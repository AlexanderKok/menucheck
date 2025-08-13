import { getDatabase } from '../lib/db';
import { getEnv } from '../lib/env';
import { extCrawlRuns, extRestaurants, extRestaurantChecks } from '../schema/competitive';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { normalizeUrl, validateUrl, isSocial } from '../services/competitive/urlResolution';
import { generateDomainCandidates } from '../services/competitive/nameToDomain';
import { computeMatchScore, fetchHtml } from '../services/competitive/siteVerification';
import { search as ddgSearch } from '../services/competitive/duckDuckGoSearch';

type Method = 'guess' | 'duckduckgo';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (typeof v === 'undefined') {
        args[k] = true;
      } else {
        args[k] = v;
      }
    }
  }
  return args as {
    'run-id'?: string;
    location?: string;
    limit?: string;
    methods?: string;
    rate?: string;
    'min-score'?: string;
  };
}

type Stats = {
  examined: number;
  guessed_success: number;
  ddg_success: number;
  updated: number;
  skipped: number;
};

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Simple per-host concurrency limiter reused locally
type QueueTask = () => Promise<void>;
const hostQueues = new Map<string, { active: number; limit: number; queue: QueueTask[] }>();
function getHost(url: string | URL): string { try { return new URL(String(url)).host; } catch { return 'invalid'; } }
async function withHostLimit<T>(url: string, limit: number, task: () => Promise<T>): Promise<T> {
  const host = getHost(url);
  let entry = hostQueues.get(host);
  if (!entry) { entry = { active: 0, limit, queue: [] }; hostQueues.set(host, entry); }
  if (entry.active < entry.limit) {
    entry.active += 1;
    try { return await task(); } finally {
      entry.active -= 1; const next = entry.queue.shift(); if (next) next();
    }
  }
  return await new Promise<T>((resolve, reject) => {
    const run = async () => {
      entry!.active += 1;
      try { resolve(await task()); } catch (e) { reject(e); } finally {
        entry!.active -= 1; const n = entry!.queue.shift(); if (n) n();
      }
    };
    entry!.queue.push(run);
  });
}

async function findTargetRun(db: any, runId?: string, location?: string): Promise<string> {
  if (runId) return runId;
  if (location) {
    const rows = await db.select().from(extCrawlRuns)
      .where(eq(extCrawlRuns.locationQuery as any, location as any))
      .orderBy(desc(extCrawlRuns.startedAt as any))
      .limit(1);
    if (rows?.[0]?.id) return rows[0].id;
  }
  const rows = await db.select().from(extCrawlRuns)
    .orderBy(desc(extCrawlRuns.startedAt as any))
    .limit(1);
  if (!rows?.[0]?.id) throw new Error('No crawl runs found');
  return rows[0].id;
}

async function processCandidate(db: any, restaurantId: string, method: string, candidateUrl: string, expected: any, perHostLimit: number, minScore: number): Promise<{ accepted: boolean; finalUrl?: string; httpStatus?: number; contentType?: string }>
{
  const validation = await withHostLimit(candidateUrl, perHostLimit, () => validateUrl(candidateUrl));
  await db.insert(extRestaurantChecks).values({
    id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    restaurantId,
    target: 'website',
    candidateUrl,
    method,
    httpStatus: validation.httpStatus ?? null,
    contentType: validation.contentType ?? null,
    effectiveUrl: validation.effectiveUrl ?? null,
    isValid: validation.isValid,
    errorMessage: validation.errorMessage ?? null,
  });
  if (!validation.isValid || isSocial(validation.effectiveUrl || candidateUrl)) {
    return { accepted: false };
  }
  const htmlRes = await withHostLimit(validation.effectiveUrl || candidateUrl, perHostLimit, () => fetchHtml(validation.effectiveUrl || candidateUrl));
  if (!htmlRes.html) return { accepted: false };
  const score = computeMatchScore(validation.effectiveUrl || candidateUrl, htmlRes.html, expected);
  const accepted = score >= minScore;
  // Log score via another check row? Avoid schema change; pack into errorMessage when rejected
  if (!accepted) {
    await db.insert(extRestaurantChecks).values({
      id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      restaurantId,
      target: 'website',
      candidateUrl,
      method: `${method}:verify`,
      httpStatus: htmlRes.status ?? null,
      contentType: htmlRes.contentType ?? null,
      effectiveUrl: htmlRes.effectiveUrl ?? null,
      isValid: false,
      errorMessage: `score=${score}`,
    });
  }
  return { accepted, finalUrl: validation.effectiveUrl || candidateUrl, httpStatus: validation.httpStatus ?? htmlRes.status, contentType: validation.contentType ?? htmlRes.contentType };
}

async function main() {
  const args = parseArgs(process.argv);
  const db = await getDatabase();
  const runId = await findTargetRun(db, args['run-id'], args.location);
  const limit = args.limit ? Number(args.limit) : undefined;
  const minScore = args['min-score'] ? Number(args['min-score']) : Number(getEnv('FALLBACK_VERIFY_MIN_SCORE') || '60');
  const methods = (args.methods || getEnv('FALLBACK_ENABLE_GUESS') || getEnv('FALLBACK_ENABLE_DDG'))
    ? (args.methods || 'guess,duckduckgo')
    : 'guess,duckduckgo';
  const enabled = new Set<Method>(methods.split(',').map((m) => m.trim() as Method));
  const perHostLimit = 5;

  const targets = await db.select().from(extRestaurants)
    .where(
      and(
        eq(extRestaurants.runId as any, runId as any),
        or(
          eq(extRestaurants.websiteIsValid as any, false as any),
          isNull(extRestaurants.websiteUrl as any)
        )
      )
    ) as any[];

  let examined = 0; const stats: Stats = { examined: 0, guessed_success: 0, ddg_success: 0, updated: 0, skipped: 0 };
  for (const row of targets) {
    if (limit && examined >= limit) break;
    examined += 1; stats.examined = examined;
    // skip if already has valid website
    if (row.websiteIsValid && row.websiteUrl) { stats.skipped += 1; continue; }

    const expected = {
      name: row.name,
      street: row.addrStreet || undefined,
      housenumber: row.addrHousenumber || undefined,
      postcode: row.addrPostcode || undefined,
      city: row.addrCity || undefined,
      phone: row.phone || undefined,
    };

    let finalUrl: string | undefined;
    let methodUsed: 'heuristic' | 'duckduckgo' | undefined;
    let httpStatus: number | undefined; let contentType: string | undefined;

    if (!finalUrl && enabled.has('guess')) {
      const candidates = generateDomainCandidates(row.name, row.addrCity);
      for (const cand of candidates) {
        const res = await processCandidate(db, row.id, 'heuristic', cand, expected, perHostLimit, minScore);
        if (res.accepted && res.finalUrl) {
          finalUrl = res.finalUrl; methodUsed = 'heuristic'; httpStatus = res.httpStatus; contentType = res.contentType; stats.guessed_success += 1; break;
        }
      }
    }

    if (!finalUrl && enabled.has('duckduckgo')) {
      const links = await ddgSearch(row.name, row.addrCity || undefined, { rateRps: args.rate ? Number(args.rate) : undefined });
      for (const link of links) {
        const res = await processCandidate(db, row.id, 'duckduckgo', link, expected, perHostLimit, minScore);
        if (res.accepted && res.finalUrl) {
          finalUrl = res.finalUrl; methodUsed = 'duckduckgo'; httpStatus = res.httpStatus; contentType = res.contentType; stats.ddg_success += 1; break;
        }
        await delay(200); // be polite between validations
      }
    }

    if (finalUrl) {
      await db.insert(extRestaurants).values({
        ...row,
        websiteUrl: finalUrl,
        websiteEffectiveUrl: finalUrl,
        websiteHttpStatus: (httpStatus ?? null) as any,
        websiteContentType: (contentType ?? null) as any,
        websiteIsSocial: isSocial(finalUrl),
        websiteIsValid: true,
        websiteLastCheckedAt: new Date(),
        websiteDiscoveryMethod: methodUsed as any,
        updatedAt: new Date(),
      }).onConflictDoUpdate?.({
        target: extRestaurants.id,
        set: {
          websiteUrl: (finalUrl ?? null) as any,
          websiteEffectiveUrl: (finalUrl ?? null) as any,
          websiteHttpStatus: (httpStatus ?? null) as any,
          websiteContentType: (contentType ?? null) as any,
          websiteIsSocial: (isSocial(finalUrl) as any),
          websiteIsValid: (true as any),
          websiteLastCheckedAt: (new Date() as any),
          websiteDiscoveryMethod: (methodUsed as any),
          updatedAt: (new Date() as any),
        }
      });
      stats.updated += 1;
    } else {
      stats.skipped += 1;
    }
  }

  console.log(JSON.stringify({ runId, ...stats }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });


