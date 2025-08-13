## Feature 0006 Review: Phase 3 wiring and Phase 4 parsing kickoff

### Summary

- Parse queue V2 processes both file and URL-backed documents (when enqueued) with retries/backoff and transitions. Analysis pipeline produces structured results and progresses statuses to done. Status endpoint is present and omits raw bytes. PDF parsing (digital + OCR fallback) implemented with real libs.
- Key fixes needed: analysis queue should drain the queue; URL endpoint should enqueue the unified queue for triaged URLs; tests are not implemented.

### Plan compliance

- ParseQueueV2
  - Sets `inputType`/`inputSource` from `documents.sourceType` and `storagePath`.
  - URL strategy detection via `UrlParser.detectDocumentType` when `mimeType`/`documentType` not present.
  - Executes strategy-specific paths for `pdf_digital`, `pdf_ocr`, `html`/`javascript`.
  - Persists `parse_runs` including `status`, `confidence`, `rawOutput`, `errorMessage`, and `metadata.strategy`.
  - Transitions: `parsing → parsed` or `failed_parsing`; enqueues analysis on success.
  - Retries/backoff: exponential up to 60s; new `runId` on re-attempt; finalizes `failed_parsing` with reason.

- AnalysisQueue
  - Transitions to `analyzing` (best-effort), reads `parse_runs.rawOutput`, normalizes items, derives categories, computes metrics (`totalItems`, `avgPrice`, `minPrice`, `maxPrice`, `categoryDistribution`, `qualityScore`), writes `analysis_runs`, transitions `analyzing → analyzed → done`.
  - Retries/backoff on failure; finalizes `failed_analysis` with reason.

- API status endpoint
  - GET `/api/v1/documents/:documentId/status` returns sanitized `document`, latest `parseRun`, and latest `analysisRun` for that parse run, omitting raw bytes.

- PDF parsing
  - Digital PDFs via `pdfjs-dist` with token extraction and line grouping; price regex; heading/category heuristics; confidence.
  - OCR fallback via `pdftoppm` + `tesseract.js`; aggregates text, extracts items, confidence, cleans temp files.

- Dependencies and env
  - `pdfjs-dist` and `tesseract.js` added to `server/package.json`. Poppler required at system level (as planned).

### Notable issues and recommendations

1) Analysis queue does not drain remaining jobs

The queue processes a single job and stops if more jobs were already queued; it does not reschedule itself like ParseQueueV2 does.

```1:27:server/src/services/analysisQueue.ts
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    try {
      const job = this.queue.shift();
      if (job) await this.processJob(job);
    } finally {
      this.isProcessing = false;
    }
  }
```

Recommendation: after finishing, if `this.queue.length > 0`, schedule the next tick (mirroring `ParseQueueV2`).

2) Public URL endpoint does not enqueue unified parse for the triaged document

The endpoint triages the URL and returns a `documentId` but only enqueues the legacy URL pipeline. This leaves the triaged document stuck at `uploaded` and not processed by `ParseQueueV2`.

```298:315:server/src/api.ts
    // Enqueue parsing job (legacy URL pipeline)
    const jobId = await parseQueue.enqueueParseJob(sourceId, true);

    // Also create a document via triage for unified pipeline tracking
    const triage = await triageDocument({ type: 'url', source: body.url });
    
    return c.json({
      success: true,
      uploadId: publicUploadId,
      menuId: menuResult[0].id,
      sourceId,
      documentId: triage.documentId,
      ...
    });
```

Recommendation: set `queued` and enqueue V2 for the triaged document as is done for file uploads.

- Add:
  - `await transitionDocumentStatus(triage.documentId, 'queued');`
  - `parseQueueV2.enqueueParseJob(triage.documentId, 'v1');`

3) Status endpoint “latest analysis” selection

The endpoint returns the latest analysis run only for the latest parse run. If there are multiple parse runs, a later analysis might exist for a previous run. Consider selecting the latest analysis across all runs for the document, or returning the latest per-run objects explicitly.

```925:982:server/src/api.ts
    const latestParseRun = (await db.select().from(parseRuns)
      .where(eq(parseRuns.documentId, documentId))
      .orderBy(desc(parseRuns.startedAt))
      .limit(1))[0];
    let latestAnalysisRun;
    if (latestParseRun) {
      latestAnalysisRun = (await db.select().from(analysisRuns)
        .where(eq(analysisRuns.parseRunId, latestParseRun.id))
        .orderBy(desc(analysisRuns.startedAt))
        .limit(1))[0];
    }
```

4) PDF parsing breadth vs. plan

- Current digital PDF parser groups by y-bands and extracts prices/headings; column detection and `layoutMetadata` are not included. This is acceptable for a Phase 4 kickoff but worth noting as a next-step enhancement.

5) urlParser PDF branches return error responses

`UrlParser.parseUrl` attempts to call `parseDigitalPdf(url)` without base64, which returns "Missing file content". This branch is currently unused by `ParseQueueV2` (which handles PDFs properly). To avoid confusion, either remove the PDF branches from `parseUrl` or implement a fetch-to-base64 path there as well.

6) Tests are missing

- The `server` workspace declares `vitest` but tests listed in the plan are not present. Add unit tests for `stateMachine`, `parseRouter`, `documentTriage`, `parseQueueV2` (including retry/backoff), and `analysisQueue`.

### Data alignment checks

- `parse_runs.rawOutput` stores the full parse result; status endpoint omits it (good).
- Field names and shapes in status endpoint match the plan: `document`, `parseRun`, `analysisRun` with the expected fields.
- No endpoints return raw bytes.

### Style/maintainability

- Minor `as any` casts in DB writes are present; acceptable for now but worth tightening when adding tests.
- `pdfjs-dist` import uses the legacy build; it works in Node via ESM dynamic import.

### Action items

- [ ] Drain `AnalysisQueue` by scheduling the next tick when more jobs remain.
- [ ] In `/public/parse-url`, also enqueue `ParseQueueV2` for the triaged document and set status `queued`.
- [ ] Optionally adjust status endpoint to select latest `analysisRun` across all runs for the document (or document behavior clearly).
- [ ] Consider adding `layoutMetadata` and simple column detection to `parseDigitalPdf` in a follow-up.
- [ ] Either remove or implement PDF handling in `UrlParser.parseUrl` to avoid confusing error paths.
- [ ] Add the tests outlined in the plan.


