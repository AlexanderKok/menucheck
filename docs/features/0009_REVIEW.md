## Feature 0009: Competitive Data Pipeline – REVIEW

### Scope check vs plan
- **Schema and migrations**: Implemented `ext_crawl_runs`, `ext_restaurants`, `ext_restaurant_checks` per plan. Field coverage matches (timestamps, stats jsonb, address fields, website/menu validation fields).
  
  ```18:55:server/src/schema/competitive.ts
  export const extRestaurants = appSchema.table('ext_restaurants', {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull().references(() => extCrawlRuns.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // "osm"
    sourceElementType: text('source_element_type').notNull(), // node|way|relation
    sourceElementId: text('source_element_id').notNull(), // store as text for safety
    name: text('name').notNull(),
    addrStreet: text('addr_street'),
    addrHousenumber: text('addr_housenumber'),
    addrPostcode: text('addr_postcode'),
    addrCity: text('addr_city'),
    addrCountry: text('addr_country'),
    latitude: decimal('latitude', { precision: 10, scale: 7 }),
    longitude: decimal('longitude', { precision: 10, scale: 7 }),
    phone: text('phone'),
    osmTags: jsonb('osm_tags'),
    websiteUrl: text('website_url'),
    websiteDiscoveryMethod: text('website_discovery_method'), // osm|google
    websiteEffectiveUrl: text('website_effective_url'),
    websiteHttpStatus: integer('website_http_status'),
    websiteContentType: text('website_content_type'),
    websiteIsSocial: boolean('website_is_social').default(false).notNull(),
    websiteIsValid: boolean('website_is_valid').default(false).notNull(),
    websiteLastCheckedAt: timestamp('website_last_checked_at'),
    menuUrl: text('menu_url'),
    menuDiscoveryMethod: text('menu_discovery_method'), // link_text|header|sitemap|search
    menuHttpStatus: integer('menu_http_status'),
    menuContentType: text('menu_content_type'),
    menuIsPdf: boolean('menu_is_pdf').default(false).notNull(),
    menuIsValid: boolean('menu_is_valid').default(false).notNull(),
    menuLastCheckedAt: timestamp('menu_last_checked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  });
  ```

- **Clients/services**: Implemented `nominatimClient`, `overpassClient`, `urlResolution`, `googleSearch`, `menuDiscovery`, `pipeline` consistent with plan. Concurrency cap present; polite delay added.
- **API**: Admin routes present under `/api/v1/admin/competitive/*` with simple env-based admin guard and auth middleware.

  ```964:975:server/src/api.ts
  adminRoutes.post('/competitive/ingest', async (c) => {
    if (!isAdmin()) return c.json({ error: 'Forbidden' }, 403);
    try {
      const body = await c.req.json().catch(() => ({}));
      const location = body.location || 'The Hague';
      const runId = await runCompetitiveIngest({ location });
      return c.json({ runId });
    } catch (error) {
      console.error('Ingest error:', error);
      return c.json({ error: 'Failed to start ingest' }, 500);
    }
  });
  ```

- **CLI**: `src/scripts/ingest-osm-the-hague.ts` writes CSV to `docs/temp_files/` with correct columns.

  ```19:28:server/src/scripts/ingest-osm-the-hague.ts
  const header = [
    'name','addr_street','addr_housenumber','addr_postcode','addr_city','addr_country','latitude','longitude',
    'website_url','website_effective_url','website_http_status','website_is_valid','website_discovery_method',
    'menu_url','menu_http_status','menu_is_valid','menu_discovery_method'
  ];
  ```

### Findings
- **Stats semantics (alignment issue)**: `with_osm_website` is incremented only when an OSM candidate validates, not when one exists. This undercounts “OSM provided a website”. Suggest: increment when OSM provides any website candidate; separately track validation.

  ```96:103:server/src/services/competitive/pipeline.ts
  if (result.isValid) {
    stats.with_osm_website += 1;
    stats.validated_website += 1;
    finalWebsite = result.effectiveUrl || normalizeUrl(cand.url);
    websiteMethod = 'osm';
    break;
  }
  ```

- **Website HTTP metadata not persisted**: Chosen website’s `website_http_status` and `website_content_type` remain `null` in `ext_restaurants`, leading to empty CSV columns, even though checks capture them.

  ```169:178:server/src/services/competitive/pipeline.ts
  websiteEffectiveUrl: finalWebsite ?? null,
  websiteHttpStatus: null,
  websiteContentType: null,
  websiteIsSocial: finalWebsite ? isSocial(finalWebsite) : false,
  websiteIsValid: !!finalWebsite,
  websiteLastCheckedAt: finalWebsite ? new Date() : null,
  ```

  Additionally, the upsert only updates `websiteUrl` and `menuUrl`, so if the base row insert wins the race, fields like `websiteEffectiveUrl`, `websiteHttpStatus`, etc. remain `NULL`:

  ```186:193:server/src/services/competitive/pipeline.ts
  }).onConflictDoUpdate?.({
    target: extRestaurants.id,
    set: {
      updatedAt: new Date(),
      websiteUrl: (finalWebsite ?? null) as any,
      menuUrl: (menuInfo.url ?? null) as any,
    }
  });
  ```
  Suggestion: include all website/menu metadata fields in the upsert `set` clause.

- **Env usage (runtime portability)**: Uses `process.env` directly for concurrency and search budget. In Workers, `process.env` is empty; prefer `getEnv()` for consistency with the rest of the code.

  ```29:33:server/src/services/competitive/pipeline.ts
  const concurrency = Math.max(1, Math.min(10, options.maxConcurrency ?? Number(process.env.COMPETITIVE_MAX_CONCURRENCY || 5)));
  const searchBudget = { remaining: Number(process.env.GOOGLE_SEARCH_BUDGET || '25') };
  ```

- **Google fallback breadth**: Only the top result is attempted; plan suggested trying top 3 before giving up.

  ```45:51:server/src/services/competitive/googleSearch.ts
  const ranked = items
    .map((it) => ({ link: it.link as string, score: scoreDomain(it.link, name) }))
    .sort((a, b) => b.score - a.score);
  const link = ranked[0]?.link || null;
  ```

- **Social detection coverage**: Limited to Facebook/Instagram; plan mentioned “etc.” Consider adding `tiktok.com`, `linkedin.com`, `twitter.com`/`x.com`, `pinterest.com`.

  ```4:6:server/src/services/competitive/urlResolution.ts
  const SOCIAL_HOSTS = [
    'facebook.com', 'm.facebook.com', 'instagram.com'
  ];
  ```

- **Menu discovery methods**: Implements DOM link-text and slug guesses; does not attempt headers/sitemap strategies. Acceptable for phase 1; note for later.

  ```5:5:server/src/services/competitive/menuDiscovery.ts
  const MENU_TEXTS = ['menu', 'menukaart', 'kaart'];
  ```

  ```54:66:server/src/services/competitive/menuDiscovery.ts
  // Fallback: try common slugs
  const slugs = ['/menu', '/menukaart', '/kaart'];
  ... method: 'slug_guess' ...
  ```

- **Reuse path method label**: When reusing a previously validated site by name+city, the method is set to `osm`, which may be misleading. Consider `reuse` or leave discovery method unchanged.

- **Minor style nit**: Redundant ternary sets `method` to `'osm'` in both branches when logging OSM checks.

  ```87:95:server/src/services/competitive/pipeline.ts
  method: cand.source.includes('contact') ? 'osm' : 'osm',
  ```

- **Rate limiting**: Simple fixed 100ms inter-iteration delay; consider per-host concurrency caps and backoff on 429/5xx for Overpass/Nominatim etiquette.

- **Type/style notes**:
  - Several `as any` casts and optional chaining on Drizzle `onConflict` helpers reduce type safety.
  - `menuDiscovery`/`urlValidation` fetches could include a `User-Agent` header consistently.

- **Tests (missing)**: No unit/integration tests under `server/src/__tests__/competitive/` as outlined in plan.

### CSV sanity check
The generated CSV matches the header, but `website_http_status` is empty due to the persistence gap noted above.

```1:3:docs/temp_files/combined_restaurants_20250812115139.csv
name,addr_street,addr_housenumber,addr_postcode,addr_city,addr_country,latitude,longitude,website_url,website_effective_url,website_http_status,website_is_valid,website_discovery_method,menu_url,menu_http_status,menu_is_valid,menu_discovery_method
Ming Dynasty,Spui,170,2511BW,'s-Gravenhage,,52.0765756,4.3175066,,,,false,,,,false,
Eetcafé Hagedis,Waldeck Pyrmontkade,116,2518JR,'s-Gravenhage,,52.0784108,4.2928326,https://www.restauranthagedis.nl/,,,false,,,,false,
```

### Recommendations
- **Fix stats**: Increment `with_osm_website` when OSM provides any candidate; keep `validated_website` for successful validations.
- **Persist website metadata**: Capture the chosen website’s `httpStatus` and `contentType` into `ext_restaurants` to populate CSV.
- **Use env helper**: Replace `process.env.COMPETITIVE_MAX_CONCURRENCY` and `GOOGLE_SEARCH_BUDGET` with `getEnv('COMPETITIVE_MAX_CONCURRENCY')` and `getEnv('GOOGLE_SEARCH_BUDGET')` for portability.
- **Expand social list**: Add TikTok, LinkedIn, Twitter/X, Pinterest to `SOCIAL_HOSTS`.
- **Broaden Google fallback**: Attempt the top 3 ranked links and validate until one passes.
- **Optional**: Add sitemap/header strategies in `menuDiscovery` to improve coverage.
- **Testing**: Add unit tests for `urlResolution`, `menuDiscovery`, `googleSearch`, and a small mocked integration test for the pipeline as per plan.

### Overall
**Implementation largely matches the plan and works end-to-end.** Main gaps are metrics semantics, persistence of website HTTP metadata, environment handling consistency, and missing tests. Addressing these will improve accuracy of reporting and operational robustness.


