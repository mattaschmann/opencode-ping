import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { SESSION } from '../constants.js'

interface Entry {
  codename: string
  armedAt: number
}

interface CacheData {
  sessions: Record<string, { codename: string; armedAt: number }>
}

const sessions = new Map<string, Entry>()

export function getCachePath(): string {
  return join(homedir(), '.cache', SESSION.CACHE_DIR, SESSION.CACHE_FILE)
}

function persist(): void {
  try {
    const data: CacheData = { sessions: {} }
    for (const [id, entry] of sessions) {
      data.sessions[id] = { codename: entry.codename, armedAt: entry.armedAt }
    }
    const filePath = getCachePath()
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  } catch (e) {
    process.stderr.write(`opencode-ping: failed to persist sessions: ${e}\n`)
  }
}

export function load(): void {
  try {
    const filePath = getCachePath()
    if (!existsSync(filePath)) return
    const raw = readFileSync(filePath, 'utf8')
    const data: CacheData = JSON.parse(raw)
    if (!data || typeof data !== 'object' || typeof data.sessions !== 'object') return

    const now = Date.now()
    let pruned = false
    sessions.clear()

    for (const [id, entry] of Object.entries(data.sessions)) {
      if (
        entry &&
        typeof entry.codename === 'string' &&
        typeof entry.armedAt === 'number' &&
        now - entry.armedAt < SESSION.TTL_MS
      ) {
        sessions.set(id, { codename: entry.codename, armedAt: entry.armedAt })
      } else {
        pruned = true
      }
    }

    if (pruned) persist()
  } catch {
    /* corrupt or unreadable — start fresh */
  }
}

export function arm(sessionID: string, codename: string): void {
  sessions.set(sessionID, { codename, armedAt: Date.now() })
  persist()
}

export function disarm(sessionID: string): void {
  sessions.delete(sessionID)
  persist()
}

export function getCodename(sessionID: string): string | undefined {
  return sessions.get(sessionID)?.codename
}

export function isArmed(sessionID: string): boolean {
  return sessions.has(sessionID)
}

export function reset(): void {
  sessions.clear()
  try {
    const filePath = getCachePath()
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    /* ignore */
  }
}
