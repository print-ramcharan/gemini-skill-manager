# Contributing

Thanks for helping improve Gemini Skill Manager.

## Before you start
- Use Node.js 18 or newer.
- Run `npm install` once in the project root.
- Start the app with `npm start`.

## Development workflow
1. Make your change in a small, focused branch.
2. Add or update tests when behavior changes.
3. Run `npm test` before opening a PR.
4. Keep commits scoped to one topic when possible.

## What to test
- Token parsing and estimation changes.
- File move behavior in `main.js`.
- Renderer changes that affect the dashboard totals or token badges.

## Pull requests
- Describe the user-facing behavior change.
- Mention any filesystem or token-counting impact.
- Include screenshots for UI changes when helpful.
- Call out anything that still needs manual verification.

## Repo notes
- `main.js` owns filesystem and IPC logic.
- `preload.js` exposes the safe renderer API.
- `renderer.js` owns the UI and token budget display.
