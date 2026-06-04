import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempHome: string = mkdtempSync(join(tmpdir(), 'opencode-ping-test-events-init-'))

jest.unstable_mockModule('node:os', () => ({
  homedir: () => tempHome,
  tmpdir
}))

const { default: plugin } = await import('../src/index.js')
const { reset, arm } = await import('../src/session/registry.js')

describe('event routing', () => {
  let testDir: string
  let configPath: string
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>
  let hooks: any

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), 'opencode-ping-test-events-'))
    testDir = join(tempHome, 'config')
    configPath = join(testDir, 'opencode-ping.json')
    mkdirSync(testDir, { recursive: true })
    reset()
    process.env.OPENCODE_PING_CONFIG_PATH = configPath
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'test-topic' } }))
    fetchMock = jest.fn<(input: any, init?: any) => Promise<any>>().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as any
    delete process.env.OPENCODE_PING
    const client = { session: { prompt: jest.fn() } }
    hooks = await plugin({ client })
  })

  afterEach(() => {
    delete process.env.OPENCODE_PING_CONFIG_PATH
    delete process.env.OPENCODE_PING
    jest.useRealTimers()
    rmSync(tempHome, { recursive: true, force: true })
  })

  it('does not notify when session is not armed', async () => {
    jest.useFakeTimers()
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on session.idle when armed', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
    jest.advanceTimersByTime(6000)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('alpha')
  })

  it('debounces idle notifications', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
    jest.advanceTimersByTime(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(4000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels debounce when session goes busy', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
    jest.advanceTimersByTime(2000)
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } } })
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on session.error when armed', async () => {
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.error', properties: { sessionID: 's1', error: {} } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('error')
  })

  it('does not notify on session.error when not armed', async () => {
    await hooks.event({ event: { type: 'session.error', properties: { sessionID: 's1', error: {} } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores session.error without sessionID', async () => {
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.error', properties: { error: {} } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on permission.asked when armed', async () => {
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'permission.asked', properties: { sessionID: 's1', id: 'p1', type: 'file', title: 'x', metadata: {}, time: { created: 0 } } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('permission')
  })

  it('does not notify on permission.asked when not armed', async () => {
    await hooks.event({ event: { type: 'permission.asked', properties: { sessionID: 's1', id: 'p1', type: 'file', title: 'x', metadata: {}, time: { created: 0 } } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on question.asked when armed', async () => {
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'question.asked', properties: { sessionID: 's1', id: 'q1', questions: [] } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('question')
  })

  it('does not notify on question.asked when not armed', async () => {
    await hooks.event({ event: { type: 'question.asked', properties: { sessionID: 's1', id: 'q1', questions: [] } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns empty hooks when OPENCODE_PING=0', async () => {
    process.env.OPENCODE_PING = '0'
    const client = { session: { prompt: jest.fn() } }
    const result = await plugin({ client })
    expect(result).toEqual({})
  })
})
