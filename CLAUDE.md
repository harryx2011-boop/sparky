# Sparky

Canonical doc: `context.md`. Read it first. It holds state, layout, decisions and release history.
Plans and decisions: `docs/plans/README.md`.

## Commands (root `package.json`)

- `npm run check`: typecheck, tests, web build and app build.
- `npm run dev:app` (desktop, port 4601 renderer) and `npm run dev:web` (site, port 4600).
- `npm run package:win`: fetch tools, then build the Windows installer.

Local agent API is on port 8600 (loopback, token file).

## UI roots

- `apps/desktop`: Electron app. Design files `DESIGN-SYSTEM.md` and `TOKENS.md` live here.
- `apps/web`: landing site. No token files.
