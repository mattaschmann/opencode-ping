import { arm, disarm, getCodename, isArmed, reset } from '../src/session/registry.js'

describe('session/registry', () => {
  beforeEach(() => reset())

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
})
