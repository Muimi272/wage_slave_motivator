import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'

// Exercises the actual Windows WebView2 application, using isolated project-local data.
const root = process.cwd()
const dataDir = path.join(root, '.qa', `desktop-${Date.now()}`)
const screenshots = path.join(root, 'artifacts', 'screenshots')
await mkdir(dataDir, { recursive: true })
await mkdir(screenshots, { recursive: true })
const executable = path.resolve(process.argv[2] || 'target/release/wage_slave_motivator.exe')
const port = 19327
const env = {
  ...process.env,
  MOTIVATOR_DATA_DIR: dataDir,
  WEBVIEW2_USER_DATA_FOLDER: path.join(dataDir, 'webview'),
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
}
const checks = []
let app
let browser
const errors = []
const launch = () => spawn(executable, [], { env, windowsHide: true, stdio: 'ignore' })

async function attach() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
        const context = browser.contexts()[0]
        const page = context.pages()[0] || (await context.waitForEvent('page'))
        await page.waitForSelector('.app-shell')
        page.on('pageerror', (error) => errors.push(error.message))
        return page
      }
    } catch (error) {
      if (attempt === 119) throw error
    }
    await delay(250)
  }
  throw new Error('WebView2 did not expose a ready application within 30 seconds')
}

async function expectVisible(locator) {
  await locator.waitFor({ state: 'visible' })
}
async function waitValue(page, predicate) {
  await page.waitForFunction(predicate)
}
async function native(page, command) {
  return page.evaluate(
    (command) => window.__TAURI_INTERNALS__.invoke(`plugin:window|${command}`, { label: 'main' }),
    command,
  )
}

try {
  app = launch()
  let page = await attach()
  await expectVisible(page.getByRole('heading', { name: '薪资与偏好.' }))
  assert.equal(await native(page, 'is_visible'), true)
  checks.push('Packaged application starts with real Tauri IPC and first-run configuration')
  await page.getByRole('button', { name: '今日概览', exact: true }).click()
  await page.screenshot({ path: path.join(screenshots, 'desktop-light.png') })

  await page.getByRole('button', { name: '薪资与偏好', exact: true }).click()
  await page.getByRole('spinbutton', { name: '税后月薪' }).fill('18000')
  await page.getByRole('spinbutton', { name: '专注时长' }).fill('1')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await expectVisible(page.getByRole('status'))
  assert.equal(
    JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8')).monthlySalary,
    18000,
  )
  await page.getByRole('spinbutton', { name: '税后月薪' }).fill('20000')
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await page.waitForFunction(() =>
    document.querySelector('[role="status"]')?.textContent.includes('设置已保存'),
  )
  // A second save verifies atomic replacement on Windows, not just initial creation.
  for (let attempt = 0; attempt < 30; attempt++) {
    if (
      JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8')).monthlySalary ===
      20000
    )
      break
    await delay(100)
  }
  assert.equal(
    JSON.parse(await readFile(path.join(dataDir, 'settings.json'), 'utf8')).monthlySalary,
    20000,
  )
  await page.reload()
  await page.getByRole('button', { name: '薪资与偏好', exact: true }).click()
  assert.equal(await page.getByRole('spinbutton', { name: '税后月薪' }).inputValue(), '20000')
  checks.push('Salary settings save, atomically replace, and reload through Rust')
  await page.screenshot({ path: path.join(screenshots, 'desktop-settings.png'), fullPage: true })

  await page.getByRole('button', { name: '切换深色模式', exact: true }).click()
  await waitValue(page, () => document.documentElement.dataset.theme === 'dark')
  await page.getByRole('button', { name: '今日概览', exact: true }).click()
  await page.screenshot({ path: path.join(screenshots, 'desktop-dark.png') })
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click()
  assert.equal(await page.getByTestId('earnings').innerText(), '••••')
  await page.getByRole('button', { name: '显示金额', exact: true }).click()
  checks.push('Dark theme and salary privacy')

  await page.getByRole('button', { name: '迷你模式', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: '展开主窗口', exact: true }))
  await waitValue(page, () => innerWidth <= 380 && innerHeight <= 180)
  assert.equal(await native(page, 'is_always_on_top'), true)
  assert.equal(await native(page, 'is_resizable'), false)
  await page.screenshot({ path: path.join(screenshots, 'desktop-mini.png') })
  await page.getByRole('button', { name: '展开主窗口', exact: true }).click()
  await expectVisible(page.getByRole('heading', { name: '今日概览.' }))
  await waitValue(page, () => innerWidth >= 860 && innerHeight >= 680)
  assert.equal(await native(page, 'is_always_on_top'), false)
  assert.equal(await native(page, 'is_resizable'), true)
  checks.push('Native compact dimensions, always-on-top, resize lock, and restoration')

  await page.getByRole('button', { name: '关闭到系统托盘', exact: true }).click()
  assert.equal(await native(page, 'is_visible'), false)
  const second = launch()
  await new Promise((resolve, reject) => {
    second.once('exit', resolve)
    second.once('error', reject)
    const timeout = setTimeout(() => reject(new Error('Second instance did not exit')), 10000)
    second.once('exit', () => clearTimeout(timeout))
  })
  assert.equal(await native(page, 'is_visible'), true)
  checks.push('Hide-to-tray and single-instance restoration')

  await page.getByRole('button', { name: '专注时钟', exact: true }).click()
  assert.equal(await page.getByRole('timer').innerText(), '01:00')
  await page.getByRole('button', { name: '开始专注', exact: true }).click()
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  const paused = await page.getByRole('timer').innerText()
  await page.reload()
  await page.getByRole('button', { name: '专注时钟', exact: true }).click()
  assert.equal(await page.getByRole('timer').innerText(), paused)
  await page.getByRole('button', { name: '继续专注', exact: true }).click()
  await page.screenshot({ path: path.join(screenshots, 'desktop-focus.png') })
  // Let the real one-minute timer finish; no mocked app clock or accelerated business logic.
  await page
    .getByRole('button', { name: '开始休息', exact: true })
    .waitFor({ state: 'visible', timeout: 65000 })
  assert.equal(await page.locator('.focus-stats > div').nth(0).locator('strong').innerText(), '1次')
  await page.reload()
  await page.getByRole('button', { name: '专注时钟', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: '开始休息', exact: true }))
  assert.equal(await page.locator('.focus-stats > div').nth(0).locator('strong').innerText(), '1次')
  await page.getByRole('button', { name: '开始休息', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: '暂停', exact: true }))
  await page.getByRole('button', { name: '重置计时', exact: true }).click()
  checks.push(
    'Real timer completion, pause/resume, reload recovery, exactly-once session recording, and break transition',
  )

  // Terminate and relaunch the process to verify persistence beyond a page reload.
  await browser.close()
  browser = undefined
  app.kill()
  await new Promise((resolve) => app.once('exit', resolve))
  app = launch()
  page = await attach()
  await waitValue(page, () => document.documentElement.dataset.theme === 'dark')
  await page.getByRole('button', { name: '薪资与偏好', exact: true }).click()
  assert.equal(await page.getByRole('spinbutton', { name: '税后月薪' }).inputValue(), '20000')
  checks.push('Full process restart preserves saved configuration and theme')
  assert.deepEqual(errors, [])
  const report = {
    passed: true,
    executable,
    checks,
    pageErrors: errors,
    timestamp: new Date().toISOString(),
  }
  await writeFile(
    path.join(root, 'artifacts', 'desktop-smoke.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
} finally {
  if (browser) await browser.close().catch(() => {})
  if (app && app.exitCode === null) app.kill()
}
