---
name: new-agent
description: Create a new eLearn agent persona
argument-hint: [agent-name]
---
Create a new agent persona for the eLearn AIOS pipeline using @docs/agents/persona-template.md

Steps:
1. Ask me for the agent name, which pipeline stage it belongs to, and its mission
2. Create the YAML file at config/agents/elearn-aios/[agent-name].yml
3. Include all required fields from the template
4. Create a placeholder rubric if one doesn't exist for this stage
5. Update tasks/todo.md to track this new agent
