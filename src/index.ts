import { NTFY } from './constants.js'
import { sendNotification } from './notify.js'
import { handlePingCommand, PING_COMMAND_SENTINEL } from './commands/ping.js'
import { getCodename } from './session/registry.js'

interface SessionState {
  lastStatus: string
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, SessionState>()

function getSession(id: string): SessionState {
  let s = sessions.get(id)
  if (!s) {
    s = { lastStatus: 'idle', debounceTimer: null }
    sessions.set(id, s)
  }
  return s
}

function clearDebounce(s: SessionState): void {
  if (s.debounceTimer) {
    clearTimeout(s.debounceTimer)
    s.debounceTimer = null
  }
}

const plugin = async ({ client }: { client: any }) => {
  if (process.env.OPENCODE_PING === '0') return {}

  return {
    config: async (input: any) => {
      if (!input || typeof input !== 'object') return
      input.command ??= {}
      input.command['ping'] = {
        template: '',
        description: 'push notification commands (start, stop, status, test, help)'
      }
    },

    'command.execute.before': async (input: any) => {
      if (input.command === 'ping') {
        const result = await handlePingCommand(input.arguments, input.sessionID)
        await client.session.prompt({
          path: { id: input.sessionID },
          body: {
            noReply: true,
            parts: [{ type: 'text', text: result, ignored: true }]
          }
        })
        throw new Error(PING_COMMAND_SENTINEL)
      }
    },

    event: async ({ event }: { event: any }) => {
      if (event.type === 'session.status') {
        const { sessionID, status } = event.properties
        const s = getSession(sessionID)
        const prev = s.lastStatus
        s.lastStatus = status.type

        if (status.type === 'idle' && prev === 'busy') {
          clearDebounce(s)
          const codename = getCodename(sessionID)
          if (codename) {
            s.debounceTimer = setTimeout(() => {
              sendNotification('idle', codename)
            }, NTFY.DEBOUNCE_MS)
          }
        } else if (status.type === 'busy') {
          clearDebounce(s)
        }
      }

      if (event.type === 'session.error') {
        const sessionID = event.properties?.sessionID
        if (sessionID) {
          const codename = getCodename(sessionID)
          if (codename) {
            sendNotification('error', codename)
          }
        }
      }

      if (event.type === 'permission.updated') {
        const sessionID = event.properties?.sessionID
        if (sessionID) {
          const codename = getCodename(sessionID)
          if (codename) {
            sendNotification('attention', codename)
          }
        }
      }
    }
  }
}

export default plugin
export { plugin }
