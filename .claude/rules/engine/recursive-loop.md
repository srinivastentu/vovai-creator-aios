---
paths: ["src/lib/engine*.ts", "src/lib/loop*.ts", "src/lib/types.ts"]
---
# Recursive Loop Engine Rules
- Every state change MUST emit an event
- Every artifact version is immutable — create new versions, never overwrite
- The loop MUST support checkpoint/resume from any point
- Quality threshold is configurable per stage, never hardcoded
- Minimum 2 iterations enforced even if v1 scores above threshold
- Track BEST version across all iterations
- Dimension-aware revision: PRESERVE ≥8, IMPROVE <8
- Human feedback applied once then cleared
- Deterministic validators run BEFORE LLM Judge
- Strip markdown fences before JSON parsing
- If JSON parsing fails, return failing grade that forces revision — NEVER crash
- The four core functions: produce() → evaluate() → runLoop() → processReview()
- This engine is IDENTICAL for all media types. Only prompts and rubrics change.
