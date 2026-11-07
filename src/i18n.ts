export type Locale = 'en' | 'zh-CN'
export type Language = 'system' | Locale

export function detectLocale(value: string | undefined): Locale {
  return /^zh(?:[-_.@]|$)/i.test(value || '') ? 'zh-CN' : 'en'
}

export function resolveLocale(language: Language, systemLocale: string): Locale {
  return language === 'system' ? detectLocale(systemLocale) : language
}

// Chinese keys keep the original copy next to each call site. English is the fallback.
export const english = {
  牛马鼓励器: 'Wage Slave Motivator',
  牛马: 'Wage',
  牛马鼓励器首页: 'Wage Slave Motivator home',
  工作空间: 'WORKSPACE',
  主导航: 'Main navigation',
  今日概览: 'Today',
  专注时钟: 'Focus timer',
  薪资与偏好: 'Salary & preferences',
  迷你模式: 'Compact mode',
  切换浅色模式: 'Switch to light theme',
  切换深色模式: 'Switch to dark theme',
  关于应用: 'About',
  最小化窗口: 'Minimize window',
  关闭到系统托盘: 'Close to system tray',
  展开主窗口: 'Expand window',
  隐藏到托盘: 'Hide to tray',
  显示金额: 'Show amounts',
  隐藏金额: 'Hide amounts',
  今日收入: 'Earned today',
  今日工资: 'Today’s earnings',
  本地时间: 'Local time',
  时薪: 'Hourly rate',
  当日目标: 'Daily target',
  秒: 's',
  今日进度: 'Daily progress',
  已计薪: 'Paid time',
  小时: 'h',
  工作日程: 'Work schedule',
  计薪时段: 'Paid hours',
  午休: 'Lunch',
  今日休息: 'Day off',
  今日工作已结束: 'Workday finished',
  距离上班: 'Until work starts',
  距离下班: 'Until work ends',
  '时 : 分': 'h : m',
  发薪倒计时: 'Next payday',
  天: 'days',
  日: 'day',
  发薪日: 'Payday',
  下次发薪: 'Next payment',
  本周预计收入: 'Weekly estimate',
  '按当前薪资与工作日推算；今天按实际时间计薪，未来日期暂不计入。':
    'Estimated from current salary and workdays; today uses elapsed paid time and future days are excluded.',
  '按当前设置推算，未来日期不计入': 'Estimate based on current settings, excluding future days',
  打开专注时钟: 'Open focus timer',
  '今日已完成 {count} 次专注': 'Completed today: {count} focus sessions',
  本地已就绪: 'Ready · offline',
  正在载入: 'Loading',
  'CNY · 人民币': 'CNY · Chinese yuan',
  计时模式: 'Timer mode',
  专注: 'Focus',
  休息: 'Break',
  剩余时间: 'Time remaining',
  已暂停: 'Paused',
  已完成: 'Completed',
  '{count} 分钟': '{count} min',
  重置计时: 'Reset timer',
  编辑专注时长: 'Edit timer duration',
  今日完成: 'Completed today',
  次: 'sessions',
  累计专注: 'Focused today',
  今日专注: 'Focused today',
  分钟: 'min',
  仅存储于本机: 'Stored on this device',
  薪资设置: 'Salary',
  税后月薪: 'Net monthly salary',
  月计薪天数: 'Paid days per month',
  每月发薪日: 'Monthly payday',
  上班时间: 'Work starts',
  下班时间: 'Work ends',
  每周工作日: 'Workdays',
  午休暂停计薪: 'Unpaid lunch break',
  午休开始: 'Lunch starts',
  午休结束: 'Lunch ends',
  专注与提醒: 'Focus & reminders',
  专注时长: 'Focus duration',
  休息时长: 'Break duration',
  '午休、下班与专注结束提醒': 'Lunch, end-of-work & timer reminders',
  系统提醒: 'System notifications',
  外观: 'Appearance',
  浅色: 'Light',
  深色: 'Dark',
  跟随系统: 'System',
  撤销修改: 'Undo changes',
  '保存中…': 'Saving…',
  保存设置: 'Save settings',
  关闭关于: 'Close about dialog',
  迷你窗口: 'Compact window',
  始终置顶: 'Always on top',
  关闭窗口: 'Close window',
  保留在系统托盘: 'Keep in system tray',
  退出应用: 'Quit application',
  '系统托盘 → 退出': 'System tray → Quit',
  完成: 'Done',
  专注完成: 'Focus complete',
  休息结束: 'Break complete',
  专注时间: 'Focus time',
  休息时间: 'Break time',
  计薪中: 'Earning',
  休息日: 'Day off',
  未上班: 'Before work',
  已下班: 'After work',
  午休中: 'Lunch break',
  '本地记录保存失败，请检查磁盘空间': 'Could not save local records. Check available disk space.',
  系统通知发送失败: 'Could not send the system notification.',
  '专注完成，休息一下': 'Focus complete. Time for a break.',
  '本次专注已记录。': 'Your focus session has been recorded.',
  '可以开始下一次专注了。': 'You can start your next focus session.',
  午休时间到了: 'Time for lunch',
  '暂时放下工作，好好吃饭。': 'Take a break and enjoy your meal.',
  下班时间到了: 'Your workday is over',
  '今日收入 ¥{amount}。': 'Earned today: CNY {amount}.',
  '主题保存失败，请重试': 'Could not save the theme. Please try again.',
  '窗口切换失败，请重试': 'Could not switch window mode. Please try again.',
  窗口操作失败: 'The window action failed.',
  '通知权限未开启，请在系统设置中允许通知，或关闭提醒后保存':
    'Allow notifications in system settings, or turn off reminders before saving.',
  设置已保存: 'Settings saved',
  '保存失败，请检查本地存储权限后重试':
    'Could not save settings. Check local storage permissions and try again.',
  暂停: 'Pause',
  继续专注: 'Resume',
  开始休息: 'Start break',
  开始专注: 'Start focus',
  '设置读取失败，已使用默认值；可在设置中重新保存':
    'Could not read settings. Defaults are in use; save your preferences to replace them.',
  '窗口事件初始化失败，请重新启动应用':
    'Could not initialize window events. Restart the application.',
  语言: 'Language',
  跟随系统语言: 'System language',
  '语言保存失败，请重试': 'Could not save the language. Please try again.',
  '月薪须在 0 至 100,000,000 元之间': 'Monthly salary must be above 0 and at most CNY 100,000,000.',
  '月计薪天数须在 1 至 31 天之间': 'Paid days per month must be between 1 and 31.',
  '发薪日须在 1 至 31 日之间': 'Payday must be a whole day between 1 and 31.',
  请输入有效时间: 'Enter valid times.',
  '下班时间须晚于上班时间（同一天）': 'Work must end after it starts, within the same day.',
  '午休须位于工作时段内，并保留有效工作时间':
    'Lunch must fall within the workday and leave some paid working time.',
  请至少选择一个工作日: 'Select at least one valid workday, without duplicates.',
  '专注与休息时长须在 1 至 180 分钟之间':
    'Focus and break durations must be whole minutes between 1 and 180.',
  设置格式无效: 'Invalid settings format.',
} as const

export type Message = keyof typeof english

export function translate(
  locale: Locale,
  key: Message,
  params: Record<string, string | number> = {},
) {
  const text = locale === 'zh-CN' ? key : english[key]
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function weekdays(locale: Locale, long = false) {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: long ? 'long' : 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 1 + index)),
    ),
  )
}
