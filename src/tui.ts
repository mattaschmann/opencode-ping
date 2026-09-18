/**
 * V2 TUI sub-plugin — the only entrypoint that can show toasts.
 *
 * Subscribes to the `toast` RPC events emitted by the server plugin
 * (`src/index.ts`) and renders them via `context.ui.toast.show`. Loaded only
 * under V2 via the `./tui` package export. Toasts do not render under headless
 * `opencode run` — same limitation the V1 toast API had.
 */
import { Plugin } from '@opencode/plugin/tui'
import { PING_RPC } from './rpc.js'

export default Plugin.define({
  id: 'opencode-ping.tui',
  setup: (context: any) => {
    const controller = new AbortController()
    try {
      const rpc = context.client.rpc(PING_RPC)
      const off = rpc.events.on(
        'toast',
        (event: any) => {
          const { message, variant } = event.data ?? {}
          if (typeof message === 'string' && message.length > 0) {
            context.ui.toast.show({ message, variant: variant ?? 'info' })
          }
        },
        { signal: controller.signal }
      )
      return () => {
        try {
          off?.()
        } catch {
          /* ignore */
        }
        controller.abort()
      }
    } catch {
      return () => controller.abort()
    }
  }
})
