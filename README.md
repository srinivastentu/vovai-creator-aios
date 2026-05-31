# VOVAI CreatorOS

> Agentic AI content production OS. CreatorOS turns a single creative brief into finished, multi-format content — with humans guiding, reviewing, and approving at every critical gate. V1 in progress. (Forked from VOVAI eLearn AIOS; the sections below still describe the eLearn lineage and will be rewritten as CreatorOS takes shape.)

## Quick Start (Mac)

```bash
npm install
cp .env.example .env.local       # Fill in API keys
brew services start postgresql@17 # Start PostgreSQL
npx prisma migrate dev            # Set up database
npm run dev                       # http://localhost:3000
```

## Development with Claude Code
Open VS Code → Cmd+Shift+P → "Claude Code: Open in New Tab"
Tell Claude: "Read CLAUDE.md and tasks/todo.md"

## Architecture
See [docs/architecture/system-overview.md](docs/architecture/system-overview.md)

