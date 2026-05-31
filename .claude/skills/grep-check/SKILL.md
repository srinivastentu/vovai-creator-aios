---
name: grep-check
description: Runs the comment-safe import discipline check for CreatorOS. Auto-loads before any commit that touches src/lib/core/. The check verifies that src/lib/core/ never imports from src/lib/domain/. The corrected command uses quoted-path matching to skip comment-line false positives.
auto_load: true
---

# Grep Check — Import Discipline

You are running the CreatorOS import discipline check before commit.
This skill exists because the original eLearn CLAUDE.md had a
slightly broken check that caught comments as false positives.

## The check

```bash
grep -rE "from ['\"][^'\"]*domain/" src/lib/core/
```

**Expected output: empty.** Anything else is a violation.

## Why this command, not the old one

The original eLearn check was:

```bash
grep -r "from.*domain/" src/lib/core/
```

That matched:
- Real violations: ✅ caught
- Comments mentioning the word "domain": ❌ also caught (false positive)

The corrected version requires the path to be quoted:

```bash
grep -rE "from ['\"][^'\"]*domain/" src/lib/core/
```

Breakdown:
- `-rE` recursive + extended regex
- `from ['\"]` requires `from "` or `from '` (real import syntax)
- `[^'\"]*` matches anything but a quote
- `domain/` matches the forbidden path segment
- Comments like `// don't import from domain` don't match because
  they have no quote after `from`

## What to do when the check fails

If grep returns matches:

1. **Read the matched lines.** They tell you the file and the offending
   import.

2. **Categorize:**
   - **Type a:** Direct violation. Core file imports a Domain type. Fix:
     either move the type to Core (if it's truly generic), or replace
     the import with a generic type parameter (e.g. `LoopState<T>`).
   - **Type b:** Phantom violation. The import is OK (e.g. `domainTypes`
     from a sibling Core module). Re-check the regex — it's working
     correctly; the structure is genuinely wrong.

3. **Fix at the source.** Don't suppress the check or add to a
   whitelist. The whole point of this discipline is that there's no
   whitelist.

4. **Re-run the check.** Repeat until empty.

5. **Run the full test suite.** Sometimes Core changes that look
   reasonable break things — the test suite catches the consequences.

## When to run this check

The cr-step-protocol skill auto-invokes this before every commit
suggestion. You also run it:

- Before tagging a CR step
- After any refactor that touched Core
- After resolving a merge conflict in Core

## What this skill DOES NOT check

This skill only enforces the import rule. It does NOT check:

- Whether new files are in the right layer (`@architect-reviewer`
  does that via the three-question test)
- Whether `domain/` properly imports from `core/` (the reverse
  direction is allowed; not policed)
- Test files (the rule applies to source files; tests have their own
  scope)

## False negatives to watch for

The check is robust but not omniscient. Two scenarios it misses:

1. **Dynamic imports:** `const x = await import(\`...\${dynamicPath}\`)`.
   These are rare and would show up in code review.

2. **Re-exports:** if Core file A re-exports from Core file B, and B
   somehow contains a Domain re-export, the check on A's imports
   passes. Fix the leaf import (in B), not the re-exporter (A).

Neither is common. The check is sufficient for 99% of cases.

## Output format when invoked

When run as part of the commit gate:

```
=== IMPORT DISCIPLINE CHECK ===

Command: grep -rE "from ['\"][^'\"]*domain/" src/lib/core/
Result: <empty>

✓ PASS — Core has no Domain imports.
```

Or if violations:

```
=== IMPORT DISCIPLINE CHECK ===

Command: grep -rE "from ['\"][^'\"]*domain/" src/lib/core/
Result:

src/lib/core/engine/loop-engine.ts:42:  from '@/lib/domain/workflows/creator/types'

✗ FAIL — 1 violation.

Cannot proceed with commit. Fix the violation(s) above.
```

## The principle behind the rule

Per `docs/01-architecture/core-vs-domain.md`:

> Core code is platform machinery. Domain code is product
> configuration. Core is reused verbatim across multiple AIOSes
> (eLearn, CreatorOS, future Film, Agri, Music). Domain is
> rewritten per AIOS.

If Core imports from Domain, Core stops being portable. The CreatorOS
fork would have to keep eLearn's domain alive forever in Core's
import graph. The CreatorOS-specific code couldn't replace it.

This single rule is what makes the multi-AIOS-on-one-platform premise
work. It's worth catching every violation.
