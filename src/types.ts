export type EventKind = 'idle' | 'error' | 'attention' | 'test'

export interface NtfyConfig {
  version: 1
  settings: {
    topic?: string
    server?: string
    priority?: Partial<Record<EventKind, string>>
    tags?: Partial<Record<EventKind, string>>
  }
}
