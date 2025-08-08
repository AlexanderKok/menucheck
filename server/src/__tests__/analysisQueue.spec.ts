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
    insert: (table: any) => ({ values: (data: any) => { if (table?.__tag === 'analysisRuns') analysisRuns.push(data); return { returning: () => [data] }; } }),
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
  });

  it('computes metrics and transitions statuses', async () => {
    docs.push({ id: 'doc1', status: 'parsed' });
    parseRuns.push({ id: 'run1', documentId: 'doc1', rawOutput: { menuItems: [ { name: 'A', price: 10, currency: 'EUR' }, { name: 'B', price: 20, currency: 'EUR', category: 'Mains' } ], confidence: 80 } });
    analysisQueue.enqueueAnalysisJob('run1', 'v1');
    await new Promise((r) => setTimeout(r, 10));
    expect(analysisRuns.length).toBe(1);
  });
});


