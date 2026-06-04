import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { jest } from '@jest/globals'

let tempHome: string = mkdtempSync(join(tmpdir(), 'opencode-ping-test-init-'))

jest.unstable_mockModule('node:os', () => ({
  homedir: () => tempHome
}))

const { arm, disarm, getCodename, isArmed, reset, load, getCachePath } = await import(
  '../src/session/registry.js'
)

describe('session/registry', () => {
  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'opencode-ping-test-'))
    reset()
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
  })

  it('starts unarmed', () => {
    expect(isArmed('s1')).toBe(false)
    expect(getCodename('s1')).toBeUndefined()
  })

  it('arms a session with a codename', () => {
    arm('s1', 'alpha')
    expect(isArmed('s1')).toBe(true)
    expect(getCodename('s1')).toBe('alpha')
  })

  it('disarms a session', () => {
    arm('s1', 'alpha')
    disarm('s1')
    expect(isArmed('s1')).toBe(false)
    expect(getCodename('s1')).toBeUndefined()
  })

  it('tracks multiple sessions independently', () => {
    arm('s1', 'alpha')
    arm('s2', 'bravo')
    expect(getCodename('s1')).toBe('alpha')
    expect(getCodename('s2')).toBe('bravo')
    disarm('s1')
    expect(isArmed('s1')).toBe(false)
    expect(isArmed('s2')).toBe(true)
  })

  it('re-arming overwrites the codename', () => {
    arm('s1', 'alpha')
    arm('s1', 'bravo')
    expect(getCodename('s1')).toBe('bravo')
  })

  it('disarming an unarmed session is a no-op', () => {
    expect(() => disarm('s1')).not.toThrow()
  })

  it('reset clears all sessions', () => {
    arm('s1', 'alpha')
    arm('s2', 'bravo')
    reset()
    expect(isArmed('s1')).toBe(false)
    expect(isArmed('s2')).toBe(false)
  })

  describe('persistence', () => {
    it('persists armed sessions to disk', () => {
      arm('s1', 'alpha')
      const cachePath = getCachePath()
      expect(existsSync(cachePath)).toBe(true)
      const data = JSON.parse(readFileSync(cachePath, 'utf8'))
      expect(data.sessions.s1.codename).toBe('alpha')
      expect(typeof data.sessions.s1.armedAt).toBe('number')
    })

    it('load restores sessions from disk', () => {
      arm('s1', 'alpha')
      arm('s2', 'bravo')
      reset()
      const cachePath = getCachePath()
      const data = {
        sessions: {
          s1: { codename: 'alpha', armedAt: Date.now() },
          s2: { codename: 'bravo', armedAt: Date.now() }
        }
      }
      writeFileSync(cachePath, JSON.stringify(data), 'utf8')
      load()
      expect(getCodename('s1')).toBe('alpha')
      expect(getCodename('s2')).toBe('bravo')
    })

    it('prunes entries older than TTL on load', () => {
      const cachePath = getCachePath()
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      const data = {
        sessions: {
          stale: { codename: 'old', armedAt: eightDaysAgo },
          fresh: { codename: 'new', armedAt: Date.now() }
        }
      }
      mkdirSync(dirname(cachePath), { recursive: true })
      writeFileSync(cachePath, JSON.stringify(data), 'utf8')
      load()
      expect(isArmed('stale')).toBe(false)
      expect(isArmed('fresh')).toBe(true)
    })

    it('handles corrupt cache file gracefully', () => {
      const cachePath = getCachePath()
      mkdirSync(dirname(cachePath), { recursive: true })
      writeFileSync(cachePath, '{{not json!!', 'utf8')
      expect(() => load()).not.toThrow()
      expect(isArmed('s1')).toBe(false)
    })

    it('handles missing cache file gracefully', () => {
      expect(() => load()).not.toThrow()
    })

    it('reset removes the cache file', () => {
      arm('s1', 'alpha')
      const cachePath = getCachePath()
      expect(existsSync(cachePath)).toBe(true)
      reset()
      expect(existsSync(cachePath)).toBe(false)
    })

    it('disarm updates the persisted file', () => {
      arm('s1', 'alpha')
      arm('s2', 'bravo')
      disarm('s1')
      const cachePath = getCachePath()
      const data = JSON.parse(readFileSync(cachePath, 'utf8'))
      expect(data.sessions.s1).toBeUndefined()
      expect(data.sessions.s2.codename).toBe('bravo')
    })
  })
})
