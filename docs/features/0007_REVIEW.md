## Feature 0007 Review

### Scope verification against plan

- **Public URL flow unified to V2**: `server/src/api.ts` routes for both public (`/api/v1/public/parse-url`) and protected (`/api/v1/protected/menus/parse-url`) now triage to `documents`, transition to `queued`, and enqueue via `parseQueueV2.enqueueParseJob(...)`. Legacy `parseQueue` is removed from usage (commented out import). Responses include `documentId` and `parseJobId` as required.
- **Analysis queue draining**: `server/src/services/analysisQueue.ts` reschedules processing when `queue.length > 0` after finishing a job, ensuring the queue drains. Enqueue also kicks off processing when idle.
- **URL parser PDF handling**: `server/src/services/urlParser.ts` confines `parseUrl` to `html`/`javascript`. PDF strategies are intentionally not handled here; V2 pipeline handles PDFs directly. `detectDocumentType` returns a PDF default of `digital_pdf` on `application/pdf`.
- **Status endpoint refinement**: `server/src/api.ts` status route collates the latest analysis across all parse runs for a `documentId` rather than only the latest parse run, matching the refinement.
- **Phase 4 digital PDF refinements**: `server/src/services/parsers/pdfParser.ts` implements column detection (gap-based), heading heuristics with y-gap, and emits `layoutMetadata` with `columnCount`, `columnBoundaries`, `bandSize`, `totalLines`, and a `linesSample`.
- **Deprecation of V1 queue**: `server/src/services/parseQueue.ts` is no longer referenced by the API. File still exists in the repo and can be archived/removed as a follow-up.

### Tests added (per plan)

- **State machine**: `server/src/__tests__/stateMachine.spec.ts` covers valid and invalid transitions.
- **Parse router**: `server/src/__tests__/parseRouter.spec.ts` verifies mappings for `digital_pdf`, `scanned_pdf`, `html_static`, `html_dynamic` and throws on unsupported combos.
- **Document triage**: `server/src/__tests__/documentTriage.spec.ts` mocks CLI utilities for PDF text/no-text and triages URL case.
- **ParseQueueV2**: `server/src/__tests__/parseQueueV2.spec.ts` covers file doc path and URL doc path with retries/backoff, and asserts analysis job enqueue via spy.
- **Analysis queue**: `server/src/__tests__/analysisQueue.spec.ts` validates that a basic analysis run is inserted and processes a parsed run.

### Gaps and recommendations

- **Analysis queue tests**: The plan requested verifying metrics (`totalItems`, `avgPrice`, `minPrice`, `maxPrice`, `categoryDistribution`, `qualityScore`) and state transitions `analyzing → analyzed → done`, plus a failure path with retries/backoff leading to `failed_analysis`. Current test only checks insertion count. Recommend adding:
  - A successful path assertion on the computed metrics shape/values.
  - A failure scenario (e.g., mock DB insert to throw once/twice) to assert retry and final failure status.

- **ParseQueueV2 retry metadata**: Plan calls out “new `runId` per retry.” Current test exercises retries but doesn’t assert that each retry generated a fresh `runId`. Consider enhancing test to capture `parseRuns` and assert unique `id`s per attempt.

- **Restaurant menu source typing**: In public/protected URL routes, `restaurantMenuSources` are created with `sourceType: 'html'` prior to detection. If the URL is a PDF, this remains misaligned. Suggest updating this record after strategy detection (or defer insert until after triage) to reflect the actual `sourceType`, `documentType`, and `parseMethod`.

- **Documents `sourceType` value**: `triageDocument` sets `documents.sourceType` to `'upload'` for file inputs, but downstream logic treats any non-`'url'` as file, so behavior is correct. For consistency, consider standardizing to `'file'`.

- **HEAD requests in detection**: `UrlParser.detectDocumentType` uses a `HEAD` request that some sites reject or misconfigure. There’s a fallback to HTML parsing on error, which is acceptable; consider retrying with `GET` headers-only as a future improvement to reduce false negatives.

- **API size/structure**: `server/src/api.ts` is large. Non-blocking suggestion: split public/protected routers and utility helpers into separate modules to keep files smaller and easier to test.

### Style/consistency

- **Response payloads**: Status endpoint does not expose `rawOutput`, keeping payloads small per plan.
- **Backoff logic**: Both parse and analysis queues use exponential backoff with caps; tests cover parse backoff timing with faked timers.
- **Dependencies**: `pdfjs-dist` and `tesseract.js` added; matches plan guidance. Dev setup notes in the plan correctly call out `poppler` tools.

### Verdict

Implementation closely follows the plan. Core flows are unified on V2, PDF parsing refinements are implemented, and tests cover most scenarios. Addressing the noted test coverage gaps and minor data alignment improvements will bring this feature to completion-quality.


