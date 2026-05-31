---
name: validate-rubric
description: Validate a rubric JSON file
argument-hint: [rubric-path]
---
Validate the rubric against docs/rubrics/rubric-schema.json:
1. Exactly 5 dimensions
2. Weights sum to 1.0 (±0.001)
3. Each dimension has name, weight, description, scoreLevels
4. scoreLevels has entries for 1-3, 4-6, 7-8, 9-10
