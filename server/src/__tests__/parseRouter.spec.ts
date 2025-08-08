import { describe, it, expect } from 'vitest';
import { routeToParser } from '../services/parseRouter';

describe('routeToParser', () => {
  it('maps PDFs correctly', () => {
    expect(routeToParser('digital_pdf' as any, 'application/pdf')).toBe('pdf_digital');
    expect(routeToParser('scanned_pdf' as any, 'application/pdf')).toBe('pdf_ocr');
  });

  it('maps HTML correctly', () => {
    expect(routeToParser('html_static' as any, 'text/html')).toBe('html');
    expect(routeToParser('html_dynamic' as any, 'text/html')).toBe('javascript');
  });

  it('throws on unsupported', () => {
    expect(() => routeToParser('html_static' as any, 'application/json')).toThrow();
  });
});


