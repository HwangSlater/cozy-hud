<div align="center">

# cozy-hud

### A tiny companion beside your terminal

A set of Claude Code mods that adds a pixel character and a small dashboard.<br>
It moves while Claude works, jumps when a task is done, and sweats when context runs low.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)](#get-started)
![Characters](https://img.shields.io/badge/characters-14-f2a0a0.svg)
[![Local only](https://img.shields.io/badge/data-stays%20local-555.svg)](#your-data-stays-on-your-machine)

[한국어](README.md) · **English** · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

<img src="docs/images/demo-work.gif" alt="The HUD while Claude fixes bugs in shop.py: the bubble says what it is doing, and the token and context cards fill in when the reply ends" width="820">

<sub>Claude fixing bugs (3× speed). The bubble says what it is doing; the token and context cards fill in when the reply ends.</sub>

</div>

---

> The in-app text (settings, speech bubbles, cards) is Korean for now.

## Waiting, made a little less dull

Once Claude is working, the screen is just text piling up. It is hard to tell at a glance what it is doing, how much it has used, or how much context is left.

**cozy-hud** puts a small character and a dashboard in a side pane and in one line above the prompt.

- The character taps its feet while Claude works, jumps when a task finishes, sweats when context passes 80%, and falls asleep after a long rest.
- A speech bubble says what Claude is doing with each tool, like "reading register.tsx".
- Install only the cards you want: tokens, context, to-dos. Any mix looks like one design.

## Get started

Install once in Claude Code.

```
/plugin marketplace add HwangSlater/cozy-hud
/plugin install cozy-hud@cozy-hud
```

Add the cards you want.

```
/plugin install cozy-hud-tokens@cozy-hud
/plugin install cozy-hud-context@cozy-hud
/plugin install cozy-hud-checklist@cozy-hud
/plugin install cozy-hud-usage@cozy-hud
/plugin install cozy-hud-tools@cozy-hud
/plugin install cozy-hud-git@cozy-hud
/plugin install cozy-hud-agents@cozy-hud
```

Two tabs open: "HUD" and "HUD settings". That's it.

**Requirements** · Claude Code with mods (2.1.287 or later) · Draws in the terminal and the desktop app (not in `claude -p` or remote sessions) · Pane at least 22 columns wide, 50+ for the large form · No network access

## What's inside

| Mod | What it does |
| --- | --- |
| `cozy-hud` | Core (required). Side pane, the line above the prompt, settings, 14 characters |
| `cozy-hud-tokens` | Tokens for this reply and the whole session, a bar chart per reply |
| `cozy-hud-context` | Context usage gauge with a warning threshold you choose |
| `cozy-hud-checklist` | Claude's to-do list, live. Follows the session checklist file (`~/.claude/checklists/<session>.md`) automatically when there is one, or any Markdown file you choose |
| `cozy-hud-usage` | 5-hour and weekly usage limits with time until reset, plus reply and session time and cost |
| `cozy-hud-tools` | The tools Claude just used, newest first (failures in the warning color) |
| `cozy-hud-git` | Current branch, changed files, unpushed commits |
| `cozy-hud-agents` | Each running subagent with its name, what it is doing, and elapsed time |

Characters: Claude, cat, penguin, chick, rabbit, fox, arctic fox, puppy, frog, bear, panda, hamster, strawberry mochi, steamed bun.

<div align="center"><img src="docs/images/characters.png" alt="The 14 cozy-hud characters" width="760"></div>

## Change things

Use the mouse or keyboard in the "HUD settings" tab. The preview stays at the top; below it, step into a list such as "Form › Character" and pick. Click an earlier part of the path at the top ("Settings › Form › Character") to jump straight back to that level. Changes stay across sessions.

<div align="center">
<img src="docs/images/demo-settings.gif" alt="The HUD settings tab: flipping characters and switching the form between large, medium and small, with the preview updating at once" width="400">

<sub>Driven with the keyboard here. Clicking works the same.</sub>
</div>

| List | What you pick |
| --- | --- |
| Form | HUD form (large, medium, small) and only the settings that form uses: character size, bubbles, per-card settings |
| Layout | Where it shows, size above the prompt, motion speed, time until sleep, pet button, reactions to finishing and warnings |
| Alerts & stats | Notify when a long reply finishes (off, or after 30 s, 1 min, 3 min), alert sound, a "Today" card (replies, files edited, time worked; off by default) |
| Theme | Auto · Basic · Amber · Mint · Mono |
| Cards | Show or hide, order |

Pick the form that fits your pane. **Large** (50+ columns) adds detail lines to cards, **medium** is the regular look, and **small** (22–32 columns) turns each card into one line, with each line switchable on or off.

<table align="center">
<tr><th>Large</th><th>Medium</th><th>Small</th></tr>
<tr><td valign="top"><img src="docs/images/form-large.png" alt="Large: Wide pane · detail lines" width="260"><br><sub>Wide pane · detail lines</sub></td><td valign="top"><img src="docs/images/form-medium.png" alt="Medium: Regular pane · cards" width="260"><br><sub>Regular pane · cards</sub></td><td valign="top"><img src="docs/images/form-small.png" alt="Small: Narrow pane · one line per card" width="260"><br><sub>Narrow pane · one line per card</sub></td></tr>
</table>

Flip characters with `[ < ]` `[ > ]` under the preview, or click the name to pick from the full list. Click "Pet" under the character and it hops once (hide the button under Layout).

Keyboard: press `Ctrl+X` then `Tab` to enter the settings tab. `Tab` next item · `Enter` pick · `A`/`D` previous/next character · `Esc` leave.

Quick commands:

```
/hud                    open the settings tab
/hud character cat      change character
/hud theme mint         change theme
/hud layout pane        show in the pane only
/hud form small         change the HUD form (large, medium, small)
/hud reset              back to defaults
```

## Your data stays on your machine

cozy-hud makes no network calls. It only draws what Claude Code already knows (token usage, context, tool names, to-dos). Your settings stay in Claude Code's mod storage.

## Make characters and cards

Other mods can depend on the core with `dependencies: ["cozy-hud"]`.

- Characters: pass pixel-letter art and a color table to `$.hud.characters({ list })`. See [core/data/characters.json](core/data/characters.json). One letter is one pixel, `.` is transparent, and `~` is reserved for the sweat drop.
- Cards: send them with `$.hud.put({ id, title, lines, brief })`. Name a role such as `dim`, `ok` or `warn` instead of a color. Types are in [core/types/index.d.ts](core/types/index.d.ts).
- The core sends `hud.ready` when it reloads, so send yours on both `session.start` and `hud.ready`.

## License

[MIT](LICENSE) © [HwangSlater](https://github.com/HwangSlater). The Claude character is fan art of Anthropic's mascot.
