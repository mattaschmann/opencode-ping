export const NTFY = {
  SERVER_DEFAULT: 'https://ntfy.sh',
  DEBOUNCE_MS: 5000,
  PROVIDER_ID: 'opencode-ping' as const
}

export const MESSAGES = {
  idle: 'idle',
  error: 'error',
  attention: 'attention',
  test: 'test'
} as const

export const PRIORITY = {
  idle: '3',
  error: '4',
  attention: '4',
  test: '3'
} as const

export const TAGS = {
  idle: 'white_check_mark',
  error: 'warning',
  attention: 'bell',
  test: 'test_tube'
} as const
