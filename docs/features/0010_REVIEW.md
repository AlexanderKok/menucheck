### Code review for feature 0010 – Better menu crawling

**Verdict**: Largely implemented as planned with a few fixups and test tidy-ups recommended.

## Plan adherence
- **DOM scanning/matching**: Implemented. Scans `header`, `nav`, `footer`, and `main/body`, aggregates `text`, `title`, `aria-label`, and `data-*` attributes, normalizes with diacritic-insensitive matching, and resolves relative URLs. De-duplicates by host+path and prioritizes scopes in the intended order.
- **Validation**: Implements HEAD→GET fallback with redirects and content sniffing for HTML/PDF. Correctly identifies 2xx and returns enriched fields.
- **Method values**: Uses `'header' | 'nav' | 'footer' | 'link_text' | 'sitemap' | 'slug'` and persists them.
- **Slug fallback**: Implemented with the specified ordered list.
- **Sitemap fallback**: Implemented with `fast-xml-parser`, tries `/sitemap.xml` then `/sitemap_index.xml`, parses nested sitemaps, keyword-filters paths, validates, and prioritizes HTML over PDF.
- **Per-host concurrency**: Added small semaphore on top of overall concurrency and applied to website validation and menu discovery.
- **Types**: `MenuDiscoveryResult['method']` updated per plan.
- **Tests**: Added `menuDiscovery.spec.ts` covering most planned cases.

## Notable strengths
- Matching logic is robust and diacritic-insensitive via normalization; keyword list matches Dutch/English variants.
- Scope prioritization and intra-scope preference for HTML over PDF are correctly enforced.
- Defensive network error handling and timeouts are in place and reuse shared helpers.
- Per-host throttling is simple and effective, reducing the risk of overloading sites.

## Issues and recommended fixes
- **Sitemap result returns hard-coded `httpStatus`/`contentType`**: When returning a sitemap-derived success, the code sets constants instead of using actual values from validation. Use the values from `validateCandidate` to keep audit accuracy.

```244:246:server/src/services/competitive/menuDiscovery.ts
    if (sitemapHtmlFirst[0]) return { url: sitemapHtmlFirst[0], method: 'sitemap', httpStatus: 200, contentType: 'text/html', isPdf: false, isValid: true };
    if (sitemapPdfSecond[0]) return { url: sitemapPdfSecond[0], method: 'sitemap', httpStatus: 200, contentType: 'application/pdf', isPdf: true, isValid: true };
```

Suggested: track and return the `httpStatus`, `contentType`, and `isPdf` captured during validation for the selected URL.

- **Test file duplication and style**: `menuDiscovery.spec.ts` contains two separate suites with duplicate imports and helpers. Consolidate into a single suite to improve readability and avoid potential confusion.

```1:15:server/src/__tests__/competitive/menuDiscovery.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverMenuUrl } from '../../services/competitive/menuDiscovery';
...
```

```137:156:server/src/__tests__/competitive/menuDiscovery.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverMenuUrl } from '../../services/competitive/menuDiscovery';
...
```

- **Missing positive `link_text` body case**: Tests cover header/nav/footer and slug/sitemap fallbacks, but there is no explicit success case for a body or main link discovered as `link_text`. Add a test that finds a valid body anchor and asserts `method: 'link_text'`.

- **Optional: unify cross-method de-duplication**: Anchors are de-duplicated via a `seen` set across scopes, and sitemaps are deduped internally. If the same URL appears in both anchor scopes and sitemap/slug, it will still validate again. Consider a global "effective host+path" seen set across all methods to avoid redundant requests.

- **Minor: unused `preferBodySniff` path**: `validateCandidate` exposes a `preferBodySniff` parameter that is never set to `true`. Either remove the parameter or add a case where it’s useful (e.g., for known PDF-like paths) to simplify code.

## Data alignment and persistence
- Menu fields (`menuUrl`, `menuDiscoveryMethod`, `menuHttpStatus`, `menuContentType`, `menuIsPdf`, `menuIsValid`) are populated from discovery results and persisted correctly. Checks are recorded for website validations and for the chosen menu URL with `method: 'crawl'`, which matches the existing audit semantics.

## Concurrency and timeouts
- Overall concurrency remains configurable and small per-host semaphore (limit 5) is applied at all network touchpoints that matter. Timeouts respect `HTTP_DEFAULT_TIMEOUT_MS` and default to 15000ms.

## Over-engineering and style
- The implementation is straightforward and readable. The sitemap traversal depth is capped and guarded. Minor polish items are listed above; otherwise the code matches the repo’s style.

## Actionable checklist
- [ ] Return real `httpStatus` and `contentType` for sitemap-selected URLs.
- [ ] Merge duplicate test suites in `menuDiscovery.spec.ts` and remove redundant imports/helpers.
- [ ] Add a test that asserts a successful `link_text` match from `main/body`.
- [ ] Consider a global de-dup across methods to avoid duplicate validations for the same host+path.
- [ ] Optional: remove or wire `preferBodySniff` parameter in `validateCandidate`.

## Conclusion
The feature is effectively implemented and should improve menu URL discovery substantially. Addressing the small correctness issue in sitemap result metadata and tidying tests will solidify quality and maintainability.


