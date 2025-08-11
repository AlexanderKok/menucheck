# KaartKompas API

Hono-based API server for KaartKompas. Supports local Node.js dev and Cloudflare Workers deployment.

## Environment Setup

The API can run either locally (Node.js) or on Cloudflare Workers. Use the following files/locations for environment variables:

- Local Node.js dev: `server/.env` (dotenv is loaded by `src/api.ts` via `dotenv/config`)
- Cloudflare Workers dev/prod: `server/wrangler.toml` and Cloudflare Dashboard → Workers & Pages → Settings → Variables
- CI (optional): set env vars in your CI provider secrets

1. Create your local development variables file:
   ```bash
   # Create .env for Node.js local dev
   cd server
   cp .env.example .env
   ```

2. Configure your environment variables in `server/.env`:
   ```env
   # Database (local dev can omit to use embedded or scripts)
   DATABASE_URL=postgresql://postgres:password@localhost:5502/postgres

   # Google reCAPTCHA (required for public routes). For local dev you can use dev-token from UI
   RECAPTCHA_SECRET_KEY=your-recaptcha-secret

   # Firebase project used by backend to verify tokens
   FIREBASE_PROJECT_ID=your-firebase-project-id

   # Optional runtime hint for code paths
   RUNTIME=node
   ```

3. For Cloudflare Workers, set variables via `wrangler.toml` (for dev) and Dashboard (for prod). Example snippet:
   ```toml
   name = "kaartkompas-api"
   [vars]
   FIREBASE_PROJECT_ID = "your-firebase-project-id"
   # never commit secrets here; set RECAPTCHA_SECRET_KEY and DATABASE_URL in Dashboard secrets
   ```

## Firebase Setup

The API uses Firebase Authentication. To set up Firebase:

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Select or create your project
3. Copy your project ID from the project settings
4. Add it to your environment variables as `FIREBASE_PROJECT_ID`

Frontend config: place your web app config in `ui/src/lib/firebase-config.json` (or `ui/src/lib/firebase-config.template.json` → copy to `firebase-config.json`).

The API uses Firebase's public JWKS endpoint to verify tokens, so no additional credentials are needed.

## Development Server

Local Node.js dev:

```bash
cd server
pnpm dev
```

Cloudflare Workers dev:

```bash
cd server
pnpm wrangler dev
```

## Development

To run the API locally:
```bash
pnpm wrangler dev
```

This will:
- Load variables from `.env` (Node) or Wrangler (`[vars]`) / Dashboard (Workers)
- Start the server (default worker dev port: 8787)

Your API will be available at `http://localhost:8787` (or your configured port).

## OCR/PDF Utilities (parsing)

Some parsing paths use external tools (only needed for OCR/triage and not used in pure digital PDF path):

- poppler-utils: `pdftoppm`, `pdfinfo`
- tesseract OCR: `tesseract`

Install:

- macOS: `brew install poppler tesseract`
- Ubuntu/Debian: `apt-get update && apt-get install -y poppler-utils tesseract-ocr`

## API Authentication

All routes under `/api/v1/protected/*` require authentication. To authenticate requests:

1. Include the Firebase ID token in the Authorization header:
   ```
   Authorization: Bearer <firebase-id-token>
   ```

2. The token will be verified and the user information will be available in protected routes.

Example protected route: `/api/v1/protected/me` returns the current user's information.

## Deployment

To deploy to production:
```bash
pnpm wrangler deploy
```

This will deploy to your Cloudflare Workers environment using the name specified in `wrangler.toml`. Make sure to configure your production environment variables in the Cloudflare dashboard with your production values for:
- DATABASE_URL
- FIREBASE_PROJECT_ID

## Environment Variables Reference

Set these in `server/.env` for local Node dev, and in Cloudflare Dashboard for Workers prod. Defaults shown where applicable.

- DATABASE_URL: Postgres connection string. Example local: `postgresql://postgres:password@localhost:5502/postgres`. For Neon/Supabase, copy from provider.
- RECAPTCHA_SECRET_KEY: Secret from Google reCAPTCHA v2/Enterprise; required for public routes. For local UI you can pass `dev-token` to bypass, but backend still checks env.
- FIREBASE_PROJECT_ID: Your Firebase project ID (from Firebase Console → Project Settings → General).
- RUNTIME: Optional hint set to `node` in local Node.js; Workers will set env via bindings.

Optional (emulators/local tools):
- FIREBASE_AUTH_EMULATOR_HOST: Set by dev scripts for local emulator; backend automatically treats as development if present.

## Troubleshooting

If you encounter issues:

1. Ensure all required environment variables are set in `.dev.vars` for local development
2. Verify your database connection string is correct for your environment
3. Check that you're using the correct port and it's not in use by another application
4. Make sure your Cloudflare account has the necessary permissions and configurations
5. Verify that your worker name in `wrangler.toml` matches your intended Cloudflare Worker name
6. For Firebase authentication issues:
   - Verify your Firebase project ID is correctly set in your environment variables
   - Ensure the client is sending a valid Firebase ID token 

## Database Setup

### Working with the Database

This project uses [Drizzle ORM](https://orm.drizzle.team) with a Neon Postgres database. The database schema is defined in TypeScript under `src/schema/`.

### Setting Up Your Database

1. Get your database connection string from Neon/Supabase or run embedded/local Postgres:
   ```
   # Neon example
   DATABASE_URL=postgres://user:password@your-neon-host/dbname
   # or local embedded defaults to a dynamic port via scripts; see logs or use 5502 during dev
   ```

2. Add it to your `.dev.vars`:
   ```
   DATABASE_URL=your-connection-string
   ```

3. Push the schema to your database:
   ```bash
   pnpm dlx dotenv-cli -e .env -- pnpm db:push
   ```

This command will create or update your database tables to match your schema. Run it whenever you make changes to files in `src/schema/`.