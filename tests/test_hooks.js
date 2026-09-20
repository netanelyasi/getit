#!/usr/bin/env node
// Tests for the getit hooks and status line. No framework: node:assert plus
// child_process. Each test gets a fresh temporary CLAUDE_CONFIG_DIR so nothing
// touches the real ~/.claude. Run with: node tests/test_hooks.js

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ACTIVATE = path.join(ROOT, 'src', 'hooks', 'getit-activate.js');
const TRACKER = path.join(ROOT, 'src', 'hooks', 'getit-tracker.js');
const STATUSLINE = path.join(ROOT, 'src', 'statusline', 'getit-statusline.js');
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

// Runs a status line script (the source or an installed copy) the way Claude
// Code does: JSON on stdin, one line on stdout. Returns stdout trimmed.
function statusline(dir, script, stdinJson) {
  const res = run(script || STATUSLINE, dir, stdinJson || '{"model":{"display_name":"Test"}}');
  assert.equal(res.status, 0, 'status line must exit 0: ' + res.stderr);
  return res.stdout.trim();
}

function setChain(dir, chain) {
  fs.mkdirSync(path.join(dir, 'getit'), { recursive: true });
  writeJson(path.join(dir, 'getit', 'statusline.json'), { chain: chain });
}

function backups(dir) {
  return fs.readdirSync(dir).filter(f => f.startsWith('settings.json.getit-bak-'));
}

// The command the chain tests use. node is the only runtime we can count on,
// so the chain is a node one-liner, which runs the same in cmd.exe and sh.
const NODE_PRINT = 'node -e "process.stdout.write(\'CHAINED\')"';

function envelope(name, args) {
  return '<command-message>' + name.replace('/', '') + '</command-message>\n' +
    '<command-name>' + name + '</command-name>\n' +
    '<command-args>' + args + '</command-args>';
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('activate with no flag file prints SKILL.md', () => {
  const dir = tmpDir();
  const res = activate(dir);
  assert.equal(res.status, 0);
  assert.ok(res.stdout.startsWith('GETIT MODE ACTIVE\n\n'));
  assert.ok(res.stdout.includes(SKILL));
  assert.equal(readFlag(dir), null, 'activate must not create the flag file');
  assert.deepEqual(fs.readdirSync(dir), [], 'activate must not create any file');
});

test('activate with flag off prints the off line only', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '.getit-active'), 'off\n');
  const res = activate(dir);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, 'GETIT MODE OFF. Explain normally.\n');
});

test('/getit off envelope writes flag off', () => {
  const dir = tmpDir();
  const r = track(dir, envelope('/getit', 'off'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'off\n');
  assert.deepEqual(fs.readdirSync(dir), ['.getit-active'], 'only the flag file is written');
  assert.ok(r.context.startsWith('GETIT MODE OFF.'));
  assert.ok(!r.context.includes('## The GETIT Flow'), 'off must not print the skill');
});

test('/getit on envelope restores on and prints SKILL.md', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'off'));
  const r = track(dir, envelope('/getit', 'on'));
  assert.equal(r.status, 0);
  assert.equal(readFlag(dir), 'on\n');
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

// ---- status line -----------------------------------------------------------

test('status line with no chain prints getit on', () => {
  const dir = tmpDir();
  assert.equal(statusline(dir), 'getit on');
});

test('status line with flag off prints getit off', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, '.getit-active'), 'off\n');
  assert.equal(statusline(dir), 'getit off');
});

test('status line with a chain prints the chain output then getit on', () => {
  const dir = tmpDir();
  setChain(dir, NODE_PRINT);
  assert.equal(statusline(dir), 'CHAINED  getit on');
});

test('status line passes the stdin JSON through to the chain', () => {
  const dir = tmpDir();
  setChain(dir, 'node -e "process.stdout.write(\'IN:\' + require(\'fs\').readFileSync(0, \'utf8\').trim())"');
  assert.equal(statusline(dir, null, '{"x":1}'), 'IN:{"x":1}  getit on');
});

test('status line keeps only the first line of a multi-line chain', () => {
  const dir = tmpDir();
  setChain(dir, 'node -e "process.stdout.write(\'L1\\nL2\\n\')"');
  assert.equal(statusline(dir), 'L1  getit on');
});

test('status line with a failing chain prints getit on', () => {
  const dir = tmpDir();
  setChain(dir, 'node -e "process.exit(1)"');
  assert.equal(statusline(dir), 'getit on');
});

test('status line with a hung chain gives up after the timeout', () => {
  const dir = tmpDir();
  setChain(dir, 'node -e "setTimeout(function () {}, 8000)"');
  const t0 = Date.now();
  assert.equal(statusline(dir), 'getit on');
  const ms = Date.now() - t0;
  assert.ok(ms < 6000, 'expected under 6 s, took ' + ms + ' ms');
});

test('status line with a null chain or broken statusline.json prints getit on', () => {
  const dir = tmpDir();
  setChain(dir, null);
  assert.equal(statusline(dir), 'getit on');
  fs.writeFileSync(path.join(dir, 'getit', 'statusline.json'), '{not json');
  assert.equal(statusline(dir), 'getit on');
});

test('/getit statusline on saves the chain, backs up settings, copies files, keeps other keys', () => {
  const dir = tmpDir();
  const settingsFile = path.join(dir, 'settings.json');
  writeJson(settingsFile, { model: 'opus', statusLine: { type: 'command', command: NODE_PRINT } });
  const r = track(dir, envelope('/getit', 'statusline on'));
  assert.equal(r.status, 0);
  assert.ok(r.context.startsWith('GETIT status line installed.'), r.context);

  assert.equal(backups(dir).length, 1, 'one backup of settings.json');
  const backup = readJson(path.join(dir, backups(dir)[0]));
  assert.equal(backup.statusLine.command, NODE_PRINT, 'backup holds the original settings');

  const saved = readJson(path.join(dir, 'getit', 'statusline.json'));
  assert.equal(saved.chain, NODE_PRINT);
  assert.equal(saved.type, 'command');
  assert.equal(typeof saved.savedAt, 'number');

  const settings = readJson(settingsFile);
  assert.equal(settings.model, 'opus', 'unrelated key preserved');
  assert.equal(settings.statusLine.type, 'command');
  const expected = 'node "' + path.join(dir, 'getit', 'getit-statusline.js').split(path.sep).join('/') + '"';
  assert.equal(settings.statusLine.command, expected);
  assert.ok(!settings.statusLine.command.includes('\\'), 'forward slashes only');
  assert.ok(fs.readFileSync(settingsFile, 'utf8').endsWith('}\n'), 'trailing newline');

  assert.ok(fs.existsSync(path.join(dir, 'getit', 'getit-statusline.js')), 'statusline script copied');
  assert.ok(fs.existsSync(path.join(dir, 'getit', 'getit-state.js')), 'state module copied');
  assert.equal(fs.readFileSync(path.join(dir, 'getit', 'getit-statusline.js'), 'utf8'), fs.readFileSync(STATUSLINE, 'utf8'));
  assert.equal(readFlag(dir), null, 'the on/off flag is untouched');
});

test('/getit statusline on twice does not overwrite the saved chain', () => {
  const dir = tmpDir();
  const settingsFile = path.join(dir, 'settings.json');
  writeJson(settingsFile, { statusLine: { type: 'command', command: NODE_PRINT } });
  track(dir, envelope('/getit', 'statusline on'));
  const first = readJson(path.join(dir, 'getit', 'statusline.json'));
  const r = track(dir, envelope('/getit', 'statusline install'));
  assert.ok(r.context.startsWith('GETIT status line installed.'));
  const second = readJson(path.join(dir, 'getit', 'statusline.json'));
  assert.deepEqual(second, first, 'saved chain must not change');
  assert.equal(backups(dir).length, 2, 'every write makes a backup');
  assert.ok(readJson(settingsFile).statusLine.command.includes('getit-statusline.js'));
});

test('/getit statusline off restores the original statusLine', () => {
  const dir = tmpDir();
  const settingsFile = path.join(dir, 'settings.json');
  writeJson(settingsFile, { model: 'opus', statusLine: { type: 'command', command: NODE_PRINT } });
  track(dir, envelope('/getit', 'statusline on'));
  const r = track(dir, envelope('/getit', 'statusline off'));
  assert.equal(r.status, 0);
  assert.ok(r.context.startsWith('GETIT status line removed.'), r.context);
  assert.ok(r.context.includes('previous status line is restored'));
  const settings = readJson(settingsFile);
  assert.deepEqual(settings, { model: 'opus', statusLine: { type: 'command', command: NODE_PRINT } });
  assert.equal(backups(dir).length, 2);
  assert.ok(fs.existsSync(path.join(dir, 'getit', 'getit-statusline.js')), 'copied files are kept');
  const again = track(dir, envelope('/getit', 'statusline off'));
  assert.ok(again.context.includes('not installed'), 'second off changes nothing');
  assert.deepEqual(readJson(settingsFile), settings);
});

test('/getit statusline on with no settings.json creates one with only statusLine', () => {
  const dir = tmpDir();
  const settingsFile = path.join(dir, 'settings.json');
  const r = track(dir, envelope('/getit', 'statusline on'));
  assert.ok(r.context.startsWith('GETIT status line installed.'), r.context);
  const settings = readJson(settingsFile);
  assert.deepEqual(Object.keys(settings), ['statusLine']);
  assert.ok(settings.statusLine.command.includes('getit-statusline.js'));
  assert.equal(backups(dir).length, 0, 'nothing to back up');
  assert.equal(readJson(path.join(dir, 'getit', 'statusline.json')).chain, null);
  const off = track(dir, envelope('/getit', 'statusline off'));
  assert.ok(off.context.includes('no previous status line'), off.context);
  assert.deepEqual(readJson(settingsFile), {}, 'statusLine key removed, file kept');
});

test('/getit statusline on refuses to touch a settings.json that is not JSON', () => {
  const dir = tmpDir();
  const settingsFile = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsFile, '{ this is not json');
  const r = track(dir, envelope('/getit', 'statusline on'));
  assert.ok(r.context.startsWith('GETIT status line could not be installed'), r.context);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), '{ this is not json');
});

test('/getit statusline and /getit statusline status report without changing anything', () => {
  const dir = tmpDir();
  let r = track(dir, envelope('/getit', 'statusline'));
  assert.ok(r.context.startsWith('GETIT status line is not installed'), r.context);
  assert.deepEqual(fs.readdirSync(dir), []);
  writeJson(path.join(dir, 'settings.json'), { statusLine: { type: 'command', command: NODE_PRINT } });
  track(dir, envelope('/getit', 'statusline on'));
  r = track(dir, envelope('/getit', 'statusline status'));
  assert.ok(r.context.startsWith('GETIT status line is installed'), r.context);
  assert.ok(r.context.includes(JSON.stringify(NODE_PRINT)), 'reports the saved chain');
  r = track(dir, envelope('/getit', 'statusline bogus'));
  assert.ok(r.context.startsWith('GETIT: unknown argument'), r.context);
});

test('installed copy runs end to end with the saved chain and the flag', () => {
  const dir = tmpDir();
  writeJson(path.join(dir, 'settings.json'), { statusLine: { type: 'command', command: NODE_PRINT } });
  track(dir, envelope('/getit', 'statusline on'));
  const script = path.join(dir, 'getit', 'getit-statusline.js');
  assert.equal(statusline(dir, script), 'CHAINED  getit on');
  track(dir, envelope('/getit', 'off'));
  assert.equal(statusline(dir, script), 'CHAINED  getit off');
  track(dir, envelope('/getit', 'on'));
  assert.equal(statusline(dir, script), 'CHAINED  getit on');
});

test('installed copy with no previous status line prints the plain line', () => {
  const dir = tmpDir();
  track(dir, envelope('/getit', 'statusline on'));
  const script = path.join(dir, 'getit', 'getit-statusline.js');
  assert.equal(statusline(dir, script), 'getit on');
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
