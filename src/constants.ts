export const NTFY = {
  SERVER_DEFAULT: 'https://ntfy.sh',
  DEBOUNCE_MS: 5000,
  PROVIDER_ID: 'opencode-ping' as const
}

export const SESSION = {
  CACHE_DIR: 'opencode-ping',
  CACHE_FILE: 'sessions.json'
}

export const MESSAGES = {
  idle: 'idle',
  error: 'error',
  permission: 'permission',
  question: 'question',
  test: 'test'
} as const

export const PRIORITY = {
  idle: '4',
  error: '4',
  permission: '4',
  question: '4',
  test: '4'
} as const

export const TAGS = {
  idle: 'white_check_mark',
  error: 'warning',
  permission: 'bell',
  question: 'question',
  test: 'test_tube'
} as const
