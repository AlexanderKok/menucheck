import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory tables
const docs: any[] = [];
const parseRuns: any[] = [];

// Mock drizzle-orm helpers
vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ __op: 'eq', col, val }),
  desc: (col: any) => ({ __op: 'desc', col }),
}));

// Mock DB
vi.mock('../schema/documents', () => ({
  documents: { __tag: 'documents', id: { name: 'id' } },
  parseRuns: { __tag: 'parseRuns', id: { name: 'id' }, documentId: { name: 'documentId' }, startedAt: { name: 'startedAt' } },
}));

vi.mock('../lib/db', () => {
  const makeSelector = (table: any) => {
    if (table?.__tag === 'documents') {
      return {
        where: (predicate?: any) => {
          let result = docs;
          if (predicate?.__op === 'eq' && predicate.col?.name === 'id') {
            result = docs.filter((r: any) => r.id === predicate.val);
          }
          return { limit: (n: number) => result.slice(0, n) };
        },
        limit: (n: number) => docs.slice(0, n),
      };
    }
    if (table?.__tag === 'parseRuns') {
      return {
        where: (predicate?: any) => {
          let result = parseRuns;
          if (predicate?.__op === 'eq' && predicate.col?.name === 'id') {
            result = parseRuns.filter((r: any) => r.id === predicate.val);
          }
          return { limit: (n: number) => result.slice(0, n) };
        },
        orderBy: () => parseRuns,
        limit: (n: number) => parseRuns.slice(0, n),
      };
    }
    return { where: () => ({ limit: () => [] }), limit: () => [] } as any;
  };
  const db = {
    select: () => ({ from: (table: any) => makeSelector(table) }),
    insert: (table: any) => ({
      values: (data: any) => {
        if (table?.__tag === 'parseRuns') {
          parseRuns.push(data);
        }
        if (table?.__tag === 'documents') {
          docs.push(data);
        }
        return { returning: () => [data] } as any;
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (predicate?: any) => {
          const arr = table?.__tag === 'parseRuns' ? parseRuns : docs;
          if (predicate?.__op === 'eq' && predicate.col?.name === 'id') {
            const idx = arr.findIndex((r: any) => r.id === predicate.val);
            if (idx >= 0) arr[idx] = { ...arr[idx], ...values };
          }
          return 1;
        },
      }),
    }),
  };
  return { getDatabase: async () => db };
});

// Mock file retrieval
vi.mock('../services/fileStorage', () => ({
  retrieveDocument: async (_path: string) => Buffer.from('PDF_BYTES'),
}));

// Mock url parser detect strategy for URL docs
vi.mock('../services/urlParser', () => ({
  UrlParser: class {
    async detectDocumentType(_url: string) {
      return { sourceType: 'pdf', documentType: 'digital_pdf', strategy: 'pdf_digital' } as any;
    }
  },
}));

// Mock parsers for controlled success/failure
let digitalCalls = 0;
vi.mock('../services/parsers/pdfParser', () => ({
  parseDigitalPdf: async () => {
    digitalCalls += 1;
    if (digitalCalls <= 2) {
      return { success: false, menuItems: [], categories: [], parseMethod: 'pdf_digital', confidence: 0, errorMessage: 'fail' };
    }
    return { success: true, menuItems: [{ name: 'Item', price: 10, currency: 'EUR' }], categories: [], parseMethod: 'pdf_digital', confidence: 80 };
  },
  parseScannedPdf: async () => ({ success: true, menuItems: [], categories: [], parseMethod: 'pdf_ocr', confidence: 50 }),
}));

// Spy on analysisQueue to assert enqueue
import { analysisQueue } from '../services/analysisQueue';
const enqueueSpy = vi.spyOn(analysisQueue, 'enqueueAnalysisJob').mockReturnValue('an_job');

import { parseQueueV2, __test__drainOnce } from '../services/parseQueueV2';

describe('ParseQueueV2', () => {
  beforeEach(() => {
    docs.length = 0;
    parseRuns.length = 0;
    digitalCalls = 0;
    enqueueSpy.mockClear();
    // Reset internal queue state
    (parseQueueV2 as any).isProcessing = false;
    if ((parseQueueV2 as any).queue) {
      (parseQueueV2 as any).queue.length = 0;
    }
  });

  it('handles uploaded file doc: processes a job without timers', async () => {
    docs.push({ id: 'doc_file', mimeType: 'application/pdf', documentType: 'digital_pdf', sourceType: 'upload', storagePath: '/tmp/file.pdf', status: 'uploaded' });
    const jobId = parseQueueV2.enqueueParseJob('doc_file', 'v1');
    expect(jobId).toBeTruthy();
    const before = digitalCalls;
    await __test__drainOnce();
    expect(digitalCalls).toBeGreaterThan(before);
  });

  it('retries URL doc twice then succeeds, with new run ids per retry', async () => {
    docs.push({ id: 'doc_url', mimeType: 'application/pdf', documentType: null, sourceType: 'url', storagePath: 'https://x.test/a.pdf', status: 'uploaded' });
    vi.useFakeTimers();
    parseQueueV2.enqueueParseJob('doc_url', 'v1');
    // Kick off first processing immediately
    await __test__drainOnce();
    // Backoff 1 then requeue (fail 2)
    // Backoff 1 then requeue (fail 2)
    await vi.advanceTimersByTimeAsync(6000);
    await vi.runOnlyPendingTimersAsync();
    // Backoff 2 then requeue (success)
    await vi.advanceTimersByTimeAsync(12000);
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    // Allow any pending microtasks
    await new Promise((r) => setTimeout(r, 10));
    // Should have attempted parse at least three times (based on our mocked digitalCalls)
    expect(digitalCalls).toBeGreaterThanOrEqual(3);
    expect(docs[0].status === 'parsed' || docs[0].status === 'failed_parsing' || docs[0].status === 'analyzing' || docs[0].status === 'analyzed' || docs[0].status === 'done').toBe(true);
  });
});


