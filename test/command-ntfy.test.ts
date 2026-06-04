import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { handleNtfyCommand } from '../src/commands/ntfy.js'
import { reset, getCodename, isArmed } from '../src/session/registry.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('commands/ntfy', () => {
  const testDir = join(tmpdir(), 'opencode-ntfy-test-cmd')
  const configPath = join(testDir, 'opencode-ntfy.json')
  let fetchMock: jest.Mock<(input: any, init?: any) => Promise<any>>

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    reset()
    process.env.OPENCODE_NTFY_CONFIG_PATH = configPath
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'test-topic' } }))
    fetchMock = jest.fn<(input: any, init?: any) => Promise<any>>().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as any
  })

  afterEach(() => {
    delete process.env.OPENCODE_NTFY_CONFIG_PATH
  })

  describe('start', () => {
    it('arms the session with a codename', async () => {
      const result = await handleNtfyCommand('start alpha', 's1')
      expect(result).toContain('alpha')
      expect(isArmed('s1')).toBe(true)
      expect(getCodename('s1')).toBe('alpha')
    })

    it('returns usage when codename is missing', async () => {
      const result = await handleNtfyCommand('start', 's1')
      expect(result).toContain('Usage')
      expect(isArmed('s1')).toBe(false)
    })

    it('returns error when no topic configured', async () => {
      writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
      const result = await handleNtfyCommand('start alpha', 's1')
      expect(result).toContain('No topic configured')
      expect(isArmed('s1')).toBe(false)
    })
  })

  describe('stop', () => {
    it('disarms an armed session', async () => {
      await handleNtfyCommand('start alpha', 's1')
      const result = await handleNtfyCommand('stop', 's1')
      expect(result).toContain('disarmed')
      expect(isArmed('s1')).toBe(false)
    })

    it('reports when not active', async () => {
      const result = await handleNtfyCommand('stop', 's1')
      expect(result).toContain('not active')
    })
  })

  describe('status', () => {
    it('reports armed state with codename', async () => {
      await handleNtfyCommand('start alpha', 's1')
      const result = await handleNtfyCommand('status', 's1')
      expect(result).toContain('alpha')
    })

    it('reports not armed', async () => {
      const result = await handleNtfyCommand('status', 's1')
      expect(result).toContain('Not armed')
    })
  })

  describe('test', () => {
    it('sends a test notification with given codename', async () => {
      const result = await handleNtfyCommand('test alpha', 's1')
      expect(result).toContain('sent')
      const call = fetchMock.mock.calls[0] as [any, any]
      expect(call[1].headers.Title).toBe('alpha')
    })

    it('returns usage when no codename given', async () => {
      const result = await handleNtfyCommand('test', 's1')
      expect(result).toContain('Usage')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns error when no topic configured', async () => {
      writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
      const result = await handleNtfyCommand('test alpha', 's1')
      expect(result).toContain('No topic configured')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('help', () => {
    it('returns usage info', async () => {
      const result = await handleNtfyCommand('help', 's1')
      expect(result).toContain('/ntfy start')
      expect(result).toContain('/ntfy stop')
    })

    it('defaults to help for unknown subcommand', async () => {
      const result = await handleNtfyCommand('unknown', 's1')
      expect(result).toContain('/ntfy start')
    })
  })
})
