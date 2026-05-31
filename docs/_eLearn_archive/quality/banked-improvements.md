# Banked Quality Improvements — From Phase 3.4 Round 4 Analysis

These improvements were identified during Phase 3.4 quality review (5 topics × 4 rounds).
They are real issues but not blocking for Phase 3 Exit Gate.
Implement when building eLearning content pipelines (Phase 9-11).

## Priority 1 — Factual Reliability (Phase 11.1: Document Pipeline)

### 1a. Claim Extractor + Fact Audit Pass
- Between produce and judge, run a lightweight pass that extracts every date, number, named-person claim
- Mark each as: verified-canonical / plausible-uncited / likely-wrong / unverifiable
- Feed structured audit into judge as evidence
- Hard-cap accuracy at 6.5 if any claim is flagged likely-wrong
- Evidence: CRISPR v2 said Casgevy approved 2021 (actually 2023), Printing Press said 8M books/year (actually 8-20M total over 50 years)

### 1b. Adversarial Accuracy Critic
- Dedicated accuracy-critic prompt that assumes the article is wrong
- Tries to find the worst factual error
- Take min(primary_accuracy, critic_accuracy) as final accuracy score
- Cheap: one dimension, ~200 tokens per call
- Addresses: confident authoritative tone inflating accuracy scores

### 1c. Ban Empty Citation Scaffolding
- Producer prompt: phrases like "according to historical analyses", "studies suggest", "based on data from" are forbidden UNLESS followed by a specific, nameable source
- Either name the real source or use honest hedging ("estimates vary", "roughly")
- Evidence: Renewable Energy v2 added "according to IRENA", "based on NREL data" — impressive but unverifiable attributions

## Priority 2 — Judge Calibration (Phase 9: Domain Setup)

### 2a. Force True Quarter-Point Scoring
- Change judge response schema to enum: [6.0, 6.25, 6.5, 6.75, 7.0, 7.25, ...]
- Prompt guidance alone produces .0/.3/.5/.8 — halves and rough thirds
- Schema enforcement is one line and eliminates score compression at the top

### 2b. Collapse or Differentiate Clarity ↔ Engagement
- Currently these two dimensions never differ by more than 0.5 — dimensional redundancy
- Option A: Merge into "Prose Quality" and add "Pedagogical Scaffolding" (defines jargon, examples before abstractions, builds complexity gradually)
- Option B: Rewrite rubric anchors to force different evidence for each dimension
- Decision: make when building eLearning rubrics (Phase 9)

### 2c. Regression Fact Sheets for Test Topics
- For 5-10 canonical test topics, hand-curate 10-15 verified facts
- After each run, diff article claims against the fact sheet
- Measures judge calibration over time, not just generation quality
- Use as an eval suite for judge prompt changes

## Priority 3 — Loop Dynamics (Phase 8: Pipeline Mode)

### 3a. Asymmetric Threshold for ELEVATE Branch
- Current: threshold 7.5 → every v1 passes → loop stops at v2
- Proposed: 7.5 to escape "incomplete", 8.0 to escape "needs improvement"
- Forces v3 when v1 passes basic threshold but hasn't reached excellence
- Only triggers ELEVATE, not full IMPROVE (so no regression risk)

### 3b. Cost-Aware v3 Trigger
- Only trigger v3 when: Δ(v1→v2) < 0.2 AND weakest dimension < 8.0 AND cost-so-far < $0.08
- Prevents "stop at v2 because threshold was met on v1" without blowing budget
- Currently the machinery for 3-5 iteration loops is idle

## Priority 4 — Style Diversity (Phase 11.1: Document Pipeline)

### 4a. Opening Paragraph De-Templating
- Rotate opening strategies: counterintuitive fact / named-person anchor / scene-setting / question / in-medias-res
- Blacklist: "Every day, the sun...", "Every night, as we slip...", "The X landscape has undergone a dramatic transformation..."
- Currently all 5 articles use the same rhetorical move

### 4b. Topic-Appropriate Structure Signal
- Small rubric bonus (up to +0.25 on structure) for topic-fitting shapes
- Timeline for historical topics, mechanism-flow for process topics, comparison for vs-articles
- Encourages producer out of uniform 5-7 H2 section skeleton

## Status

- [ ] 1a — Implement in Phase 11.1
- [ ] 1b — Implement in Phase 11.1
- [ ] 1c — Implement in Phase 11.1 (or earlier if easy)
- [ ] 2a — Implement in Phase 9
- [ ] 2b — Implement in Phase 9
- [ ] 2c — Implement in Phase 9 (eval suite)
- [ ] 3a — Implement in Phase 8
- [ ] 3b — Implement in Phase 8
- [ ] 4a — Implement in Phase 11.1
- [ ] 4b — Implement in Phase 9 (rubric design)