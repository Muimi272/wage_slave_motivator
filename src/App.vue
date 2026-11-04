<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { version } from '../package.json'
import { isTauri, invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  ArrowDownLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Eye,
  EyeOff,
  Expand,
  LayoutDashboard,
  Minimize2,
  Minus,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sprout,
  Sun,
  TimerReset,
  X,
} from 'lucide-vue-next'
import {
  atTime,
  dayKey,
  defaults,
  durationText,
  earnings,
  paydayInfo,
  validateConfig,
  weekEarnings,
  type Config,
} from './domain'
import { loadConfig, persistConfig } from './persistence'
import { newTimer, pauseTimer, remainingMs, restoreTimer, startTimer, type Timer } from './timer'

const config = ref<Config>(structuredClone(defaults))
const draft = reactive<Config>(structuredClone(defaults))
const now = ref(new Date())
const view = ref<'today' | 'focus' | 'settings'>('today')
const compact = ref(false)
const ready = ref(false)
const saving = ref(false)
const formError = ref('')
const toast = ref('')
const privacy = ref(false)
const about = ref(false)
const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
const timer = ref<Timer>(newTimer(defaults.focusMinutes))
const sessions = ref<Record<string, { count: number; minutes: number }>>({})
const systemDark = ref(matchMedia('(prefers-color-scheme: dark)').matches)
const colorScheme = matchMedia('(prefers-color-scheme: dark)')
const isDark = computed(
  () => config.value.theme === 'dark' || (config.value.theme === 'system' && systemDark.value),
)
const wage = computed(() => earnings(config.value, now.value))
const payday = computed(() => paydayInfo(config.value, now.value))
const week = computed(() => weekEarnings(config.value, now.value))
const weekTotal = computed(() => week.value.reduce((sum, day) => sum + day.amount, 0))
const currentSessions = computed(
  () => sessions.value[dayKey(now.value)] || { count: 0, minutes: 0 },
)
const timerRemaining = computed(() => remainingMs(timer.value, now.value.getTime()))
const timerProgress = computed(() =>
  Math.min(1, Math.max(0, 1 - timerRemaining.value / timer.value.duration)),
)
const money = (amount: number, decimals = 2) =>
  privacy.value
    ? '••••'
    : new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount)
const dateLabel = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
)
const englishDate = computed(() =>
  now.value
    .toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
    .toUpperCase(),
)
const clock = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const timerLabel = computed(() =>
  timer.value.state === 'completed'
    ? timer.value.mode === 'focus'
      ? '专注完成'
      : '休息结束'
    : timer.value.mode === 'focus'
      ? '专注时间'
      : '休息时间',
)
const statusActive = computed(() => wage.value.status === '计薪中')
const unlisteners: UnlistenFn[] = []
let ticker: ReturnType<typeof setInterval> | undefined
let toastTimeout: ReturnType<typeof setTimeout> | undefined
let previousTick = Date.now()

function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toast.value = ''
  }, 4500)
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(`motivator.${key}`, JSON.stringify(value))
  } catch {
    notify('本地记录保存失败，请检查磁盘空间')
  }
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`motivator.${key}`) || 'null')
  } catch {
    return null
  }
}

function persistFocus() {
  store('focus', { timer: timer.value, sessions: sessions.value })
}

async function desktopNotification(title: string, body: string) {
  if (!config.value.notifications || !isTauri()) return
  try {
    const { isPermissionGranted, sendNotification } =
      await import('@tauri-apps/plugin-notification')
    if (await isPermissionGranted()) sendNotification({ title, body })
  } catch {
    notify('系统通知发送失败')
  }
}

function tick() {
  const timestamp = Date.now()
  now.value = new Date(timestamp)
  if (timer.value.state === 'running' && remainingMs(timer.value, timestamp) === 0) {
    const completedAt = new Date(timer.value.deadline!)
    if (timer.value.mode === 'focus') {
      const key = dayKey(completedAt)
      const old = sessions.value[key] || { count: 0, minutes: 0 }
      sessions.value[key] = {
        count: old.count + 1,
        minutes: old.minutes + timer.value.duration / 60000,
      }
    }
    timer.value = { ...timer.value, state: 'completed', remaining: 0, deadline: null }
    persistFocus()
    const title = timer.value.mode === 'focus' ? '专注完成，休息一下' : '休息结束'
    notify(title)
    void desktopNotification(
      title,
      timer.value.mode === 'focus' ? '本次专注已记录。' : '可以开始下一次专注了。',
    )
  }
  if (ready.value && config.value.notifications && wage.value.workingDay) {
    const events = [
      ...(config.value.lunchEnabled
        ? [
            {
              time: config.value.lunchStart,
              title: '午休时间到了',
              body: '暂时放下工作，好好吃饭。',
            },
          ]
        : []),
      {
        time: config.value.workEnd,
        title: '下班时间到了',
        body: `今日收入 ¥${money(wage.value.amount)}。`,
      },
    ]
    for (const event of events) {
      const boundary = atTime(now.value, event.time)
      if (previousTick < boundary && timestamp >= boundary && timestamp - boundary < 300000) {
        notify(event.title)
        void desktopNotification(event.title, event.body)
      }
    }
  }
  previousTick = timestamp
}

function navigate(target: typeof view.value) {
  view.value = target
  about.value = false
}

async function toggleTheme() {
  const next: Config = { ...config.value, theme: isDark.value ? 'light' : 'dark' }
  try {
    await persistConfig(next)
    config.value = next
    draft.theme = next.theme
  } catch {
    notify('主题保存失败，请重试')
  }
}

function togglePrivacy() {
  privacy.value = !privacy.value
  store('privacy', privacy.value)
}

async function toggleCompact() {
  try {
    if (isTauri()) await invoke('set_compact', { compact: !compact.value })
    else compact.value = !compact.value
  } catch {
    notify('窗口切换失败，请重试')
  }
}

async function windowAction(action: 'hide' | 'minimize') {
  if (!isTauri()) return
  try {
    await getCurrentWindow()[action]()
  } catch {
    notify('窗口操作失败')
  }
}

function toggleWorkday(day: number) {
  draft.workdays = draft.workdays.includes(day)
    ? draft.workdays.filter((d) => d !== day)
    : [...draft.workdays, day].sort()
}

async function saveSettings() {
  formError.value = validateConfig(draft) || ''
  if (formError.value) return
  saving.value = true
  try {
    if (draft.notifications && isTauri()) {
      const { isPermissionGranted, requestPermission } =
        await import('@tauri-apps/plugin-notification')
      if (!(await isPermissionGranted()) && (await requestPermission()) !== 'granted') {
        formError.value = '通知权限未开启，请在系统设置中允许通知，或关闭提醒后保存'
        return
      }
    }
    await persistConfig(draft)
    config.value = JSON.parse(JSON.stringify(draft))
    if (timer.value.state === 'idle') resetTimer(timer.value.mode)
    notify('设置已保存')
  } catch {
    formError.value = '保存失败，请检查本地存储权限后重试'
  } finally {
    saving.value = false
  }
}

function cancelSettings() {
  Object.assign(draft, JSON.parse(JSON.stringify(config.value)))
  formError.value = ''
}

function resetTimer(mode: Timer['mode'] = timer.value.mode) {
  timer.value = newTimer(
    mode === 'focus' ? config.value.focusMinutes : config.value.breakMinutes,
    mode,
  )
  persistFocus()
}

function timerAction() {
  if (timer.value.state === 'completed')
    resetTimer(timer.value.mode === 'focus' ? 'break' : 'focus')
  timer.value =
    timer.value.state === 'running'
      ? pauseTimer(timer.value, Date.now())
      : startTimer(timer.value, Date.now())
  now.value = new Date()
  persistFocus()
}

const timerActionLabel = computed(() =>
  timer.value.state === 'running'
    ? '暂停'
    : timer.value.state === 'paused'
      ? '继续专注'
      : timer.value.state === 'completed'
        ? timer.value.mode === 'focus'
          ? '开始休息'
          : '开始专注'
        : timer.value.mode === 'focus'
          ? '开始专注'
          : '开始休息',
)

watch(
  isDark,
  (value) => {
    document.documentElement.dataset.theme = value ? 'dark' : 'light'
  },
  { immediate: true },
)
watch(about, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement
    await nextTick()
    dialog.value?.querySelector<HTMLButtonElement>('button')?.focus()
  } else {
    previousFocus?.focus()
  }
})
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const buttons = dialog.value.querySelectorAll<HTMLButtonElement>('button')
  const first = buttons[0],
    last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
const onColorScheme = (event: MediaQueryListEvent) => {
  systemDark.value = event.matches
}
const onVisibility = () => {
  if (!document.hidden) tick()
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    about.value = false
    if (compact.value) void toggleCompact()
  }
}

onMounted(async () => {
  try {
    const saved = await loadConfig()
    if (saved) config.value = saved
    else view.value = 'settings'
    Object.assign(draft, JSON.parse(JSON.stringify(config.value)))
  } catch {
    view.value = 'settings'
    notify('设置读取失败，已使用默认值；可在设置中重新保存')
  }
  privacy.value = read('privacy') === true
  const savedFocus = read('focus') as { timer?: unknown; sessions?: unknown } | null
  const savedSessions = savedFocus?.sessions ?? read('sessions')
  if (savedSessions && typeof savedSessions === 'object' && !Array.isArray(savedSessions)) {
    sessions.value = Object.fromEntries(
      Object.entries(savedSessions).filter(
        ([key, value]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(key) &&
          value &&
          Number.isInteger(value.count) &&
          value.count >= 0 &&
          Number.isFinite(value.minutes) &&
          value.minutes >= 0,
      ),
    )
  }
  timer.value =
    restoreTimer(savedFocus?.timer ?? read('timer')) || newTimer(config.value.focusMinutes)
  if (isTauri()) {
    try {
      unlisteners.push(
        await listen<boolean>('compact-changed', (event) => {
          compact.value = event.payload
        }),
      )
      unlisteners.push(await listen('navigate-settings', () => navigate('settings')))
    } catch {
      notify('窗口事件初始化失败，请重新启动应用')
    }
    try {
      await getCurrentWindow().show()
    } catch {
      /* Window may already be visible. */
    }
  }
  ready.value = true
  tick()
  ticker = setInterval(tick, 100)
  colorScheme.addEventListener('change', onColorScheme)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  clearInterval(ticker)
  clearTimeout(toastTimeout)
  unlisteners.forEach((fn) => fn())
  colorScheme.removeEventListener('change', onColorScheme)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="compact" class="mini-window">
    <div class="mini-title" data-tauri-drag-region>
      <span class="mini-brand"><Sprout :size="16" /> 今日收入</span>
      <div class="window-actions">
        <button class="icon-button" aria-label="展开主窗口" @click="toggleCompact">
          <Expand :size="15" /></button
        ><button class="icon-button" aria-label="隐藏到托盘" @click="windowAction('hide')">
          <Minus :size="15" />
        </button>
      </div>
    </div>
    <div
      class="mini-amount"
      :class="{ 'large-value': money(wage.amount).length > 10 }"
      data-tauri-drag-region
    >
      <span>¥</span>{{ money(wage.amount)
      }}<button
        class="icon-button"
        :aria-label="privacy ? '显示金额' : '隐藏金额'"
        @click="togglePrivacy"
      >
        <component :is="privacy ? EyeOff : Eye" :size="16" />
      </button>
    </div>
    <div class="mini-bottom">
      <span class="status"><i :class="{ active: statusActive }" />{{ wage.status }}</span
      ><span
        >{{ (wage.progress * 100).toFixed(0) }}%<span class="mini-divider">/</span>¥{{
          money(wage.daily)
        }}</span
      >
    </div>
    <div class="mini-progress"><span :style="{ width: `${wage.progress * 100}%` }" /></div>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" aria-label="牛马鼓励器首页" @click.prevent="navigate('today')"
        ><span class="brand-icon"><Sprout :size="25" :stroke-width="1.7" /></span
        ><span>牛马<span class="brand-sub">MOTIVATOR</span></span></a
      >
      <div class="nav-caption">工作空间</div>
      <nav aria-label="主导航">
        <button :class="['nav-item', { selected: view === 'today' }]" @click="navigate('today')">
          <LayoutDashboard :size="18" /><span>今日概览</span
          ><span v-if="view === 'today'" class="nav-dot" />
        </button>
        <button :class="['nav-item', { selected: view === 'focus' }]" @click="navigate('focus')">
          <TimerReset :size="19" /><span>专注时钟</span
          ><span v-if="timer.state === 'running'" class="running-dot" />
        </button>
        <button
          :class="['nav-item', { selected: view === 'settings' }]"
          @click="navigate('settings')"
        >
          <Settings2 :size="18" /><span>薪资与偏好</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="mini-launch" @click="toggleCompact">
          <Minimize2 :size="17" /><span>迷你模式</span><ArrowDownLeft :size="14" />
        </button>
        <div class="sidebar-tools">
          <button
            class="icon-button"
            :aria-label="isDark ? '切换浅色模式' : '切换深色模式'"
            :title="isDark ? '切换浅色模式' : '切换深色模式'"
            @click="toggleTheme"
          >
            <component :is="isDark ? Sun : Moon" :size="18" /></button
          ><span class="version">v{{ version }}</span
          ><button class="icon-button" aria-label="关于应用" @click="about = true">
            <CircleHelp :size="17" />
          </button>
        </div>
      </div>
    </aside>

    <div class="main-shell">
      <header class="titlebar" data-tauri-drag-region>
        <span class="titlebar-label" data-tauri-drag-region
          >牛马鼓励器<span class="titlebar-separator">/</span
          >{{ view === 'today' ? '今日概览' : view === 'focus' ? '专注时钟' : '薪资与偏好' }}</span
        >
        <div class="window-actions">
          <button class="icon-button" aria-label="最小化窗口" @click="windowAction('minimize')">
            <Minus :size="16" /></button
          ><button
            class="icon-button close-button"
            aria-label="关闭到系统托盘"
            title="关闭到系统托盘"
            @click="windowAction('hide')"
          >
            <X :size="16" />
          </button>
        </div>
      </header>

      <main v-if="view === 'today'" class="page dashboard">
        <div class="page-heading">
          <div>
            <p class="eyebrow">{{ englishDate }}</p>
            <h1>今日概览<span class="heading-dot">.</span></h1>
          </div>
          <div class="live-clock">
            <span class="clock-icon"><Clock3 :size="15" /></span><span>{{ clock }}</span
            ><span class="timezone">本地时间</span>
          </div>
        </div>

        <section class="earnings-card" aria-label="今日工资">
          <div class="earnings-main">
            <div class="card-topline">
              <span class="section-label">今日收入</span
              ><button
                class="icon-button"
                :aria-label="privacy ? '显示金额' : '隐藏金额'"
                @click="togglePrivacy"
              >
                <component :is="privacy ? EyeOff : Eye" :size="17" />
              </button>
            </div>
            <div class="earnings-amount" :class="{ 'large-value': money(wage.amount).length > 10 }">
              <span class="currency">¥</span
              ><span data-testid="earnings">{{ money(wage.amount) }}</span>
            </div>
            <div class="earnings-meta">
              <span class="status"><i :class="{ active: statusActive }" />{{ wage.status }}</span
              ><span class="meta-divider" /><span
                >时薪 <strong>¥{{ money(wage.hourly) }}</strong></span
              >
            </div>
            <div class="earnings-baseline">
              <span
                >当日目标 <strong>¥{{ money(wage.daily) }}</strong></span
              ><span class="per-second">+ ¥{{ money(wage.hourly / 3600, 4) }} / 秒</span>
            </div>
          </div>
          <div class="day-progress">
            <div class="progress-top"><span>今日进度</span><ArrowRight :size="18" /></div>
            <div class="progress-number">{{ Math.floor(wage.progress * 100) }}<span>%</span></div>
            <div class="progress-track"><span :style="{ width: `${wage.progress * 100}%` }" /></div>
            <div class="progress-footer">
              <span>已计薪 {{ (wage.paidMs / 3600000).toFixed(1) }} 小时</span
              ><span>/ {{ (wage.duration / 3600000).toFixed(1) }} h</span>
            </div>
          </div>
        </section>

        <div class="middle-grid">
          <section class="schedule-card card">
            <div class="section-heading">
              <h2>工作日程</h2>
              <span class="small-muted">{{ dateLabel }}</span>
            </div>
            <div class="schedule-hours">
              <span>{{ config.workStart }}</span
              ><span>{{ config.workEnd }}</span>
            </div>
            <div class="schedule-track">
              <div
                class="schedule-elapsed"
                :style="{
                  width: `${Math.min(100, Math.max(0, ((now.getTime() - wage.start) / (wage.end - wage.start)) * 100))}%`,
                }"
              />
              <div
                v-if="config.lunchEnabled"
                class="schedule-lunch"
                :style="{
                  left: `${((atTime(now, config.lunchStart) - wage.start) / (wage.end - wage.start)) * 100}%`,
                  width: `${((atTime(now, config.lunchEnd) - atTime(now, config.lunchStart)) / (wage.end - wage.start)) * 100}%`,
                }"
              />
              <span
                v-if="wage.workingDay && now.getTime() >= wage.start && now.getTime() <= wage.end"
                class="schedule-now"
                :style="{
                  left: `${((now.getTime() - wage.start) / (wage.end - wage.start)) * 100}%`,
                }"
              />
            </div>
            <div class="schedule-legend">
              <span><i class="legend-work" />计薪时段</span
              ><span v-if="config.lunchEnabled"
                ><i class="legend-lunch" />午休 {{ config.lunchStart }} –
                {{ config.lunchEnd }}</span
              >
            </div>
            <div class="offwork">
              <span class="offwork-label"
                ><span class="soft-icon"><Coffee :size="18" /></span
                >{{
                  !wage.workingDay
                    ? '今日休息'
                    : wage.status === '已下班'
                      ? '今日工作已结束'
                      : wage.status === '未上班'
                        ? '距离上班'
                        : '距离下班'
                }}</span
              ><strong
                >{{
                  !wage.workingDay || wage.status === '已下班'
                    ? '— —'
                    : durationText(
                        wage.status === '未上班' ? wage.start - now.getTime() : wage.remaining,
                      )
                }}<small v-if="wage.workingDay && wage.status !== '已下班'">时 : 分</small></strong
              >
            </div>
          </section>
          <section class="payday-card card">
            <div class="section-heading">
              <h2>发薪倒计时</h2>
              <span class="soft-icon"><Bell :size="16" /></span>
            </div>
            <div class="payday-number">{{ payday.days }}<span>天</span></div>
            <div class="payday-bottom">
              <span>{{
                payday.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
              }}</span
              ><span class="payday-tag">{{ payday.days === 0 ? '发薪日' : '下次发薪' }}</span>
            </div>
          </section>
        </div>

        <div class="bottom-grid">
          <section class="week-card card">
            <div class="section-heading">
              <h2>
                本周预计收入
                <span
                  class="info-hint"
                  title="按当前薪资与工作日推算；今天按实际时间计薪，未来日期暂不计入。"
                  aria-label="按当前设置推算，未来日期不计入"
                  ><CircleHelp :size="13"
                /></span>
              </h2>
              <span class="week-total">¥{{ money(weekTotal) }}</span>
            </div>
            <div class="week-chart">
              <div
                v-for="(day, index) in week"
                :key="index"
                :class="['chart-column', { today: day.isToday, future: day.future }]"
                :title="`${day.day.toLocaleDateString('zh-CN')}：¥${money(day.amount)}`"
              >
                <div class="bar-slot">
                  <span v-if="day.isToday" class="bar-today-dot" />
                  <div
                    :class="['chart-bar', { 'bar-empty': day.amount === 0 }]"
                    :style="{ height: `${Math.max(5, (day.amount / wage.daily) * 76)}px` }"
                  />
                </div>
                <span>{{ ['一', '二', '三', '四', '五', '六', '日'][index] }}</span>
              </div>
            </div>
          </section>
          <section class="quick-focus card">
            <div class="section-heading">
              <h2>专注时钟</h2>
              <button class="icon-button" aria-label="打开专注时钟" @click="navigate('focus')">
                <ArrowRight :size="17" />
              </button>
            </div>
            <div class="quick-focus-body">
              <div>
                <div class="quick-timer">{{ durationText(timerRemaining, true) }}</div>
                <span class="small-muted">{{
                  timer.state === 'idle'
                    ? '今日已完成 ' + currentSessions.count + ' 次专注'
                    : timerLabel
                }}</span>
              </div>
              <button class="play-button" :aria-label="timerActionLabel" @click="timerAction">
                <component
                  :is="timer.state === 'running' ? Pause : Play"
                  :size="21"
                  :fill="timer.state === 'running' ? 'none' : 'currentColor'"
                />
              </button>
            </div>
            <div class="focus-ticks">
              <span v-for="n in 18" :key="n" :class="{ filled: n / 18 <= timerProgress }" />
            </div>
          </section>
        </div>
        <footer class="page-footer">
          <span><span class="footer-dot" />{{ ready ? '本地已就绪' : '正在载入' }}</span
          ><span>CNY · 人民币</span>
        </footer>
      </main>

      <main v-else-if="view === 'focus'" class="page focus-page">
        <div class="page-heading">
          <div>
            <p class="eyebrow">FOCUS & REST</p>
            <h1>专注时钟<span class="heading-dot">.</span></h1>
          </div>
          <span class="small-muted">{{ dateLabel }}</span>
        </div>
        <section class="focus-stage card">
          <div class="segmented mode-switch" aria-label="计时模式">
            <button
              :class="{ chosen: timer.mode === 'focus' }"
              :disabled="timer.state === 'running' || timer.state === 'paused'"
              @click="resetTimer('focus')"
            >
              <TimerReset :size="16" />专注</button
            ><button
              :class="{ chosen: timer.mode === 'break' }"
              :disabled="timer.state === 'running' || timer.state === 'paused'"
              @click="resetTimer('break')"
            >
              <Coffee :size="16" />休息
            </button>
          </div>
          <div class="timer-ring">
            <svg viewBox="0 0 300 300" aria-hidden="true">
              <circle class="ring-background" cx="150" cy="150" r="138" />
              <circle
                class="ring-progress"
                cx="150"
                cy="150"
                r="138"
                :style="{ strokeDashoffset: 867.08 * (1 - timerProgress) }"
              />
            </svg>
            <div class="timer-center">
              <span class="timer-status"
                ><i :class="{ active: timer.state === 'running' }" />{{ timerLabel }}</span
              >
              <div class="focus-digits" role="timer" aria-label="剩余时间">
                {{ durationText(timerRemaining, true) }}
              </div>
              <span class="small-muted">{{
                timer.state === 'paused'
                  ? '已暂停'
                  : timer.state === 'completed'
                    ? '已完成'
                    : `${timer.duration / 60000} 分钟`
              }}</span>
            </div>
          </div>
          <div class="timer-controls">
            <button
              class="icon-button reset-timer"
              aria-label="重置计时"
              title="重置计时"
              @click="resetTimer()"
            >
              <RotateCcw :size="19" /></button
            ><button class="primary-button timer-primary" @click="timerAction">
              <component :is="timer.state === 'running' ? Pause : Play" :size="17" />{{
                timerActionLabel
              }}</button
            ><button
              class="icon-button reset-timer"
              aria-label="编辑专注时长"
              title="编辑专注时长"
              @click="navigate('settings')"
            >
              <Settings2 :size="19" />
            </button>
          </div>
        </section>
        <div class="focus-stats">
          <div>
            <span class="small-muted">今日完成</span
            ><strong>{{ currentSessions.count }}<small>次</small></strong>
          </div>
          <div>
            <span class="small-muted">今日专注</span
            ><strong>{{ currentSessions.minutes }}<small>分钟</small></strong>
          </div>
          <div>
            <span class="small-muted">今日收入</span
            ><strong class="focus-earned" :class="{ 'large-value': money(wage.amount).length > 10 }"
              >¥{{ money(wage.amount) }}</strong
            >
          </div>
        </div>
      </main>

      <main v-else class="page settings-page">
        <div class="page-heading">
          <div>
            <p class="eyebrow">PREFERENCES</p>
            <h1>薪资与偏好<span class="heading-dot">.</span></h1>
          </div>
          <span class="local-badge"><span class="footer-dot" />仅存储于本机</span>
        </div>
        <form @submit.prevent="saveSettings" novalidate>
          <section class="settings-section">
            <div class="settings-section-title">
              <span class="section-index">01</span>
              <h2>薪资设置</h2>
            </div>
            <div class="form-grid three-columns">
              <label
                >税后月薪<span class="input-with-unit"
                  ><span>¥</span
                  ><input
                    v-model.number="draft.monthlySalary"
                    type="number"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    required
                    aria-label="税后月薪" /></span></label
              ><label
                >月计薪天数<span class="input-with-unit"
                  ><input
                    v-model.number="draft.workDaysPerMonth"
                    type="number"
                    min="1"
                    max="31"
                    step="0.01"
                    required
                    aria-label="月计薪天数"
                  /><span>天</span></span
                ></label
              ><label
                >每月发薪日<span class="input-with-unit"
                  ><input
                    v-model.number="draft.payday"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    required
                    aria-label="每月发薪日"
                  /><span>日</span></span
                ></label
              >
            </div>
          </section>
          <section class="settings-section">
            <div class="settings-section-title">
              <span class="section-index">02</span>
              <h2>工作日程</h2>
            </div>
            <div class="form-grid">
              <label>上班时间<input v-model="draft.workStart" type="time" required /></label
              ><label>下班时间<input v-model="draft.workEnd" type="time" required /></label>
            </div>
            <fieldset class="workdays-field">
              <legend>每周工作日</legend>
              <div class="workday-buttons">
                <button
                  v-for="(label, index) in ['一', '二', '三', '四', '五', '六', '日']"
                  :key="index"
                  type="button"
                  :aria-label="`星期${label}`"
                  :aria-pressed="draft.workdays.includes((index + 1) % 7)"
                  :class="{ chosen: draft.workdays.includes((index + 1) % 7) }"
                  @click="toggleWorkday((index + 1) % 7)"
                >
                  {{ label }}<Check v-if="draft.workdays.includes((index + 1) % 7)" :size="11" />
                </button>
              </div>
            </fieldset>
            <div class="setting-toggle-row">
              <span>午休暂停计薪</span
              ><button
                type="button"
                class="switch"
                role="switch"
                :aria-checked="draft.lunchEnabled"
                aria-label="午休暂停计薪"
                @click="draft.lunchEnabled = !draft.lunchEnabled"
              >
                <span />
              </button>
            </div>
            <div v-if="draft.lunchEnabled" class="form-grid lunch-inputs">
              <label>午休开始<input v-model="draft.lunchStart" type="time" required /></label
              ><label>午休结束<input v-model="draft.lunchEnd" type="time" required /></label>
            </div>
          </section>
          <section class="settings-section">
            <div class="settings-section-title">
              <span class="section-index">03</span>
              <h2>专注与提醒</h2>
            </div>
            <div class="form-grid">
              <label
                >专注时长<span class="input-with-unit"
                  ><input
                    v-model.number="draft.focusMinutes"
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    required
                    aria-label="专注时长"
                  /><span>分钟</span></span
                ></label
              ><label
                >休息时长<span class="input-with-unit"
                  ><input
                    v-model.number="draft.breakMinutes"
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    required
                    aria-label="休息时长"
                  /><span>分钟</span></span
                ></label
              >
            </div>
            <div class="setting-toggle-row">
              <span>午休、下班与专注结束提醒</span
              ><button
                type="button"
                class="switch"
                role="switch"
                :aria-checked="draft.notifications"
                aria-label="系统提醒"
                @click="draft.notifications = !draft.notifications"
              >
                <span />
              </button>
            </div>
          </section>
          <section class="settings-section appearance-section">
            <div class="settings-section-title">
              <span class="section-index">04</span>
              <h2>外观</h2>
            </div>
            <div class="segmented theme-options">
              <button
                v-for="option in [
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                  { value: 'system', label: '跟随系统' },
                ]"
                :key="option.value"
                type="button"
                :aria-pressed="draft.theme === option.value"
                :class="{ chosen: draft.theme === option.value }"
                @click="draft.theme = option.value as Config['theme']"
              >
                {{ option.label }}
              </button>
            </div>
          </section>
          <div class="settings-actions">
            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
            <div>
              <button type="button" class="secondary-button" @click="cancelSettings">
                撤销修改</button
              ><button type="submit" class="primary-button" :disabled="saving">
                <Check :size="16" />{{ saving ? '保存中…' : '保存设置' }}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  </div>

  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      <Check :size="16" />{{ toast }}
    </div></Transition
  >
  <div v-if="about" class="modal-backdrop" @click.self="about = false">
    <section
      ref="dialog"
      class="about-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      @keydown="trapFocus"
    >
      <button class="icon-button modal-close" aria-label="关闭关于" @click="about = false">
        <X :size="18" /></button
      ><span class="about-logo"><Sprout :size="36" /></span>
      <h2 id="about-title">牛马鼓励器</h2>
      <p>MOTIVATOR / {{ version }}</p>
      <div class="about-shortcuts">
        <span>迷你窗口</span><span>始终置顶</span><span>关闭窗口</span><span>保留在系统托盘</span
        ><span>退出应用</span><span>系统托盘 → 退出</span>
      </div>
      <button class="primary-button" @click="about = false">完成<ChevronRight :size="16" /></button>
    </section>
  </div>
</template>
