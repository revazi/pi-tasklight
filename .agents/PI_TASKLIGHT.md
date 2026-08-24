# pi-tasklight — Implementation Plan

## Product idea

`pi-tasklight` is a Pi coding-agent extension package that connects Pi sessions to the Tasklight CLI.

It lets users ask Pi to do work and receive a short desktop notification when Pi is ready, without adding a second summarization model call.

Primary command:

```text
/tl fix the failing auth test
```

Always-on mode:

```text
/tl-on
/tl-off
/tl-toggle
```

## Positioning

> pi-tasklight notifies you when Pi finishes and summarizes what happened in one notification-sized sentence.

Tasklight remains the generic CLI. `pi-tasklight` is only the Pi integration layer.

## Current architecture

Repository structure:

```text
pi-tasklight/
  package.json
  README.md
  extensions/
    tasklight.ts
  .agents/
    PI_TASKLIGHT.md
```

Runtime dependency:

```bash
tasklight notify ...
tasklight doctor
```

`pi-tasklight` depends on the published npm CLI package:

```text
@tasklight/cli
```

Tasklight resolution order:

1. `TASKLIGHT_BIN=/path/to/tasklight`
2. `@tasklight/cli` dependency resolved from the extension package
3. normal `PATH` lookup for `tasklight`
4. `npx -y @tasklight/cli` fallback

## Current features

Implemented:

- `/tl <prompt>` one-off Tasklight-enabled Pi prompt.
- `/tl-on` enables notifications for every normal Pi prompt in the current session.
- `/tl-off` disables always-on mode.
- `/tl-toggle` toggles always-on mode.
- `/tl-status` reports always-on state.
- `/tl-test` sends a test Tasklight notification.
- `/tl-doctor` runs `tasklight doctor` from inside Pi.
- `/tl` argument autocomplete suggestions.
- Short notification summaries without a second model call.
- Hidden summary marker stripping from final assistant messages.
- Session-persisted always-on setting via Pi custom session entries.
- Notification title format: `Pi - <session name>` when possible.
- Fallback title suffix detection from terminal/app environment.
- Focus override via `TASKLIGHT_ACTIVATE_APP`.
- Tasklight binary override via `TASKLIGHT_BIN`.
- Tasklight CLI dependency via `@tasklight/cli`, with `PATH` and `npx` fallback.

## Important design constraint

Do not increase token burden unnecessarily.

Current approach is acceptable:

1. For `/tl` or always-on turns, add a tiny per-turn instruction.
2. Ask Pi to append one hidden summary marker.
3. Strip the marker from saved/displayed assistant message.
4. Send the extracted summary through `tasklight notify`.

Avoid adding a second LLM summarization request unless explicitly requested by the user later.

## Manual QA checklist

From the Tasklight repo:

```bash
go build -o bin/tasklight ./cmd/tasklight
```

From the pi-tasklight repo:

```bash
# Install the @tasklight/cli dependency for local-path testing.
npm install

# Optional: override with a local Go build instead.
export TASKLIGHT_BIN="$HOME/Work/tasklight/bin/tasklight"

# Package loads
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl-test"

# Doctor works
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl-doctor"

# Interactive test
pi -e .
```

Inside interactive Pi:

```text
/tl-test
/tl-doctor
/tl run a tiny harmless check and tell me done
/tl-on
say hello briefly
/tl-off
```

Expected:

- `/tl-test` shows a Tasklight notification.
- `/tl-doctor` shows Tasklight diagnostics.
- `/tl <prompt>` sends a notification after Pi finishes.
- Always-on mode notifies after normal prompts while enabled.
- Hidden `<TASKLIGHT_SUMMARY>` marker does not appear in final displayed answer.
- Notification title uses session name if set.
- Click-to-focus behavior is delegated to Tasklight.

## Phase 0 — Repository polish

Goal: make this repository independently publishable.

Steps:

1. Initialize git if needed.
2. Add package metadata:
   - repository URL
   - bugs URL
   - homepage
   - author
   - license confirmation
3. Add README install examples for:
   - local path install
   - git install
   - future npm install
4. Add a short security note: Pi extensions run with full local permissions.
5. Add changelog or release notes file if useful.
6. Confirm `package.json` `pi.extensions` points to `./extensions/tasklight.ts`.

Acceptance criteria:

- `pi -e .` loads the package.
- `pi install ~/Work/pi-tasklight` works.
- README is accurate when the package is outside the Tasklight repo.

## Phase 1 — Better settings UX

Goal: make configuration discoverable from inside Pi.

Add:

```text
/tl-settings
```

Suggested behavior:

- Show current values:
  - always-on state
  - Tasklight binary path/source
  - activate app override
  - title suffix override
- Offer simple actions using `ctx.ui.select`:
  - toggle always-on
  - run doctor
  - send test notification
  - clear doctor widget

Optional commands:

```text
/tl-doctor clear
/tl-status verbose
```

Acceptance criteria:

- User can inspect configuration without leaving Pi.
- Does not require an LLM call.
- Does not add context messages.

## Phase 2 — Reduce marker fragility

Goal: make summary extraction robust.

Current marker:

```text
<TASKLIGHT_SUMMARY>...</TASKLIGHT_SUMMARY>
```

Potential improvements:

1. Use a less user-visible marker unlikely to collide with normal content.
2. Support multiple fallback marker formats for model variance.
3. Strip malformed partial markers when possible.
4. If marker is missing, keep deterministic fallback summary.
5. Add unit tests outside Pi if practical by extracting pure helper functions.

Acceptance criteria:

- Marker does not appear in normal final answer.
- Missing/malformed marker does not break notification.
- Summary stays under the target character limit.

## Phase 3 — Tests/tooling

Goal: make extension changes safer.

Options:

1. Add TypeScript type checking.
2. Add a tiny test harness for pure functions:
   - summary extraction
   - fallback summary extraction
   - title detection
   - duration formatting
3. Consider moving pure logic from `extensions/tasklight.ts` into `src/` and exposing a thin extension entrypoint.

Suggested structure:

```text
pi-tasklight/
  extensions/
    tasklight.ts
  src/
    summary.ts
    notification.ts
    config.ts
  test/
    summary.test.ts
```

Do not overbuild yet. Keep the extension easy to load through Pi.

Acceptance criteria:

- Basic tests can run without Pi.
- Extension still loads via `pi -e .`.

## Phase 4 — Packaging and publishing

Goal: make install easy.

Near-term git install:

```bash
pi install git:github.com/<owner>/pi-tasklight
```

Later npm install:

```bash
pi install npm:@tasklight/pi-tasklight
```

Package metadata requirements:

- `keywords` includes `pi-package`.
- `pi.extensions` points to the extension entrypoint.
- runtime dependencies are listed in `dependencies` if any are added.
- Pi peer dependencies stay as peer dependencies with `"*"`.

Acceptance criteria:

- Package installs through local path.
- Package installs through git URL.
- Package can later be published to npm without restructuring.

## Phase 5 — Tasklight CLI dependency strategy

Goal: make `pi-tasklight` easy for Pi-only users who do not want to install Tasklight manually.

Status: mostly implemented now that `@tasklight/cli` exists on npm.

Current resolution order:

1. `TASKLIGHT_BIN=/path/to/tasklight` explicit override.
2. `@tasklight/cli` resolved from the extension package dependency.
3. `tasklight` from `PATH`.
4. `npx -y @tasklight/cli` fallback.
5. Clear `/tl-doctor` guidance if none of the above works.

Packaging model:

- `@tasklight/pi-tasklight` depends on `@tasklight/cli` in `dependencies`.
- Pi npm/git package installation installs the Tasklight CLI automatically through npm dependency resolution.
- Users should only need:

```bash
pi install npm:@tasklight/pi-tasklight
```

Do not silently install Homebrew packages from `pi-tasklight`.

For `terminal-notifier`:

- Keep it optional.
- Let `tasklight doctor` explain how to install it for best macOS click/icon behavior.
- Long term, Tasklight should replace it with a native helper.

Acceptance criteria:

- A Pi-only user can install `pi-tasklight` and get a working Tasklight CLI via npm dependency resolution.
- `TASKLIGHT_BIN` remains available for local development and custom installs.
- Missing CLI errors are actionable.
- No surprise Homebrew/system package installation occurs.

## Phase 6 — Better always-on persistence

Current always-on persistence is session-local via custom entries.

Future options:

1. Keep session-local only.
2. Add env default only (`PI_TASKLIGHT_ALWAYS=1`).
3. Add a user config file later if users ask for persistent global defaults.

Recommended near-term stance:

- Keep session-local + env default.
- Avoid writing separate config until real need appears.

Acceptance criteria:

- Behavior is predictable.
- README clearly explains persistence scope.

## Phase 7 — Native Tasklight helper alignment

Tasklight plans to replace `terminal-notifier` with a native macOS helper later.

`pi-tasklight` should not care which notification backend Tasklight uses.

Keep using only:

```bash
tasklight notify ...
tasklight doctor
```

Do not call `terminal-notifier`, `osascript`, or platform notification tools directly from `pi-tasklight`.

Acceptance criteria:

- No platform-specific notification code lives in `pi-tasklight`.
- Native helper adoption requires no pi-tasklight changes unless CLI flags change.

## Non-goals

Do not implement these in pi-tasklight for now:

- Direct notification provider implementations.
- Direct terminal/tmux focus logic.
- Second LLM summary call by default.
- Cloud/webhook notification routing.
- Deep Pi UI replacement.
- Automatic installation of Tasklight or Homebrew packages.

## Notes for future agents

- Read Pi extension docs before changing extension behavior.
- Use Pi events rather than parsing terminal output.
- Keep Tasklight-specific platform logic in the Tasklight CLI repo.
- Keep this package small and focused.
