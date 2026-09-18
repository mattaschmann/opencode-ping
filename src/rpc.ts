/**
 * Shared RPC definition for the server → TUI toast bridge.
 *
 * V2 server plugins cannot show toasts directly and `ctx.event` is
 * subscribe-only. RPC events are the sanctioned server→TUI channel: the server
 * plugin (`src/index.ts`) registers this definition and emits `toast` events;
 * the `./tui` sub-plugin (`src/tui.ts`) subscribes and renders them. Imported by
 * both entrypoints, so it must not pull in any server-only state.
 */
import { Rpc } from '@opencode/plugin'
import { Schema } from 'effect'
import { NTFY } from './constants.js'

export const PING_RPC = Rpc.define({
  id: NTFY.PROVIDER_ID,
  methods: {},
  events: {
    toast: {
      schema: Schema.Struct({
        message: Schema.String,
        variant: Schema.Literals(['info', 'success', 'warning', 'error'])
      })
    }
  }
})

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'
