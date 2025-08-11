import { describe, it, expect, vi, beforeEach } from 'vitest';
// Stub auth to inject a user context reliably
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => { c.set('user', { id: 'user_1', email: 'u@example.com' }); return next(); },
}));
import app from '../api';

// Mock parse queue V2
vi.mock('../services/parseQueueV2', () => ({
  parseQueueV2: { enqueueParseJob: vi.fn().mockReturnValue('p2_fake') },
}));

// Mock triage to return a stable doc
vi.mock('../services/documentTriage', () => ({
  triageDocument: vi.fn(async (input: any) => ({
    documentId: 'doc_r1',
    documentType: input.type === 'url' ? 'html_static' : 'digital_pdf',
    processingStrategy: input.type === 'url' ? 'html' : 'pdf_digital',
    storageLocation: input.type === 'url' ? input.source : '/tmp/x.pdf',
    contentAnalysis: { confidence: 80 },
  })),
}));

// Mock DB
const rows: Record<string, any[]> = {
  users: [],
  menus: [],
  restaurants: [],
  publicUploads: [],
  sources: [],
  documents: [],
};

vi.mock('../lib/db', () => {
  const db = {
    select: () => ({ from: (_t: any) => ({ limit: (_n: number) => [] }) }),
    insert: (table: any) => ({ values: (data: any) => ({ returning: () => [data] }) }),
    update: () => ({ set: () => ({ where: () => 1 }) }),
  };
  return { getDatabase: async () => db };
});

// No-op extra mocks

describe('Route: parse-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('public route returns documentId and parseJobId (no legacy jobId)', async () => {
    const resp = await app.request('/api/v1/public/parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/menu', recaptchaToken: 'dev-token' }),
    });
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.documentId).toBe('doc_r1');
    expect(json.parseJobId).toBe('p2_fake');
    expect(json.jobId).toBeUndefined();
  });

  it('protected route returns documentId and parseJobId with auth', async () => {
    const req = new Request('http://localhost/api/v1/protected/menus/parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer faketoken' },
      body: JSON.stringify({ url: 'https://example.com/menu', restaurant: { name: 'Resto' } }),
    });
    const res = await app.fetch(req, { RUNTIME: 'node' } as any);
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.documentId).toBe('doc_r1');
    expect(json.parseJobId).toBe('p2_fake');
    expect(json.jobId).toBeUndefined();
  });
});


