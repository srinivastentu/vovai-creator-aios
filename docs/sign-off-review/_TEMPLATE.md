# CR-<N> Sign-off Review — <Step Title>

| | |
|---|---|
| **Step** | CR-<N> — <step title> |
| **Verdict** | <SIGN-OFF \| SIGN-OFF WITH FOLLOW-UPS \| DO NOT SIGN OFF> |
| **Confidence** | <high \| medium \| low> |
| **Reviewed commit** | `<sha>` |
| **Tag** | `<CR-N-...>` |
| **Reviewed at** | <YYYY-MM-DD> |
| **Method** | Multi-lens audit (`cr-signoff-audit` workflow): 5 independent lenses + synthesis |

## Verdict

<One decisive paragraph: is the step properly done? Why this verdict? Note any
single disagreement between lenses and how it was adjudicated.>

## Verification evidence (deterministic gates)

| Check | Result |
|---|---|
| `npm run typecheck` | <exit 0> |
| `npm run test` | <exit 0 — N passed / M skipped> |
| `npm run build` | <exit 0> |
| Import discipline (`core` → `domain`) | <empty (PASS)> |
| `prisma validate` / `migrate status` | <valid; no drift> _(schema steps)_ |
| <step-specific gate, e.g. CLI output / row counts / artifact on disk> | <result> |

## What's correct (strengths)

- <load-bearing thing done well, with file:line evidence>
- …

## Findings

### 🔴 Blockers
<None. — or numbered list; each blocks progression to the next CR step.>

### 🟠 Majors
<None. — or numbered list.>

### 🟡 Minors (track as follow-ups)
1. **<title>** — <description> ([path:line](path#Lline)). _Fix before CR-<X>._
2. …

### ⚪ Nits
- <hygiene/style item>

## Needs human input

<Anything that cannot be verified from the repo and is the user's call —
e.g. "did you actually review the persona before it was seeded?". Omit the
section if none.>

## Recommended follow-ups

| Follow-up | Due before | Lands at |
|---|---|---|
| <action> | CR-<X> | [path:line](path#Lline) |

## Bottom line

<Signed off / blocked. One or two sentences. State the next CR step the user
is clear to proceed to, or what must be fixed first.>
