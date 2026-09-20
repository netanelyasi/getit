# Changelog

## 1.1.0 — 2026-09-20

On/off toggle for the Claude Code plugin install.

- `/getit off`, `/getit on` and `/getit status`. The state persists in `~/.claude/.getit-active` across sessions. Default is on.
- Natural-language switches when they are the whole message: "getit off", "stop getit", "turn off getit", "getit on", "start getit", "turn on getit".
- `/getit <topic>` while off uses the flow for that one answer and leaves the switch off.
- SessionStart hook (`src/hooks/getit-activate.js`) loads `SKILL.md` when on; UserPromptSubmit hook (`src/hooks/getit-tracker.js`) tracks the commands and adds a short per-turn reminder while on.
- Status line: `/getit statusline on` shows `getit on` / `getit off` under the input box. It keeps the status line you already had and appends to it, since Claude Code allows one status line command. `/getit statusline off` restores it, `/getit statusline` reports what is installed. The script and the state reader are copied to `~/.claude/getit/`, the previous command is saved in `~/.claude/getit/statusline.json`, and `settings.json` is backed up before each change. No dependency on any other status line tool.
- `## On / off` section in `SKILL.md`; README sections for the toggle and the status line.
- Tests: `node tests/test_hooks.js` (no dependencies).

## 1.0.0 — 2026-09-20

Initial release.

- `SKILL.md` with the eight-step GETIT flow: CORE, MODEL, CHAIN, GROUND, PRESERVE, COMPRESS, RETELL, STOP.
- Default style rules, adaptive depth, and the final silent test.
- Claude Code plugin manifest and marketplace manifest.
- MIT license.
