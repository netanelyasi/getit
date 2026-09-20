#!/usr/bin/env node
// getit: Claude Code SessionStart hook.
//
// Runs on every session start (and on resume, /clear and compaction, since
// Claude Code re-fires SessionStart for those too). It reads the persisted
// on/off flag, refreshes the status badge, and when getit is on it emits the
// full SKILL.md as session context so the flow is loaded without the user
// having to type /getit. Always exits 0.

const { readFlag, writeBadge, readSkill } = require('./getit-state');

try {
  // Drain stdin so the parent never blocks on a full pipe. The payload is
  // not needed: state lives in the flag file, not in the hook input.
  try {
    const fs = require('fs');
    if (!process.stdin.isTTY) fs.readFileSync(0, 'utf8');
  } catch (e) { /* ignore */ }

  const state = readFlag();
  writeBadge(state);

  if (state === 'off') {
    process.stdout.write('GETIT MODE OFF. Explain normally.\n');
  } else {
    process.stdout.write('GETIT MODE ACTIVE\n\n' + readSkill());
  }
} catch (e) {
  // Silent fail. A hook that throws would surface as a spurious hook error.
}
process.exit(0);
