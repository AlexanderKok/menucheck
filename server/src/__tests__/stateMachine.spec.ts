import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory tables
const docs: any[] = [];

// Mock drizzle-orm helpers so our fake DB can understand filters
vi.mock('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ __op: 'eq', col, val }),
  desc: (col: any) => ({ __op: 'desc', col }),
}));

// Mock schema tables with tags
vi.mock('../schema/documents', () => ({
  documents: { __tag: 'documents', id: { name: 'id' } },
}));

// Mock DB to back state machine
vi.mock('../lib/db', () => {
  const makeSelector = (table: any) => {
    const data = table?.__tag === 'documents' ? docs : [];
    return {
      where: (predicate?: any) => {
        let result = data;
        if (predicate && predicate.__op === 'eq' && predicate.col && predicate.col.name === 'id') {
          result = data.filter((r: any) => r.id === predicate.val);
        }
        return {
          limit: (n: number) => result.slice(0, n),
        };
      },
      limit: (n: number) => data.slice(0, n),
    };
  };
  const db = {
    select: () => ({ from: (table: any) => makeSelector(table) }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (predicate?: any) => {
          if (table?.__tag === 'documents' && predicate?.__op === 'eq' && predicate.col?.name === 'id') {
            const idx = docs.findIndex((r: any) => r.id === predicate.val);
            if (idx >= 0) docs[idx] = { ...docs[idx], ...values };
          }
          return 1;
        },
      }),
    }),
  };
  return { getDatabase: async () => db };
});

import { transitionDocumentStatus } from '../services/stateMachine';

describe('stateMachine transitions', () => {
  beforeEach(() => {
    docs.length = 0;
    docs.push({ id: 'doc1', status: 'uploaded' });
  });

  it('allows valid transitions', async () => {
    await transitionDocumentStatus('doc1', 'queued');
    await transitionDocumentStatus('doc1', 'parsing');
    await transitionDocumentStatus('doc1', 'parsed');
    await transitionDocumentStatus('doc1', 'analyzing');
    await transitionDocumentStatus('doc1', 'analyzed');
    await transitionDocumentStatus('doc1', 'done');
    expect(docs[0].status).toBe('done');
  });

  it('rejects invalid transitions', async () => {
    await transitionDocumentStatus('doc1', 'queued');
    await transitionDocumentStatus('doc1', 'parsing');
    await transitionDocumentStatus('doc1', 'parsed');
    await expect(transitionDocumentStatus('doc1', 'uploaded' as any)).rejects.toThrow();
  });
});


