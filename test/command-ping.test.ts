import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempHome: string = mkdtempSync(join(tmpdir(), 'opencode-ping-test-cmd-init-'))

jest.unstable_mockModule('node:os', () => ({
  homedir: () => tempHome,
  tmpdir
}))

const { handlePingCommand } = await import('../src/commands/ping.js')
const { reset, getCodename, isArmed } = await import('../src/session/registry.js')

describe('commands/ping', () => {
  let configPath: string
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'opencode-ping-test-cmd-'))
    const testDir = join(tempHome, 'config')
    configPath = join(testDir, 'opencode-ping.json')
    mkdirSync(testDir, { recursive: true })
    reset()
    process.env.OPENCODE_PING_CONFIG_PATH = configPath
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'test-topic' } }))
    fetchMock = jest.fn<(input: any, init?: any) => Promise<any>>().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    delete process.env.OPENCODE_PING_CONFIG_PATH
    rmSync(tempHome, { recursive: true, force: true })
  })

  describe('start', () => {
    it('arms the session with a codename', async () => {
      const result = await handlePingCommand('start alpha', 's1')
      expect(result).toContain('alpha')
      expect(isArmed('s1')).toBe(true)
      expect(getCodename('s1')).toBe('alpha')
    })

    it('returns usage when codename is missing', async () => {
      const result = await handlePingCommand('start', 's1')
      expect(result).toContain('Usage')
      expect(isArmed('s1')).toBe(false)
    })

    it('returns error when no topic configured', async () => {
      writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
      const result = await handlePingCommand('start alpha', 's1')
      expect(result).toContain('No topic configured')
      expect(isArmed('s1')).toBe(false)
    })
  })

  describe('stop', () => {
    it('disarms an armed session', async () => {
      await handlePingCommand('start alpha', 's1')
      const result = await handlePingCommand('stop', 's1')
      expect(result).toContain('disarmed')
      expect(isArmed('s1')).toBe(false)
    })

    it('reports when not active', async () => {
      const result = await handlePingCommand('stop', 's1')
      expect(result).toContain('not active')
    })
  })

  describe('status', () => {
    it('reports armed state with codename', async () => {
      await handlePingCommand('start alpha', 's1')
      const result = await handlePingCommand('status', 's1')
      expect(result).toContain('alpha')
    })

    it('reports not armed', async () => {
      const result = await handlePingCommand('status', 's1')
      expect(result).toContain('Not armed')
    })
  })

  describe('test', () => {
    it('sends a test notification with given codename', async () => {
      const result = await handlePingCommand('test alpha', 's1')
      expect(result).toContain('sent')
      const call = fetchMock.mock.calls[0] as [any, any]
      expect(call[1].headers.Title).toBe('alpha')
    })

    it('returns usage when no codename given', async () => {
      const result = await handlePingCommand('test', 's1')
      expect(result).toContain('Usage')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns error when no topic configured', async () => {
      writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
      const result = await handlePingCommand('test alpha', 's1')
      expect(result).toContain('No topic configured')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('help', () => {
    it('returns usage info', async () => {
      const result = await handlePingCommand('help', 's1')
      expect(result).toContain('/ping start')
      expect(result).toContain('/ping stop')
    })

    it('defaults to help for unknown subcommand', async () => {
      const result = await handlePingCommand('unknown', 's1')
      expect(result).toContain('/ping start')
    })
  })
})
