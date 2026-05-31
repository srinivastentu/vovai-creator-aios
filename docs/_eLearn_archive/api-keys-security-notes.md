# API Keys in Tests — Security Notes

## Now (local dev)
What you're doing is fine:
```bash
set -a && source .env.local && set +a && RUN_LIVE_TESTS=1 npx vitest run ...
```

Checklist:
- `.env.local` is in `.gitignore` (Next.js default — verify)
- `.env.local` is NOT in `.env` or `.env.example` with real keys
- `RUN_LIVE_TESTS=1` gate means CI never accidentally burns API credits

## Later (CI/team) — add when needed, not now

1. **Vitest env loading** — add `dotenv/config` to vitest setup so you don't need the `source` dance:
   ```ts
   // vitest.config.ts
   export default defineConfig({
     test: {
       setupFiles: ['./tests/setup.ts'],
     }
   })

   // tests/setup.ts
   import { config } from 'dotenv'
   config({ path: '.env.local' })
   ```

2. **CI secrets** — when you add GitHub Actions, use repository secrets:
   ```yaml
   # .github/workflows/live-tests.yml (manual trigger only)
   on: workflow_dispatch
   env:
     ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
     OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
     RUN_LIVE_TESTS: 1
   ```
   Never run live tests on every push — manual dispatch or nightly only.

3. **Key rotation** — when you have team members, use separate API keys per environment (dev/staging/prod). Revoke and rotate if any key hits version control.

4. **Cost guardrails** — set billing alerts and monthly caps on both Anthropic and OpenAI dashboards. A runaway loop test with max 5 iterations is cheap ($0.04), but a bug that retries infinitely is not.

## Things that would be security issues
- API keys committed to git (even in a "test" branch)
- Keys in `package.json` scripts
- Keys in test fixture files
- `.env.local` not in `.gitignore`
- Live tests running in CI without `workflow_dispatch` gate