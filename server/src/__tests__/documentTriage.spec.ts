import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory docs for triage
const docs: any[] = [];

// Mock drizzle-orm eq
vi.mock('drizzle-orm', () => ({ eq: (col: any, val: any) => ({ __op: 'eq', col, val }) }));

// Minimal schema mock exposure to allow name access
vi.mock('../schema/documents', async (orig) => {
  const mod: any = await orig();
  return { ...mod };
});

// Mock DB
vi.mock('../schema/documents', () => ({ documents: { __tag: 'documents', id: { name: 'id' } } }));

vi.mock('../lib/db', () => {
  const db = {
    insert: (table: any) => ({
      values: (data: any) => {
        if (table?.__tag === 'documents') docs.push(data);
        return { returning: () => [data] };
      },
    }),
    select: () => ({ from: (_t: any) => ({ where: () => ({ limit: () => [] }) }) }),
  };
  return { getDatabase: async () => db };
});

// Mock UrlParser.detectDocumentType for URL flow
vi.mock('../services/urlParser', () => ({
  UrlParser: class {
    async detectDocumentType(url: string) {
      if (url.endsWith('.pdf')) return { sourceType: 'pdf', documentType: 'digital_pdf', strategy: 'pdf_digital' } as any;
      return { sourceType: 'html', documentType: 'html_static', strategy: 'html' } as any;
    }
  },
}));

// Mock child_process exec for detectDocumentType(filePath,...)
vi.mock('node:child_process', () => ({
  exec: (cmd: string, cb: Function) => {
    // Simulate tools present and text present
    if (cmd.startsWith('pdfinfo')) {
      cb(null, { stdout: 'Pages: 2', stderr: '' });
      return;
    }
    if (cmd.startsWith('pdftotext')) {
      cb(null, { stdout: 'This PDF has plenty of text and prices 12.00. Lots of characters to exceed the threshold for text ratio determination.', stderr: '' });
      return;
    }
    cb(null, { stdout: '', stderr: '' });
  },
}));

import { detectDocumentType, triageDocument } from '../services/documentTriage';

describe('documentTriage', () => {
  beforeEach(() => { docs.length = 0; });

  it('detects PDF as digital when text present', async () => {
    const t = await detectDocumentType('/tmp/file.pdf', 'application/pdf');
    expect(t).toBe('digital_pdf');
  });

  it('defaults HTML mime to html_static', async () => {
    const t = await detectDocumentType('/tmp/file.html', 'text/html');
    expect(t).toBe('html_static');
  });

  it('triages URL into documents table', async () => {
    const res = await triageDocument({ type: 'url', source: 'https://x.test/menu.html' });
    expect(res.documentId).toBeDefined();
    expect(docs[0]).toBeTruthy();
    expect(docs[0].status).toBe('uploaded');
  });
});


