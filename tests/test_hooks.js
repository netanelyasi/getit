#!/usr/bin/env node
// Tests for the getit hooks. No framework: node:assert plus child_process.
// Each test gets a fresh temporary CLAUDE_CONFIG_DIR so nothing touches the
// real ~/.claude. Run with: node tests/test_hooks.js

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ACTIVATE = path.join(ROOT, 'src', 'hooks', 'getit-activate.js');
const TRACKER = path.join(ROOT, 'src', 'hooks', 'getit-tracker.js');
const SKILL = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'getit-test-'));
}

function run(script, dir, stdin) {
  const res = spawnSync(process.execPath, [script], {
    input: stdin,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: dir }),
    timeout: 10000
  });
  return res;
}

function activate(dir) {
  return run(ACTIVATE, dir, '{"source":"startup"}');
}

// Runs the tracker and returns { status, context } where context is the
// additionalContext string, or '' when the hook printed nothing.
function track(dir, prompt, rawStdin) {
  const stdin = rawStdin !== undefined ? rawStdin : JSON.stringify({ prompt: prompt });
  const res = run(TRACKER, dir, stdin);
  let context = '';
  if (res.stdout.trim()) {
    const parsed = JSON.parse(res.stdout);
    context = parsed.hookSpecificOutput.additionalContext;
  }
  return { status: res.status, context: context, stdout: res.stdout, stderr: res.stderr };
}

function readFlag(dir) {
  try { return fs.readFileSync(path.join(dir, '.getit-active'), 'utf8'); } catch (e) { return null; }
}

function readBadge(dir) {
  try { return fs.readFileSync(path.join(dir, 'status-badges', 'getit'), 'utf8'); } catch (e) { return null; }
}

function envelope(name, args) {
  return '<command-message>' + name.replace('/', '') + '</command-message>\n' +
    '<command-name>' + name + '</command-name>\n' +
    '<command-args>' + args + '</command-args>';
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('activate with no flag file prints SKILL.md and writes badge on', () => {
  const dir = tmpDir();
  const res = activate(dir);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.startsWith('GETIT MODE ACTIVE\n\n'));
  assert.ok(res.stdout.includes(SKILL));
  assert.equal(readBadge(dir), 'getit on\n');
  assert.equal(readFlag(dir), null, 'activate must not create the flag file');
});

test('activate with flag off prints the off line only', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '.getit-active'), 'off\n');
  const res = activate(dir);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'GETIT MODE OFF. Explain normally.\n');
  assert.equal(readBadge(dir), 'getit off\n');
});

test('/getit off envelope writes flag off and badge getit off', () => {
  const dir = tmpDir();
  const r = track(dir, envelope('/getit', 'off'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'off\n');
  assert.equal(readBadge(dir), 'getit off\n');
  assert.ok(r.context.startsWith('GETIT MODE OFF.'));
  assert.ok(!r.context.includes('## The GETIT Flow'), 'off must not print the skill');
});

test('/getit on envelope restores on and prints SKILL.md', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'off'));
  const r = track(dir, envelope('/getit', 'on'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'on\n');
  assert.equal(readBadge(dir), 'getit on\n');
  assert.ok(r.context.startsWith('GETIT MODE ACTIVE. Reply with one short line'));
  assert.ok(r.context.includes(SKILL));
});

test('namespaced /getit:getit envelope is accepted', () => {
  const dir = tmpDir();
  const r = track(dir, envelope('/getit:getit', 'off'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'off\n');
});

test('natural-language "getit off" as the whole prompt turns off', () => {
  const dir = tmpDir();
  const r = track(dir, 'getit off');
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'off\n');
  assert.equal(readBadge(dir), 'getit off\n');
  const r2 = track(dir, 'Turn on getit');
  assert.equal(r2.status, 0);
  assert.equal(readFlag(dir), 'on\n');
  const r3 = track(dir, 'stop getit.');
  assert.equal(r3.status, 0);
  assert.equal(readFlag(dir), 'off\n');
});

test('a prompt that merely contains the word off does not change state', () => {
  const dir = tmpDir();
  const r = track(dir, 'explain why the server is off');
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), null, 'flag must stay untouched');
  assert.ok(r.context.startsWith('GETIT MODE ACTIVE:'), 'ordinary prompt while on gets the reminder');
  assert.ok(!r.context.includes('## The GETIT Flow'));
});

test('/getit <topic> while off prints SKILL.md for one turn and leaves flag off', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'off'));
  const r = track(dir, envelope('/getit', 'race conditions'));
  assert.equal(r.status, 0);
  assert.ok(r.context.startsWith('GETIT MODE ACTIVE for this request only (flag stays off).'));
  assert.ok(r.context.includes(SKILL));
  assert.equal(readFlag(dir), 'off\n');
  assert.equal(readBadge(dir), 'getit off\n');
});

test('/getit <topic> while on prints nothing and changes nothing', () => {
  const dir = tmpDir();
  const r = track(dir, envelope('/getit', 'race conditions'));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(readFlag(dir), null);
});

test('/getit status reports the state without changing it', () => {
  const dir = tmpDir();
  let r = track(dir, envelope('/getit', 'status'));
  assert.equal(r.status, 0);
  assert.ok(r.context.startsWith('GETIT MODE is ON.'));
  track(dir, envelope('/getit', 'off'));
  r = track(dir, envelope('/getit', 'status'));
  assert.ok(r.context.startsWith('GETIT MODE is OFF.'));
  assert.equal(readFlag(dir), 'off\n');
});

test('foreign command envelope carrying "getit off" does not change state', () => {
  const dir = tmpDir();
  const r = track(dir, envelope('/caveman', 'getit off'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), null);
  assert.equal(readBadge(dir), null);
});

test('ordinary prompt while off prints nothing', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'off'));
  const r = track(dir, 'what is a mutex');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('broken stdin (empty) exits 0 and changes nothing', () => {
  const dir = tmpDir();
  const r = track(dir, null, '');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(readFlag(dir), null);
  const r2 = track(dir, null, '{not json');
  assert.equal(r2.status, 0);
  assert.equal(r2.stdout, '');
});

test('scheduled-task prompt prints nothing and changes nothing', () => {
  const dir = tmpDir();
  const r = track(dir, '<scheduled-task id="x">getit off</scheduled-task>');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(readFlag(dir), null);
  assert.equal(readBadge(dir), null);
});

test('flag written by the hook is read back by activate', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'off'));
  const res = activate(dir);
  assert.equal(res.stdout, 'GETIT MODE OFF. Explain normally.\n');
  track(dir, envelope('/getit', 'on'));
  const res2 = activate(dir);
  assert.ok(res2.stdout.startsWith('GETIT MODE ACTIVE\n\n'));
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log('ok   ' + t.name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + t.name);
    console.log('     ' + String(e.message).split('\n').join('\n     '));
  }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
