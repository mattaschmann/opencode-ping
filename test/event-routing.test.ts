import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempHome: string = mkdtempSync(join(tmpdir(), 'opencode-ping-test-events-init-'))

jest.unstable_mockModule('node:os', () => ({
  homedir: () => tempHome,
  tmpdir
}))

const { handleEvent, disposeAll } = await import('../src/session/router.js')
const { reset, arm } = await import('../src/session/registry.js')

describe('event routing', () => {
  let testDir: string
  let configPath: string
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), 'opencode-ping-test-events-'))
    testDir = join(tempHome, 'config')
    configPath = join(testDir, 'opencode-ping.json')
    mkdirSync(testDir, { recursive: true })
    reset()
    disposeAll()
    process.env.OPENCODE_PING_CONFIG_PATH = configPath
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'test-topic' } }))
    fetchMock = jest.fn<(input: any, init?: any) => Promise<any>>().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as any
    delete process.env.OPENCODE_PING
  })

  afterEach(() => {
    disposeAll()
    delete process.env.OPENCODE_PING_CONFIG_PATH
    delete process.env.OPENCODE_PING
    jest.useRealTimers()
    rmSync(tempHome, { recursive: true, force: true })
  })

  // --- idle, single session ------------------------------------------------

  it('does not notify when session is not armed', () => {
    jest.useFakeTimers()
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies idle after execution succeeds when armed', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('alpha')
    expect(call[1].body).toContain('idle')
  })

  it('debounces the idle notification', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(4000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('coalesces multiple execution boundaries into a single ping', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(3000)
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(3000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels the idle debounce when execution restarts', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(2000)
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disposeAll clears pending idle timers', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 's1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 's1' } })
    disposeAll()
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats session.status busy/idle as execution state', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.status', data: { sessionID: 's1', status: { type: 'busy' } } })
    handleEvent({ type: 'session.status', data: { sessionID: 's1', status: { type: 'idle' } } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as [any, any])[1].body).toContain('idle')
  })

  // --- idle, subagent family ------------------------------------------------

  it('does NOT ping idle when a child finishes while the parent is still running', () => {
    jest.useFakeTimers()
    arm('root', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'child', parentID: 'root' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'child' } })
    // Child finishes; parent still active.
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'child' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does NOT ping idle when one child finishes while a sibling runs', () => {
    jest.useFakeTimers()
    arm('root', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'c1', parentID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'c2', parentID: 'root' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'c1' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'c2' } })
    // Parent went idle, c1 finished, c2 still running.
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'root' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'c1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pings idle exactly once when the whole family goes quiet', () => {
    jest.useFakeTimers()
    arm('root', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'c1', parentID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'c2', parentID: 'root' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'c1' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'c2' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'c1' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'c2' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'root' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as [any, any])[1].headers.Title).toBe('alpha')
  })

  it('cancels the idle ping when the parent resumes during the debounce', () => {
    jest.useFakeTimers()
    arm('root', 'alpha')
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'root' } })
    handleEvent({ type: 'session.created', data: { sessionID: 'child', parentID: 'root' } })
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'child' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'child' } })
    handleEvent({ type: 'session.execution.succeeded', data: { sessionID: 'root' } })
    jest.advanceTimersByTime(2000)
    // Parent picks the turn back up after the child's result.
    handleEvent({ type: 'session.execution.started', data: { sessionID: 'root' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // --- immediate events -----------------------------------------------------

  it('notifies on session.execution.failed when armed', () => {
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.failed', data: { sessionID: 's1', error: {} } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('error')
  })

  it('does not notify on session.execution.failed when not armed', () => {
    handleEvent({ type: 'session.execution.failed', data: { sessionID: 's1', error: {} } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores session.execution.failed without sessionID', () => {
    arm('s1', 'alpha')
    handleEvent({ type: 'session.execution.failed', data: { error: {} } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('attributes a child permission to the armed family root', () => {
    arm('root', 'alpha')
    handleEvent({ type: 'session.created', data: { sessionID: 'child', parentID: 'root' } })
    handleEvent({
      type: 'permission.asked',
      data: { sessionID: 'child', id: 'p1', action: 'edit', resources: [] }
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('alpha')
    expect(call[1].body).toContain('permission')
  })

  it('notifies on permission.asked when armed', () => {
    arm('s1', 'alpha')
    handleEvent({ type: 'permission.asked', data: { sessionID: 's1', id: 'p1', action: 'edit', resources: [] } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('permission')
  })

  it('does not notify on permission.asked when not armed', () => {
    handleEvent({ type: 'permission.asked', data: { sessionID: 's1', id: 'p1', action: 'edit', resources: [] } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on form.created when armed (nested sessionID)', () => {
    arm('s1', 'alpha')
    handleEvent({ type: 'form.created', data: { form: { id: 'q1', sessionID: 's1', title: 'x', fields: [] } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('question')
  })

  it('does not notify on form.created when not armed', () => {
    handleEvent({ type: 'form.created', data: { form: { id: 'q1', sessionID: 's1', title: 'x', fields: [] } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
