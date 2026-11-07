import { describe, expect, it, vi, beforeEach } from 'vitest'
import { detectLocale, english, resolveLocale, translate, weekdays } from './i18n'
import { defaults, validateConfig } from './domain'
import { loadConfig, persistConfig } from './persistence'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }))

describe('language selection', () => {
  it.each(['C', 'C.UTF-8', 'POSIX', '', 'en-US', 'fr_FR.UTF-8', 'ja-JP', 'zhfoo', undefined])(
    'falls back to English for %s',
    (value) => expect(detectLocale(value)).toBe('en'),
  )
  it.each(['zh', 'zh_CN.UTF-8', 'zh-Hans-CN', 'zh-TW', 'ZH-hk'])(
    'selects Chinese for %s',
    (value) => expect(detectLocale(value)).toBe('zh-CN'),
  )
  it('honors explicit choices regardless of the system locale', () => {
    expect(resolveLocale('en', 'zh_CN.UTF-8')).toBe('en')
    expect(resolveLocale('zh-CN', 'C')).toBe('zh-CN')
    expect(resolveLocale('system', 'C')).toBe('en')
    expect(resolveLocale('system', 'zh-Hans')).toBe('zh-CN')
  })
  it('provides English copy and localized interpolation', () => {
    for (const text of Object.values(english)) expect(text).not.toMatch(/\p{Script=Han}/u)
    expect(translate('en', '今日已完成 {count} 次专注', { count: 3 })).toBe(
      'Completed today: 3 focus sessions',
    )
    expect(translate('zh-CN', '今日已完成 {count} 次专注', { count: 3 })).toBe(
      '今日已完成 3 次专注',
    )
    expect(weekdays('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(weekdays('zh-CN', true)[0]).toBe('星期一')
  })
})

describe('settings migration and language persistence', () => {
  const entries = new Map<string, string>()
  beforeEach(() => {
    entries.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    })
  })
  it('upgrades old settings without resetting salary or schedule', async () => {
    const { language: _, ...old } = { ...defaults, monthlySalary: 23456, workStart: '08:30' }
    entries.set('motivator.config', JSON.stringify(old))
    expect(await loadConfig()).toEqual({ ...old, language: 'system' })
  })
  it('persists a manual choice and can restore system language', async () => {
    await persistConfig({ ...defaults, language: 'zh-CN' })
    expect((await loadConfig())?.language).toBe('zh-CN')
    await persistConfig({ ...defaults, language: 'system' })
    expect((await loadConfig())?.language).toBe('system')
  })
  it('rejects unknown language settings', () => {
    expect(validateConfig({ ...defaults, language: 'fr' as never })).toBe('设置格式无效')
  })
})
