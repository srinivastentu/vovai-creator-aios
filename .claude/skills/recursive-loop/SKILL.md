---
name: recursive-loop
description: >
  The core recursive loop pattern. Use when implementing or modifying
  the produce → evaluate → runLoop → processReview cycle.
---
# Recursive Loop Pattern

## The Four Core Functions
1. `produce()` — Agent generates artifact from goal + context + feedback
2. `evaluate()` — Judge grades artifact against weighted rubric
3. `runLoop()` — Orchestrates: produce → evaluate → threshold → present or revise
4. `processReview()` — Handles human actions: Approve | Feedback | Reject

## State Machine
```
IDLE → GENERATING → EVALUATING →
  [score < threshold] → REVISING → GENERATING
  [score ≥ threshold] → PRESENTING → AWAITING_REVIEW →
    [approve] → APPROVED (terminal)
    [feedback] → GENERATING (with feedback context)
    [reject] → GENERATING (fresh start)
```

## Key Patterns
- Dimension-aware revision: PRESERVE (≥8) vs IMPROVE (<8)
- Best-version tracking: always keep the highest-scoring version
- Diminishing returns: if improvement < 0.2 per iteration, escalate
- Validators before Judge: word count, format checks run first (cheap)
- Cross-model judging: Producer uses Claude, Judge uses GPT-4o (prevents self-bias)
