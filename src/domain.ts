import type { Language, Message } from './i18n'

export type CurrencyCode = 'CNY' | 'VND' | 'INR' | 'ZWG' | 'USD' | 'EUR'

export interface Currency {
  code: CurrencyCode
  label: string
  symbol: string
  decimals: number
  defaultRate: number
}

export const currencies: Currency[] = [
  { code: 'CNY', label: '人民币', symbol: '¥', decimals: 2, defaultRate: 1 },
  { code: 'VND', label: '越南盾', symbol: '₫', decimals: 0, defaultRate: 3831.417625 },
  { code: 'INR', label: '印度卢比', symbol: '₹', decimals: 2, defaultRate: 14.067863 },
  { code: 'ZWG', label: '津巴布韦币', symbol: 'ZiG', decimals: 2, defaultRate: 3.966854 },
  { code: 'USD', label: '美元', symbol: '$', decimals: 2, defaultRate: 0.149554 },
  { code: 'EUR', label: '欧元', symbol: '€', decimals: 2, defaultRate: 0.133627 },
]

export interface Config {
  language: Language
  monthlySalary: number
  displayCurrency: CurrencyCode
  exchangeRates: Record<CurrencyCode, number>
  workDaysPerMonth: number
  payday: number
  workStart: string
  workEnd: string
  lunchStart: string
  lunchEnd: string
  lunchEnabled: boolean
  workdays: number[]
  focusMinutes: number
  breakMinutes: number
  notifications: boolean
  theme: 'light' | 'dark' | 'system'
}

export const defaults: Config = {
  language: 'system',
  monthlySalary: 12000,
  displayCurrency: 'CNY',
  exchangeRates: Object.fromEntries(currencies.map((c) => [c.code, c.defaultRate])) as Record<
    CurrencyCode,
    number
  >,
  workDaysPerMonth: 21.75,
  payday: 10,
  workStart: '09:00',
  workEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  lunchEnabled: true,
  workdays: [1, 2, 3, 4, 5],
  focusMinutes: 25,
  breakMinutes: 5,
  notifications: false,
  theme: 'light',
}

export const findCurrency = (code: CurrencyCode) =>
  currencies.find((currency) => currency.code === code) ?? currencies[0]

export const convertCurrency = (amount: number, c: Config) =>
  amount * (c.exchangeRates[c.displayCurrency] ?? 1)

export const minuteOfDay = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function validateConfig(c: Config): Message | null {
  if (!Number.isFinite(c.monthlySalary) || c.monthlySalary <= 0 || c.monthlySalary > 100000000)
    return '月薪须在 0 至 100,000,000 元之间'
  if (!Number.isFinite(c.workDaysPerMonth) || c.workDaysPerMonth < 1 || c.workDaysPerMonth > 31)
    return '月计薪天数须在 1 至 31 天之间'
  if (!Number.isInteger(c.payday) || c.payday < 1 || c.payday > 31)
    return '发薪日须在 1 至 31 日之间'
  if (
    !currencies.some((currency) => currency.code === c.displayCurrency) ||
    !currencies.every(
      (currency) =>
        Number.isFinite(c.exchangeRates[currency.code]) && c.exchangeRates[currency.code] > 0,
    )
  )
    return '汇率须为大于0的有效数字'
  if (
    ![c.workStart, c.workEnd, c.lunchStart, c.lunchEnd].every((t) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
    )
  )
    return '请输入有效时间'
  const [start, end, lunchStart, lunchEnd] = [c.workStart, c.workEnd, c.lunchStart, c.lunchEnd].map(
    minuteOfDay,
  )
  if (end <= start) return '下班时间须晚于上班时间（同一天）'
  if (
    c.lunchEnabled &&
    (lunchStart < start ||
      lunchEnd > end ||
      lunchEnd <= lunchStart ||
      lunchEnd - lunchStart >= end - start)
  )
    return '午休须位于工作时段内，并保留有效工作时间'
  if (
    !Array.isArray(c.workdays) ||
    !c.workdays.length ||
    c.workdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(c.workdays).size !== c.workdays.length
  )
    return '请至少选择一个工作日'
  if (![c.focusMinutes, c.breakMinutes].every((n) => Number.isInteger(n) && n >= 1 && n <= 180))
    return '专注与休息时长须在 1 至 180 分钟之间'
  if (
    !['light', 'dark', 'system'].includes(c.theme) ||
    !['system', 'en', 'zh-CN'].includes(c.language) ||
    typeof c.lunchEnabled !== 'boolean' ||
    typeof c.notifications !== 'boolean'
  )
    return '设置格式无效'
  return null
}

export function atTime(day: Date, time: string): number {
  const result = new Date(day)
  const [hours, minutes] = time.split(':').map(Number)
  result.setHours(hours, minutes, 0, 0)
  return result.getTime()
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function earnings(c: Config, date: Date) {
  const now = date.getTime()
  const start = atTime(date, c.workStart),
    end = atTime(date, c.workEnd)
  const lunchStart = atTime(date, c.lunchStart),
    lunchEnd = atTime(date, c.lunchEnd)
  const lunchMs = c.lunchEnabled ? lunchEnd - lunchStart : 0
  const duration = end - start - lunchMs
  const workingDay = c.workdays.includes(date.getDay())
  const elapsed = Math.max(0, Math.min(now, end) - start)
  const lunchElapsed = c.lunchEnabled ? Math.max(0, Math.min(now, lunchEnd) - lunchStart) : 0
  const paidMs = workingDay ? Math.min(duration, Math.max(0, elapsed - lunchElapsed)) : 0
  const daily = c.monthlySalary / c.workDaysPerMonth
  const status: '休息日' | '未上班' | '已下班' | '午休中' | '计薪中' = !workingDay
    ? '休息日'
    : now < start
      ? '未上班'
      : now >= end
        ? '已下班'
        : c.lunchEnabled && now >= lunchStart && now < lunchEnd
          ? '午休中'
          : '计薪中'
  return {
    amount: (daily * paidMs) / duration,
    daily,
    hourly: daily / (duration / 3600000),
    paidMs,
    duration,
    progress: paidMs / duration,
    status,
    start,
    end,
    workingDay,
    remaining: workingDay ? Math.max(0, end - now) : 0,
  }
}

export function paydayInfo(c: Config, now: Date) {
  const paydayFor = (year: number, month: number) =>
    new Date(year, month, Math.min(c.payday, new Date(year, month + 1, 0).getDate()))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = paydayFor(today.getFullYear(), today.getMonth())
  if (next < today) next = paydayFor(today.getFullYear(), today.getMonth() + 1)
  // Calendar-day arithmetic stays correct over daylight saving changes.
  const calendar = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return { date: next, days: Math.round((calendar(next) - calendar(today)) / 86400000) }
}

export function weekEarnings(c: Config, now: Date) {
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(day.getDate() + index)
    const isToday = dayKey(day) === dayKey(now)
    const future = dayKey(day) > dayKey(now)
    const end = new Date(atTime(day, c.workEnd))
    return {
      day,
      isToday,
      future,
      amount: future ? 0 : earnings(c, isToday ? now : end).amount,
      working: c.workdays.includes(day.getDay()),
    }
  })
}

export function durationText(ms: number, seconds = false) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600),
    minutes = Math.floor((total % 3600) / 60)
  return seconds
    ? `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')}`
}
