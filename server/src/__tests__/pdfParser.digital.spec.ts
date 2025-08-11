import { describe, it, expect, vi } from 'vitest';

// Mock pdfjs to provide deterministic layout
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [
            // Column 1 tokens (x ~ 50)
            { str: 'STARTERS', transform: [1,0,0,1,50,800] },
            { str: 'Soup', transform: [1,0,0,1,50,780] },
            { str: '€5.00', transform: [1,0,0,1,150,780] },
            { str: 'Salad', transform: [1,0,0,1,50,760] },
            { str: '€7.00', transform: [1,0,0,1,150,760] },
            // Column 2 tokens (x ~ 350)
            { str: 'MAINS', transform: [1,0,0,1,350,800] },
            { str: 'Steak', transform: [1,0,0,1,350,780] },
            { str: '€20.00', transform: [1,0,0,1,460,780] },
          ],
        }),
      }),
    }),
  }),
}));

import { parseDigitalPdf } from '../services/parsers/pdfParser';

describe('pdfParser digital layout metadata', () => {
  it('emits layout metadata with at least two columns detected', async () => {
    const result: any = await parseDigitalPdf('', 'ZmFrZV9iYXNlNjQ=');
    expect(result.success).toBe(true);
    expect(result.layoutMetadata).toBeTruthy();
    expect(result.layoutMetadata.columnCount).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(result.layoutMetadata.columnBoundaries)).toBe(true);
    expect(result.layoutMetadata.linesSample.length).toBeGreaterThan(0);
    expect(result.layoutMetadata.totalLines).toBeGreaterThan(0);
    expect(result.layoutMetadata.bandSize).toBeGreaterThan(0);
  });

  it('falls back to single column when gaps are small', async () => {
    await vi.resetModules();
    await vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [
                { str: 'STARTERS', transform: [1,0,0,1,50,800] },
                { str: 'Soup', transform: [1,0,0,1,50,780] },
                { str: '€5.00', transform: [1,0,0,1,120,780] },
                { str: 'Salad', transform: [1,0,0,1,50,760] },
                { str: '€7.00', transform: [1,0,0,1,120,760] },
              ],
            }),
          }),
        }),
      }),
    }));
    const { parseDigitalPdf: parseOnce } = await import('../services/parsers/pdfParser');
    const result: any = await parseOnce('', 'ZmFrZV9iYXNlNjQ=');
    expect(result.layoutMetadata).toBeTruthy();
    expect(result.layoutMetadata.columnCount).toBe(1);
    expect(Array.isArray(result.layoutMetadata.columnBoundaries)).toBe(true);
  });
});


