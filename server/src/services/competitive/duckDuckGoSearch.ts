import * as cheerio from 'cheerio';
import { getEnv, getHttpTimeoutMs } from '../../lib/env';

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const NEGATIVE_SITES = [
  'facebook.com', 'm.facebook.com', 'instagram.com', 'tripadvisor.com', 'thefork.nl', 'ubereats.com', 'yelp.com', 'thuisbezorgd.nl', 'deliveroo.nl'
];

function normalizeToken(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreCandidate(url: string, titleText: string | undefined, name: string, city?: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let score = 0;
    if (host.endsWith('.nl')) score += 2;
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (host.replace(/[^a-z0-9]+/g, '').includes(normalizedName)) score += 3;
    if (NEGATIVE_SITES.some((k) => host.includes(k.replace(/\s+/g, '')))) score -= 5;

    // Title signals: prefer results whose title mentions the name or city
    if (titleText) {
      const t = normalizeToken(titleText);
      const nameTokens = normalizeToken(name).split(' ').filter(Boolean);
      const cityTokens = city ? normalizeToken(city).split(' ').filter(Boolean) : [];
      if (nameTokens.some((tok) => t.includes(tok))) score += 2;
      if (cityTokens.length > 0 && cityTokens.some((tok) => t.includes(tok))) score += 2;
    }
    if (city) {
      const cityCompact = city.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (cityCompact && host.replace(/[^a-z0-9]+/g, '').includes(cityCompact)) score += 1;
    }
    return score;
  } catch {
    return 0;
  }
}

export type DuckOptions = {
  rateRps?: number;
  jitterMs?: number;
};

let lastCallAt = 0;

async function rateLimit(rps: number, jitterMs: number) {
  const minInterval = 1000 / Math.max(0.01, rps);
  const now = Date.now();
  const elapsed = now - lastCallAt;
  const wait = Math.max(0, minInterval - elapsed) + Math.floor(Math.random() * jitterMs);
  if (wait > 0) await delay(wait);
  lastCallAt = Date.now();
}

export async function search(name: string, city?: string, opts: DuckOptions = {}): Promise<string[]> {
  const rps = Number(getEnv('FALLBACK_SEARCH_RATE_RPS') || opts.rateRps || '0.2');
  const jitter = 250 + (opts.jitterMs || 0);
  // Force intent by including the term "restaurant"
  const q = `${name} restaurant ${city || ''} -site:facebook.com -site:instagram.com -site:tripadvisor.com -site:thefork.nl -site:ubereats.com -site:yelp.com -site:thuisbezorgd.nl -site:deliveroo.nl`.trim();
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=nl-nl`; // HTML-only results
  await rateLimit(rps, jitter);

  const controller = new AbortController();
  const timeoutMs = getHttpTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' };
  try {
    const resp = await fetch(url, { method: 'GET', signal: controller.signal, headers });
    const html = await resp.text();
    // Basic block detection
    if (resp.status === 429 || /captcha|unusual|block/i.test(html)) {
      // backoff
      await delay(10_000);
      return [];
    }
    const $ = cheerio.load(html);
    const links: { href: string; text: string; score: number }[] = [];
    // Support both classic and new DDG HTML selectors
    $('a.result__a, a.result__title, a.result__url, a[class*="result__a" i]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if (!href) return;
      try {
        const url = new URL(href, 'https://duckduckgo.com');
        const target = url.searchParams.get('uddg') || href; // DDG encodes outbound URLs in some cases
        const s = scoreCandidate(target, text, name, city);
        if (s > -5) links.push({ href: target, text, score: s });
      } catch {}
    });
    // Fallback selector
    if (links.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (/duckduckgo\.com\/y\?/.test(href)) {
          try {
            const u = new URL(href, 'https://duckduckgo.com');
            const target = u.searchParams.get('uddg');
          if (target) {
            const s = scoreCandidate(target, $(el).text(), name, city);
              if (s > -5) links.push({ href: target, text: $(el).text(), score: s });
            }
          } catch {}
        }
      });
    }

    links.sort((a, b) => b.score - a.score);
    const maxCandidates = Number(getEnv('FALLBACK_SEARCH_MAX_CANDIDATES') || '5');
    const unique = links.map((l) => l.href).filter((u, i, arr) => arr.indexOf(u) === i);
    return unique.slice(0, maxCandidates);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}


