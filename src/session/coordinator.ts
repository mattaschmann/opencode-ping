/**
 * Process-wide subscription coordinator.
 *
 * V2 instantiates a plugin once PER LOCATION (directory), not once per process.
 * With N locations open, `setup()` runs N times; a naive per-instance
 * `ctx.event.subscribe()` therefore delivers every event N times, producing N
 * duplicate notifications. The event stream is global, so exactly one
 * subscription suffices.
 *
 * This module keeps a single coordinator on `globalThis` (survives module
 * re-evaluation across locations). Each plugin instance `join`s with its own
 * subscribe factory; only the first opens the stream. Instances `leave` on
 * cleanup; when the current owner leaves while others remain, ownership is
 * handed to a survivor so notifications keep flowing. The last instance out
 * tears the subscription down and runs the provided dispose hook.
 */

/** Opens a subscription; returns an abort handle for it. */
export type SubscribeFactory = (onEvent: (event: unknown) => void) => () => void

interface Member {
  readonly id: number
  readonly subscribe: SubscribeFactory
}

interface Coordinator {
  nextId: number
  readonly members: Map<number, Member>
  ownerId: number | null
  abortCurrent: (() => void) | null
  readonly onEvent: (event: unknown) => void
  readonly onLastLeave: () => void
}

const KEY = Symbol.for('opencode-ping.subscription')

function getCoordinator(
  onEvent: (event: unknown) => void,
  onLastLeave: () => void
): Coordinator {
  const g = globalThis as Record<symbol, Coordinator | undefined>
  let c = g[KEY]
  if (!c) {
    c = {
      nextId: 1,
      members: new Map(),
      ownerId: null,
      abortCurrent: null,
      onEvent,
      onLastLeave
    }
    g[KEY] = c
  }
  return c
}

function elect(c: Coordinator): void {
  // Tear down any existing subscription first.
  if (c.abortCurrent) {
    try {
      c.abortCurrent()
    } catch {
      /* ignore */
    }
    c.abortCurrent = null
  }
  c.ownerId = null

  const next = c.members.values().next().value as Member | undefined
  if (!next) return

  c.ownerId = next.id
  c.abortCurrent = next.subscribe(c.onEvent)
}

/**
 * Register this instance's subscribe factory. Opens the shared subscription if
 * none is active. Returns a `leave` handle for cleanup. `onEvent`/`onLastLeave`
 * are captured from the first caller (all instances share one handler).
 */
export function join(
  subscribe: SubscribeFactory,
  onEvent: (event: unknown) => void,
  onLastLeave: () => void
): () => void {
  const c = getCoordinator(onEvent, onLastLeave)
  const id = c.nextId++
  c.members.set(id, { id, subscribe })

  if (c.ownerId === null) elect(c)

  let left = false
  return () => {
    if (left) return
    left = true
    const wasOwner = c.ownerId === id
    c.members.delete(id)

    if (c.members.size === 0) {
      if (c.abortCurrent) {
        try {
          c.abortCurrent()
        } catch {
          /* ignore */
        }
        c.abortCurrent = null
      }
      c.ownerId = null
      c.onLastLeave()
      // Drop the shared coordinator so a later reload rebuilds it with the new
      // module's callbacks instead of reusing this generation's stale closures.
      const g = globalThis as Record<symbol, Coordinator | undefined>
      if (g[KEY] === c) delete g[KEY]
      return
    }

    // Others remain: if the owner left, hand ownership to a survivor.
    if (wasOwner) elect(c)
  }
}

/** Test-only: drop the coordinator so each test starts clean. */
export function _resetCoordinator(): void {
  const g = globalThis as Record<symbol, Coordinator | undefined>
  const c = g[KEY]
  if (c?.abortCurrent) {
    try {
      c.abortCurrent()
    } catch {
      /* ignore */
    }
  }
  delete g[KEY]
}
