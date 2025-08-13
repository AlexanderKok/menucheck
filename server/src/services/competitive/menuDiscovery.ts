import type { MenuDiscoveryResult } from '../../types/competitive';
import { getEnv, getHttpTimeoutMs } from '../../lib/env';
import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

type AnchorCandidate = {
  absoluteUrl: string;
  sourceMethod: 'header' | 'nav' | 'footer' | 'link_text';
};

function toMatchKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const KEYWORDS = [
  'menu', 'menukaart', 'kaart', 'eten', 'dranken', 'drankkaart', 'wijnkaart',
  'borrel', 'lunch', 'diner', 'gerechten', 'assortiment', 'kaart-en-prijzen',
  'menu-en-prijzen', 'food', 'drinks', 'beverage', 'wine list'
].map(toMatchKey);

function textMatchesMenuKeywords(input: string): boolean {
  const key = toMatchKey(input || '');
  return KEYWORDS.some((kw) => key.includes(kw));
}

function isHttpLike(u: URL): boolean {
  return u.protocol === 'http:' || u.protocol === 'https:';
}

function candidateKey(u: URL): string {
  return `${u.host}${u.pathname}`;
}

async function validateCandidate(url: string, preferBodySniff = false): Promise<{
  ok: boolean;
  httpStatus?: number;
  contentType?: string;
  isPdf?: boolean;
  isHtml?: boolean;
  effectiveUrl?: string;
}> {
  const timeoutMs = getHttpTimeoutMs();
  const headers: Record<string, string> = { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' };
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // First try HEAD unless caller prefers body sniffing straight away
    let resp = await fetch(url, { method: preferBodySniff ? 'GET' : 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    let finalUrl = (resp as any).url || url;
    let contentType = resp.headers.get('content-type') || undefined;
    let status = resp.status;
    let isPdf = !!contentType && /application\/pdf/i.test(contentType);
    let isHtml = !!contentType && /text\/html|application\/(xhtml\+xml|html)/i.test(contentType);

    const needGet = preferBodySniff || !resp.ok || resp.status === 405 || resp.status >= 400 || !contentType || (!isPdf && !isHtml);
    if (needGet) {
      resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
      finalUrl = (resp as any).url || url;
      status = resp.status;
      contentType = resp.headers.get('content-type') || contentType;
      isPdf = !!contentType && /application\/pdf/i.test(contentType);
      isHtml = !!contentType && /text\/html|application\/(xhtml\+xml|html)/i.test(contentType);
      if (!contentType || (!isPdf && !isHtml)) {
        try {
          const ab = await resp.arrayBuffer();
          const bytes = new Uint8Array(ab.slice(0, 4096));
          const text = new TextDecoder('utf-8').decode(bytes);
          if (text.trimStart().startsWith('%PDF-')) {
            isPdf = true; isHtml = false; contentType = contentType || 'application/pdf';
          } else if (/<!doctype html|<html/i.test(text)) {
            isHtml = true; isPdf = false; contentType = contentType || 'text/html';
          }
        } catch {}
      }
    }

    const ok = (status >= 200 && status < 300) && (isPdf || isHtml);
    return { ok, httpStatus: status, contentType, isPdf, isHtml, effectiveUrl: finalUrl };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(to);
  }
}

export async function discoverMenuUrl(homepageUrl: string): Promise<MenuDiscoveryResult> {
  const timeoutMs = getHttpTimeoutMs();
  const headers: Record<string, string> = { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' };
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(homepageUrl, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    if (!resp.ok) return { isValid: false, httpStatus: resp.status };
    const html = await resp.text();
    const $ = load(html);
    const baseUrl = new URL((resp as any).url || homepageUrl);

    const scopes: Array<{ selector: string; method: AnchorCandidate['sourceMethod'] } > = [
      { selector: 'header a', method: 'header' },
      { selector: 'nav a', method: 'nav' },
      { selector: 'footer a', method: 'footer' },
      { selector: 'main a, body a', method: 'link_text' },
    ];

    const seen = new Set<string>();
    const groups: Record<string, AnchorCandidate[]> = { header: [], nav: [], footer: [], link_text: [] };

    for (const { selector, method } of scopes) {
      $(selector).each((_idx: number, el: any) => {
        const hrefRaw = ($(el).attr('href') || '').trim();
        if (!hrefRaw) return;
        try {
          const resolved = new URL(hrefRaw, baseUrl);
          if (!isHttpLike(resolved)) return;
          if (/^mailto:|^tel:/i.test(hrefRaw)) return;
          if (resolved.hash && (resolved.pathname === baseUrl.pathname || (resolved.origin + resolved.pathname) === (baseUrl.origin + baseUrl.pathname))) return;

          const text = ($(el).text() || '').trim();
          const title = ($(el).attr('title') || '').trim();
          const aria = ($(el).attr('aria-label') || '').trim();
          const dataAttrs: string[] = [];
          const attribs = (el as any).attribs || {};
          Object.keys(attribs).forEach((name) => {
            if (name && name.toLowerCase().startsWith('data-')) {
              dataAttrs.push(String((attribs as any)[name] || ''));
            }
          });
          const combined = [text, title, aria, ...dataAttrs].join(' ');
          if (!textMatchesMenuKeywords(combined)) return;

          const key = candidateKey(resolved);
          if (seen.has(key)) return;
          seen.add(key);
          groups[method].push({ absoluteUrl: resolved.toString(), sourceMethod: method });
        } catch {}
      });
    }

    const validateGroup = async (cands: AnchorCandidate[]): Promise<MenuDiscoveryResult | null> => {
      let pdfResult: MenuDiscoveryResult | null = null;
      for (const c of cands) {
        const vr = await validateCandidate(c.absoluteUrl);
        if (vr.ok) {
          if (vr.isHtml) {
            return { url: vr.effectiveUrl || c.absoluteUrl, method: c.sourceMethod, httpStatus: vr.httpStatus, contentType: vr.contentType, isPdf: false, isValid: true };
          } else if (vr.isPdf && !pdfResult) {
            pdfResult = { url: vr.effectiveUrl || c.absoluteUrl, method: c.sourceMethod, httpStatus: vr.httpStatus, contentType: vr.contentType, isPdf: true, isValid: true };
          }
        }
      }
      return pdfResult;
    };

    for (const group of [groups.header, groups.nav, groups.footer, groups.link_text]) {
      const res = await validateGroup(group);
      if (res) return res;
    }

    // Sitemap fallback
    const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true, parseTagValue: true, parseAttributeValue: true });
    const discovered: string[] = [];
    // Try sitemap.xml first
    let loadedPrimary = false;
    try {
      const r = await fetch(new URL('/sitemap.xml', baseUrl).toString(), { method: 'GET', redirect: 'follow', headers });
      if (r.ok) {
        const xml = await r.text();
        const obj = parser.parse(xml);
        const addLocs = (o: any) => {
          if (!o) return;
          if (o.urlset && Array.isArray(o.urlset.url)) {
            for (const u of o.urlset.url) {
              if (u.loc) discovered.push(String(u.loc));
            }
          } else if (o.urlset && o.urlset.url && o.urlset.url.loc) {
            discovered.push(String(o.urlset.url.loc));
          }
        };
        addLocs(obj);
        loadedPrimary = true;
      }
    } catch {}
    // If primary not available or provided no urls, try sitemap_index.xml
    if (!loadedPrimary || discovered.length === 0) {
      try {
        const r = await fetch(new URL('/sitemap_index.xml', baseUrl).toString(), { method: 'GET', redirect: 'follow', headers });
        if (r.ok) {
          const xml = await r.text();
          const obj = parser.parse(xml);
          if (obj && obj.sitemapindex) {
            const sitemaps = Array.isArray(obj.sitemapindex.sitemap) ? obj.sitemapindex.sitemap : [obj.sitemapindex.sitemap];
            for (const sm of sitemaps) {
              if (sm && sm.loc) discovered.push(String(sm.loc));
            }
          }
        }
      } catch {}
    }

    const nested = discovered.filter((u) => u.endsWith('.xml'));
    for (const u of nested.slice(0, 10)) {
      try {
        const r = await fetch(u, { method: 'GET', redirect: 'follow', headers });
        if (!r.ok) continue;
        const xml = await r.text();
        const obj = parser.parse(xml);
        if (obj && obj.urlset) {
          const urls = Array.isArray(obj.urlset.url) ? obj.urlset.url : [obj.urlset.url];
          for (const entry of urls) {
            if (entry && entry.loc) discovered.push(String(entry.loc));
          }
        }
      } catch {}
    }

    const filtered = discovered
      .filter((u) => {
        try {
          const uu = new URL(u);
          return isHttpLike(uu) && textMatchesMenuKeywords(decodeURIComponent(uu.pathname));
        } catch { return false; }
      })
      .filter((u, idx, arr) => {
        try {
          const key = candidateKey(new URL(u));
          return arr.findIndex((x) => {
            try { return candidateKey(new URL(x)) === key; } catch { return false; }
          }) === idx;
        } catch { return false; }
      });

    type Validated = { url: string; httpStatus?: number; contentType?: string; isPdf: boolean };
    const sitemapHtmlFirst: Validated[] = [];
    const sitemapPdfSecond: Validated[] = [];
    for (const u of filtered) {
      const vr = await validateCandidate(u);
      if (vr.ok) {
        const record: Validated = {
          url: vr.effectiveUrl || u,
          httpStatus: vr.httpStatus,
          contentType: vr.contentType,
          isPdf: !!vr.isPdf,
        };
        if (vr.isHtml) sitemapHtmlFirst.push(record);
        else if (vr.isPdf) sitemapPdfSecond.push(record);
      }
    }
    if (sitemapHtmlFirst[0]) {
      const best = sitemapHtmlFirst[0];
      return { url: best.url, method: 'sitemap', httpStatus: best.httpStatus, contentType: best.contentType, isPdf: false, isValid: true };
    }
    if (sitemapPdfSecond[0]) {
      const best = sitemapPdfSecond[0];
      return { url: best.url, method: 'sitemap', httpStatus: best.httpStatus, contentType: best.contentType, isPdf: true, isValid: true };
    }

    // Slug fallback
    const slugs = ['/menu', '/menukaart', '/kaart', '/eten', '/dranken', '/drankkaart', '/wijnkaart', '/lunch', '/diner', '/food', '/drinks', '/menu-en-prijzen', '/kaart-en-prijzen'];
    for (const slug of slugs) {
      const candidate = new URL(slug, baseUrl);
      const vr = await validateCandidate(candidate.toString());
      if (vr.ok) {
        return { url: vr.effectiveUrl || candidate.toString(), method: 'slug', httpStatus: vr.httpStatus, contentType: vr.contentType, isPdf: !!vr.isPdf, isValid: true };
      }
    }

    return { isValid: false };
  } catch {
    return { isValid: false };
  } finally {
    clearTimeout(to);
  }
}



