## Feature 0005 Review (Phases 2–3)

### Scope implemented

- Document triage service created and used by public/protected upload endpoints.
- Local file storage layer writes uploads to `server/uploads/documents/{userId}/{id}.ext` with `.gitignore` entry.
- New lineage tables: `documents`, `parse_runs`, `analysis_runs` defined and indexed; migrations present.
- State machine module added for guarded status transitions.
- New parse queue (`ParseQueueV2`) and analysis queue scaffolding added.
- Public/protected API endpoints stop returning raw bytes and enforce 10 MB limit.

### Matches to plan

- Document triage (Phase 2)
  - Stores bytes to FS and creates `documents` row; detects PDF type via Poppler tools; routes to strategy.
    
    ```1:64:server/src/services/documentTriage.ts
export async function triageDocument(input: DocumentInput): Promise<DocumentTriageResult> {
  const db = await getDatabase();
  if (input.type === 'file') {
    const src = input.source as { content: string; mimeType: string; name?: string };
    const storagePath = await storeDocument(src.content, input.userId || 'public', src.name || 'document.pdf');
    const detectedType = await detectDocumentType(storagePath, src.mimeType);
    const strategy = routeToParser(detectedType, src.mimeType);
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(documents).values({
      id: documentId,
      userId: input.userId || null,
      originalName: src.name || null,
      mimeType: src.mimeType,
      fileSize: null,
      storagePath,
      sourceType: 'upload',
      sourceUrl: null,
      documentType: detectedType,
      status: 'uploaded',
    });
    return {
      documentId,
      documentType: detectedType,
      processingStrategy: strategy,
      storageLocation: storagePath,
      contentAnalysis: { confidence: 80 },
    };
  }
}
```

- File storage (Phase 2)
  - Safe paths, base dir creation, `retrieveDocument` implemented. `.gitignore` includes `server/uploads/`.
    
    ```4:31:server/src/services/fileStorage.ts
const BASE_DIR = process.env.UPLOADS_ROOT
  || process.env.DOCUMENTS_BASE_DIR
  || path.join(process.cwd(), 'uploads', 'documents');
...
export async function storeDocument(contentBase64: string, userId: string, filename: string): Promise<string> {
  await ensureBaseDir();
  const userDir = path.join(BASE_DIR, safeUserId);
  ...
  await fs.writeFile(filePath, buffer);
  return filePath;
}
```

- Schema and indexes (Phase 2)
  - `documents` + indexes, `parse_runs`, `analysis_runs` present in schema and migrations.
    
    ```5:29:server/src/schema/documents.ts
export const documents = appSchema.table(
  'documents',
  { id: text('id').primaryKey(), userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), ... },
  (table) => ({
    idxDocumentsUserId: index('idx_documents_user_id').on(table.userId),
    idxDocumentsStatus: index('idx_documents_status').on(table.status),
    idxDocumentsSourceType: index('idx_documents_source_type').on(table.sourceType),
  })
);
```

- API integration + payload policy (Phase 2)
  - Public/protected upload call triage; 413 enforced; raw `fileContent` not returned.
    
    ```133:141:server/src/api.ts
// Enforce upload size limit (10 MB)
const maxSizeBytes = 10 * 1024 * 1024;
if (typeof body.file.size === 'number' && body.file.size > maxSizeBytes) {
  return c.json({ ... }, 413);
}
```

- State machine & queues (Phase 3)
  - `transitionDocumentStatus` validates and persists; `ParseQueueV2` writes to `parse_runs`; `AnalysisQueue` scaffolds writes to `analysis_runs`.
    
    ```22:36:server/src/services/stateMachine.ts
export async function transitionDocumentStatus(documentId: string, newStatus: DocumentStatus, reason?: string): Promise<void> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const current = (doc?.status as DocumentStatus) || 'uploaded';
  if (!validTransitions[current]?.includes(newStatus)) {
    throw new Error(`Invalid transition from ${current} to ${newStatus}`);
  }
  await db.update(documents)
    .set({ status: newStatus, statusReason: reason ?? null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}
```

### Gaps, issues, and risks

- State machine transition bug
  - `done` should be terminal but currently allows `done → analyzing`.
    
    ```10:19:server/src/services/stateMachine.ts
const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
  ...
  analyzed: ['done'],
  done: ['analyzing'], // should be []
  failed_parsing: ['queued'],
  failed_analysis: ['analyzing'],
};
```

- Unified pipeline not fully wired (Phase 3)
  - Upload endpoints create `documents` but do not enqueue `ParseQueueV2` jobs; no transition to `queued`.
  - `AnalysisQueue` is never triggered after parse completion and does not update `documents` status to `analyzing`/`analyzed`/`done`.

- URL triage incomplete
  - `triageDocument` URL branch is a placeholder; does not inspect HTML for dynamic vs static. Plan calls for SPA detection.

- Migration duplication/drift
  - `documents`/`parse_runs`/`analysis_runs` are created in both `0000_perpetual_northstar.sql` and `0005_slim_nemesis.sql`. Redundant but harmless with IF NOT EXISTS; still increases drift risk. Journal includes `0005`.

- Type alignment
  - `ParseResult.parseMethod` is `string` while strategies are strongly typed (`ParseStrategy`). Consider tightening.

- Minor: Status coverage
  - No explicit `queued` transition during enqueue; endpoints jump from `uploaded` directly to `parsing` later when processed.

### Recommendations (concrete edits)

- Fix terminal transition
  - In `server/src/services/stateMachine.ts`, set `done: []`.

- Enqueue parse on triage (unified path)
  - After successful triage in both upload endpoints, enqueue `ParseQueueV2.enqueueParseJob(documentId, parserVersion)`; transition document to `queued` at enqueue time.
  - On `ParseQueueV2` completion success, trigger `AnalysisQueue.enqueueAnalysisJob(runId, analysisVersion)` and transition to `analyzing` before analysis, then to `analyzed`/`done` after.

- URL triage
  - Enhance URL branch to use `UrlParser.detectDocumentType` and set `documentType`/`processingStrategy` accordingly.

- Migrations
  - Either keep the tables solely in `0000` and drop them from `0005`, or ensure `0005` contains only necessary diffs (FK additions/adjustments). Commit `server/drizzle/0005_slim_nemesis.sql` and `server/drizzle/meta/0005_snapshot.json` together if retained.

- Types
  - Change `ParseResult.parseMethod: string` to `ParseStrategy` to avoid case/shape drift.

### Non-functional checks

- Payload policy satisfied: 10 MB cap and no raw bytes returned in responses (sanitization in menu getters).
- Rate limiting in place for public routes.
- Poppler dependency used for PDF detection; ensure dev setup doc is followed (`brew install poppler`).

### Conclusion

Phases 2 core deliverables are in place and used by the API. Phase 3 is partially implemented (state machine, queues, router exist) but not fully wired end-to-end: enqueueing, status transitions beyond `parsed`, and analysis triggering remain. Address the listed fixes to complete Phase 3 and stabilize migrations.

### Feature 0005 Review (Phase 1)

This review verifies Phase 1 of the Unified PDF Processing Architecture and assesses the updated auth token verification and middleware behavior.

### What was implemented (Phase 1)

- **Authenticated PDF upload endpoint**: Implemented at `/api/v1/protected/upload-menu`. It reuses the public path’s immediate parsing flow, stores a `menu_uploads` record, invokes the mock `parseDigitalPdf`, computes metrics, creates categories and items, and returns a success response.

```542:673:server/src/api.ts
protectedRoutes.post('/upload-menu', async (c) => {
  // ... creates menuUploads, calls parseDigitalPdf, computes metrics,
  // writes categories and menu items, returns success
});
```

- **UI integration (MenuInsights)**: The dashboard integrates the existing `MenuUpload` component under the “Upload PDF” tab and refreshes the user’s menus post-upload.

```367:373:ui/src/pages/MenuInsights.tsx
<TabsContent value="upload" className="space-y-6">
  <MenuUpload onFileUpload={handleFileUpload} />
</TabsContent>
```

- **Client API wiring**: Authenticated upload hits `/api/v1/protected/upload-menu` with base64 file content; user menus are fetched from `/api/v1/protected/menus`.

```54:66:ui/src/lib/serverComm.ts
export async function uploadMenu(menuData) {
  const response = await fetchWithAuth('/api/v1/protected/upload-menu', { ... });
  return response.json();
}
```

### Auth changes verified

- **Emulator token decoding (base64url) and relaxed validation in dev**: Accepts tokens that have a `sub` without strict `aud/iss` verification in development.

```33:59:server/src/lib/firebase-auth.ts
if (isDevelopment()) {
  // base64url decode payload; require only `sub` in dev
  // return { id: payload.sub, email: payload.email }
}
```

- **User upsert/fetch hardening**: Upsert by `id` with `onConflictDoNothing`, then fetch by `id`, falling back to `email` if not found.

```28:57:server/src/middleware/auth.ts
await db.insert(users).values({ id: firebaseUser.id, email: firebaseUser.email!, ... }).onConflictDoNothing();
// fetch by id; if not found and email exists, fetch by email
```

### Validation and data alignment

- The server writes numeric metrics as strings (e.g., `toFixed(2)`), which is valid for Drizzle `decimal` columns. The UI safely parses numerical fields before display.

```91:105:ui/src/pages/MenuInsights.tsx
totalItems: safeParseFloat(menu.totalItems),
avgPrice: safeParseFloat(menu.avgPrice),
priceRange: { min: safeParseFloat(menu.minPrice), max: safeParseFloat(menu.maxPrice) },
```

- The server returns `createdAt` and other fields expected by the UI; ordering uses `createdAt` descending.

### Issues found and recommendations

- Email non-null requirement vs. relaxed dev tokens
  - **Issue**: `users.email` is `not null` and unique, yet the dev verifier only guarantees `sub`. Insert uses `firebaseUser.email!` (non-null assertion), which will throw if the emulator token lacks `email`.
  - **Recommendation**: In dev, require `email` alongside `sub` (fail fast if missing) or generate a deterministic placeholder (e.g., `${sub}@dev.local`) strictly for dev. Prefer the first option to avoid polluting data. Alternatively, loosen the schema to allow nullable emails, but that weakens invariants.

- Large payloads: base64 file content returned to clients
  - **Issue**: `analysisData` stores `fileContent` (base64) and is returned by `/protected/menus`. This increases response size and exposes raw uploads.
  - **Recommendation**: Strip `fileContent` from responses or store it outside `analysisData` (e.g., ephemeral storage) and omit from selects. This can be addressed alongside Phase 2 storage service.

- Minor UI prop mismatch for `Progress`
  - **Issue**: A `color` prop is passed to `Progress`, but the component doesn’t support it; the prop becomes an unknown DOM attribute.
  - **Recommendation**: Remove the `color` prop and instead apply a conditional class to `Progress` or its indicator via `className`.

- Duplicate import in `menus` schema
  - **Issue**: `users` is imported twice in `server/src/schema/menus.ts`.
  - **Recommendation**: Remove the duplicate import at the bottom to match project style and avoid linter warnings.

### Plan adherence

- Phase 1 goals are met:
  - Authenticated upload endpoint created and hooked into the dashboard for quick iteration without reCAPTCHA.
  - Reused public parsing logic for immediate feedback (mock parser maintained for now).

- Later phases (triage, storage, unified documents, queue separation, layout/OCR parsing, public path migration) are not implemented yet, as expected.

### Environment and setup

- Ensure the following for local dev consistency:
  - `server/.env` includes `FIREBASE_PROJECT_ID=demo-project` and `FIREBASE_AUTH_EMULATOR_HOST=localhost:5503`.
  - Frontend points to the API: set `VITE_API_URL` accordingly (e.g., http://localhost:5500).

### Overall

Solid Phase 1 integration that removes reCAPTCHA friction for development and validates the end-to-end flow. Address the email guarantee in dev tokens, trim base64 from menu responses, and tidy minor UI/schema nits. These are small changes and won’t block Phase 2 work.


