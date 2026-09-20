#!/usr/bin/env node
// getit: shared state helpers for the Claude Code hooks.
//
// Two files live under the Claude config directory:
//   <claudeDir>/.getit-active         "on" or "off". Missing file means on.
//   <claudeDir>/status-badges/getit   "getit on" or "getit off", one line.
//
// The status-badges directory is a generic contract: any tool may drop a
// one-line file there and a status line can display it.
//
// Every function here is best-effort and never throws. Hooks must exit 0.

const fs = require('fs');
const path = require('path');
const os = require('os');

const FLAG_NAME = '.getit-active';
const BADGE_DIR = 'status-badges';
const BADGE_NAME = 'getit';
const MAX_FLAG_BYTES = 64;

const FALLBACK_SKILL =
  'GETIT flow. Simplify the explanation, not the truth. ' +
  'CORE: state the direct answer early. ' +
  'MODEL: build a simple, correct mental model from things the reader already knows. ' +
  'CHAIN: explain how and why as a causal chain (this happens, which causes this, which leads to this). ' +
  'GROUND: make it concrete with one small example, number or scenario; prefer an example over an analogy. ' +
  'PRESERVE: keep the facts that change the conclusion, the conditions, exceptions, uncertainty and tradeoffs. ' +
  'COMPRESS: cut repetition, filler and anything that does not improve the mental model. ' +
  'RETELL: check that the reader could now explain it to someone else without a meaningful error. ' +
  'STOP: once the reader has the idea, the mechanism and the qualifications, end.';

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function flagPath() {
  return path.join(claudeDir(), FLAG_NAME);
}

function badgePath() {
  return path.join(claudeDir(), BADGE_DIR, BADGE_NAME);
}

// Returns "off" only when the flag file exists and says so. Anything else
// (missing file, unreadable, garbage, symlink) is treated as the default: on.
function readFlag() {
  try {
    const p = flagPath();
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_FLAG_BYTES) return 'on';
    const raw = fs.readFileSync(p, 'utf8').trim().toLowerCase();
    return raw === 'off' ? 'off' : 'on';
  } catch (e) {
    return 'on';
  }
}

// Write content to target atomically: write a temp file next to it, then
// rename over the target. On Windows the rename can fail briefly when another
// process holds the target open, so retry a few times and always sweep the
// temp file so nothing is left behind.
function atomicWrite(target, content) {
  let tmp;
  try {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    try {
      if (fs.lstatSync(target).isSymbolicLink()) return false;
    } catch (e) {
      if (e.code !== 'ENOENT') return false;
    }
    tmp = path.join(dir, path.basename(target) + '.' + process.pid + '.' + Date.now() + '.tmp');
    fs.writeFileSync(tmp, String(content), { encoding: 'utf8', mode: 0o600 });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.renameSync(tmp, target);
        return true;
      } catch (e) {
        const transient = e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'EACCES' || e.code === 'EEXIST';
        if (!transient) throw e;
      }
    }
    return false;
  } catch (e) {
    return false;
  } finally {
    if (tmp) { try { fs.unlinkSync(tmp); } catch (e) { /* already renamed or never created */ } }
  }
}

function normalizeState(state) {
  return String(state).trim().toLowerCase() === 'off' ? 'off' : 'on';
}

function writeFlag(state) {
  return atomicWrite(flagPath(), normalizeState(state) + '\n');
}

function writeBadge(state) {
  return atomicWrite(badgePath(), 'getit ' + normalizeState(state) + '\n');
}

// The full SKILL.md text, read at runtime so edits to the source of truth
// propagate. The hook lives at <plugin_root>/src/hooks/, so SKILL.md is two
// levels up. Falls back to a one-paragraph summary of the eight steps.
function readSkill() {
  try {
    const text = fs.readFileSync(path.join(__dirname, '..', '..', 'SKILL.md'), 'utf8');
    if (text.trim()) return text;
  } catch (e) { /* fall through */ }
  return FALLBACK_SKILL;
}

module.exports = { claudeDir, flagPath, badgePath, readFlag, writeFlag, writeBadge, readSkill, FALLBACK_SKILL };
