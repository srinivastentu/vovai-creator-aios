# VOVAI eLearn AIOS — System Overview

## What Is It?
An AI-powered eLearning video production platform. AI agent teams produce
videos while humans guide and approve at every critical gate.

## Input → Output
**Input:** "Create a 10-minute training video about workplace safety"
**Output:** Complete eLearning video with narration, visuals, music, captions, SCORM packaging

## The Five Internal Layers
1. **Presentation:** Next.js frontend — dashboards, review interfaces, workshop
2. **Orchestration:** Pipeline orchestrator, task queue, event bus
3. **Agentic AI Engine:** Recursive loop, tournament, judge, validators
4. **Intelligence:** Registries (agents, skills, prompts, rubrics, workflows)
5. **Foundation:** PostgreSQL, Redis, S3/R2, FFmpeg, Auth, Billing

## Core Flow
```
User creates project → Orchestrator decomposes into pipeline stages →
Each stage: Agent produces artifact → Judge evaluates → Loop refines →
Human reviews → Approved artifacts flow to next stage →
Final assembly → Delivered video
```
