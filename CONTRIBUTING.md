# Contributing to Pi Tasklight

Thanks for considering a contribution.

## Before you start

- Keep the extension small and focused.
- Avoid adding runtime dependencies unless they are essential.
- Do not add extra model calls for notification text.
- Prefer simple Pi commands and clear README updates.

## Local development

```bash
npm install
npm run check
npm test
```

Run Pi with the local extension:

```bash
pi -e .
```

Useful smoke check:

```bash
PI_OFFLINE=1 pi -e . --no-session --no-tools -p "/tl"
```

## Pull requests

Please include:

- a short explanation of the change,
- any relevant tests or smoke-check output,
- README updates for user-facing behavior changes.

## Release notes

This package is published as `@tasklight/pi-tasklight`.
