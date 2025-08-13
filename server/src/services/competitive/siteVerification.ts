import * as cheerio from 'cheerio';
import { getEnv, getHttpTimeoutMs } from '../../lib/env';

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

function normalize(input: string | undefined | null): string {
  if (!input) return '';
  const lowered = stripDiacritics(String(input).toLowerCase());
  return lowered.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsNumericRun(text: string, digits: number): boolean {
  return new RegExp(`\\d{${digits},}`).test(text.replace(/\D+/g, ''));
}

function fuzzySimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const inter = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union;
}

// Generic words we want to ignore when matching names
const GENERIC_BUSINESS_WORDS = new Set([
  'restaurant','eetcafe','cafe','cafeteria','bistro','brasserie','bar','grill','kitchen','keuken','lounge','pizzeria','sushi','ramen','thai','thais','indonesian','indonesisch','indian','indiaas','chinese','chinees','pizza','burger','steakhouse','steak','bakery','bakkerij','broodjes','doner','döner'
]);

function getCoreTokens(text: string): string[] {
  return text
    .split(' ')
    .filter((tok) => tok && !GENERIC_BUSINESS_WORDS.has(tok));
}

export function extractVisibleText($: cheerio.CheerioAPI): string {
  // Basic extraction of text without scripts/styles
  $('script, style, noscript, svg').remove();
  const bodyText = $('body').text() || '';
  // Bound length to avoid heavy scoring on very large pages
  return bodyText.substring(0, 200_000);
}

export function computeMatchScore(
  url: string,
  html: string,
  expected: { name: string; street?: string; housenumber?: string; postcode?: string; city?: string; phone?: string }
): number {
  const $ = cheerio.load(html);
  const title = $('title').text();
  const h1 = $('h1').first().text();
  const text = extractVisibleText($);

  const nName = normalize(expected.name);
  const nTitle = normalize(title);
  const nH1 = normalize(h1);
  const nText = normalize(text);
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
  const hostCompact = host.replace(/[^a-z0-9]+/g, '');
  const nameCompact = nName.replace(/\s+/g, '');
  const coreNameTokens = getCoreTokens(nName);
  const coreNameCompact = coreNameTokens.join('');

  let score = 0;

  // Hostname includes normalized name or core name (ignoring generic words)
  if (hostCompact.includes(nameCompact) || nameCompact.includes(hostCompact)) score += 30;
  else if (coreNameCompact && hostCompact.includes(coreNameCompact)) score += 28;
  else if (coreNameTokens.some((tok) => hostCompact.includes(tok))) score += 22;

  // Title/H1 fuzzy similarity
  const coreJoined = coreNameTokens.join(' ');
  const simTitle = Math.max(fuzzySimilarity(nTitle, nName), fuzzySimilarity(nTitle, coreJoined));
  const simH1 = Math.max(fuzzySimilarity(nH1, nName), fuzzySimilarity(nH1, coreJoined));
  if (Math.max(simTitle, simH1) >= 0.6) score += 20;
  // Direct core token presence in title/h1
  if (coreNameTokens.length > 0) {
    const coreInTitle = coreNameTokens.some((tok) => nTitle.includes(tok));
    const coreInH1 = coreNameTokens.some((tok) => nH1.includes(tok));
    if (coreInTitle || coreInH1) score += 15;
  }

  // Address components
  const nStreet = normalize(expected.street);
  const nHouse = normalize(expected.housenumber);
  const nPostcode = normalize(expected.postcode);
  const nCity = normalize(expected.city);

  if (nStreet && nText.includes(nStreet) && nHouse && nText.includes(nHouse)) score += 25;
  if (nPostcode && /\b[1-9][0-9]{3}\s?[a-z]{2}\b/.test(nText)) score += 15;
  if (nCity && nText.includes(nCity)) score += 10;
  // If page text includes the core name tokens, boost
  if (coreNameTokens.length > 0 && coreNameTokens.some((tok) => nText.includes(tok))) score += 10;

  // Phone digits overlap
  const phoneDigits = (expected.phone || '').replace(/\D+/g, '');
  if (phoneDigits && containsNumericRun(phoneDigits, 6)) score += 10;

  // Penalize aggregator keywords and hosts
  const negative = ['facebook', 'instagram', 'tripadvisor', 'thuisbezorgd', 'deliveroo', 'ubereats', 'yelp', 'thefork', 'restaurantgids', 'cylex', 'oozo', 'telefoonboek', 'eet.nu', 'resto.nl', 'restaurants.nl'];
  if (negative.some((k) => nText.includes(k))) score -= 20;
  if (isAggregatorHost(url)) score -= 60;

  // Clamp 0-100
  return Math.max(0, Math.min(100, score));
}

export async function fetchHtml(url: string): Promise<{ html?: string; status?: number; contentType?: string; effectiveUrl?: string; error?: string }>
{
  const timeoutMs = getHttpTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' };
  try {
    const resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    const contentType = resp.headers.get('content-type') || undefined;
    const html = contentType && /html/i.test(contentType) ? await resp.text() : undefined;
    return { html, status: resp.status, contentType, effectiveUrl: resp.url };
  } catch (e: any) {
    return { error: e?.message || 'request_failed' };
  } finally {
    clearTimeout(timeout);
  }
}

const AGGREGATOR_HOSTS = [
  'restaurantgids.nl', 'restaurants.nl', 'cylex.nl', 'oozo.nl', 'telefoonboek.nl', 'resto.nl', 'eet.nu', 'linkedin.com', "tripadvisor.com", "yelp.com", "ubereats.com", "thuisbezorgd.nl", "deliveroo.nl", "thefork.nl"
];

export function isAggregatorHost(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}


