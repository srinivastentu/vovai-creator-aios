# The Recursive Loop Engine

## Core Pattern
```
produce() → evaluate() → runLoop() → processReview()
```

## State Machine
```
IDLE → GENERATING → EVALUATING →
  [score < threshold] → REVISING → GENERATING
  [score ≥ threshold] → PRESENTING → AWAITING_REVIEW →
    [approve] → APPROVED
    [feedback] → GENERATING (with feedback)
    [reject] → GENERATING (fresh start)
```

## Key Data Structures
- **Artifact:** { id, version, content, stage, sceneIndex?, createdAt, metadata }
- **Grade:** { dimensions[], compositeScore, overallAssessment, improvementPriorities }
- **IterationRecord:** { iteration, artifact, grade, outcome, cost }
- **StageSession:** { id, projectId, stage, status, iterations[], currentArtifact, bestArtifact }
