export type EventKind = 'idle' | 'error' | 'permission' | 'question' | 'test'

export interface NtfyConfig {
  version: 1
  settings: {
    topic?: string
    server?: string
    priority?: Partial<Record<EventKind, string>>
    tags?: Partial<Record<EventKind, string>>
  }
}
