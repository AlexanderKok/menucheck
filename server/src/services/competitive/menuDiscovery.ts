import type { MenuDiscoveryResult } from '../../types/competitive';
import { getEnv } from '../../lib/env';
import cheerio from 'cheerio';

const MENU_TEXTS = ['menu', 'menukaart', 'kaart'];

export async function discoverMenuUrl(homepageUrl: string): Promise<MenuDiscoveryResult> {
  const timeoutMs = Number(getEnv('HTTP_DEFAULT_TIMEOUT_MS') || '15000');
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(homepageUrl, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' } });
    if (!resp.ok) {
      return { isValid: false, httpStatus: resp.status };
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const anchors: Array<{ href: string; text: string }> = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = ($(el).text() || '').trim();
      const title = ($(el).attr('title') || '').trim();
      const aria = ($(el).attr('aria-label') || '').trim();
      const combined = [text, title, aria].join(' ').toLowerCase();
      if (MENU_TEXTS.some((t) => combined.includes(t))) {
        anchors.push({ href, text: combined });
      }
    });
    const base = new URL(homepageUrl);
    for (const a of anchors) {
      const candidate = new URL(a.href, base).toString();
       const check = await fetch(candidate, { method: 'HEAD', headers: { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' } });
      let contentType = check.headers.get('content-type') || undefined;
      let status = check.status;
      if (!check.ok || status === 405 || status >= 400) {
        const getResp = await fetch(candidate, { headers: { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' } });
        contentType = getResp.headers.get('content-type') || contentType;
        status = getResp.status;
      }
      const isPdf = !!contentType && /application\/pdf/i.test(contentType);
      const isHtml = !!contentType && /text\/html|application\/(xhtml\+xml|html)/i.test(contentType);
      const valid = (status >= 200 && status < 300) && (isPdf || isHtml);
      if (valid) {
        return {
          url: candidate,
          method: 'link_text',
          httpStatus: status,
          contentType,
          isPdf,
          isValid: true,
        };
      }
    }
    // Fallback: try common slugs
    const slugs = ['/menu', '/menukaart', '/kaart'];
    for (const slug of slugs) {
      const candidate = new URL(slug, base).toString();
      const check = await fetch(candidate, { method: 'HEAD', headers: { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' } });
      const contentType = check.headers.get('content-type') || undefined;
      const isPdf = !!contentType && /application\/pdf/i.test(contentType);
      const isHtml = !!contentType && /text\/html|application\/(xhtml\+xml|html)/i.test(contentType);
      const valid = check.status >= 200 && check.status < 300 && (isPdf || isHtml);
      if (valid) {
        return { url: candidate, method: 'slug_guess', httpStatus: check.status, contentType, isPdf, isValid: true };
      }
    }
    return { isValid: false };
  } catch {
    return { isValid: false };
  } finally {
    clearTimeout(to);
  }
}



