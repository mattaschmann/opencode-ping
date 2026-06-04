import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import plugin from '../src/index.js'
import { reset, arm } from '../src/session/registry.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('event routing', () => {
  const testDir = join(tmpdir(), 'opencode-ping-test-events')
  const configPath = join(testDir, 'opencode-ping.json')
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>
  let hooks: any

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
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
  })

  it('does not notify when session is not armed', async () => {
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } } })
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'idle' } } } })
    jest.useFakeTimers()
    jest.advanceTimersByTime(6000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('notifies on idle transition when armed', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } } })
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'idle' } } } })
    jest.advanceTimersByTime(6000)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('alpha')
  })

  it('debounces idle notifications', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } } })
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'idle' } } } })
    jest.advanceTimersByTime(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(4000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cancels debounce when session goes busy again', async () => {
    jest.useFakeTimers()
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'busy' } } } })
    await hooks.event({ event: { type: 'session.status', properties: { sessionID: 's1', status: { type: 'idle' } } } })
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

  it('notifies on permission.updated when armed', async () => {
    arm('s1', 'alpha')
    await hooks.event({ event: { type: 'permission.updated', properties: { sessionID: 's1', id: 'p1', type: 'file', title: 'x', metadata: {}, time: { created: 0 } } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].body).toContain('attention')
  })

  it('does not notify on permission.updated when not armed', async () => {
    await hooks.event({ event: { type: 'permission.updated', properties: { sessionID: 's1', id: 'p1', type: 'file', title: 'x', metadata: {}, time: { created: 0 } } } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns empty hooks when OPENCODE_PING=0', async () => {
    process.env.OPENCODE_PING = '0'
    const client = { session: { prompt: jest.fn() } }
    const result = await plugin({ client })
    expect(result).toEqual({})
  })
})
