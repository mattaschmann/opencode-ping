import { describe, it, expect, beforeEach } from '@jest/globals'
import { join, _resetCoordinator } from '../src/session/coordinator.js'

describe('subscription coordinator', () => {
  beforeEach(() => {
    _resetCoordinator()
  })

  it('opens exactly one subscription across N instances', () => {
    let opened = 0
    const factory = () => {
      opened++
      return () => {}
    }
    const leaves = Array.from({ length: 6 }, () =>
      join(factory, () => {}, () => {})
    )
    expect(opened).toBe(1)
    leaves.forEach((l) => l())
  })

  it('delivers each event once to the shared handler', () => {
    const received: unknown[] = []
    let emit: ((e: unknown) => void) | null = null
    const factory = (onEvent: (e: unknown) => void) => {
      emit = onEvent
      return () => {}
    }
    const leaves = Array.from({ length: 6 }, () =>
      join(factory, (e) => received.push(e), () => {})
    )
    emit!({ type: 'permission.asked' })
    expect(received).toHaveLength(1)
    leaves.forEach((l) => l())
  })

  it('keeps the subscription alive when a non-owner leaves', () => {
    let aborted = 0
    const factory = () => () => {
      aborted++
    }
    const a = join(factory, () => {}, () => {})
    const b = join(factory, () => {}, () => {})
    // b is a non-owner (a opened it). b leaving must not abort.
    b()
    expect(aborted).toBe(0)
    a()
  })

  it('hands ownership to a survivor when the owner leaves', () => {
    const opens: number[] = []
    let n = 0
    const factory = () => {
      const id = ++n
      opens.push(id)
      return () => {}
    }
    const a = join(factory, () => {}, () => {}) // owner, opens #1
    const b = join(factory, () => {}, () => {}) // waits
    expect(opens).toEqual([1])
    a() // owner leaves -> re-elect -> opens #2
    expect(opens).toEqual([1, 2])
    b()
  })

  it('routes events to the new owner after handoff', () => {
    const received: string[] = []
    const emitters: Array<(e: unknown) => void> = []
    const factory = (onEvent: (e: unknown) => void) => {
      emitters.push(onEvent)
      return () => {}
    }
    const a = join(factory, (e: any) => received.push(e.type), () => {})
    const b = join(factory, () => {}, () => {})
    a() // hand off to b; a second subscription opens with the same shared handler
    emitters[emitters.length - 1]!({ type: 'form.created' })
    expect(received).toEqual(['form.created'])
    b()
  })

  it('aborts and runs onLastLeave only when the final instance leaves', () => {
    let aborted = 0
    let lastLeave = 0
    const factory = () => () => {
      aborted++
    }
    const a = join(factory, () => {}, () => lastLeave++)
    const b = join(factory, () => {}, () => lastLeave++)
    a()
    expect(lastLeave).toBe(0)
    expect(aborted).toBe(1) // handoff aborts the old owner's subscription
    b()
    expect(lastLeave).toBe(1)
  })

  it('rebuilds cleanly after the final leave (no stale callbacks)', () => {
    // First generation leaves entirely.
    const firstLeave = join(() => () => {}, () => {}, () => {})
    firstLeave()

    // A later reload joins fresh; its onEvent must be the one that fires,
    // proving the coordinator was rebuilt rather than reusing gen-1 closures.
    const received: string[] = []
    let emit: ((e: unknown) => void) | null = null
    const leave = join(
      (onEvent) => {
        emit = onEvent
        return () => {}
      },
      (e: any) => received.push(e.type),
      () => {}
    )
    emit!({ type: 'permission.asked' })
    expect(received).toEqual(['permission.asked'])
    leave()
  })
})
