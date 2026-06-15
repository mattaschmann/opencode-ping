# opencode-ntfy: generic phone notifications via ntfy.sh

A standalone OpenCode plugin that posts generic notifications to a public ntfy.sh
topic when sessions finish, error, or need input. Messages are always static (no
session titles, paths, error text) so a public topic is safe. Arch-agnostic,
zero dependencies beyond fetch. TypeScript, no build step, loaded directly by
OpenCode from ~/workspace/opencode-ntfy.

## Implementation Plan

- [x] Scaffold project structure mirroring opencode-kirocli-bridge (lean local-only)
  - package.json, tsconfig.json, jest.config.js, .nvmrc, .gitignore, opencode.jsonc
  - AGENTS.md, README.md
- [x] src/constants.ts — server default, generic messages, debounce, titles/priorities/tags
- [x] src/types.ts — NtfyConfig + EventKind
- [x] src/config/store.ts — read opencode-ntfy.json, getTopic, getServer, isEventEnabled
- [x] src/notify.ts — POST to ${server}/${topic} with headers; fail-quiet
- [x] src/commands/ntfy.ts — /ntfy test + /ntfy help
- [x] src/index.ts — event hook (idle debounce, error, attention) + command.execute.before
- [ ] npm install + npm run typecheck — resolve any type errors
- [ ] test/config-store.test.ts — defaults, round-trip read, corrupt JSON recovery
- [ ] test/notify.test.ts — mock fetch, assert generic bodies + correct headers
- [ ] test/event-routing.test.ts — debounce logic, per-event toggles, OPENCODE_NTFY=0
- [ ] npm test — all green
- [ ] Register in dotfiles opencode/opencode.jsonc plugin array
  ("~/workspace/opencode-ntfy" alongside the bridge entry)
- [ ] Create ~/.config/opencode/opencode-ntfy.json with a real topic
- [ ] Manual verify: /ntfy test, trigger idle, error, permission.asked — confirm
  pushes land in ntfy app with generic text only

## Implementation Plan (2026-06-04)

Design shift: default-off, per-session arming via `/ntfy start <codename>`.
Codename appears as ntfy Title header; bodies stay generic.

- [x] `src/session/registry.ts` — in-memory `Map<sessionID, codename>`; `arm`, `disarm`, `getCodename`, `isArmed`, `reset`
- [x] `src/types.ts` — drop `notifyIdle/notifyError/notifyAttention`; keep `topic`/`server`
- [x] `src/config/store.ts` — remove `isEventEnabled`; keep `getTopic`/`getServer`/`readConfig`
- [x] `src/notify.ts` — `sendNotification(kind, codename)`: Title = codename, body = `MESSAGES[kind]`; silent no-op if no topic
- [x] `src/commands/ntfy.ts` — `handleNtfyCommand(args, sessionID)`: `start <codename>`, `stop`, `status`, `test`, `help`
- [x] `src/index.ts` — pass `sessionID` to command handler; event handler notifies only when session armed; fix `permission.updated`; guard optional `session.error` sessionID
- [x] `npm run typecheck` — clean
- [x] `test/session-registry.test.ts` — arm/disarm/getCodename/isArmed/reset
- [x] `test/config-store.test.ts` — defaults, round-trip, corrupt JSON recovery
- [x] `test/notify.test.ts` — mock fetch; assert Title = codename, generic body, headers; no-op when no topic
- [x] `test/command-ntfy.test.ts` — start arms, stop disarms, status reports, test standalone vs no-topic message
- [x] `test/event-routing.test.ts` — unarmed = no notify, armed = notify, debounce, `OPENCODE_NTFY=0`
- [x] `npm test` — all green (43 tests)
- [ ] Register in dotfiles opencode/opencode.jsonc plugin array (user)
- [ ] Create `~/.config/opencode/opencode-ntfy.json` with a real topic (user)
- [ ] Manual verify: `/ntfy start <codename>`, trigger idle, error, permission — confirm pushes land (user)
