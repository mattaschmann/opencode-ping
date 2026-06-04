import { MESSAGES, PRIORITY, TAGS } from './constants.js'
import { getServer, getTopic } from './config/store.js'
import type { EventKind } from './types.js'

export async function sendNotification(kind: EventKind, codename: string): Promise<void> {
  const topic = getTopic()
  if (!topic) return

  const server = getServer()
  const url = `${server}/${topic}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': codename,
        'Priority': PRIORITY[kind],
        'Tags': TAGS[kind]
      },
      body: MESSAGES[kind]
    })

    if (!response.ok) {
      console.error(`[opencode-ntfy] ntfy responded ${response.status}`)
    }
  } catch (err) {
    console.error(`[opencode-ntfy] Failed to send: ${err}`)
  }
}
