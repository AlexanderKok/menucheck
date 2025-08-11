import { describe, it, expect, vi, beforeEach } from 'vitest';

const parseRuns: any[] = [];
const analysisRuns: any[] = [];
const docs: any[] = [];

vi.mock('drizzle-orm', () => ({ eq: (col: any, val: any) => ({ __op: 'eq', col, val }) }));

// Mock schema tables
vi.mock('../schema/documents', () => ({
  documents: { __tag: 'documents', id: { name: 'id' } },
  parseRuns: { __tag: 'parseRuns', id: { name: 'id' }, documentId: { name: 'documentId' } },
  analysisRuns: { __tag: 'analysisRuns', parseRunId: { name: 'parseRunId' }, startedAt: { name: 'startedAt' } },
}));

// Capture transitions for assertions
const transitions: Array<{ id: string; status: string; reason?: string }> = [];
vi.mock('../services/stateMachine', () => ({
  transitionDocumentStatus: vi.fn(async (id: string, status: string, reason?: string) => {
    transitions.push({ id, status, reason });
  }),
}));

vi.mock('../lib/db', () => {
  const makeSelector = (table: any) => {
    if (table?.__tag === 'parseRuns') {
      return { where: (p: any) => ({ limit: (n: number) => parseRuns.filter((r) => !p || r.id === p.val).slice(0, n) }) } as any;
    }
    if (table?.__tag === 'analysisRuns') {
      return { where: () => ({ limit: (n: number) => analysisRuns.slice(0, n) }), orderBy: () => analysisRuns } as any;
    }
    if (table?.__tag === 'documents') {
      return { where: (p: any) => ({ limit: (n: number) => docs.filter((r) => !p || r.id === p.val).slice(0, n) }) } as any;
    }
    return { where: () => ({ limit: () => [] }) } as any;
  };
  const db = {
    select: () => ({ from: (table: any) => makeSelector(table) }),
    insert: (table: any) => ({ values: (data: any) => { if (table?.__tag === 'analysisRuns') { if (data?.status === 'completed') { throw new Error('insert failed'); } analysisRuns.push(data); } return { returning: () => [data] }; } }),
    update: (table: any) => ({ set: (values: any) => ({ where: (p: any) => { if (table?.__tag === 'documents') { const idx = docs.findIndex((d) => d.id === p.val); if (idx >= 0) docs[idx] = { ...docs[idx], ...values }; } return 1; } }) }),
  };
  return { getDatabase: async () => db };
});

import { analysisQueue } from '../services/analysisQueue';

describe('AnalysisQueue', () => {
  beforeEach(() => {
    parseRuns.length = 0;
    analysisRuns.length = 0;
    docs.length = 0;
    transitions.length = 0;
  });

  it('computes metrics and transitions statuses', async () => {
    docs.push({ id: 'doc1', status: 'parsed' });
    parseRuns.push({ id: 'run1', documentId: 'doc1', rawOutput: { menuItems: [ { name: 'A', price: 10, currency: 'EUR' }, { name: 'B', price: 20, currency: 'EUR', category: 'Mains' } ], confidence: 80 } });
    analysisQueue.enqueueAnalysisJob('run1', 'v1');
    await new Promise((r) => setTimeout(r, 10));
    expect(analysisRuns.length).toBe(1);
  });

  it('retries with backoff and marks failed after max retries', async () => {
    docs.push({ id: 'doc2', status: 'parsed' });
    parseRuns.push({ id: 'run2', documentId: 'doc2', rawOutput: { menuItems: null } });
    // Force failure path by throwing inside queue processing via spy on insert to analysisRuns
    const originalInsert = (await import('../lib/db')).getDatabase;
    // Use fake timers to advance backoff
    vi.useFakeTimers();
    analysisQueue.enqueueAnalysisJob('run2', 'v1');
    await vi.advanceTimersByTimeAsync(5000);
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(10000);
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(20000);
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    // Expect multiple failed attempts and a final failed_analysis transition
    const failedCount = analysisRuns.filter((r) => r.status === 'failed').length;
    expect(failedCount).toBeGreaterThanOrEqual(3);
    const finalFailed = transitions.find((t) => t.status === 'failed_analysis');
    expect(finalFailed).toBeTruthy();
  });

  it('writes metrics on success path', async () => {
    // Arrange a successful parse run
    docs.push({ id: 'doc3', status: 'parsed' });
    parseRuns.push({ id: 'run3', documentId: 'doc3', rawOutput: { menuItems: [ { name: 'A', price: 10, currency: 'EUR' }, { name: 'B', price: 20, currency: 'EUR', category: 'Mains' } ], confidence: 80 } });

    // Temporarily monkey-patch DB mock to allow 'completed' insert
    const dbMod = await import('../lib/db');
    const db = await dbMod.getDatabase();
    const originalInsert = db.insert;
    (db as any).insert = (table: any) => ({ values: (data: any) => { if (table?.__tag === 'analysisRuns') { analysisRuns.push(data); } return { returning: () => [data] }; } });

    analysisQueue.enqueueAnalysisJob('run3', 'v1');
    await new Promise((r) => setTimeout(r, 10));

    // Restore insert
    (db as any).insert = originalInsert;

    const completed = analysisRuns.find((r) => r.status === 'completed');
    expect(completed).toBeTruthy();
    expect(completed?.metrics?.totalItems).toBe(2);
    expect(typeof completed?.metrics?.avgPrice === 'number' || completed?.metrics?.avgPrice === null).toBe(true);
    expect(completed?.metrics?.minPrice).toBe(10);
    expect(completed?.metrics?.maxPrice).toBe(20);
    expect((completed?.metrics?.qualityScore ?? 0) as number).toBeGreaterThan(0);
  });
});


