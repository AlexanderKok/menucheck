## Feature 0008: Testing & Parser Reliability Hardening – REVIEW

### Plan coverage

- 1) Parse Queue V2 tests: partial
  - parse run insert/update asserted superficially (id/documentId/parserVersion/parseMethod/status). Missing explicit checks for `startedAt`, `completedAt`, `confidence`, `rawOutput` fields and error message paths.
  - Analysis enqueue is verified after success via `__test__drainOnce()`, but not strictly ordered against `parseRuns.status === 'completed'` with an assertion.

- 2) Digital PDF layout metadata tests: partial
  - Two‑column scenario covered and asserts `layoutMetadata` with `columnCount >= 2`, `columnBoundaries`, `linesSample`, `totalLines`, `bandSize`.
  - Single‑column fallback test is missing.

- 3) Analysis queue failure path tests: partial
  - Retries/backoff exercised with fake timers; asserts at least one failed run.
  - Missing assertions that retries reach `maxRetries`, document transitions to `failed_analysis`, and that a final `analysis_runs` record has `status='failed'` with `errorMessage`.
  - Success‑path metrics not asserted (should verify `metrics.totalItems`, `avgPrice`, `minPrice`, `maxPrice`, `qualityScore > 0`).

- 4) End‑to‑end route tests: partial
  - Public `POST /api/v1/public/parse-url` test asserts `documentId` and `parseJobId` and absence of legacy `jobId`.
  - Protected `POST /api/v1/protected/menus/parse-url` test is lenient on status and does not assert response shape; auth isn’t stubbed to reliably hit handler.

- 5) Cleanup (legacy queue): partial
  - URL routes use only V2 queue. `services/parseQueue.ts` remains and isn’t marked deprecated.

- 6) Route updates for source tracking: partial
  - Both public and protected URL routes update `restaurant_menu_sources` with `sourceType`, `documentType`, `parseMethod` based on triage.
  - BUG: Public route inserts `restaurant_menu_sources` with `restaurantId: ''` and `userId: ''` (empty strings). Schema requires non‑null FKs; this will violate constraints in real DB.

- 7) PDF parsing refinements: mostly done
  - Threshold bumped to `Math.max(50, mean + std)` (plan suggested 40 min). Added stricter heading detection using uppercase/no‑price and y‑band jump. Right‑aligned price clustering not explicitly handled beyond improved gap logic.

- 8) CI stability: done
  - Vitest configured with `--run`, non‑watch, timeouts present.

- 9) Docs for dev env/OCR: partial
  - Server README documents `poppler`/`tesseract` installation and env vars.
  - Root README lacks these OCR notes and environment reminders from the plan.

- 10) Follow‑ups: n/a (not required)

### Issues & risks

- Schema/route mismatch
  - `restaurant_menu_sources` requires non‑null `restaurantId` and `userId`, but public route writes empty strings. This likely fails at runtime. Consider allowing nulls for public captures or don’t create a source row for public until a restaurant/user exists.
  - Protected route uses `restaurantId || ''` when restaurant isn’t provided; same constraint issue.

- reCAPTCHA env source
  - `verifyRecaptcha` reads `process.env` directly. In Workers, env comes from `c.env`. Use `getEnv('RECAPTCHA_SECRET_KEY')` to support both runtimes.

- Test gaps against acceptance criteria
  - Missing single‑column PDF test.
  - Missing strict assertions around `parse_runs` timestamps/payload and ordering before analysis enqueue.
  - Missing `failed_analysis` transition and final failed `analysis_runs` checks; missing metrics assertions for success.
  - Protected route e2e should stub auth to assert response shape.

- Legacy queue cleanup
  - `services/parseQueue.ts` still present without deprecation header; could confuse future contributors.

### Recommendations

- Tests
  - Extend `parseQueueV2.spec.ts` to assert `startedAt`/`completedAt`, `confidence`, `rawOutput`, and that analysis enqueue occurs only after `status === 'completed'` (e.g., spy and check run state just before call).
  - Add single‑column scenario in `pdfParser.digital.spec.ts` and assert `columnCount === 1` and empty `columnBoundaries`.
  - In `analysisQueue.spec.ts`, simulate thrown errors to hit backoff; advance timers through `maxRetries` and assert document status `failed_analysis`, plus a terminal `analysis_runs` with `status='failed'` and `errorMessage`. Add a success test asserting metrics (`totalItems`, `avgPrice`, `minPrice`, `maxPrice`, positive `qualityScore`).
  - For protected route, stub `authMiddleware` to inject a user or expose the sub‑router to bypass auth, then assert the response includes `documentId` and `parseJobId` with no `jobId`.

- Routes/schema
  - Public route: avoid inserting `restaurant_menu_sources` until a restaurant/user exists, or change schema to allow nullable `restaurantId`/`userId`. If keeping the row, set them to `null` (and relax schema), not empty strings.
  - Protected route: avoid `''` fallbacks; use `null` and relax schema or make restaurant creation mandatory for this endpoint.
  - Update `verifyRecaptcha` to use `getEnv()` to function on Workers.

- Cleanup
  - Add a deprecation header to `server/src/services/parseQueue.ts` and open a task to remove it once any lingering scripts/tests are migrated.

- Docs
  - Mirror the OCR/tooling notes and env reminders from `server/README.md` into root `README.md` under a concise "Prereqs for parsing" section.

### Overall

Core V2 flow and PDF parsing refinements are in place. The most pressing issues are the `restaurant_menu_sources` FK mismatch for public/protected URL routes and several missing assertions to satisfy the acceptance criteria. Addressing these will close the gap with the plan.


