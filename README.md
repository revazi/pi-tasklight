# pi-tasklight

Pi extension package for the Tasklight CLI.

`pi-tasklight` adds Tasklight notifications to Pi coding-agent sessions. Use it when you want Pi to do a task and notify you with a short summary when the task finishes.

```text
/tl fix the failing auth test
```

When Pi finishes, the extension calls:

```bash
tasklight notify ...
```

It avoids a second summarization model call. For `/tl` and always-on turns, the extension adds a tiny per-turn instruction asking Pi to include one short hidden notification summary marker, strips that marker from the final assistant message, and sends the summary to Tasklight.

## Requirements

- Pi coding agent
- Tasklight CLI

`pi-tasklight` depends on [`@tasklight/cli`](https://www.npmjs.com/package/@tasklight/cli), so npm/git installs can bring the Tasklight CLI with the Pi package.

Tasklight is resolved in this order:

1. `TASKLIGHT_BIN=/path/to/tasklight`
2. installed `@tasklight/cli` package dependency
3. `tasklight` in `PATH`
4. `npx -y @tasklight/cli` fallback

Check Tasklight first:

```bash
npx -y @tasklight/cli doctor
```

For local development next to the Tasklight repository:

```bash
cd ~/Work/tasklight
go build -o bin/tasklight ./cmd/tasklight

cd ~/Work/pi-tasklight
export TASKLIGHT_BIN="$HOME/Work/tasklight/bin/tasklight"
```

## Try without installing

From this repository, install the package dependency once if you want to use the local `@tasklight/cli` instead of `PATH`/`npx`:

```bash
npm install
```

Then run:

```bash
pi -e ./extensions/tasklight.ts
```

Or load the package directory:

```bash
pi -e .
```

Then inside Pi:

```text
/tl run the tests and fix failures
```

## Install locally

For local-path installs from this checkout, run `npm install` once first unless `tasklight` is already in `PATH` or `TASKLIGHT_BIN` is set.

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

## Commands

```text
/tl            Show package info, doctor result, and contribution links
/tl <prompt>   Run a Pi prompt and notify with a short summary when done
/tl-on         Enable Tasklight notifications for every normal Pi prompt in this session
/tl-off        Disable always-on mode
/tl-toggle     Toggle always-on mode
/tl-status     Show whether always-on mode is enabled
/tl-doctor     Run tasklight doctor inside Pi
/tl-test       Send a test Tasklight notification
```

`/tl` includes argument autocomplete suggestions for common prompts. Type `/tl ` and use Pi's normal autocomplete flow to pick a suggestion.

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

Always-on mode adds the same small per-turn summary instruction to normal prompts, so it has a tiny token cost on each enabled turn. It still does not make a second summarization model call.

## Notification title and focus

Notification titles use this format when possible:

```text
Pi - <session name>
```

If the Pi session has no name, `pi-tasklight` falls back to the detected terminal/application name, for example:

```text
Pi - iTerm2
```

If neither is available, the title is just:

```text
Pi
```

Override the title suffix:

```bash
export PI_TASKLIGHT_TITLE_SUFFIX="My terminal"
```

Override click-to-focus target:

```bash
export TASKLIGHT_ACTIVATE_APP="Terminal"
export TASKLIGHT_ACTIVATE_APP="iTerm2"
export TASKLIGHT_ACTIVATE_APP="Visual Studio Code"
```

On macOS, Tasklight works without external dependencies through `osascript`, but custom notification identity, custom icons, and click-to-focus work best today with:

```bash
brew install terminal-notifier
```

Tasklight does not auto-install `terminal-notifier`; without it, Tasklight falls back to `osascript`.

When `terminal-notifier` is available, Tasklight creates and registers a tiny local `Tasklight.app` helper under `~/Library/Application Support/Tasklight/`. Tasklight uses that bundle as the notification sender, so the left-side notification icon is Tasklight rather than `terminal-notifier`.

A future Tasklight phase will replace this dependency with a tiny native macOS notification helper bundled with Tasklight itself.

If Pi runs inside tmux, Tasklight can also attempt to return to the original tmux pane.

## Environment variables

```text
TASKLIGHT_BIN                 Path to the tasklight binary. Defaults to tasklight in PATH.
TASKLIGHT_ACTIVATE_APP        App name or bundle ID to focus when clicking notifications.
TASKLIGHT_ICON                Override Tasklight's notification icon path.
PI_TASKLIGHT_ALWAYS           Enable always-on mode by default: 1/true/yes/on.
PI_TASKLIGHT_TITLE_SUFFIX     Override notification title suffix.
```

## Design

`pi-tasklight` intentionally does not make Tasklight Pi-specific. Tasklight remains the generic notification CLI; this package is only the Pi integration layer.

The `/tl` command adds a short per-turn instruction asking Pi to append a marker like:

```text
<TASKLIGHT_SUMMARY>Fixed failing auth test setup.</TASKLIGHT_SUMMARY>
```

The extension extracts that text, removes the marker from the final assistant message, and sends it to Tasklight. If the model does not provide a marker, the extension falls back to a short deterministic summary from the final answer.

## Publish later

This package is structured as a Pi package and can later be published independently through npm or git. Since `@tasklight/cli` is a dependency, npm/git package installs can install the Tasklight CLI automatically.

Future install examples:

```bash
pi install git:github.com/<owner>/pi-tasklight
pi install npm:@tasklight/pi-tasklight
```
