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


