#!/usr/bin/env node
// getit: Claude Code UserPromptSubmit hook.
//
// Watches each user prompt for /getit on, /getit off, /getit status, the
// matching natural-language phrases, and /getit statusline on|off|status.
// It persists the state in the flag file, installs or removes the status
// line on request, and injects the right context for this turn.
// Always exits 0 and never throws, even on empty or broken stdin.

const { readFlag, writeFlag, readSkill } = require('./getit-state');
const statusline = require('./getit-statusline-install');

const REINFORCE =
  'GETIT MODE ACTIVE: simplify the explanation, not the truth. ' +
  'CORE, MODEL, CHAIN, GROUND, PRESERVE, COMPRESS, RETELL, STOP.';

const OFF_MSG =
  'GETIT MODE OFF. Reply with one short line confirming getit is off, then do nothing else for this turn. ' +
  'From now on explain normally without the GETIT flow.';

const ON_MSG =
  'GETIT MODE ACTIVE. Reply with one short line confirming getit is on, then do nothing else for this turn.';

const ONE_SHOT_MSG = 'GETIT MODE ACTIVE for this request only (flag stays off).';

function emit(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: text
    }
  }));
}

// Whole-prompt, anchored matches only, so a sentence that merely contains
// the word "off" (such as "explain why the server is off") never flips state.
const NL_OFF = /^(?:please\s+)?(?:getit\s+(?:mode\s+)?(?:off|stop)|stop\s+getit|turn\s+off\s+getit(?:\s+mode)?|disable\s+getit)\s*[.!]*$/;
const NL_ON = /^(?:please\s+)?(?:getit\s+(?:mode\s+)?on|start\s+getit|turn\s+on\s+getit(?:\s+mode)?|enable\s+getit)\s*[.!]*$/;

function handle(prompt, skipNaturalLanguage) {
  let command = null; // 'off' | 'on' | 'status' | 'statusline' | 'topic' | null
  let topic = '';
  let sub = '';

  const slash = /^\/getit(?::getit)?(?:\s+(.*))?$/.exec(prompt);
  if (slash) {
    const arg = (slash[1] || '').trim();
    const sl = /^statusline(?:\s+(\S+))?$/.exec(arg);
    if (arg === 'off' || arg === 'stop') command = 'off';
    else if (arg === 'on' || arg === 'start') command = 'on';
    else if (arg === 'status') command = 'status';
    else if (sl) { command = 'statusline'; sub = sl[1] || ''; }
    else { command = 'topic'; topic = arg; }
  } else if (!skipNaturalLanguage) {
    if (NL_OFF.test(prompt)) command = 'off';
    else if (NL_ON.test(prompt)) command = 'on';
  }

  const state = readFlag();

  if (command === 'off') {
    writeFlag('off');
    emit(OFF_MSG);
    return;
  }
  if (command === 'on') {
    writeFlag('on');
    emit(ON_MSG + '\n\n' + readSkill());
    return;
  }
  if (command === 'status') {
    emit('GETIT MODE is ' + state.toUpperCase() + '. Reply with one short line stating that getit is ' + state + ', then do nothing else for this turn.');
    return;
  }
  if (command === 'statusline') {
    // The status line lives in settings.json. Hooks run as the user, so the
    // hook edits it directly and the model only confirms in one line.
    if (sub === 'on' || sub === 'install') emit(statusline.install());
    else if (sub === 'off' || sub === 'uninstall') emit(statusline.uninstall());
    else if (sub === '' || sub === 'status') emit(statusline.status());
    else emit('GETIT: unknown argument "statusline ' + sub + '". Reply with one short line saying the options are /getit statusline on, off or status, then do nothing else for this turn.');
    return;
  }
  if (command === 'topic') {
    // A real /getit <topic> request. The state does not change. When the
    // flag is off, load the skill for this one turn only; when on, the
    // SessionStart hook already loaded it, so nothing more is needed.
    if (state === 'off') emit(ONE_SHOT_MSG + '\n\n' + readSkill());
    return;
  }

  // Ordinary prompt: short per-turn reinforcement while on, silence while off.
  if (state === 'on') emit(REINFORCE);
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    let prompt = String(data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!prompt) return;

    // Unattended scheduled-task runs must not be touched at all.
    if (/<scheduled-task\b/.test(prompt)) return;

    // Claude Code delivers slash commands as an envelope, not the literal text:
    //   <command-message>getit</command-message>
    //   <command-name>/getit</command-name>
    //   <command-args>off</command-args>
    // Rebuild "/getit <args>" for our own command. A foreign command's
    // envelope is left alone and natural-language detection is skipped for
    // it, so another command's arguments cannot trip our triggers.
    let skipNaturalLanguage = false;
    const envName = /<command-name>\s*([^<\s]+)\s*<\/command-name>/.exec(prompt);
    if (envName) {
      if (envName[1] === '/getit' || envName[1] === '/getit:getit') {
        const envArgs = /<command-args>\s*([^<]*?)\s*<\/command-args>/.exec(prompt);
        const args = envArgs ? envArgs[1].trim() : '';
        prompt = args ? '/getit ' + args : '/getit';
      } else {
        skipNaturalLanguage = true;
      }
    }

    handle(prompt, skipNaturalLanguage);
  } catch (e) {
    // Silent fail: broken JSON, unreadable files, anything. Exit 0 below.
  }
});
process.stdin.resume();
