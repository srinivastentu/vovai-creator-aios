---
name: loop-stage-creation
description: Walks Claude Code through adding a new LoopStage to a CreatorOS Domain Workflow. Loads when the user's request involves a new pipeline stage, a new artifact type, or a new agent loop. Enforces the rule that all loop machinery lives in Core; only the stage configuration and agent set live in Domain.
---

# Loop Stage Creation

You are adding a new `LoopStage<T>` to a CreatorOS Domain Workflow.
Follow this protocol. Don't skip steps.

## The shape of a new stage

A new stage requires exactly these pieces:

1. **Artifact type** in `prisma/schema.prisma` (if it's a new
   artifact kind, not just a new loop on existing kinds)
2. **Validator** — deterministic, runs before LLM judge
3. **Rubric** — domain rules; weights sum to 1.0; completeness >= 0.20
4. **Agent set** — producer(s), critic(s), integrator, judge per
   loop pattern
5. **Stage config** — `LoopStage<T>` instance in pipeline-config.ts
6. **Persistence side-effects** — what gets written to DB at iteration
   approval
7. **Tests** — validator, rubric, stage, persistence
8. **CLI script** (if CR step is before the UI work) OR API route +
   UI page (if after)

## Stage config template

```typescript
// src/lib/domain/workflows/creator/pipeline-config.ts

import type { LoopStage } from '@/lib/core/engine/types'
import { MY_NEW_RUBRIC } from './rubrics/my-new-rubric'
import { myValidator } from './validators/my-validator'
import * as agents from './agents/my-stage'

export const MY_NEW_STAGE: LoopStage<MyArtifactShape> = {
  id: 'my-new-stage',
  name: 'My New Stage',
  loopPattern: 'standard',           // or 'cross-critique' if Pattern 5
  minIterations: 2,
  maxIterations: 4,
  threshold: 80,
  maxBudgetUSD: 2.00,
  validator: myValidator,
  rubric: MY_NEW_RUBRIC,
  agents: {
    producer: agents.producer,
    judge: agents.judge,
    // For cross-critique:
    // crossCritique: {
    //   producers: [agents.producerClaude, agents.producerGpt],
    //   criticAssignments: { ... },
    //   integratorAgent: agents.integrator,
    //   judgeAgent: agents.judge
    // }
  },
  persistOnIteration: async (artifact, ctx) => {
    // Write to DB. Update relevant rows.
  }
}
```

## Validator template

```typescript
// src/lib/domain/workflows/creator/validators/my-validator.ts

import type { ValidatorResult } from '@/lib/core/engine/types'

export function myValidator(artifact: MyArtifactShape): ValidatorResult {
  if (!artifact.field1) {
    return { valid: false, reason: 'field1 required' }
  }
  if (artifact.length < 100) {
    return { valid: false, reason: 'too short: <100 chars' }
  }
  // ... more checks
  return { valid: true }
}
```

## Rubric — see `agent-persona-creation` skill route to rubric-author

For rubrics, invoke `@rubric-author` to author the file. It enforces
the 5 rules.

## Persistence side-effects

Side-effects fire only after an iteration passes validator + judge +
threshold. The Loop Engine calls `persistOnIteration` once per
iteration. Don't write to DB inside the agent prompts.

Typical patterns:

- Stage 2 (Research): create ResearchSource rows on the LongFormMaster
- Stage 3 (Master synth): create LongFormSection + SourceRef rows
- Stage 5 (Repurpose): create Artifact row with derivedVia, parentArtifactIds

## What goes in Core vs Domain

**Core (`src/lib/core/`):**
- LoopStage<T> type definition (already exists)
- runLoop, runStandardIteration, runCrossCritiqueIteration, etc.
- ValidatorResult type
- RubricDefinition type
- AgentConfig type
- gateway, requestMultiple, cost ledger

**Domain (`src/lib/domain/`):**
- Your new validator function
- Your new rubric definition
- Your new agent files (persona docs)
- Your stage config (LoopStage instance)
- persistOnIteration callback (writes domain entities)
- CLI script or API route + UI page

If you find yourself wanting to add a new field to `LoopStage<T>` to
support your stage, **stop**. That's a Core change. Open a decision
log entry first; route to `@architect-reviewer`.

## Test scaffolding

Route to `@test-writer` to scaffold:

- `tests/unit/domain/validators/my-validator.test.ts`
- `tests/unit/domain/rubrics/my-new-rubric.test.ts`
- `tests/unit/domain/<my-stage>-stage.test.ts`
- `tests/integration/prisma/<my-artifact>.test.ts` (if new entity)

## After adding a stage

Run the `grep-check` skill before commit. It runs the corrected
comment-safe import discipline check.

Then `@architect-reviewer review the staged diff` (the protocol
skill auto-invokes this; just in case).

## What you DO NOT do here

- Wire UI for the new stage. UI is its own CR step.
- Add the stage to the user-facing pipeline without an explicit
  decision log entry justifying the scope addition.
- Skip the validator. Every stage has one.
- Skip the rubric. Every stage has one.
- Use loopPattern 'tournament' for text artifacts. Use 'cross-critique'.
  Tournament is for atomic outputs (images, audio).
