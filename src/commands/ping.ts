import { sendNotification } from '../notify.js'
import { getTopic, readConfig, writeConfig, writeDefaultConfig } from '../config/store.js'
import { arm, disarm, getCodename, isArmed } from '../session/registry.js'
import { PRIORITY, TAGS } from '../constants.js'
import type { EventKind } from '../types.js'

export const PING_COMMAND_SENTINEL = '__OPENCODE_PING_COMMAND__'

const VALID_EVENTS: EventKind[] = ['idle', 'error', 'permission', 'question', 'test']
const VALID_PRIORITIES = ['1', '2', '3', '4', '5']

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
    case 'priority': {
      const event = parts[1] as EventKind | undefined
      const value = parts[2]
      if (!event || !value) {
        const config = readConfig()
        const lines = VALID_EVENTS.map(
          (e) => `  ${e}: ${config.settings.priority?.[e] ?? PRIORITY[e]} (default: ${PRIORITY[e]})`
        )
        return `Usage: /ping priority <event> <1-5>\nEvents: ${VALID_EVENTS.join(', ')}\n\nCurrent:\n${lines.join('\n')}`
      }
      if (!VALID_EVENTS.includes(event)) {
        return `Invalid event "${event}". Valid: ${VALID_EVENTS.join(', ')}`
      }
      if (!VALID_PRIORITIES.includes(value)) {
        return `Invalid priority "${value}". Valid: 1 (min) to 5 (max)`
      }
      const config = readConfig()
      config.settings.priority ??= {}
      config.settings.priority[event] = value
      writeConfig(config)
      return `Priority for "${event}" set to ${value}.`
    }
    case 'tag': {
      const event = parts[1] as EventKind | undefined
      const value = parts.slice(2).join(' ')
      if (!event || !value) {
        const config = readConfig()
        const lines = VALID_EVENTS.map(
          (e) => `  ${e}: ${config.settings.tags?.[e] ?? TAGS[e]} (default: ${TAGS[e]})`
        )
        return `Usage: /ping tag <event> <tag>\nEvents: ${VALID_EVENTS.join(', ')}\n\nCurrent:\n${lines.join('\n')}`
      }
      if (!VALID_EVENTS.includes(event)) {
        return `Invalid event "${event}". Valid: ${VALID_EVENTS.join(', ')}`
      }
      const config = readConfig()
      config.settings.tags ??= {}
      config.settings.tags[event] = value
      writeConfig(config)
      return `Tag for "${event}" set to "${value}".`
    }
    case 'help':
    default:
      return [
        '/ping init <topic>              — generate config file',
        '/ping start <codename>          — arm notifications for this session',
        '/ping stop                      — disarm notifications',
        '/ping status                    — show armed state',
        '/ping test <codename>           — send a test push',
        '/ping priority [event] [1-5]    — get/set priority per event',
        '/ping tag [event] [tag]         — get/set tag per event',
        '/ping help                      — show this message'
      ].join('\n')
  }
}
