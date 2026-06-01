// Env setup for the V1 acceptance test (CR-12).
//
// Runs as a vitest setupFile (vitest.e2e.config.ts) BEFORE the test module is
// imported, so .env.local secrets are present before any module reads
// process.env. Loads .env.local first (canonical local secrets — the API keys),
// then .env (DATABASE_URL only) — earlier file wins, matching Next.js precedence
// and the pipeline scripts.
import { config as loadEnv } from 'dotenv'

loadEnv({ path: ['.env.local', '.env'] })
