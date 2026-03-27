---
paths: ["src/app/api/**"]
---
# API Conventions
- All API routes use Next.js App Router (route.ts files)
- Use Server-Sent Events (SSE) for streaming loop progress
- Every response includes: success, data, error
- Use Zod for request validation at API boundary
- Cost tracking in every response that triggers LLM calls
