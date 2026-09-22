# Contributing

## Running tests

No dependencies to install. Run:

```bash
node tests/test_hooks.js
```

or

```bash
npm test
```

## Branches

Name branches by what they do:

- `fix/...` — bug fixes
- `feat/...` — new behavior
- `docs/...` — documentation only
- `chore/...` — everything else (CI, release process, tooling)

## Commits

Imperative mood, one-line summary, the "why" in the body if it is not obvious from the summary alone.

```
Fix status line fallback on hung previous command

The previous status line could hang indefinitely if the user's own
command never returned. Add a 3 second timeout so getit's line still
renders.
```

## Pull requests

Every change goes through a pull request against `main`. CI must be green before merge. Fill in the PR template: what changed, why, the linked issue if there is one, and the checklist.

## Filing issues

Use the issue forms (bug report or feature request) rather than a blank issue. They ask for the details that are needed to reproduce or evaluate the request; a form filled in fully gets looked at faster than a one-line description.

## Releasing

1. Bump the version in all three files: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`. They must all match, or CI fails.
2. Add a `## X.Y.Z — YYYY-MM-DD` section to `CHANGELOG.md` describing what changed.
3. Open a PR with those changes, get it merged.
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push --tags
   ```
5. The release workflow takes it from there: it reads the matching `CHANGELOG.md` section and publishes it as the GitHub Release body.

## The one rule for SKILL.md edits

Never trade truth for brevity. GETIT's whole purpose is simplifying the explanation without simplifying the facts. An edit to `SKILL.md` that makes an instruction shorter at the cost of accuracy, a missing exception, or a softened condition works against the project, not for it.
