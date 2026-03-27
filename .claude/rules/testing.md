# Testing Conventions (Global)
- Write failing tests FIRST, then implement
- Use Vitest as test runner
- Test files: component.test.ts next to component.ts
- Mock LLM calls in unit tests — never call real APIs in tests
- Mock fal.ai, ElevenLabs, Runway in tests — use fixture files
- Test all three review actions individually
- Test quality threshold: below → revise, above → present
- Test checkpoint/resume: simulate crash, verify recovery
- Aim for 80% engine coverage, 60% UI coverage
