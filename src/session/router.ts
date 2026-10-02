/**
 * Pure V2 event router: maps subscribed events to ntfy notifications.
 *
 * Owns the per-family debounce state so `src/index.ts` stays a thin subscribe
 * loop. All payloads are read from `event.data` (V2 shape). Never throws:
 * notification failures are swallowed by `sendNotification`.
 *
 * Idle detection is FAMILY-AWARE. A turn can spawn subagents (child sessions);
 * each runs its own execution lifecycle. Treating any single session going
 * quiet as "idle" fires a ping every time a subagent finishes, even while the
 * armed root is still working. Instead we track:
 *
 *   - parentID links (`session.created`) to resolve a session's family root,
 *   - per-session running state (`session.execution.*`, `session.status`),
 *
 * and only ping "idle" once the armed root AND every known descendant have
 * stopped running. A short debounce coalesces the many execution boundaries in
 * a turn (and lets a parent resume after a child reports back) into one ping.
 */
import { NTFY } from '../constants.js'
import { sendNotification } from '../notify.js'
import { getCodename, isArmed } from './registry.js'

/** sessionID -> parentID (only children appear here). */
const parentOf = new Map<string, string>()
/** sessionID -> currently executing. Absent/false means not running. */
const running = new Map<string, boolean>()
/** root sessionID -> pending idle debounce timer. */
const idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
/** root sessionID -> set of family members seen (root + descendants). */
const familyMembers = new Map<string, Set<string>>()

/** Walk parentID links to the family root. Self when no parent is known. */
function rootOf(sessionID: string): string {
  const seen = new Set<string>()
  let current = sessionID
  for (;;) {
    const parent = parentOf.get(current)
    if (!parent || seen.has(parent)) return current
    seen.add(parent)
    current = parent
  }
}

/** Record a session as part of its root's family for later idle checks. */
function trackMember(sessionID: string): string {
  const root = rootOf(sessionID)
  let members = familyMembers.get(root)
  if (!members) {
    members = new Set([root])
    familyMembers.set(root, members)
  }
  members.add(sessionID)
  return root
}

/** True when the root and every tracked descendant have stopped running. */
function familyIdle(root: string): boolean {
  if (running.get(root)) return false
  const members = familyMembers.get(root)
  if (!members) return true
  for (const member of members) {
    if (running.get(member)) return false
  }
  return true
}

function clearIdleTimer(root: string): void {
  const timer = idleTimers.get(root)
  if (timer) {
    clearTimeout(timer)
    idleTimers.delete(root)
  }
}

/**
 * Reconsider idle for a family root. Cancels any pending ping, then schedules a
 * fresh one only when the whole family is quiet and the root is armed.
 */
function reconsiderIdle(root: string): void {
  clearIdleTimer(root)
  if (!isArmed(root)) return
  if (!familyIdle(root)) return
  const codename = getCodename(root)
  if (!codename) return
  const timer = setTimeout(() => {
    idleTimers.delete(root)
    // Re-check at fire time: a late execution.started may have resumed work.
    if (isArmed(root) && familyIdle(root)) {
      sendNotification('idle', codename)
    }
  }, NTFY.DEBOUNCE_MS)
  idleTimers.set(root, timer)
}

/** Notify the armed family root for an immediate (non-idle) event. */
function notifyRootIfArmed(
  sessionID: string | undefined,
  kind: 'error' | 'permission' | 'question'
): void {
  if (!sessionID) return
  const root = trackMember(sessionID)
  const codename = getCodename(root)
  if (codename) sendNotification(kind, codename)
}

/** Route a single V2 event. Reads `event.data`; no-ops on unknown types. */
export function handleEvent(event: { type?: string; data?: any }): void {
  const data = event?.data ?? {}

  switch (event?.type) {
    case 'session.created': {
      const sessionID = data.sessionID
      if (!sessionID) return
      if (data.parentID) parentOf.set(sessionID, data.parentID)
      trackMember(sessionID)
      return
    }

    case 'session.execution.started': {
      const sessionID = data.sessionID
      if (!sessionID) return
      running.set(sessionID, true)
      const root = trackMember(sessionID)
      // Work resumed somewhere in the family — cancel any pending idle ping.
      clearIdleTimer(root)
      return
    }

    case 'session.execution.succeeded':
    case 'session.execution.interrupted': {
      const sessionID = data.sessionID
      if (!sessionID) return
      running.set(sessionID, false)
      const root = trackMember(sessionID)
      reconsiderIdle(root)
      return
    }

    case 'session.execution.failed': {
      const sessionID = data.sessionID
      if (!sessionID) return
      running.set(sessionID, false)
      // A failed execution is still an attention-worthy stop: notify, then also
      // reconsider idle so the family-quiet ping doesn't double up.
      notifyRootIfArmed(sessionID, 'error')
      reconsiderIdle(rootOf(sessionID))
      return
    }

    case 'session.status': {
      // Belt-and-suspenders: some flows emit status without an execution event.
      const sessionID = data.sessionID
      const statusType = data.status?.type
      if (!sessionID || !statusType) return
      if (statusType === 'busy') {
        running.set(sessionID, true)
        clearIdleTimer(trackMember(sessionID))
      } else if (statusType === 'idle') {
        running.set(sessionID, false)
        reconsiderIdle(trackMember(sessionID))
      }
      return
    }

    case 'permission.asked':
      notifyRootIfArmed(data.sessionID, 'permission')
      return

    case 'form.created':
      // sessionID is nested inside the form info, not top-level.
      notifyRootIfArmed(data.form?.sessionID, 'question')
      return
  }
}

/** Clear all pending debounce timers and family state — called from cleanup. */
export function disposeAll(): void {
  for (const timer of idleTimers.values()) clearTimeout(timer)
  idleTimers.clear()
  parentOf.clear()
  running.clear()
  familyMembers.clear()
}
