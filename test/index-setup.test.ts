import { describe, it, expect, afterEach } from '@jest/globals'

const { default: plugin } = await import('../src/index.js')

describe('plugin entrypoint (V2 predicate)', () => {
  it('default export is an object with a string id and a setup function', () => {
    // Mirrors V2's plugin predicate:
    // typeof t === "object" && "id" in t && typeof t.id === "string" && typeof t.setup === "function"
    expect(typeof plugin).toBe('object')
    expect(plugin).not.toBeNull()
    expect(typeof (plugin as any).id).toBe('string')
    expect((plugin as any).id.length).toBeGreaterThan(0)
    expect(typeof (plugin as any).setup).toBe('function')
  })
})

describe('setup with OPENCODE_PING=0', () => {
  afterEach(() => {
    delete process.env.OPENCODE_PING
  })

  it('returns a no-op cleanup and touches no ctx domains', async () => {
    process.env.OPENCODE_PING = '0'
    let touched = false
    const ctx = {
      get rpc() {
        touched = true
        return {}
      },
      get command() {
        touched = true
        return {}
      },
      get event() {
        touched = true
        return {}
      }
    }
    const cleanup = await (plugin as any).setup(ctx)
    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
    expect(touched).toBe(false)
  })
})
