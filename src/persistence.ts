import { invoke, isTauri } from '@tauri-apps/api/core'
import { defaults, validateConfig, type Config } from './domain'

export async function loadConfig(): Promise<Config | null> {
  const saved = isTauri()
    ? await invoke<Config | null>('load_config')
    : JSON.parse(localStorage.getItem('motivator.config') || 'null')
  if (!saved) return null
  const merged = { ...defaults, ...saved }
  const error = validateConfig(merged)
  if (error) throw new Error(error)
  return merged
}

export async function persistConfig(config: Config) {
  const plain = JSON.parse(JSON.stringify(config)) as Config
  if (isTauri()) await invoke('save_config', { config: plain })
  else localStorage.setItem('motivator.config', JSON.stringify(plain))
}
