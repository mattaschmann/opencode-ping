import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { sendNotification } from '../src/notify.js'
import { MESSAGES, PRIORITY, TAGS } from '../src/constants.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('notify', () => {
  const testDir = join(tmpdir(), 'opencode-ntfy-test-notify')
  const configPath = join(testDir, 'opencode-ntfy.json')
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    process.env.OPENCODE_NTFY_CONFIG_PATH = configPath
    fetchMock = jest.fn<(input: any, init?: any) => Promise<any>>().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    delete process.env.OPENCODE_NTFY_CONFIG_PATH
  })

  it('no-ops silently when no topic configured', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
    await sendNotification('idle', 'alpha')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to server/topic with correct headers', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'my-topic' } }))
    await sendNotification('idle', 'alpha')
    expect(fetchMock).toHaveBeenCalledWith('https://ntfy.sh/my-topic', {
      method: 'POST',
      headers: {
        Title: 'alpha',
        Priority: PRIORITY.idle,
        Tags: TAGS.idle
      },
      body: MESSAGES.idle
    })
  })

  it('uses codename as Title header', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 't' } }))
    await sendNotification('error', 'bravo')
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[1].headers.Title).toBe('bravo')
  })

  it('uses generic body for each event kind', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 't' } }))
    for (const kind of ['idle', 'error', 'attention', 'test'] as const) {
      fetchMock.mockClear()
      await sendNotification(kind, 'x')
      const call = fetchMock.mock.calls[0] as [any, any]
      expect(call[1].body).toBe(MESSAGES[kind])
    }
  })

  it('uses custom server from config', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 't', server: 'https://custom.sh' } }))
    await sendNotification('test', 'x')
    const call = fetchMock.mock.calls[0] as [any, any]
    expect(call[0]).toBe('https://custom.sh/t')
  })

  it('logs to stderr on non-ok response without throwing', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 't' } }))
    fetchMock.mockResolvedValue({ ok: false, status: 429 })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendNotification('test', 'x')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('429'))
    spy.mockRestore()
  })

  it('logs to stderr on fetch failure without throwing', async () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 't' } }))
    fetchMock.mockRejectedValue(new Error('network down'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(sendNotification('test', 'x')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('network down'))
    spy.mockRestore()
  })
})
