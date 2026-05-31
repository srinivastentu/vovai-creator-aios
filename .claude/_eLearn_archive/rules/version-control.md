# Version Control Rules (applies to all files)

## Quick Save Triggers — commit + push after EACH of these:
- A new page or component renders correctly in the browser
- A bug is fixed and verified (test passes or manual check)
- A backend API route is created and responds correctly
- A UI component is connected to a real API (no longer using sample data)
- An agent persona, rubric, or pipeline config is created or modified
- A database migration is applied successfully
- Tests are written and passing for a new feature
- Before starting any experimental or risky change
- At the end of every work session

## Quick Save Format:
- Run: git add -A && git commit -m "[type]: [what changed]"
- Types: feat (new feature), fix (bug fix), refactor, docs, config, test
- Then: git push origin main
- Example: "feat: add project detail page with pipeline stage cards"

## Version Tag Triggers — STOP and ASK the user before proceeding:
When ANY of these conditions are met, STOP current work and say:
"🏷️ We've reached a milestone. I recommend creating version tag vX.Y.Z
because [reason]. Shall I tag and push this version?"

Milestone triggers:
- Ring completion (any Ring fully working end-to-end) → vX.0.0
- A major subsystem works for the first time (engine, grading, review, tournament) → vX.Y.0
- Database schema changes that alter existing tables
- Before integrating a new external API (fal.ai, ElevenLabs, Runway, etc.)
- Before any refactor that touches 5+ files
- When all tests pass after a significant feature addition

## IMPORTANT: Always push after committing. Never leave unpushed commits.

## Branch Strategy (keep it simple):
- `main` is the primary branch. All work happens here for now.
- Create a branch ONLY when doing something experimental:
  git checkout -b experiment/[name]
- If the experiment works: merge to main, delete branch, tag if milestone
- If it fails: git checkout main (your main branch is safe)