# Port to the OpenCode V2 plugin API

V1 plugin implementations do not run in OpenCode 2. This plugin currently
**fails to load** on the live V2 daily driver (`Expected object at ["default"]`),
so notifications are broken until it is ported to `Plugin.define({ id, setup(ctx) })`.

Gate is cleared (Kiro provider works under V2). Shared how-to with verified
templates and the full event map:
`~/workspace/dotfiles/.tasks/opencode-v2-plugin-port-recipe.md` (see §6 for the
ping-specific notes). This file only tracks repo-specific residue.

## What this plugin uses today

- `config` - registers the `ping` command (`src/index.ts:35`).
- `command.execute.before` - handles `ping`, replies by splicing `output.parts`
  with `{ ignored: true }` (`src/index.ts:44`).
- `event({ event })` - routes `session.idle`, `session.status`, `session.error`,
  `permission.asked`, `question.asked` to notifications (`src/index.ts:51`).
- Per-session `setTimeout` debounce in a module `Map`; **no `dispose`** today, so
  timers leak on unload — add a cleanup return.

## V2 mapping (verified — see recipe §2/§3/§4)

| V1 | V2 |
|---|---|
| default fn export | `Plugin.define({ id, setup })` — object, or it's rejected |
| `config` (command reg) | `ctx.command.transform` executor (no model turn) |
| `{ ignored: true }` reply splice | RPC toast via `./tui` sub-plugin — **NOT** `session.synthetic` (model-visible) |
| `event` | `ctx.event.subscribe({ signal })`; `event.data` not `.properties` |
| `session.error` | `session.execution.failed` (`{ sessionID, error }`) |
| `question.asked` | `form.created` (sessionID is inside `form.Info`) |

## Decisions

- **V2-only on a new `v2` branch.** *Why:* mirrors the kirocli-bridge precedent (`main` = V1 fallback, `v2` = clean rewrite); avoids a permanently forked handler path just to satisfy a runtime being retired.
- **`/ping` output via RPC toast + `./tui` sub-plugin.** *Why:* the only V2 channel that isn't model-visible; `session.synthetic` lowers to a `role:"user"` message that would pollute context on every `/ping help`.
- **Idle driven by `session.step.ended` + 5s debounce; `session.step.started` cancels.** *Why:* live `/api/event` capture on v2.0.8 showed `session.status` and `session.idle` are **never emitted** at runtime (schema-only). `session.step.*` fire per real turn; debouncing coalesces a turn's many steps into one ping.
- **Single-subscription coordinator keyed on `Symbol.for('opencode-ping.subscription')`.** *Why:* V2 runs `setup` once per location; N open dirs meant N subscriptions → N duplicate pings (observed: 7 booted locations → 7 pings). Coordinator elects one owner, refcounts, and hands off ownership to a survivor when the owner unloads, so notifications neither duplicate nor die.
- **Extract `src/session/router.ts` as a pure `handleEvent(event)`.** *Why:* keeps `src/index.ts` thin, gives tests a synchronous seam (no fake async iterators vs fake timers), owns the debounce map + `disposeAll()`.

### Verified event map (runtime `/api/event` capture on v2.0.8, not just schema)

| purpose | V2 event | sessionID path | note |
|---|---|---|---|
| idle | `session.step.ended` (debounced) + `session.step.started` (cancel) | `data.sessionID` | `session.status`/`session.idle` NEVER emitted at runtime — schema-only |
| error | `session.execution.failed` | `data.sessionID` | not seen in capture (no failures occurred); wired per schema |
| permission | `permission.asked` | `data.sessionID` (flat) | live-verified (fired on bash approval) |
| question | `form.created` | `data.form.sessionID` (nested) | not seen in capture; wired per schema |

`CommandInvocation` carries `sessionID` + `prompt` — `/ping` session scoping survives.

## Implementation Plan

- [x] Branch `v2` off `main`; leave `main` as the working V1 fallback.
- [x] `package.json`: drop `@opencode-ai/plugin` peer/dev dep + `opencode.hooks` manifest; add `@opencode/plugin@2.0.6` + `effect@4.0.0-rc.112`; add `"exports": { ".": "./src/index.ts", "./tui": "./src/tui.ts" }`.
- [x] New `src/rpc.ts` — `Rpc.define({ id: NTFY.PROVIDER_ID, methods: {}, events: { toast } })`.
- [x] New `src/tui.ts` — `Plugin.define({ id: "opencode-ping.tui" })` subscribing `toast` → `context.ui.toast.show`, abort cleanup.
- [x] New `src/session/router.ts` — move five branches out of index; export `handleEvent(event)`, own debounce `Map`, export `disposeAll()`.
- [x] Rewrite `src/index.ts` as `Plugin.define({ id, setup })`: `OPENCODE_PING=0` early return, `loadSessions()`, RPC register + `emitToast`, `ctx.command.transform` registering `ping`, `ctx.event.subscribe({ signal })` loop, cleanup → `controller.abort()` + `disposeAll()`.
- [x] Rewrite `test/event-routing.test.ts` against `handleEvent({ type, data })`.
- [x] Add `test/index-setup.test.ts` asserting default export satisfies V2's predicate.
- [x] Run `npm run typecheck` and `npm test`. (52 pass, typecheck clean)
- [x] Update `README.md` (`plugin` → `plugins`) and `AGENTS.md` project structure.
- [x] Live-verify on the V2 daily driver: plugin loads (`opencode plugin list` shows `opencode-ping 0.0.0`); `/ping start` armed a session via the live command API; a prompted turn produced a real phone ping.

### Post-review fixes (after first live run)

- [x] **Idle off `session.step.*`, not `session.status`.** First live run confirmed `session.status`/`session.idle` never fire on v2.0.8. Rewrote `router.ts`: `session.step.ended` schedules the 5s debounce, `session.step.started` cancels. Verified: idle ping fired ~5s after a real turn went quiet.
- [x] **Single-subscription coordinator (`src/session/coordinator.ts`).** First live run delivered 6 duplicate pings (one per booted location). Added a `globalThis`-symbol coordinator with owner election, refcount, and handoff-on-owner-leave. `index.ts` subscribes through `join(...)`. Verified: 7 booted locations → exactly **1** ping per event.
- [x] Tests: rewrote idle cases in `test/event-routing.test.ts` for step events (coalescing + cancel); added `test/coordinator.test.ts` (7→1 subscription, single delivery, non-owner leave, owner handoff, final teardown). **59 pass, typecheck clean.**

### Wrap review fixes

- [x] **Coordinator stale-state.** Final leave now deletes `globalThis[KEY]` so a later reload rebuilds with fresh callbacks. Added a rebuild-after-final-leave test.
- [x] **Node engine floor.** `engines.node` `>=18` → `>=20` (matches `@opencode/plugin@2.0.6` transitive deps and `.nvmrc`).
- [x] **Audit.** `npm audit fix --omit=dev` bumped transitive `brace-expansion` 2.1.1 → 2.1.7, clearing the lone high finding. 11 moderate remain (transitive under `@opencode/plugin`, no non-breaking fix) — accepted.
- [x] **Config example.** `opencode.jsonc` `"plugin"` → `"plugins"`.
- [x] **Setup coverage.** Added a test asserting `OPENCODE_PING=0` returns a no-op cleanup and touches no `ctx` domains. **61 pass, typecheck clean.**
