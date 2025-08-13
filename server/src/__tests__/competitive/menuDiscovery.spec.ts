import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverMenuUrl } from '../../services/competitive/menuDiscovery';

type FetchInput = string | URL | Request;

function makeResponse(body: string | Uint8Array, init: Partial<Response> & { status?: number; headers?: Record<string, string> } = {}) {
  const blob = typeof body === 'string' ? new Blob([body], { type: init.headers?.['content-type'] || 'text/plain' }) : new Blob([body]);
  const r = new Response(blob, { status: init.status ?? 200, headers: init.headers });
  return r;
}

function htmlResponse(html: string) {
  return makeResponse(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

function pdfResponse(prefix = '%PDF-1.7\n') {
  return makeResponse(prefix + ' PDF content', {});
}

describe('menuDiscovery', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-ignore
    global.fetch = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('finds header anchor with Dutch keyword and validates via HEAD then GET', async () => {
    const homepageHtml = '<html><body><header><a href="/menukaart" title="Onze menukaart">Menukaart</a></header></body></html>';
    const headOk = new Response(null as any, { status: 405, headers: { 'content-type': 'text/plain' } });
    const getOk = htmlResponse('<html></html>');
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse(homepageHtml)) // GET homepage
      .mockResolvedValueOnce(headOk) // HEAD candidate
      .mockResolvedValueOnce(getOk); // GET candidate fallback

    const res = await discoverMenuUrl('https://example.com');
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('header');
    expect(res.url).toContain('/menukaart');
  });

  it('prefers HTML over PDF within same scope', async () => {
    const homepageHtml = '<html><body><nav><a href="/menu.pdf">Menu</a><a href="/menu">Menu</a></nav></body></html>';
    const headPdf = new Response(null as any, { status: 200, headers: { 'content-type': 'application/pdf' } });
    const headHtml = new Response(null as any, { status: 200, headers: { 'content-type': 'text/html' } });
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse(homepageHtml))
      .mockResolvedValueOnce(headPdf) // HEAD /menu.pdf
      .mockResolvedValueOnce(headHtml); // HEAD /menu

    const res = await discoverMenuUrl('https://example.com');
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('nav');
    expect(res.url).toContain('/menu');
    expect(res.isPdf).toBe(false);
  });

  it('matches on attributes and diacritics in nav', async () => {
    const homepage = 'https://attr.com';
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse('<html><nav><a href="/kaart" title="Dránkkaart" aria-label="Wijnkaart" data-menu="true">X</a></nav></html>'))
      .mockResolvedValueOnce(htmlResponse('<html>kaart</html>'));
    const res = await discoverMenuUrl(homepage);
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('nav');
  });

  it('returns link_text when discovered in body/main', async () => {
    const homepage = 'https://body.com';
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse('<html><body><main><a href="/menu">Menu</a></main></body></html>'))
      .mockResolvedValueOnce(new Response(null as any, { status: 200, headers: { 'content-type': 'text/html' } }));
    const res = await discoverMenuUrl(homepage);
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('link_text');
    expect(res.url).toContain('/menu');
  });

  it('skips mailto/tel/#fragment and falls back to slug', async () => {
    const homepage = 'https://slug.com';
    const notFound = new Response(null as any, { status: 404 });
    const okHtml = new Response(null as any, { status: 200, headers: { 'content-type': 'text/html' } });
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse('<html><main>\n<a href="mailto:test@slug.com">Email</a>\n<a href="tel:+3112345678">Phone</a>\n<a href="#menu">Menu Fragment</a>\n</main></html>')) // GET homepage
      // Sitemaps missing
      .mockResolvedValueOnce(notFound) // GET /sitemap.xml
      .mockResolvedValueOnce(notFound) // GET /sitemap_index.xml
      // No anchor validation calls
      .mockResolvedValueOnce(notFound) // HEAD /menu
      .mockResolvedValueOnce(okHtml); // GET /menu (fallback)
    const res = await discoverMenuUrl(homepage);
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('slug');
    expect(res.url).toBe('https://slug.com/menu');
  });

  it('sitemap fallback returns validated metadata and URL', async () => {
    const homepageHtml = '<html><body>No links</body></html>';
    const sitemapXml = `<?xml version="1.0"?><urlset><url><loc>https://example.com/menukaart</loc></url></urlset>`;
    const headOk = new Response(null as any, { status: 200, headers: { 'content-type': 'text/html' } });
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse(homepageHtml)) // GET homepage
      .mockResolvedValueOnce(makeResponse(sitemapXml, { status: 200, headers: { 'content-type': 'application/xml' } })) // GET /sitemap.xml
      .mockResolvedValueOnce(headOk); // HEAD candidate

    const res = await discoverMenuUrl('https://example.com');
    expect(res.isValid).toBe(true);
    expect(res.method).toBe('sitemap');
    expect(res.url).toContain('/menukaart');
    expect(res.httpStatus).toBe(200);
    expect(res.contentType?.includes('html')).toBe(true);
  });

  it('content sniffing detects PDF when header missing', async () => {
    const homepageHtml = '<html><footer><a href="/menu.pdf">Menu</a></footer></html>';
    const noType = new Response(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])]) as any, { status: 200 }); // %PDF-
    // @ts-ignore
    global.fetch
      .mockResolvedValueOnce(htmlResponse(homepageHtml))
      .mockResolvedValueOnce(noType) // HEAD
      .mockResolvedValueOnce(noType); // GET fallback
    const res = await discoverMenuUrl('https://example.com');
    expect(res.isValid).toBe(true);
    expect(res.isPdf).toBe(true);
    expect(res.method).toBe('footer');
  });
});
