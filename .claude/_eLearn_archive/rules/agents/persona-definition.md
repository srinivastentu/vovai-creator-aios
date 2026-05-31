---
paths: ["src/agents/**", "config/agents/**"]
---
# Agent Persona Rules
- Every agent MUST have: identity, mission, tools, model, skills, memory_scope, permission_mode
- Agents are stateless — receive context, produce artifact, return
- Never embed domain knowledge in agent prompts — reference skills instead
- Agent personas are YAML files in config/agents/, NOT hardcoded in TypeScript
- The same recursive loop serves ALL agents — only prompts and rubrics change
