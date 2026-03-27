---
paths: ["src/lib/grading*", "config/rubrics/**"]
---
# Grading System Rules
- Every rubric has exactly 5 dimensions with weights summing to 1.0
- Each dimension scored 1-10 with specific criteria per score level
- Composite score = weighted average (recalculate, don't trust LLM math)
- Rubrics are JSON files in config/rubrics/, validated against schema
- The Judge uses the rubric — it does not define quality standards itself
