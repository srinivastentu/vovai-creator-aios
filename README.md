# VOVAI eLearn AIOS

> Agentic AI-powered eLearning OS platform. AI agent teams produce broadcast-quality eLearning videos while humans guide and approve at every gate.

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
