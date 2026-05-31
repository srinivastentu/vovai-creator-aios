# CR-0 — Fork Bootstrap (Purge eLearn Domain)

Paste this entire prompt into Claude Code as the first message of a
fresh session. Settings: `/effort ultracode`, Auto Mode on.

The `cr-step-protocol` skill (under `.claude/skills/cr-step-protocol/`)
loads automatically and walks you through this.

---

## Session prompt

```
Read CLAUDE.md. This is CreatorOS CR-0: Fork Bootstrap.

Prior step CR-0.5 done: docs/ + .claude/ placed; CLAUDE.md addendum
applied; tag CR-0.5-knowledge-bootstrap pushed.

Goal: purge eLearn Domain content from the codebase. Scaffold the
CreatorOS Domain Workflow skeleton (empty folders, README files,
no logic yet). Tag CR-0-fork-bootstrap.

NO new source logic in this step. Removal + skeleton scaffolding +
test archive only.

Read first:
  - CLAUDE.md (full file, including the routing table addendum)
  - docs/01-architecture/core-vs-domain.md (what stays vs goes)
  - docs/03-decisions/creator-decisions-log.md (the bare-skeleton
    purge decision dated 2026-05)

# Verify prerequisites

  pwd                                          (ends in vovai-creator-aios)
  git status                                   (clean tree)
  git tag | grep CR-0.5-knowledge-bootstrap    (must exist)
  npm run typecheck                            (exit 0)
  npm run test                                 (baseline; record count)

If any prereq fails, STOP and report.

# Step 1 — Archive eLearn Domain

The following move out of active code into archive folders.
Archive folders preserve the content for reference; they're git-tracked.
After this step, NOTHING under src/lib/domain/ remains.

  mkdir -p src/_eLearn_archive_domain
  mkdir -p src/_eLearn_archive_pages
  mkdir -p src/_eLearn_archive_components
  mkdir -p src/_eLearn_archive_api
  mkdir -p tests/_eLearn_archive

Move src/lib/domain/ to src/_eLearn_archive_domain/:
  mv src/lib/domain/* src/_eLearn_archive_domain/ 2>/dev/null
  mv src/lib/domain/.* src/_eLearn_archive_domain/ 2>/dev/null || true
  rmdir src/lib/domain 2>/dev/null
  mkdir -p src/lib/domain

# Step 2 — Archive eLearn-flavored API + UI (bare skeleton purge)

Per the bare-skeleton decision, archive ALL of src/app/api/ except a
.gitkeep marker for the directory. CreatorOS rebuilds pipeline-shaped
routes from scratch in CR-2 onward.

  # Move API
  cp -r src/app/api/* src/_eLearn_archive_api/ 2>/dev/null
  rm -rf src/app/api/*
  touch src/app/api/.gitkeep

  # Move eLearn-flavored UI components
  # Keep: src/components/ui (shadcn primitives), layout files
  # Archive: everything else
  cd src/components
  for d in $(ls -d */ 2>/dev/null); do
    name="${d%/}"
    if [ "$name" != "ui" ]; then
      mv "$d" ../_eLearn_archive_components/
    fi
  done
  cd ../..

# Step 3 — Replace home page with minimal CreatorOS landing

  cat > src/app/page.tsx <<'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">CreatorOS</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Agentic AI content production OS. V1 in progress.
      </p>
    </main>
  )
}
EOF

  # If src/app/page.tsx had eLearn-specific imports they're now gone.
  # Also clear any eLearn-flavored layout content (keep ThemeProvider,
  # globals, theme toggle — they're generic).

# Step 4 — Verify libs survive

These libs are generic, not eLearn-specific. They should remain intact.
Run the safety grep:

  grep -rE "(course|module|topic|bloom|addie|study_material|video_pipeline|curriculum|lesson)" src/lib/grading src/lib/media

If matches > 0, STOP, list them, ask for guidance. If empty,
src/lib/grading and src/lib/media are confirmed generic — keep both.

# Step 5 — Archive eLearn domain tests

  find tests -type f -name "*.test.ts" -exec grep -l "src/lib/domain\|domain/workflows\|elearn\|bloom\|addie\|course\|module" {} \; > /tmp/domain-tests.txt
  while read f; do
    # Preserve directory structure under tests/_eLearn_archive/
    rel="${f#tests/}"
    mkdir -p "tests/_eLearn_archive/$(dirname "$rel")"
    mv "$f" "tests/_eLearn_archive/$rel"
  done < /tmp/domain-tests.txt

Plus: any test under tests/unit/ or tests/integration/ that imports
from src/_eLearn_archive_api/ or src/_eLearn_archive_components/ is
orphan; move to the archive too.

# Step 6 — Scaffold CreatorOS Domain skeleton

  mkdir -p src/lib/domain/workflows/creator/{agents,validators,rubrics,skills}

  cat > src/lib/domain/workflows/creator/README.md <<'EOF'
# CreatorOS Domain Workflow

This folder will hold:
- `agents/` — Forge-style persona docs (per docs/02-domain/agents-and-personas.md)
  - `idea-coach.ts`
  - `research-agent.ts`
  - `source-curator.ts`
  - `long-form-synthesizer.ts`
  - `linkedin/` (producer-claude, producer-gpt, critic-claude-on-gpt,
                critic-gpt-on-claude, integrator, judge)
  - `article/` (same 6 roles)
- `validators/` — deterministic shape checks per stage
- `rubrics/` — RubricDefinition objects (see docs/02-domain/rubrics.md)
- `skills/` — V1 skill snippets (auto-concatenated into agent prompts)
- `pipeline-config.ts` — exports LoopStage instances per stage

Empty in CR-0. Populated by CR-2 onwards (action plan).
EOF

# Step 7 — Verification gates

  npm run typecheck                                            → exit 0
  npm run test                                                 → all green
  grep -rE "from ['\"][^'\"]*domain/" src/lib/core/            → nothing
  ls src/lib/domain/workflows/creator/                         → README + 4 folders
  ls src/app/api/                                              → just .gitkeep
  ls src/components/                                           → ui/ only (plus layout files if separate)
  ls src/_eLearn_archive_domain/                               → has content
  ls tests/_eLearn_archive/                                    → has content

The grep-check skill is auto-invoked by the protocol; it should pass.

# Step 8 — Architect review

  @architect-reviewer please review the staged diff for CR-0.

  Verdict expected: APPROVE (the diff is removals + skeleton + replacement
  home page; the three-question test is straightforward).

# Step 9 — Commit and tag

  git add -A
  git commit -m "CR-0: fork bootstrap — purge eLearn Domain, bare-skeleton" \
             -m "Archive eLearn domain code, eLearn API routes, eLearn UI components, and eLearn tests to archive folders. Scaffold empty src/lib/domain/workflows/creator/ skeleton. Replace home page with minimal CreatorOS landing. src/lib/grading and src/lib/media retained (verified generic). Tests remain green." \
             -m "Refs: docs/04-plans/v1-action-plan.md (CR-0)"

  git tag CR-0-fork-bootstrap
  git push origin main
  git push origin CR-0-fork-bootstrap

# Final report

Output the cr-step-protocol's standard report:

  === CR-0 COMPLETE ===

  WHAT YOU SEE:
    • src/lib/domain/ contains only workflows/creator/ skeleton with
      empty folders + README
    • src/app/api/ contains only .gitkeep
    • src/components/ contains only ui/ + layout-related files
    • Home page renders "CreatorOS" landing
    • Archives populated: src/_eLearn_archive_{domain,pages,components,api}
      and tests/_eLearn_archive/

  NUMBERS:
    • Tests before: 1024 (or your baseline)
    • Tests after: <count after archive>
    • Files archived: <count>
    • Files retained under src/: <count>

  GATES PASSED:
    ✓ typecheck
    ✓ test
    ✓ grep-check
    ✓ src/lib/grading + src/lib/media intact (no eLearn words)
    ✓ src/app/api/ contains only .gitkeep
    ✓ architect-reviewer: APPROVE

  GIT STATE:
    Tag pushed: CR-0-fork-bootstrap
    Commit SHA: <sha>

  NEXT STEP:
    CR-1: Minimal schema + BuildOS persona seeded
    (run with: paste prompt from docs/04-plans/v1-action-plan.md CR-1)
```

---

## After CR-0

Your repo now has:

- A working Next.js + Prisma codebase with all Core machinery intact
- An empty Domain workflow skeleton waiting to be filled
- All eLearn-flavored code safely archived (recoverable, not deleted)
- A green test suite (eLearn-specific tests archived; Core tests unchanged)

Ready for CR-1 — schema + seed.
