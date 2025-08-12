import { getEnv } from '../../lib/env';

const NEGATIVE_KEYWORDS = ['facebook', 'instagram', 'tripadvisor', 'thuisbezorgd', 'deliveroo', 'ubereats', 'uber eats', 'yelp', 'thefork'];

function scoreDomain(url: string, name: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let score = 0;
    if (host.endsWith('.nl')) score += 2;
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (host.replace(/[^a-z0-9]+/g, '').includes(normalizedName)) score += 3;
    if (NEGATIVE_KEYWORDS.some((k) => host.includes(k.replace(/\s+/g, '')))) score -= 5;
    return score;
  } catch {
    return 0;
  }
}

// Simple in-memory cache per process. For durability, we could persist to DB ext_restaurant_checks or ext_restaurants by name/city.
const memoryCache = new Map<string, string>();

export async function searchOfficialSite(name: string, city: string, budget: { remaining: number } = { remaining: 3 }): Promise<string | null> {
  const key = `${name}|${city}`.toLowerCase();
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  const cseId = getEnv('GOOGLE_CSE_ID');
  const apiKey = getEnv('GOOGLE_API_KEY');
  const serpKey = getEnv('SERPAPI_KEY');
  const query = `${name} ${city}`;

  if (budget.remaining <= 0) return null;

  // Prefer Google Custom Search API if configured
  if (cseId && apiKey) {
    budget.remaining -= 1;
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', cseId);
    url.searchParams.set('q', query + ' -site:facebook.com -site:instagram.com -site:tripadvisor.com');
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const items: any[] = json.items || [];
    const ranked = items
      .map((it) => ({ link: it.link as string, score: scoreDomain(it.link, name) }))
      .sort((a, b) => b.score - a.score);
    const link = ranked[0]?.link || null;
    if (link) memoryCache.set(key, link);
    return link;
  }

  // Fallback: SerpAPI
  if (serpKey) {
    budget.remaining -= 1;
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', serpKey);
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const results: any[] = json.organic_results || [];
    const ranked = results
      .map((it) => ({ link: it.link as string, score: scoreDomain(it.link, name) }))
      .sort((a, b) => b.score - a.score);
    const link = ranked[0]?.link || null;
    if (link) memoryCache.set(key, link);
    return link;
  }

  return null;
}


