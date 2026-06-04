# opencode-ping

OpenCode plugin that pings your phone via [ntfy.sh](https://ntfy.sh) when sessions finish, error, or need your input.

## Setup

1. Install the [ntfy app](https://ntfy.sh) on your phone (Android/iOS)
2. Pick a hard-to-guess topic name (e.g. `opencode-abc123xyz`)
3. Subscribe to that topic in the ntfy app
4. Add the plugin to your `opencode.jsonc`:

```json
{
  "plugin": ["~/workspace/opencode-ping"]
}
```

5. Restart OpenCode
6. Run `/ping init opencode-abc123xyz` to generate the config file

## Config

| Key | Default | Description |
|-----|---------|-------------|
| `topic` | (required) | Your ntfy topic name |
| `server` | `https://ntfy.sh` | ntfy server URL |

Set `OPENCODE_PING=0` to disable entirely.

## Commands

- `/ping init <topic>` — generate config file at `~/.config/opencode/opencode-ping.json`
- `/ping start <codename>` — arm notifications for this session
- `/ping stop` — disarm notifications
- `/ping status` — show armed state
- `/ping test <codename>` — send a test push to verify delivery
- `/ping help` — show available commands

## Usage

Notifications are off by default. Arm a session with a codename to start receiving pushes:

```
/ping start alpha
```

You'll get a push when the session finishes, errors, or needs input. The codename appears as the notification title; the body is just the event kind (`idle`, `error`, `attention`).

## Privacy

Messages are always generic — the body is just the event kind (e.g. `idle`). No session titles, file paths, tool names, or error text are ever sent. The topic name is the only thing gating who can read your notifications — pick something unguessable.
