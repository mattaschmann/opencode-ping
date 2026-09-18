# AGENTS.md - opencode-ping

References:
- https://agentsmd.io/agents-md-best-practices

## Project Overview

OpenCode plugin that pings your phone via ntfy.sh when sessions finish, error, or need input. Notifications are off by default; arm per-session with `/ping start <codename>`. Bodies are always just the event kind (`idle`, `error`, `permission`, `question`, `test`) — no dynamic content. Arch-agnostic — just an HTTPS POST.

## Do

- Use TypeScript for all source files
- Use `@opencode/plugin` (V2) for type definitions and `Plugin.define`
- Keep `src/index.ts` as the main entry point; delegate to submodules
- Keep notification bodies GENERIC — never include session title, tool name, file path, or error message
- Run `npm run typecheck` and `npm test` before presenting changes
- Fail quiet — log to stderr on errors, never throw from event handlers

## Don't

- Add heavy or unnecessary dependencies
- Use default exports only for the plugin entrypoints (`src/index.ts`, `src/tui.ts`); named exports everywhere else
- Include dynamic/sensitive content in notification bodies
- Make large speculative changes without confirming with the user

## Commands

- `npm run typecheck` - Type check (`tsc --noEmit`)
- `npm test` - Run Jest tests (ESM mode)
- `npm run format` - Format with Prettier

Note: No build step — plugin is shipped as TypeScript source, loaded directly by OpenCode.

## Project Structure

- `src/index.ts` - Main plugin entry point (`Plugin.define`; command + event subscription wiring)
- `src/constants.ts` - Defaults, generic messages, priorities, tags
- `src/types.ts` - Config + event type definitions
- `src/rpc.ts` - Shared RPC definition for the server → TUI toast bridge
- `src/tui.ts` - `./tui` sub-plugin that renders toasts (only entrypoint that can)
- `src/config/store.ts` - Read/write ~/.config/opencode/opencode-ping.json
- `src/notify.ts` - POST to ntfy.sh
- `src/commands/ping.ts` - /ping slash command handler (init, start, stop, status, test, priority, tag, help)
- `src/session/registry.ts` - Session arm/disarm state with persistence to ~/.cache/opencode-ping/sessions.json
- `src/session/router.ts` - Pure `handleEvent(event)` routing V2 events to notifications; owns the debounce map + `disposeAll()`
- `src/session/coordinator.ts` - Process-wide single-subscription coordinator (V2 runs `setup` per location); owner election + refcount + handoff
- `test/` - Jest test suites

## Testing

- Jest tests use ESM mode with ts-jest
- Test config store: defaults, round-trip, corrupt JSON recovery
- Test notify: mock fetch, assert generic bodies, assert headers
- Test session registry: arm/disarm, persistence round-trip, TTL pruning, corrupt file recovery
- Run `npm test` and `npm run typecheck` before submitting

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCODE_PING_CONFIG_PATH` | `~/.config/opencode/opencode-ping.json` | Override config file path |
| `OPENCODE_PING` | (unset) | Set to `0` to disable entirely |

## When Stuck

- Ask a clarifying question
- Propose a short plan before implementing
- Don't push large changes without confirmation
