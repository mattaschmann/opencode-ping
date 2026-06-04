import { sendNotification } from '../notify.js'
import { getTopic, writeDefaultConfig } from '../config/store.js'
import { arm, disarm, getCodename, isArmed } from '../session/registry.js'

export const NTFY_COMMAND_SENTINEL = '__OPENCODE_NTFY_COMMAND__'

export async function handleNtfyCommand(args: string, sessionID: string): Promise<string> {
  const parts = args.trim().split(/\s+/)
  const sub = parts[0] ?? 'help'

  switch (sub) {
    case 'init': {
      const topic = parts[1]
      if (!topic) {
        return 'Usage: /ntfy init <topic>'
      }
      const { path, created } = writeDefaultConfig(topic)
      if (created) {
        return `Config created at ${path}`
      }
      return `Config already exists at ${path}`
    }
    case 'start': {
      const codename = parts[1]
      if (!codename) {
        return 'Usage: /ntfy start <codename>'
      }
      if (!getTopic()) {
        return 'No topic configured. Set topic in ~/.config/opencode/opencode-ntfy.json'
      }
      arm(sessionID, codename)
      return `Notifications armed as "${codename}".`
    }
    case 'stop': {
      if (!isArmed(sessionID)) {
        return 'Notifications are not active.'
      }
      disarm(sessionID)
      return 'Notifications disarmed.'
    }
    case 'status': {
      const name = getCodename(sessionID)
      if (name) {
        return `Armed as "${name}".`
      }
      return 'Not armed.'
    }
    case 'test': {
      const codename = parts[1]
      if (!codename) {
        return 'Usage: /ntfy test <codename>'
      }
      if (!getTopic()) {
        return 'No topic configured. Set topic in ~/.config/opencode/opencode-ntfy.json'
      }
      await sendNotification('test', codename)
      return 'Test notification sent.'
    }
    case 'help':
    default:
      return [
        '/ntfy init <topic>     — generate config file',
        '/ntfy start <codename>  — arm notifications for this session',
        '/ntfy stop              — disarm notifications',
        '/ntfy status            — show armed state',
        '/ntfy test <codename>   — send a test push',
        '/ntfy help              — show this message'
      ].join('\n')
  }
}
