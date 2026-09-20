# GETIT

**Understand it. Remember it. Explain it.**

[![Install](https://skills.sh/b/netanelyasi/getit)](https://skills.sh/netanelyasi/getit)
[![GitHub stars](https://img.shields.io/github/stars/netanelyasi/getit?style=flat)](https://github.com/netanelyasi/getit/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Works with](https://img.shields.io/badge/Works%20with-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20OpenCode%20%C2%B7%20more-blue)](#install)

Most "explain this simply" prompts fail in one of two ways. Either the answer is dumbed down until it is no longer true, or it is a wall of jargon with the word "simply" in front of it. GETIT is a skill with one rule: **simplify the explanation, not the truth.** It optimizes for a single outcome, which it calls the RETELL test: after reading the answer once, could you explain the core idea to someone else, in your own words, without getting it wrong?

## Install

Install with the [skills](https://skills.sh) CLI (works with Claude Code, Codex, Cursor, OpenCode and other agents):

```bash
npx skills add netanelyasi/getit
```

Install for all projects on your machine, or target a specific agent:

```bash
npx skills add netanelyasi/getit --global
npx skills add netanelyasi/getit --agent codex
npx skills add netanelyasi/getit --agent cursor
```

As a Claude Code plugin:

```
/plugin marketplace add netanelyasi/getit
/plugin install getit@getit
```

Manually, as a Claude Code skill:

```bash
git clone https://github.com/netanelyasi/getit ~/.claude/skills/getit
```

Claude.ai and Claude Desktop: upload `SKILL.md` as a custom skill in your settings.

## Usage

In Claude Code:

```
/getit <topic>
```

Or just ask. "Explain X", "help me understand Y", "break this down", "what does this document actually say" all match the skill's description, so it triggers on its own.

It works in whatever language you write in. Ask in Hebrew, get the answer in Hebrew, same rules.

## How it works

The skill walks the model through eight steps before it answers:

1. **CORE** — State the direct answer or central idea early. No background tour first.
2. **MODEL** — Build a simple, correct picture from things the reader already understands. Never swap one unfamiliar term for another.
3. **CHAIN** — Explain how and why as a causal chain: this happens → which causes this → which leads to this.
4. **GROUND** — Make it concrete with one small example, number or scenario. Prefer a real example over an analogy.
5. **PRESERVE** — Keep the facts that change the conclusion, the conditions, the exceptions, the uncertainty and the tradeoffs.
6. **COMPRESS** — Cut repetition, filler, decorative wording and anything that does not improve the reader's mental model.
7. **RETELL** — Check: could the reader now explain this to someone else without a meaningful error? If not, fix the gap.
8. **STOP** — Once the reader has the idea, the mechanism and the qualifications, end.

On top of the flow there is a default style (plain words, short paragraphs, name a technical term and explain it on the spot), adaptive depth (a simple question gets a few sentences, a complex one gets layers), and a final silent checklist the model runs before sending.

## Before / After

**"Why don't antibiotics work against viruses?"**

Before, a typical answer:

> Antibiotics are antimicrobial agents that exert bactericidal or bacteriostatic effects by targeting prokaryote-specific structures such as peptidoglycan synthesis, 70S ribosomal subunits, or DNA gyrase. Viruses are obligate intracellular parasites that lack these structures, so antibiotics have no pharmacological target. Viral infections require antivirals such as nucleoside analogues or protease inhibitors. Note that inappropriate antibiotic use contributes to antimicrobial resistance, a major public health concern. Always consult a healthcare professional.

After, with GETIT:

> **Antibiotics target machinery that bacteria have, but viruses are built differently.**
>
> A bacterium is a cell with its own systems for things such as building its protective wall and making proteins. Different antibiotics interfere with those systems.
>
> A virus does not have most of that machinery. It gets inside our cells and uses their machinery to make more copies of itself. So many of the targets antibiotics attack in bacteria simply are not present in viruses.
>
> That is why antibiotics can treat bacterial infections but do not treat viral infections.

**"What is a race condition?"**

Before, a typical answer:

> In simple terms, a race condition is like two people trying to walk through a door at the same time and bumping into each other. In programming, it occurs when multiple threads access shared resources concurrently without proper synchronization, leading to unpredictable behavior. To prevent it, use mutexes, semaphores, or other synchronization primitives. ELI5: the computer gets confused when two things happen at once.

After, with GETIT:

> **A race condition is a bug where the result depends on which of two things happens to run first, and nothing forces the order.**
>
> It shows up when two pieces of code work on the same data at the same time. Each one reads the data, changes it, and writes it back. If the second one reads before the first has written, it works from a stale value, and one of the changes is lost.
>
> A concrete case: an account balance is 100. Two withdrawals of 30 run at once. Both read 100, both compute 70, both write 70. The balance should be 40. It is 70, and the bank just gave away 30.
>
> It is hard to catch because it does not fail every time, only when the timing lines up. The same code can pass a thousand tests and break in production. The fix is to force the order: make read-change-write happen as one uninterruptible step (a lock, or an atomic operation), so the second withdrawal has to wait for the first.

The first "before" is accurate but only readable if you already know the terms. The second sounds friendly but never shows the mechanism, and the door analogy does not explain why the result is wrong. Both fail the RETELL test.

## What it will not do

- It will not remove a condition, exception or uncertainty to sound more confident. If the honest answer is "usually, but not when X", that is the answer.
- It will not use canned labels like "ELI5", "In simple terms" or "What to tell your friend". It just explains.
- It will not sound childish unless you ask for a child-level explanation.
- It will not pad to a fixed length. Simple question, short answer. Complex concept, layers. Length follows understanding, not a template.

## Who this is not for

- People who want a one-line answer no matter what. GETIT will give you a short answer when the question is simple, but it will not cut a causal step just to fit on one line.
- Experts who want raw density with no scaffolding. The Adaptive Depth rules do handle an expert audience, and technical vocabulary is preserved when it adds precision, but the reasoning flow stays. If you want a bare reference dump, this is the wrong tool.

## Related

Other BrainboxAI skills:

- [Brainboxai-IL/tlae](https://github.com/Brainboxai-IL/tlae) — Tech Lead Agentic Engineering, a Claude Code skill that adapts to your stack, risk profile and domain.
- [Brainboxai-IL/verify-crew](https://github.com/Brainboxai-IL/verify-crew) — separate builder, test-author and verifier agents so the code author never grades its own work.

## License

MIT. See [LICENSE](LICENSE).

Built by [Netanel Elyasi](https://github.com/netanelyasi), [BrainboxAI](https://brainboxai.io).
