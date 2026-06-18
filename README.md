<!--
Badges to add after npm publish:

[![npm version](https://img.shields.io/npm/v/@tasklight/pi-tasklight.svg)](https://www.npmjs.com/package/@tasklight/pi-tasklight)
[![npm downloads](https://img.shields.io/npm/dm/@tasklight/pi-tasklight.svg)](https://www.npmjs.com/package/@tasklight/pi-tasklight)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
-->

# Pi Tasklight

Tasklight notifications for [Pi](https://github.com/earendil-works/pi) coding-agent sessions.

Use Pi Tasklight when you want Pi to work in the background and notify you with a short outcome summary when it finishes.

```text
/tl fix the failing auth test
```

When Pi is done, Pi Tasklight sends a Tasklight desktop notification like:

```text
Pi task finished in 2m 14s
Fixed the failing auth test setup.
```

No second summarization model call is used. The extension asks Pi for one tiny hidden summary marker, strips it from the final answer, and passes that summary to Tasklight.

---

## Features

- `/tl <prompt>` runs a one-off Pi task and notifies when it finishes.
- `/tl` opens a package info overlay with Tasklight doctor status and project links.
- Optional always-on mode for normal Pi prompts.
- Short notification summaries without a second LLM call.
- `tasklight doctor` and test notification commands inside Pi.
- Session-aware notification titles like `Pi - <session name>`.
- Terminal/app focus support delegated to Tasklight.
- Uses the published [`@tasklight/cli`](https://www.npmjs.com/package/@tasklight/cli) package when installed.

---

## Requirements

- Pi coding agent
- Tasklight CLI

Pi Tasklight depends on [`@tasklight/cli`](https://www.npmjs.com/package/@tasklight/cli), so npm/git package installs can bring the Tasklight CLI with the extension.

Tasklight is resolved in this order:

1. `TASKLIGHT_BIN=/path/to/tasklight`
2. installed `@tasklight/cli` package dependency
3. `tasklight` in `PATH`
4. `npx -y @tasklight/cli` fallback

Check Tasklight directly:

```bash
npx -y @tasklight/cli doctor
```

---

## Quick start from this repo

Install dependencies once:

```bash
npm install
```

Run Pi with the extension loaded:

```bash
pi -e .
```

Then inside Pi:

```text
/tl
/tl-test
/tl run a tiny harmless check and tell me done
```

You can also load the extension file directly:

```bash
pi -e ./extensions/tasklight.ts
```

---

## Install locally

Install globally for your user:

```bash
pi install ~/Work/pi-tasklight
```

Or install project-locally from a project where you use Pi:

```bash
pi install -l ~/Work/pi-tasklight
```

After installing, start Pi normally and use:

```text
/tl your task here
```

---

## Commands

| Command | Description |
| --- | --- |
| `/tl` | Show package info, Tasklight doctor status, and project links |
| `/tl <prompt>` | Run a Pi prompt and notify with a short Tasklight summary when done |
| `/tl-on` | Enable Tasklight notifications for every normal Pi prompt in this session |
| `/tl-off` | Disable always-on mode |
| `/tl-toggle` | Toggle always-on mode |
| `/tl-status` | Show whether always-on mode is enabled |
| `/tl-doctor` | Run `tasklight doctor` inside Pi |
| `/tl-test` | Send a test Tasklight notification |

`/tl` includes autocomplete suggestions for common prompts. Type `/tl ` and use Pi's normal autocomplete flow.

---

## Always-on mode

By default, only `/tl <prompt>` creates a Tasklight notification.

Enable notifications for every normal Pi prompt in the current session:

```text
/tl-on
```

Disable it:

```text
/tl-off
```

Start Pi with always-on mode enabled by default:

```bash
export PI_TASKLIGHT_ALWAYS=1
pi -e ~/Work/pi-tasklight
```

`/tl-on`, `/tl-off`, and `/tl-toggle` persist the setting in the current Pi session using a custom session entry. That metadata does not participate in LLM context.

---

## Notification title and focus

Notification titles use this format when possible:

```text
Pi - <session name>
```

If the Pi session has no name, Pi Tasklight falls back to the detected terminal/application name, for example:

```text
Pi - iTerm2
```

Override the title suffix:

```bash
export PI_TASKLIGHT_TITLE_SUFFIX="My terminal"
```

Override the click-to-focus target:

```bash
export TASKLIGHT_ACTIVATE_APP="Terminal"
export TASKLIGHT_ACTIVATE_APP="iTerm2"
export TASKLIGHT_ACTIVATE_APP="Visual Studio Code"
```

Focus behavior is handled by Tasklight itself. Pi Tasklight only calls the Tasklight CLI.

---

## Environment variables

| Variable | Description |
| --- | --- |
| `TASKLIGHT_BIN` | Path to a Tasklight binary. Overrides all other CLI resolution. |
| `TASKLIGHT_ACTIVATE_APP` | App name or bundle ID to focus when clicking notifications. |
| `TASKLIGHT_ICON` | Override Tasklight's notification icon path. |
| `PI_TASKLIGHT_ALWAYS` | Enable always-on mode by default: `1`, `true`, `yes`, or `on`. |
| `PI_TASKLIGHT_TITLE_SUFFIX` | Override notification title suffix. |

---

## Local Tasklight development

If you are developing Tasklight and Pi Tasklight side-by-side:

```bash
cd ~/Work/tasklight
go build -o bin/tasklight ./cmd/tasklight

cd ~/Work/pi-tasklight
export TASKLIGHT_BIN="$HOME/Work/tasklight/bin/tasklight"
pi -e .
```

---

## How it works

Pi Tasklight intentionally keeps Tasklight generic. Tasklight remains the notification CLI; this package is only the Pi integration layer.

For `/tl` and always-on turns, the extension adds a small per-turn instruction asking Pi to append a hidden summary marker:

```text
<TASKLIGHT_SUMMARY>Fixed failing auth test setup.</TASKLIGHT_SUMMARY>
```

The extension then:

1. extracts the summary,
2. strips the marker from the visible assistant message,
3. sends the summary through `tasklight notify`, and
4. falls back to the first useful final-answer line if the marker is missing.

---

## Security note

Pi extensions run with local user permissions. Only install Pi packages from sources you trust.

Pi Tasklight executes the Tasklight CLI using your local environment and the configuration described above.

---

## Development

```bash
npm install
npm test
npm run fallow
```

Useful smoke checks:

```bash
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl"
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl-doctor"
```

---

## Publishing later

This package is structured as a Pi package and can be published through npm.

After npm publish:

```bash
pi install npm:@tasklight/pi-tasklight
```

The repository is currently private. Once it is public, add:

- npm/version/download badges at the top of this README
- public repository and issue links
- optional git install instructions, for example:

```bash
pi install git:github.com/revazi/pi-tasklight
```
