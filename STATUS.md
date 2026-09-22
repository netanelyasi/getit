# STATUS

## Where we are

v1.1.0 released 2026-09-20. Installable as a Claude Code plugin or via the skills CLI. Plugin install includes the on/off toggle (`/getit on` / `/getit off` / `/getit status`) and an optional status line addition. 31 tests pass (`node tests/test_hooks.js`).

## What the last session closed

2026-09-22: set up the GitHub process around the repo — bug report and feature request issue forms, issue template config, pull request template, CI workflow (test matrix across OS and Node versions, plus a manifest version-sync check), release workflow (tag-triggered, pulls the matching CHANGELOG.md section into the GitHub Release), CONTRIBUTING.md, CODEOWNERS. Branch protection on `main` set up separately (not in this repo's files).

## What comes next

- Wait for the first external issues or PRs and see whether the forms actually get filled in usefully.
- Consider turning on GitHub Discussions (the issue template config already points "Question" there).
- Watch the first few CI runs and the first real release tag for problems the dry run didn't catch.

## Open and unproven

- The CI matrix has not yet been seen green on `windows-latest` — only reasoned through, not run.
- The release workflow has not yet been exercised with a real `vX.Y.Z` tag push.

## What not to start

- A rewrite of the SKILL.md flow. The eight-step structure is settled; changes there go through the normal PR process, not a redesign.
- Adding dependencies. The project's whole test setup is dependency-free by design; keep it that way.
