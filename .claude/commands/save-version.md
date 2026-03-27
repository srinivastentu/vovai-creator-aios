---
name: save-version
description: Create a version tag at a milestone
argument-hint: [version like v0.3.0]
---

Create a milestone version tag and push to GitHub.

Steps:
1. Run `git status` — if there are uncommitted changes, commit them first
2. Run `git log --oneline -5` — show me the last 5 commits that will be in this version
3. Ask me to confirm the version number and write a milestone message
4. Run `git tag -a [version] -m "[message]"`
5. Run `git push origin main && git push origin [version]`
6. Update tasks/todo.md — mark the milestone as complete
7. Confirm: "✅ Version [version] tagged and pushed to GitHub"