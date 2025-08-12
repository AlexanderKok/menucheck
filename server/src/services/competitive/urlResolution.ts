import type { UrlCandidate, ValidationResult } from '../../types/competitive';
import { getEnv } from '../../lib/env';

const SOCIAL_HOSTS = [
  'facebook.com', 'm.facebook.com', 'instagram.com'
];

export function normalizeUrl(input: string): string {
  if (!input) return input;
  try {
    const hasScheme = /^(https?:)?\/\//i.test(input);
    const prefixed = hasScheme ? input : `https://${input}`;
    const u = new URL(prefixed);
    u.hostname = u.hostname.toLowerCase();
    // Strip tracking params
    const toRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    toRemove.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return input;
  }
}

export function isSocial(url: string): boolean {
  try {
    const u = new URL(normalizeUrl(url));
    return SOCIAL_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

export function pickBestOsmWebsite(tags: Record<string, string | undefined>): UrlCandidate[] {
  const candidatesRaw = [
    { key: 'website', source: 'website' as const },
    { key: 'contact:website', source: 'contact:website' as const },
    { key: 'url', source: 'url' as const },
    { key: 'contact:url', source: 'contact:url' as const },
  ];
  const candidates: UrlCandidate[] = [];
  for (const c of candidatesRaw) {
    const value = tags[c.key];
    if (value && typeof value === 'string') {
      const normalized = normalizeUrl(value);
      candidates.push({ url: normalized, source: c.source, isSocial: isSocial(normalized) });
    }
  }
  // Rank: prefer non-social, prefer website/contact:website, then url/contact:url
  const rank = (cand: UrlCandidate): number => {
    let score = 0;
    if (cand.isSocial) score -= 10;
    if (cand.source === 'website' || cand.source === 'contact:website') score += 5;
    if (cand.source === 'url' || cand.source === 'contact:url') score += 2;
    return score;
  };
  return candidates
    .filter((c, index, arr) => arr.findIndex((x) => hostOf(x.url) === hostOf(c.url)) === index)
    .sort((a, b) => rank(b) - rank(a));
}

function hostOf(u: string): string {
  try { return new URL(normalizeUrl(u)).hostname; } catch { return u; }
}

export async function validateUrl(url: string): Promise<ValidationResult> {
  const timeoutMs = Number(getEnv('HTTP_DEFAULT_TIMEOUT_MS') || '15000');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'User-Agent': getEnv('OSM_USER_AGENT') || 'kaartkompas/unknown-contact' };
  try {
    // Try HEAD
    let resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    if (!resp.ok || resp.status === 405 || resp.status >= 400) {
      // Fallback GET
      resp = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    }
    const finalUrl = resp.url || url;
    const contentType = resp.headers.get('content-type') || undefined;
    const isHtmlLike = contentType ? /text\/html|application\/(xhtml\+xml|html)/i.test(contentType) : true;
    const social = isSocial(finalUrl);
    const valid = resp.status >= 200 && resp.status < 300 && isHtmlLike && !social;
    return {
      candidateUrl: url,
      effectiveUrl: finalUrl,
      httpStatus: resp.status,
      contentType,
      isValid: valid,
      isSocial: social,
    };
  } catch (error: any) {
    return {
      candidateUrl: url,
      isValid: false,
      errorMessage: error?.message || 'request_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}



