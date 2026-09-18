/**
 * Pure V2 event router: maps subscribed events to ntfy notifications.
 *
 * Owns the per-session debounce state so `src/index.ts` stays a thin subscribe
 * loop. All payloads are read from `event.data` (V2 shape). Never throws:
 * notification failures are swallowed by `sendNotification`.
 *
 * Idle detection: v2.0.8 does NOT emit `session.status` or `session.idle` at
 * runtime (verified against the live `/api/event` stream — they exist in the
 * schema but never fire). Instead we treat a quiet period after the last
 * `session.step.ended` as "idle": each step-ended resets the debounce, each
 * step-started cancels it, and the ping fires only once no step has ended for
 * `NTFY.DEBOUNCE_MS`. This coalesces the many steps in a turn into one ping.
 */
import { NTFY } from '../constants.js'
import { sendNotification } from '../notify.js'
import { getCodename } from './registry.js'

interface SessionState {
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, SessionState>()

function getSession(id: string): SessionState {
  let s = sessions.get(id)
  if (!s) {
    s = { debounceTimer: null }
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

function notifyIfArmed(sessionID: string | undefined, kind: 'error' | 'permission' | 'question'): void {
  if (!sessionID) return
  const codename = getCodename(sessionID)
  if (codename) sendNotification(kind, codename)
}

/** Route a single V2 event. Reads `event.data`; no-ops on unknown types. */
export function handleEvent(event: { type?: string; data?: any }): void {
  const data = event?.data ?? {}

  switch (event?.type) {
    case 'session.step.started': {
      // A new step means the turn is still active — cancel any pending idle.
      const sessionID = data.sessionID
      if (!sessionID) return
      clearDebounce(getSession(sessionID))
      return
    }

    case 'session.step.ended': {
      // Turn may be winding down. Reset the debounce; ping fires only if no
      // further step ends within the window.
      const sessionID = data.sessionID
      if (!sessionID) return
      const s = getSession(sessionID)
      clearDebounce(s)
      const codename = getCodename(sessionID)
      if (codename) {
        s.debounceTimer = setTimeout(() => {
          s.debounceTimer = null
          sendNotification('idle', codename)
        }, NTFY.DEBOUNCE_MS)
      }
      return
    }

    case 'session.execution.failed':
      notifyIfArmed(data.sessionID, 'error')
      return

    case 'permission.asked':
      notifyIfArmed(data.sessionID, 'permission')
      return

    case 'form.created':
      // sessionID is nested inside the form info, not top-level.
      notifyIfArmed(data.form?.sessionID, 'question')
      return
  }
}

/** Clear all pending debounce timers — called from plugin cleanup. */
export function disposeAll(): void {
  for (const s of sessions.values()) clearDebounce(s)
  sessions.clear()
}
