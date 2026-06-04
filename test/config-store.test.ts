import { readConfig, getTopic, getServer, getConfigFilePath } from '../src/config/store.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('config/store', () => {
  const testDir = join(tmpdir(), 'opencode-ntfy-test-config')
  const configPath = join(testDir, 'opencode-ntfy.json')

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    process.env.OPENCODE_NTFY_CONFIG_PATH = configPath
    try { rmSync(configPath) } catch {}
  })

  afterEach(() => {
    delete process.env.OPENCODE_NTFY_CONFIG_PATH
  })

  it('returns defaults when config file is missing', () => {
    const cfg = readConfig()
    expect(cfg).toEqual({ version: 1, settings: {} })
  })

  it('reads a valid config file', () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'my-topic', server: 'https://custom.sh' } }))
    expect(getTopic()).toBe('my-topic')
    expect(getServer()).toBe('https://custom.sh')
  })

  it('falls back to defaults on corrupt JSON', () => {
    writeFileSync(configPath, '{{not json}}')
    const cfg = readConfig()
    expect(cfg).toEqual({ version: 1, settings: {} })
  })

  it('falls back to defaults when version is wrong', () => {
    writeFileSync(configPath, JSON.stringify({ version: 99, settings: { topic: 'x' } }))
    const cfg = readConfig()
    expect(cfg).toEqual({ version: 1, settings: {} })
  })

  it('returns default server when not configured', () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: { topic: 'test' } }))
    expect(getServer()).toBe('https://ntfy.sh')
  })

  it('returns undefined topic when not configured', () => {
    writeFileSync(configPath, JSON.stringify({ version: 1, settings: {} }))
    expect(getTopic()).toBeUndefined()
  })

  it('respects OPENCODE_NTFY_CONFIG_PATH env override', () => {
    const altPath = join(testDir, 'alt.json')
    writeFileSync(altPath, JSON.stringify({ version: 1, settings: { topic: 'alt-topic' } }))
    process.env.OPENCODE_NTFY_CONFIG_PATH = altPath
    expect(getTopic()).toBe('alt-topic')
  })
})
