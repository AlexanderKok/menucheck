Complete the authenticated upload UX and “My Menus” list — Code Review

Overview
- The backend and frontend changes largely implement the plan in `docs/features/0012_PLAN.md`.
- Core flows work: authenticated uploads, protected document-status endpoint, linking `menu_uploads.document_id`, and client polling.

What was implemented (matches plan)
- Backend
  - Link `menu_uploads.document_id` to unified `documents` model.
    - Schema change present in `server/src/schema/menus.ts` and migrations update constraints.
  - Protected document-status endpoint: `GET /api/v1/protected/documents/:documentId/status` with ownership checks.
  - Authenticated upload endpoints set `documentId` after triage for both PDF and URL flows and enqueue parse jobs.
  - `GET /api/v1/protected/menus` enriches menus with latest parse/analysis status when `documentId` is present and sanitizes large fields.
- Frontend
  - `PublicUpload` now calls protected endpoints when authenticated and starts polling using a new `useDocumentStatusPoll` hook.
  - `serverComm` includes `getDocumentStatus(documentId)` hitting the protected endpoint with auth.
  - A basic “My Menus” experience exists via `MenuInsights` history tab using `getUserMenus`.

Evidence

Protected status endpoint with ownership check:
```1145:1209:server/src/api.ts
  // Protected alias for document status with ownership enforcement
  api.get('/protected/documents/:documentId/status', authMiddleware, async (c) => {
    try {
      const db = await getDatabase();
      const documentId = c.req.param('documentId');
      const user = c.get('user');
      const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      if (!doc || (doc as any).userId !== user.id) {
        return c.json({ error: 'Not found' }, 404);
      }
      // ...
      return c.json({ document: docResp, parseRun: parseResp, analysisRun: analysisResp });
    } catch (error) {
      // ...
    }
  });
```

Linking `menu_uploads` to `documents`:
```6:13:server/src/schema/menus.ts
export const menuUploads = appSchema.table('menu_uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  restaurantId: text('restaurant_id').references(() => restaurants.id, { onDelete: 'set null' }),
  documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
  // ...
});
```

Client polling setup:
```31:60:ui/src/hooks/useDocumentStatusPoll.ts
export function useDocumentStatusPoll(
  documentId: string | null | undefined,
  opts: { intervalMs?: number; maxWaitMs?: number } = {}
) {
  // ...
  const fetchOnce = useCallback(async () => {
    if (!documentId) return;
    try {
      const res = await api.getDocumentStatus(documentId);
      setStatus(res);
      setError(null);
      return res as DocumentStatus;
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch status');
      return null;
    }
  }, [documentId]);
```

Issues found
- Polling stops too early when runs aren’t created yet
  - The terminal-state logic treats missing runs as “done,” so polling can stop before the first `parseRun` is created.
  - Current logic:
```47:53:ui/src/hooks/useDocumentStatusPoll.ts
  const isTerminal = useCallback((s: DocumentStatus | null) => {
    if (!s) return false;
    const parseDone = !s.parseRun || ['completed', 'failed'].includes(s.parseRun.status);
    const analysisDone = !s.analysisRun || ['completed', 'failed'].includes(s.analysisRun.status);
    const docDone = ['completed', 'failed'].includes(s.document.status);
    return (parseDone && analysisDone) || docDone;
  }, []);
```
  - Expected: consider missing runs as “not done,” otherwise initial fetch returns terminal and stops polling immediately.

- Client-side 10MB limit not enforced
  - The server enforces 10MB with 413, but the client doesn’t pre-validate file size per the plan.
  - `PublicUpload` should block files >10MB with a clear error before uploading and also map 413 to a friendly message.

- “My Menus” list does not render latest parse/analysis status fields
  - The server returns `latestParseStatus`, `latestAnalysisStatus`, and `lastUpdatedAt` when `documentId` exists, but `MenuInsights` only shows `menu.status`.
  - Not a blocker, but the plan recommends surfacing these fields with badges/timestamps.

- N+1 queries in `/protected/menus`
  - For each menu with `documentId`, the server fetches latest parse and analysis runs individually. Acceptable for small lists; consider batching later.

Data alignment and response contracts
- Status endpoint response matches the documented shape.
- `getUserMenus` returns dates and numeric fields; the UI safely parses numbers and treats dates as strings. OK.

Suggestions (fixes)
- Fix polling terminal logic:
  - Change to only treat runs as done if they exist and are terminal. Example:
    - `const parseDone = s.parseRun ? ['completed','failed'].includes(s.parseRun.status) : false;`
    - `const analysisDone = s.analysisRun ? ['completed','failed'].includes(s.analysisRun.status) : false;`
    - `return (parseDone && analysisDone) || ['completed','failed'].includes(s.document.status);`

- Add client-side file size check in `PublicUpload`:
  - Before reading/encoding the file, check `file.size > 10 * 1024 * 1024` → show a clear error and skip upload.
  - Map 413 responses to a “Maximum upload size is 10 MB” message.

- Enhance “My Menus” list in `MenuInsights`:
  - If `menu.documentId` present, render `latestParseStatus`, `latestAnalysisStatus`, and `lastUpdatedAt` from API for better UX.

Conclusion
- The plan is substantially implemented and functional. Addressing the polling logic and client-side size validation will improve correctness and UX. Surfacing per-menu latest statuses will align the dashboard more closely with the plan’s recommendations.


