export interface NtfyConfig {
  version: 1
  settings: {
    topic?: string
    server?: string
  }
}

export type EventKind = 'idle' | 'error' | 'attention' | 'test'
