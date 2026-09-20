#!/usr/bin/env node
// getit: Claude Code status line command. Zero dependencies. Always exits 0.
//
// Claude Code allows exactly one statusLine command, so this script chains.
// `/getit statusline on` saves the previous command in
// <claudeDir>/getit/statusline.json as {"chain": "<command>"} and copies this
// file plus getit-state.js into <claudeDir>/getit/. Each refresh runs the chain
// with the same stdin JSON, prints its first output line, and appends
// "getit on" / "getit off". No chain, or one that fails, hangs past 3 s or
// prints nothing, gives just "getit on" / "getit off".
//
// Async spawn with a timer, not spawnSync: measured on Windows, spawnSync with
// stdin input waits for a hung grandchild (10 s for a 3 s timeout).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const CHAIN_TIMEOUT_MS = 3000;

// Plugin layout, then the installed copy (getit-state.js beside this file).
function loadState() {
  try { return require('../hooks/getit-state'); } catch (e) { /* not the plugin tree */ }
  try { return require(path.join(__dirname, 'getit-state')); } catch (e) { /* no copy either */ }
  const dir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const readFlag = () => { try { return fs.readFileSync(path.join(dir(), '.getit-active'), 'utf8').trim().toLowerCase() === 'off' ? 'off' : 'on'; } catch (e) { return 'on'; } };
  return { claudeDir: dir, readFlag: readFlag };
}

function readChain(claudeDir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(claudeDir, 'getit', 'statusline.json'), 'utf8'));
    return typeof cfg.chain === 'string' && cfg.chain.trim() ? cfg.chain : null;
  } catch (e) { return null; }
}

function killTree(child) {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGKILL');
  } catch (e) { /* best effort */ }
}

// Calls done(firstLine) exactly once; '' on failure, timeout or empty output.
function runChain(chain, input, done) {
  let out = '', settled = false;
  const finish = text => { if (!settled) { settled = true; clearTimeout(timer); done(text); } };
  const timer = setTimeout(() => { if (!settled) { killTree(child); finish(''); } }, CHAIN_TIMEOUT_MS);
  let child;
  try {
    child = spawn(chain, { shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e) { return finish(''); }
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', d => { out += d; });
  child.on('error', () => finish(''));
  child.on('close', code => finish(code === 0 && out.trim() ? out.trim().split(/\r?\n/)[0] : ''));
  child.stdin.on('error', () => { /* chain closed stdin early */ });
  child.stdin.end(input);
}

function main(input) {
  let line = 'getit on', chain = null;
  try {
    const state = loadState();
    line = 'getit ' + (state.readFlag() === 'off' ? 'off' : 'on');
    chain = readChain(state.claudeDir());
  } catch (e) { /* plain line */ }
  const print = prefix => { process.stdout.write((prefix ? prefix + '  ' : '') + line + '\n'); process.exit(0); };
  if (chain) runChain(chain, input, print); else print('');
}

let input = '';
if (process.stdin.isTTY) { main(''); } else {
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('error', () => main(input));
  process.stdin.on('end', () => main(input));
  process.stdin.resume();
}
