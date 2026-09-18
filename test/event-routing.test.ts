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

  it('does not notify when session is not armed', () => {
    jest.useFakeTimers()
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies after step.ended goes quiet when armed', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('alpha')
  })

  it('debounces idle notifications', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(4000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('coalesces multiple step.ended into a single ping', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(3000)
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(3000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels the idle debounce when a new step starts', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(2000)
    handleEvent({ type: 'session.step.started', data: { sessionID: 's1' } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('disposeAll clears pending idle timers', () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    handleEvent({ type: 'session.step.ended', data: { sessionID: 's1' } })
    disposeAll()
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

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
