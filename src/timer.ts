export interface Timer {
  mode: 'focus' | 'break'
  state: 'idle' | 'running' | 'paused' | 'completed'
  duration: number
  remaining: number
  deadline: number | null
}
export const newTimer = (minutes: number, mode: Timer['mode'] = 'focus'): Timer => ({
  mode,
  state: 'idle',
  duration: minutes * 60000,
  remaining: minutes * 60000,
  deadline: null,
})
export const remainingMs = (timer: Timer, now: number) =>
  timer.state === 'running' && timer.deadline !== null
    ? Math.max(0, timer.deadline - now)
    : timer.remaining
export function startTimer(timer: Timer, now: number): Timer {
  return { ...timer, state: 'running', deadline: now + timer.remaining }
}
export function pauseTimer(timer: Timer, now: number): Timer {
  return { ...timer, state: 'paused', remaining: remainingMs(timer, now), deadline: null }
}
export function restoreTimer(value: unknown): Timer | null {
  if (!value || typeof value !== 'object') return null
  const t = value as Timer
  if (
    !['focus', 'break'].includes(t.mode) ||
    !['idle', 'running', 'paused', 'completed'].includes(t.state)
  )
    return null
  if (
    ![t.duration, t.remaining].every((n) => Number.isFinite(n) && n >= 0 && n <= 10800000) ||
    t.duration < 60000 ||
    t.remaining > t.duration
  )
    return null
  if (t.state === 'running' && (!Number.isFinite(t.deadline) || t.deadline === null)) return null
  return { ...t }
}
