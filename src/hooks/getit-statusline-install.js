#!/usr/bin/env node
// getit: install, remove and report the getit status line.
//
// Claude Code reads one statusLine command from <claudeDir>/settings.json.
// install() points it at a copy of src/statusline/getit-statusline.js placed
// in <claudeDir>/getit/ (a stable path; the plugin cache directory changes on
// every plugin update) and saves the command that was there before in
// <claudeDir>/getit/statusline.json so the status line script can chain it
// and uninstall() can restore it. settings.json is backed up to
// settings.json.getit-bak-<epoch> before every write and every other key is
// preserved. Each function returns the additionalContext text for this turn
// and never throws.

const fs = require('fs');
const path = require('path');
const { claudeDir, atomicWrite } = require('./getit-state');

const SCRIPT_NAME = 'getit-statusline.js';
const STATE_NAME = 'getit-state.js';
const CHAIN_NAME = 'statusline.json';
const SOURCE_SCRIPT = path.join(__dirname, '..', 'statusline', SCRIPT_NAME);
const SOURCE_STATE = path.join(__dirname, STATE_NAME);

const ONE_LINE = ' Do nothing else this turn.';

function getitDir() { return path.join(claudeDir(), 'getit'); }
function settingsPath() { return path.join(claudeDir(), 'settings.json'); }
function chainPath() { return path.join(getitDir(), CHAIN_NAME); }
function installedScript() { return path.join(getitDir(), SCRIPT_NAME); }

function statusLineCommand() {
  return 'node "' + installedScript().split(path.sep).join('/') + '"';
}

function pointsAtGetit(settings) {
  return !!(settings && settings.statusLine && typeof settings.statusLine.command === 'string' &&
    settings.statusLine.command.includes(SCRIPT_NAME));
}

// Returns { settings, exists } or throws when the file exists but is not a
// JSON object. An unparseable settings.json is never overwritten.
function readSettings() {
  let raw;
  try {
    raw = fs.readFileSync(settingsPath(), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { settings: {}, exists: false };
    throw new Error('settings.json could not be read (' + e.code + ')');
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error('settings.json is not valid JSON, so it was left untouched'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('settings.json is not a JSON object, so it was left untouched');
  return { settings: parsed, exists: true };
}

function backupSettings(exists) {
  if (!exists) return null;
  const target = settingsPath() + '.getit-bak-' + Date.now();
  fs.copyFileSync(settingsPath(), target);
  return target;
}

function writeSettings(settings) {
  if (!atomicWrite(settingsPath(), JSON.stringify(settings, null, 2) + '\n')) throw new Error('settings.json could not be written');
}

function readChain() {
  try {
    const cfg = JSON.parse(fs.readFileSync(chainPath(), 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : null;
  } catch (e) { return null; }
}

function writeChain(cfg) {
  if (!atomicWrite(chainPath(), JSON.stringify(cfg, null, 2) + '\n')) throw new Error(CHAIN_NAME + ' could not be written');
}

function copyFiles() {
  fs.mkdirSync(getitDir(), { recursive: true });
  for (const [src, name] of [[SOURCE_SCRIPT, SCRIPT_NAME], [SOURCE_STATE, STATE_NAME]]) {
    if (!atomicWrite(path.join(getitDir(), name), fs.readFileSync(src, 'utf8'))) throw new Error(name + ' could not be copied');
  }
}

function install() {
  try {
    copyFiles();
    const { settings, exists } = readSettings();
    backupSettings(exists);
    const current = settings.statusLine;
    const command = current && typeof current.command === 'string' && current.command.trim() ? current.command : null;
    if (command && command.includes(SCRIPT_NAME)) {
      // Already installed: keep the saved chain, refresh the files only.
      if (!readChain()) writeChain({ chain: null, savedAt: Date.now() });
    } else if (command) {
      writeChain({ chain: command, type: typeof current.type === 'string' ? current.type : 'command', savedAt: Date.now() });
    } else {
      writeChain({ chain: null, savedAt: Date.now() });
    }
    settings.statusLine = { type: 'command', command: statusLineCommand() };
    writeSettings(settings);
    return 'GETIT status line installed. Reply with one short line saying the getit status line is on and that it shows after the next reply (Claude Code refreshes the status line after each response).' + ONE_LINE;
  } catch (e) {
    return 'GETIT status line could not be installed: ' + e.message + '. Reply with one short line saying so.' + ONE_LINE;
  }
}

function uninstall() {
  try {
    const { settings, exists } = readSettings();
    if (!pointsAtGetit(settings)) {
      return 'GETIT status line is not installed (settings.json does not point at ' + SCRIPT_NAME + '), nothing was changed. Reply with one short line saying so.' + ONE_LINE;
    }
    backupSettings(exists);
    const saved = readChain();
    const chain = saved && typeof saved.chain === 'string' && saved.chain.trim() ? saved.chain : null;
    if (chain) settings.statusLine = { type: typeof saved.type === 'string' ? saved.type : 'command', command: chain };
    else delete settings.statusLine;
    writeSettings(settings);
    return 'GETIT status line removed. Reply with one short line saying the getit status line is off and ' +
      (chain ? 'the previous status line is restored.' : 'there was no previous status line to restore.') + ONE_LINE;
  } catch (e) {
    return 'GETIT status line could not be removed: ' + e.message + '. Reply with one short line saying so.' + ONE_LINE;
  }
}

function status() {
  let installed = false;
  try { installed = pointsAtGetit(readSettings().settings); } catch (e) { /* unreadable counts as not installed */ }
  const saved = readChain();
  const chain = saved && typeof saved.chain === 'string' && saved.chain.trim() ? saved.chain : null;
  return 'GETIT status line is ' + (installed ? 'installed' : 'not installed') +
    ' (settings.json ' + (installed ? 'points' : 'does not point') + ' at ' + installedScript() + '). ' +
    'Saved previous status line: ' + (chain ? JSON.stringify(chain) : 'none') + '. ' +
    'Reply with one short line stating this. Use /getit statusline on or off to change it.' + ONE_LINE;
}

module.exports = { install, uninstall, status, statusLineCommand, installedScript, pointsAtGetit };
