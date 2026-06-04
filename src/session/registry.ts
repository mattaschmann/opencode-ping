const sessions = new Map<string, string>()

export function arm(sessionID: string, codename: string): void {
  sessions.set(sessionID, codename)
}

export function disarm(sessionID: string): void {
  sessions.delete(sessionID)
}

export function getCodename(sessionID: string): string | undefined {
  return sessions.get(sessionID)
}

export function isArmed(sessionID: string): boolean {
  return sessions.has(sessionID)
}

export function reset(): void {
  sessions.clear()
}
