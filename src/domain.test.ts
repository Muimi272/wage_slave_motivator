import { describe, expect, it } from 'vitest'
import {
  defaults,
  durationText,
  earnings,
  paydayInfo,
  validateConfig,
  weekEarnings,
} from './domain'
import { newTimer, pauseTimer, remainingMs, restoreTimer, startTimer } from './timer'

const date = (time: string) => new Date(`2026-11-04T${time}:00`)
const config = { ...defaults, monthlySalary: 17400 }

describe('absolute-time wage calculation', () => {
  it('calculates daily and hourly wages from paid hours', () => {
    const result = earnings(config, date('10:00'))
    expect(result.daily).toBe(800)
    expect(result.hourly).toBe(100)
    expect(result.amount).toBe(100)
  })
  it('clamps before and after work', () => {
    expect(earnings(config, date('08:59')).amount).toBe(0)
    expect(earnings(config, date('18:00')).amount).toBe(800)
    expect(earnings(config, date('23:59')).amount).toBe(800)
    expect(earnings(config, date('18:00')).status).toBe('已下班')
  })
  it('freezes during lunch and resumes exactly at lunch end', () => {
    expect(earnings(config, date('12:00')).amount).toBe(300)
    expect(earnings(config, date('12:59')).amount).toBe(300)
    expect(earnings(config, date('12:59')).status).toBe('午休中')
    expect(earnings(config, date('13:00')).status).toBe('计薪中')
    expect(earnings(config, date('14:00')).amount).toBe(400)
  })
  it('uses wall time after sleep and does not accumulate interval drift', () => {
    earnings(config, date('09:01'))
    expect(earnings(config, date('17:00')).amount).toBe(700)
  })
  it('does not count a rest day, supports custom workdays', () => {
    const saturday = new Date('2026-11-07T18:00:00')
    expect(earnings(config, saturday).amount).toBe(0)
    expect(earnings(config, saturday).status).toBe('休息日')
    expect(earnings({ ...config, workdays: [6] }, saturday).amount).toBe(800)
  })
  it('counts lunch when unpaid lunch is disabled', () => {
    const result = earnings({ ...config, lunchEnabled: false }, date('12:30'))
    expect(result.duration).toBe(9 * 3600000)
    expect(result.amount).toBeCloseTo((800 * 3.5) / 9)
    expect(result.status).toBe('计薪中')
  })
  it('starts each new workday from zero', () => {
    expect(earnings(config, new Date('2026-11-05T00:00:00')).amount).toBe(0)
  })
})

describe('payday calendar', () => {
  it('returns zero throughout payday', () => {
    expect(paydayInfo(config, new Date('2026-11-10T23:59:00')).days).toBe(0)
  })
  it('moves to the next month only after payday', () => {
    const next = paydayInfo(config, new Date('2026-11-11T00:00:00'))
    expect(next.date.getMonth()).toBe(11)
    expect(next.days).toBe(29)
  })
  it('clamps to the last day of a short month', () => {
    expect(
      paydayInfo({ ...config, payday: 31 }, new Date('2027-02-01T12:00:00')).date.getDate(),
    ).toBe(28)
    expect(
      paydayInfo({ ...config, payday: 31 }, new Date('2028-02-01T12:00:00')).date.getDate(),
    ).toBe(29)
  })
  it('handles the year boundary', () => {
    const next = paydayInfo(config, new Date('2026-12-31T12:00:00'))
    expect(next.date.getFullYear()).toBe(2027)
    expect(next.days).toBe(10)
  })
})

describe('week projection', () => {
  it('includes previous workdays and partial today, excludes future', () => {
    const week = weekEarnings(config, date('10:00'))
    expect(week.map((d) => d.amount)).toEqual([800, 800, 100, 0, 0, 0, 0])
    expect(week[2].isToday).toBe(true)
    expect(week[3].future).toBe(true)
  })
  it('finds Monday correctly on Sunday across month boundaries', () => {
    const week = weekEarnings(config, new Date('2026-11-01T12:00:00'))
    expect(week[0].day.getDate()).toBe(26)
    expect(week[0].day.getMonth()).toBe(9)
    expect(week[6].isToday).toBe(true)
  })
})

describe('settings validation', () => {
  it('accepts defaults and fractional paid days', () => {
    expect(validateConfig(defaults)).toBeNull()
  })
  it.each([
    { monthlySalary: 0 },
    { monthlySalary: NaN },
    { monthlySalary: Infinity },
    { workDaysPerMonth: 0 },
    { workDaysPerMonth: 32 },
    { payday: 0 },
    { payday: 2.5 },
    { workStart: '9:00' },
    { workEnd: '08:00' },
    { lunchStart: '08:00' },
    { lunchEnd: '19:00' },
    { lunchEnd: '11:00' },
    { workdays: [] },
    { workdays: [8] },
    { workdays: [1, 1] },
    { focusMinutes: 0 },
    { breakMinutes: 181 },
  ])('rejects invalid input %j', (change) => {
    expect(validateConfig({ ...defaults, ...change })).not.toBeNull()
  })
})

describe('focus clock', () => {
  it('stays accurate while suspended and after restoring from storage', () => {
    const running = startTimer(newTimer(25), 100000)
    const restored = restoreTimer(JSON.parse(JSON.stringify(running)))!
    expect(remainingMs(restored, 100000 + 20 * 60000)).toBe(5 * 60000)
    expect(remainingMs(restored, 100000 + 30 * 60000)).toBe(0)
  })
  it('pauses without counting the paused period and resumes correctly', () => {
    const running = startTimer(newTimer(25), 0)
    const paused = pauseTimer(running, 5 * 60000)
    expect(remainingMs(paused, 100 * 60000)).toBe(20 * 60000)
    const resumed = startTimer(paused, 100 * 60000)
    expect(remainingMs(resumed, 110 * 60000)).toBe(10 * 60000)
  })
  it('rejects corrupted persisted timers', () => {
    expect(restoreTimer({ ...newTimer(25), deadline: 'bad', state: 'running' })).toBeNull()
    expect(restoreTimer({ ...newTimer(25), remaining: -1 })).toBeNull()
    expect(restoreTimer({ ...newTimer(25), duration: 0 })).toBeNull()
    expect(restoreTimer(null)).toBeNull()
  })
  it('formats time without negative values', () => {
    expect(durationText(-1000, true)).toBe('00:00')
    expect(durationText(25 * 60000, true)).toBe('25:00')
    expect(durationText(2 * 3600000 + 5 * 60000)).toBe('02 : 05')
  })
})
