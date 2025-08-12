import { getDatabase } from '../../lib/db';
import { geocodeToAreaOrBbox } from './nominatimClient';
import { fetchRestaurants } from './overpassClient';
import { pickBestOsmWebsite, validateUrl, normalizeUrl, isSocial } from './urlResolution';
import { searchOfficialSite } from './googleSearch';
import { discoverMenuUrl } from './menuDiscovery';
import { extCrawlRuns, extRestaurants, extRestaurantChecks } from '../../schema/competitive';
import { eq, and, desc } from 'drizzle-orm';
import { getEnv } from '../../lib/env';
import type { PipelineOptions, PipelineStats } from '../../types/competitive';

function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export async function runCompetitiveIngest(options: PipelineOptions): Promise<string> {
  const db = await getDatabase();
  const runId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const stats: PipelineStats = {
    total_seen: 0,
    with_osm_website: 0,
    validated_website: 0,
    google_fallback_success: 0,
    with_menu_url: 0,
  };
  await db.insert(extCrawlRuns).values({ id: runId, locationQuery: options.location, provider: 'overpass', status: 'running', stats });

  try {
    const area = await geocodeToAreaOrBbox(options.location);
    await db.update(extCrawlRuns).set({ areaId: area.areaId, bbox: area.bbox }).where(eq(extCrawlRuns.id, runId as any));
    const places = await fetchRestaurants(area);
    const concurrency = Math.max(1, Math.min(10, options.maxConcurrency ?? Number(getEnv('COMPETITIVE_MAX_CONCURRENCY') || '5')));
    // Per-run small budget for Google CSE fallbacks to avoid quota exhaustion
    const searchBudget = { remaining: Number(getEnv('GOOGLE_SEARCH_BUDGET') || '25') };
    let index = 0;
    async function worker() {
      while (index < places.length) {
        const i = index++;
        const p = places[i];
        await processPlace(db, runId, p, stats, searchBudget);
        // polite delay between requests clusters
        await delay(100);
      }
    }
    stats.total_seen = places.length;
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await db.update(extCrawlRuns).set({ status: 'completed', completedAt: new Date(), stats }).where(eq(extCrawlRuns.id, runId as any));
  } catch (error: any) {
    await db.update(extCrawlRuns).set({ status: 'failed', completedAt: new Date(), errorMessage: error?.message || String(error), stats }).where(eq(extCrawlRuns.id, runId as any));
    throw error;
  }
  return runId;
}

async function processPlace(db: any, runId: string, p: any, stats: PipelineStats, searchBudget: { remaining: number }): Promise<void> {
  const id = `er_${runId}_${p.elementType}_${p.elementId}`;
  const baseRow = {
    id,
    runId,
    source: 'osm',
    sourceElementType: p.elementType,
    sourceElementId: String(p.elementId),
    name: p.name || 'Unknown',
    addrStreet: p.address?.street ?? null,
    addrHousenumber: p.address?.housenumber ?? null,
    addrPostcode: p.address?.postcode ?? null,
    addrCity: p.address?.city ?? null,
    addrCountry: p.address?.country ?? null,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    phone: p.phone ?? null,
    osmTags: p.tags ?? {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  // Ensure base restaurant row exists before recording checks
  await db.insert(extRestaurants).values(baseRow).onConflictDoNothing?.();

  // Pick website candidate from OSM
  const candidates = pickBestOsmWebsite(p.tags || {});
  let finalWebsite: string | null = null;
  let websiteMethod: 'osm' | 'google' | undefined;
  const hadOsmCandidate = candidates.length > 0;
  for (const cand of candidates) {
    if (!cand.url) continue;
    const result = await validateUrl(cand.url);
    await db.insert(extRestaurantChecks).values({
      id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      restaurantId: id,
      target: 'website',
      candidateUrl: cand.url,
      method: 'osm',
      httpStatus: result.httpStatus ?? null,
      contentType: result.contentType ?? null,
      effectiveUrl: result.effectiveUrl ?? null,
      isValid: result.isValid,
      errorMessage: result.errorMessage ?? null,
    });
    if (cand.isSocial) continue;
    if (result.isValid) {
      stats.with_osm_website += 1;
      stats.validated_website += 1;
      finalWebsite = result.effectiveUrl || normalizeUrl(cand.url);
      websiteMethod = 'osm';
      var chosenWebsiteStatus = result.httpStatus;
      var chosenWebsiteContentType = result.contentType;
      break;
    }
  }

  // If OSM offered a candidate but none validated, still count availability
  if (!finalWebsite && hadOsmCandidate) {
    stats.with_osm_website += 1;
  }

  // Google fallback
  if (!finalWebsite) {
    // Reuse previously validated website for same name + city if available
    if (baseRow.name && baseRow.addrCity) {
      try {
        const reused = await db.select().from(extRestaurants)
          .where(and(eq(extRestaurants.name as any, baseRow.name as any), eq(extRestaurants.addrCity as any, baseRow.addrCity as any), eq(extRestaurants.websiteIsValid as any, true as any)))
          .orderBy(desc(extRestaurants.createdAt as any))
          .limit(1);
        if (reused?.[0]?.websiteUrl) {
          finalWebsite = reused[0].websiteUrl;
          websiteMethod = 'reuse';
        }
      } catch {}
    }
  }

  if (!finalWebsite) {
    const googleUrl = await searchOfficialSite(baseRow.name, baseRow.addrCity || '', searchBudget);
    if (googleUrl) {
      const result = await validateUrl(googleUrl);
      await db.insert(extRestaurantChecks).values({
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        restaurantId: id,
        target: 'website',
        candidateUrl: googleUrl,
        method: 'google',
        httpStatus: result.httpStatus ?? null,
        contentType: result.contentType ?? null,
        effectiveUrl: result.effectiveUrl ?? null,
        isValid: result.isValid,
        errorMessage: result.errorMessage ?? null,
      });
      if (result.isValid) {
        stats.google_fallback_success += 1;
        stats.validated_website += 1;
        finalWebsite = result.effectiveUrl || normalizeUrl(googleUrl);
        websiteMethod = 'google';
        var chosenWebsiteStatus = result.httpStatus;
        var chosenWebsiteContentType = result.contentType;
      }
    }
  }

  let menuInfo: { url?: string; method?: string; httpStatus?: number; contentType?: string; isPdf?: boolean; isValid?: boolean } = {};
  if (finalWebsite) {
    const res = await discoverMenuUrl(finalWebsite);
    if (res.isValid && res.url) {
      stats.with_menu_url += 1;
      menuInfo = { url: res.url, method: res.method, httpStatus: res.httpStatus, contentType: res.contentType, isPdf: res.isPdf, isValid: res.isValid };
      await db.insert(extRestaurantChecks).values({
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        restaurantId: id,
        target: 'menu',
        candidateUrl: res.url,
        method: 'crawl',
        httpStatus: res.httpStatus ?? null,
        contentType: res.contentType ?? null,
        effectiveUrl: res.url,
        isValid: true,
        errorMessage: null,
      });
    }
  }

  await db.insert(extRestaurants).values({
    ...baseRow,
    websiteUrl: finalWebsite ?? null,
    websiteDiscoveryMethod: websiteMethod ?? null,
    websiteEffectiveUrl: finalWebsite ?? null,
    websiteHttpStatus: (typeof chosenWebsiteStatus !== 'undefined' ? chosenWebsiteStatus : null) as any,
    websiteContentType: (typeof chosenWebsiteContentType !== 'undefined' ? chosenWebsiteContentType : null) as any,
    websiteIsSocial: finalWebsite ? isSocial(finalWebsite) : false,
    websiteIsValid: !!finalWebsite,
    websiteLastCheckedAt: finalWebsite ? new Date() : null,
    menuUrl: menuInfo.url ?? null,
    menuDiscoveryMethod: (menuInfo.method as any) ?? null,
    menuHttpStatus: menuInfo.httpStatus ?? null,
    menuContentType: menuInfo.contentType ?? null,
    menuIsPdf: !!menuInfo.isPdf,
    menuIsValid: !!menuInfo.isValid,
    menuLastCheckedAt: menuInfo.url ? new Date() : null,
  }).onConflictDoUpdate?.({
    target: extRestaurants.id,
    set: {
      updatedAt: new Date(),
      websiteUrl: (finalWebsite ?? null) as any,
      websiteDiscoveryMethod: (websiteMethod ?? null) as any,
      websiteEffectiveUrl: (finalWebsite ?? null) as any,
      websiteHttpStatus: (typeof chosenWebsiteStatus !== 'undefined' ? chosenWebsiteStatus : null) as any,
      websiteContentType: (typeof chosenWebsiteContentType !== 'undefined' ? chosenWebsiteContentType : null) as any,
      websiteIsSocial: (finalWebsite ? isSocial(finalWebsite) : false) as any,
      websiteIsValid: (!!finalWebsite) as any,
      websiteLastCheckedAt: (finalWebsite ? new Date() : null) as any,
      menuUrl: (menuInfo.url ?? null) as any,
      menuDiscoveryMethod: ((menuInfo.method as any) ?? null) as any,
      menuHttpStatus: (menuInfo.httpStatus ?? null) as any,
      menuContentType: (menuInfo.contentType ?? null) as any,
      menuIsPdf: (!!menuInfo.isPdf) as any,
      menuIsValid: (!!menuInfo.isValid) as any,
      menuLastCheckedAt: (menuInfo.url ? new Date() : null) as any,
    }
  });
}


