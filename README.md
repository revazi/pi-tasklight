<!--
Badges to add after npm publish:

[![npm version](https://img.shields.io/npm/v/@tasklight/pi-tasklight.svg)](https://www.npmjs.com/package/@tasklight/pi-tasklight)
[![npm downloads](https://img.shields.io/npm/dm/@tasklight/pi-tasklight.svg)](https://www.npmjs.com/package/@tasklight/pi-tasklight)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
-->

# Pi Tasklight

Tasklight notifications for [Pi](https://github.com/earendil-works/pi) coding-agent sessions.

Use Pi Tasklight when you want Pi to work in the background and notify you when it finishes.

```text
/tl fix the failing auth test
```

When Pi is done, Pi Tasklight sends a Tasklight desktop notification like:

```text
Pi · my-repo · auth-session
✓ Finished in 2m 14s
fix the failing auth test
```

No summarization model call is used. Pi Tasklight sends the original prompt as the notification message.

---

## Features

- `/tl <prompt>` runs a one-off Pi task and notifies when it finishes.
- `/tl` opens the Pi Tasklight status view with Tasklight doctor results and project links.
- Optional notifications for normal Pi prompts via `/tl-toggle`.
- Notifications without a second LLM call.
- Tasklight doctor status in `/tl` and a test notification command inside Pi.
- Context-aware notification titles like `Pi · <directory/repo> · <session>`.
- Click-to-focus support delegated to Tasklight.
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

Inside Pi, run bare `/tl` to see Tasklight status and doctor results. You can also check Tasklight directly from a shell:

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
| `/tl` | Show Pi Tasklight status, Tasklight doctor results, and project links |
| `/tl <prompt>` | Run a Pi prompt and notify when done |
| `/tl-toggle` | Toggle notifications for normal Pi prompts |
| `/tl-test` | Send a test Tasklight notification |

Use bare `/tl` whenever you want to check Tasklight status or doctor output. `/tl <prompt>` includes autocomplete suggestions for common prompts; type `/tl ` and use Pi's normal autocomplete flow.

---

## Normal prompt notifications

By default, only `/tl <prompt>` creates a Tasklight notification.

Toggle notifications for every normal Pi prompt in the current session:

```text
/tl-toggle
```

Start Pi with normal prompt notifications enabled by default:

```bash
export PI_TASKLIGHT_ALWAYS=1
pi -e ~/Work/pi-tasklight
```

`/tl-toggle` persists the setting in the current Pi session using a custom session entry. That metadata does not participate in LLM context.

---

## Notification title and focus

Notification titles use this format when possible:

```text
Pi · <directory/repo> · <session>
```

If the Pi session has no name, Pi Tasklight uses:

```text
Pi · <directory/repo>
```

Override the directory/repo title part:

```bash
export PI_TASKLIGHT_TITLE_SUFFIX="my-repo"
```

Override the click-to-focus target:

```bash
export TASKLIGHT_ACTIVATE_APP="Your App Name Or Bundle ID"
```

Focus behavior is handled by Tasklight itself. Pi Tasklight only passes through `TASKLIGHT_ACTIVATE_APP` or the current bundle identifier when available.

---

## Environment variables

| Variable | Description |
| --- | --- |
| `TASKLIGHT_BIN` | Path to a Tasklight binary. Overrides all other CLI resolution. |
| `TASKLIGHT_ACTIVATE_APP` | App name or bundle ID to focus when clicking notifications. |
| `TASKLIGHT_ICON` | Override Tasklight's notification icon path. |
| `PI_TASKLIGHT_ALWAYS` | Enable normal prompt notifications by default: `1`, `true`, `yes`, or `on`. |
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

For `/tl` and toggled normal-prompt notifications, Pi Tasklight tracks the prompt locally and sends a notification when Pi finishes. It does not add extra prompt instructions, parse the final answer, or make a second model call.

The notification title carries folder/session context; the notification message is the original prompt, truncated if needed.

---

## Security note

Pi extensions run with local user permissions. Only install Pi packages from sources you trust.

Pi Tasklight executes the Tasklight CLI using your local environment and the configuration described above.

---

## Development

```bash
npm install
npm test
```

Useful smoke checks:

```bash
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl"
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
