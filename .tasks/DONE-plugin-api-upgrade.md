# Fix command.execute.before output.parts in opencode-ping

The `/ping` command result doesn't display correctly after removing the
`throw`-to-abort pattern. Root cause: `output.parts = [...]` replaces the
property on the output object, but opencode holds a closure reference to the
original array, so the assignment is silently ignored.

## Investigation

Verified against the installed opencode 1.17.7 binary (bytecode-level analysis).

### How the command path works (1.17.7)

1. `SessionPrompt.command` triggers `command.execute.before` with `{parts: ho}`.
2. After the hook returns, it unconditionally calls `he(...)` (the prompt fn)
   with the same `ho` array. No `noReply` flag is passed.
3. The prompt fn only short-circuits on `if(a.noReply===!0) return z` — the
   command path never sets this, so a model turn always fires.
4. If the hook throws, `Plugin.trigger` propagates the error, which is published
   as a `session.error` and rendered **inline as a full error block (message +
   stack + `cause`) in the conversation**, garbling the TUI (verified via
   screenshot, opencode 1.17.7). It is NOT suppressed.

### How `ignored: true` is handled

When building the model message from parts, the bundle filters:
```js
if(Je.type!=="text" || Je.ignored || Je.synthetic) continue;
if(!Je.text.trim()) continue;
```
Parts with `ignored: true` are **excluded from model context** but still stored
and rendered in the TUI chat. The help text never reaches the model. However,
the empty model turn still fires (no text parts survive filtering → model gets
an empty user message).

### Why reassignment fails

`output.parts` is the closure variable `ho` passed by reference. Reassigning
`output.parts = [...]` replaces the property on the wrapper object but `ho`
still points to the original array. Only in-place mutation (`.splice()`)
propagates to what the prompt function consumes.

### Upstream status

| PR/Issue | What | Status |
|----------|------|--------|
| #9306 | `noReply` flag proposal | closed |
| #9307 | `noReply` hook implementation | closed, NOT merged |
| #18554 | `cancelled` flag proposal | open |
| #18559 | cancellation support PR | open, not merged |
| #27521 | `noReply` on command schema | open, not merged |
| #28292 | combined feature request | open |

None of these are in 1.17.7. No mechanism exists in this version to suppress
the model turn from `command.execute.before` without throwing.

### Available approaches (tradeoff matrix)

| Approach | Displays | No model turn | No error |
|---|---|---|---|
| `splice` + `ignored:true` | yes (chat) | no (empty turn) | yes |
| `throw` sentinel | as error text | yes | no |
| `showToast` + `throw` | yes (toast) | yes | no |
| `showToast` only | yes (toast) | no | yes |
| wait for upstream `noReply` | — | — | — |

### Rejected alternatives

**Throw sentinel** — skips the model turn but renders the full error object
(message + stack + `cause`) inline in the conversation, garbling the TUI. This
is the original artifact that motivated the whole task. An earlier iteration of
this investigation claimed the throw was mapped to an empty `BadRequest({})` and
suppressed via `throwOnError:false` in the TUI — both claims were contradicted
by direct observation (screenshot, opencode 1.17.7). Observation governs.

**`client.tui.showToast` / separate `client.session.prompt`** — display-only
channels that do not touch the command execution flow. The empty model turn still
fires regardless of whether output appears as a toast or a separate prompt
message. Rejected because it doesn't solve the core issue.

### Additional API available

`client.tui.showToast({ title, message, variant, duration })` — can display
text as a TUI toast without a chat message. Available via plugin init `client`
arg.

## Decision

**Chosen approach: splice + ignored:true (no throw).**

Rationale: Help text renders correctly in the TUI, is excluded from model
context, and no error surfaces. The residual cost — an empty model turn fires
on each `/ping` invocation — is accepted as a known limitation of 1.17.7.
When upstream ships a `noReply`/`cancelled` flag, the fix is to set that flag
alongside the splice.

## Implementation Plan

- [x] Fix `output.parts` assignment in `src/index.ts` → mutate in-place:
  ```ts
  output.parts.splice(0, output.parts.length, { type: 'text', text: result, ignored: true })
  ```
  - 2025-06-15: done — replaced assignment with splice at src/index.ts:47
- [x] Run `npm run typecheck`
  - 2025-06-15: done — passes clean
- [x] Run `npm test`
  - 2025-06-15: done — 51 tests, 5 suites pass
- [x] Verify `/ping help` displays correctly in opencode
  - 2026-06-15: done — renders in TUI chat; model does not see it (ignored:true)

## Residual

An empty model turn fires on each `/ping` invocation because the command path
calls `prompt()` unconditionally. This cannot be eliminated in 1.17.7 without
throwing. Accepted as a known limitation; will resolve when upstream ships
`noReply`/`cancelled` on the hook output.
