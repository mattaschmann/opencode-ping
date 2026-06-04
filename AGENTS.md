# AGENTS.md - opencode-ntfy

References:
- https://agentsmd.io/agents-md-best-practices

## Project Overview

OpenCode plugin that posts generic phone notifications to a public ntfy.sh topic when sessions finish, error, or need input. Messages are intentionally static (no session titles, paths, or error text) so a public topic is safe. Arch-agnostic — just an HTTPS POST. Modeled on opencode-kirocli-bridge.

## Do

- Use TypeScript for all source files
- Use `@opencode-ai/plugin` for type definitions
- Keep `src/index.ts` as the main entry point; delegate to submodules
- Keep notification bodies GENERIC — never include session title, tool name, file path, or error message
- Run `npm run typecheck` and `npm test` before presenting changes
- Fail quiet — log to stderr on errors, never throw from event handlers

## Don't

- Add heavy or unnecessary dependencies
- Use default exports for anything other than the main plugin
- Include dynamic/sensitive content in notification bodies
- Make large speculative changes without confirming with the user

## Commands

- `npm run typecheck` - Type check (`tsc --noEmit`)
- `npm test` - Run Jest tests (ESM mode)
- `npm run format` - Format with Prettier

Note: No build step — plugin is shipped as TypeScript source, loaded directly by OpenCode.

## Project Structure

- `src/index.ts` - Main plugin entry point (event + command hooks)
- `src/constants.ts` - Defaults, generic messages, priorities, tags
- `src/types.ts` - Config + event type definitions
- `src/config/store.ts` - Read ~/.config/opencode/opencode-ntfy.json
- `src/notify.ts` - POST to ntfy.sh
- `src/commands/ntfy.ts` - /ntfy slash command handler
- `test/` - Jest test suites

## Testing

- Jest tests use ESM mode with ts-jest
- Test config store: defaults, round-trip, corrupt JSON recovery
- Test notify: mock fetch, assert generic bodies, assert headers
- Test event routing: debounce, per-event toggles
- Run `npm test` and `npm run typecheck` before submitting

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCODE_NTFY_CONFIG_PATH` | `~/.config/opencode/opencode-ntfy.json` | Override config file path |
| `OPENCODE_NTFY` | (unset) | Set to `0` to disable entirely |

## When Stuck

- Ask a clarifying question
- Propose a short plan before implementing
- Don't push large changes without confirmation
