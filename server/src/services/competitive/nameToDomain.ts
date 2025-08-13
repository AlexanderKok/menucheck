import { getEnv } from '../../lib/env';

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
}

function normalizeNamePart(input: string): { compact: string; hyphenated: string } {
  const lowered = stripDiacritics(input.toLowerCase());
  const compact = lowered.replace(/[^a-z0-9]+/g, '').replace(/\s+/g, '');
  const hyphenated = lowered
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return { compact, hyphenated };
}

const GENERIC_BUSINESS_WORDS = new Set([
  'restaurant','eetcafe','cafe','cafeteria','bistro','brasserie','bar','grill','kitchen','keuken','lounge','pizzeria','sushi','ramen','thai','thais','indonesian','indonesisch','indian','indiaas','chinese','chinees','pizza','burger','steakhouse','steak','bakery','bakkerij','broodjes','doner','döner'
]);

function getCoreTokens(raw: string): string[] {
  const lowered = stripDiacritics((raw || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  return lowered.split(/\s+/).filter((tok) => tok && !GENERIC_BUSINESS_WORDS.has(tok));
}

export function getFallbackTlds(): string[] {
  const raw = getEnv('FALLBACK_TLDS', '.nl,.com,.eu,.be') || '.nl,.com,.eu,.be';
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export function generateDomainCandidates(name: string, city?: string, tlds: string[] = getFallbackTlds()): string[] {
  const { compact: nameCompact, hyphenated: nameHyph } = normalizeNamePart(name);
  const { compact: cityCompact, hyphenated: cityHyph } = normalizeNamePart(city || '');
  const coreTokens = getCoreTokens(name);
  const coreCompact = coreTokens.join('');
  const coreHyphen = coreTokens.join('-');

  const seeds = new Set<string>();
  // Base name variants
  seeds.add(nameCompact);
  seeds.add(nameHyph);
  // Core name variants (ignore generic words like "restaurant", "eetcafe")
  if (coreCompact) {
    seeds.add(coreCompact);
    seeds.add(coreHyphen);
  }
  // With city
  if (cityCompact) {
    seeds.add(nameCompact + cityCompact);
    seeds.add(`${nameHyph}-${cityHyph}`);
    if (coreCompact) {
      seeds.add(coreCompact + cityCompact);
      seeds.add(`${coreHyphen}-${cityHyph}`);
    }
  }
  // Suffix/prefix variants with "restaurant"
  seeds.add(nameCompact + 'restaurant');
  seeds.add('restaurant' + nameCompact);
  seeds.add(`${nameHyph}-restaurant`);
  seeds.add(`restaurant-${nameHyph}`);
  if (coreCompact) {
    seeds.add(coreCompact + 'restaurant');
    seeds.add('restaurant' + coreCompact);
    seeds.add(`${coreHyphen}-restaurant`);
    seeds.add(`restaurant-${coreHyphen}`);
  }

  const hosts: string[] = [];
  for (const seed of seeds) {
    for (const tld of tlds) {
      const cleanTld = tld.startsWith('.') ? tld : `.${tld}`;
      const host = `${seed}${cleanTld}`.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
      hosts.push(host);
      // try www variant too
      hosts.push(`www.${host}`);
    }
  }

  // De-duplicate while preserving order
  const uniqueHosts = hosts.filter((h, i) => hosts.indexOf(h) === i);

  const urls: string[] = [];
  for (const host of uniqueHosts) {
    urls.push(`https://${host}/`);
  }
  return urls;
}


