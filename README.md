# opencode-ntfy

OpenCode plugin that pushes generic notifications to your phone via [ntfy.sh](https://ntfy.sh) when sessions finish, error, or need your input.

## Setup

1. Install the [ntfy app](https://ntfy.sh) on your phone (Android/iOS)
2. Pick a hard-to-guess topic name (e.g. `opencode-abc123xyz`)
3. Subscribe to that topic in the ntfy app
4. Create `~/.config/opencode/opencode-ntfy.json`:

```json
{
  "version": 1,
  "settings": {
    "topic": "opencode-abc123xyz"
  }
}
```

5. Add the plugin to your `opencode.jsonc`:

```json
{
  "plugin": ["~/workspace/opencode-ntfy"]
}
```

6. Restart OpenCode

## Config

| Key | Default | Description |
|-----|---------|-------------|
| `topic` | (required) | Your ntfy topic name |
| `server` | `https://ntfy.sh` | ntfy server URL |
| `notifyIdle` | `true` | Push on session finish |
| `notifyError` | `true` | Push on session error |
| `notifyAttention` | `true` | Push when input needed |

Set `OPENCODE_NTFY=0` to disable entirely.

## Commands

- `/ntfy test` — send a test push to verify delivery
- `/ntfy help` — show available commands

## Privacy

Messages are always generic (e.g. "Session finished"). No session titles, file paths, tool names, or error text are ever sent. The topic name is the only thing gating who can read your notifications — pick something unguessable.
