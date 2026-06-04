import { MESSAGES } from './constants.js'
import { getPriority, getServer, getTag, getTopic } from './config/store.js'
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
        'Priority': getPriority(kind),
        'Tags': getTag(kind)
      },
      body: MESSAGES[kind]
    })

    if (!response.ok) {
      console.error(`[opencode-ping] ntfy responded ${response.status}`)
    }
  } catch (err) {
    console.error(`[opencode-ping] Failed to send: ${err}`)
  }
}
