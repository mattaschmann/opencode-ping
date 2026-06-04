import { sendNotification } from '../notify.js'
import { getTopic, writeDefaultConfig } from '../config/store.js'
import { arm, disarm, getCodename, isArmed } from '../session/registry.js'

export const PING_COMMAND_SENTINEL = '__OPENCODE_PING_COMMAND__'

export async function handlePingCommand(args: string, sessionID: string): Promise<string> {
  const parts = args.trim().split(/\s+/)
  const sub = parts[0] ?? 'help'

  switch (sub) {
    case 'init': {
      const topic = parts[1]
      if (!topic) {
        return 'Usage: /ping init <topic>'
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
        return 'Usage: /ping start <codename>'
      }
      if (!getTopic()) {
        return 'No topic configured. Set topic in ~/.config/opencode/opencode-ping.json'
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
        return 'Usage: /ping test <codename>'
      }
      if (!getTopic()) {
        return 'No topic configured. Set topic in ~/.config/opencode/opencode-ping.json'
      }
      await sendNotification('test', codename)
      return 'Test notification sent.'
    }
    case 'help':
    default:
      return [
        '/ping init <topic>     — generate config file',
        '/ping start <codename>  — arm notifications for this session',
        '/ping stop              — disarm notifications',
        '/ping status            — show armed state',
        '/ping test <codename>   — send a test push',
        '/ping help              — show this message'
      ].join('\n')
  }
}
