import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { NTFY } from '../constants.js'
import type { NtfyConfig } from '../types.js'

export function getConfigFilePath(): string {
  const override = process.env.OPENCODE_NTFY_CONFIG_PATH
  if (override) return override
  return join(homedir(), '.config', 'opencode', 'opencode-ntfy.json')
}

export function readConfig(): NtfyConfig {
  try {
    const raw = readFileSync(getConfigFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.version === 1 && typeof parsed.settings === 'object') {
      return parsed as NtfyConfig
    }
  } catch {
    /* missing or corrupt */
  }
  return { version: 1, settings: {} }
}

export function getTopic(): string | undefined {
  return readConfig().settings.topic
}

export function getServer(): string {
  return readConfig().settings.server ?? NTFY.SERVER_DEFAULT
}

export function writeDefaultConfig(topic: string): { path: string; created: boolean } {
  const configPath = getConfigFilePath()
  if (existsSync(configPath)) {
    return { path: configPath, created: false }
  }
  const config: NtfyConfig = {
    version: 1,
    settings: { topic, server: NTFY.SERVER_DEFAULT }
  }
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  return { path: configPath, created: true }
}
