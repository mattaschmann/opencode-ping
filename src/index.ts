/**
 * OpenCode V2 plugin entrypoint.
 *
 * Registers the `/ping` command (display-only via RPC toast) and subscribes to
 * session events, routing them to ntfy notifications through
 * `session/router.ts`. Notifications are off by default; arm per-session with
 * `/ping start <codename>`. Fails quiet — never throws from setup or the event
 * loop. V2 only; the V1 implementation lives on the `main` branch.
 */
import { Plugin } from '@opencode/plugin'
import { NTFY } from './constants.js'
import { handlePingCommand } from './commands/ping.js'
import { load as loadSessions } from './session/registry.js'
import { disposeAll, handleEvent } from './session/router.js'
import { join } from './session/coordinator.js'
import { PING_RPC, type ToastVariant } from './rpc.js'

export default Plugin.define({
  id: NTFY.PROVIDER_ID,
  setup: async (ctx: any) => {
    if (process.env.OPENCODE_PING === '0') return () => {}

    loadSessions()

    // Toast bridge: server plugins have no toast API, so `/ping` output is
    // emitted as an RPC event the `./tui` sub-plugin renders. Degrades to a
    // no-op when RPC is unavailable (e.g. headless).
    let emitToast: (message: string, variant: ToastVariant) => void = () => {}
    try {
      const reg = await ctx.rpc.register(PING_RPC, {})
      emitToast = (message, variant) => {
        void reg.events.emit('toast', { message, variant }).catch(() => {})
      }
    } catch {
      /* RPC unavailable — toasts degrade to no-ops */
    }

    // `/ping` command — display-only. Runs the pure handler and surfaces the
    // result as a toast; deliberately does NOT prompt the model (V2's answer to
    // the V1 `{ ignored: true }` splice).
    await ctx.command.transform((editor: any) => {
      editor.add({
        name: 'ping',
        description: 'push notification commands (start, stop, status, test, help)',
        execute: async (input: any) => {
          const args = String(input?.prompt?.text ?? '').trim()
          const result = await handlePingCommand(args, input?.sessionID)
          emitToast(result, 'info')
        }
      })
    })

    // Subscribe through the process-wide coordinator: V2 runs `setup` once per
    // location, but the event stream is global, so only one instance opens the
    // subscription. `leave` hands ownership to a survivor if this instance is
    // the owner and others remain; the last one out aborts and clears timers.
    const leave = join(
      (onEvent) => {
        const controller = new AbortController()
        void (async () => {
          try {
            for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
              onEvent(event)
            }
          } catch {
            /* subscription ended */
          }
        })()
        return () => controller.abort()
      },
      (event) => {
        try {
          handleEvent(event as { type?: string; data?: any })
        } catch (e) {
          console.error(`[opencode-ping] event handler error: ${e}`)
        }
      },
      () => disposeAll()
    )

    return () => {
      leave()
    }
  }
})
