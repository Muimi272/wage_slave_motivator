# Wage Slave Motivator 1.2.0 · 牛马鼓励器

## Currency and rolling numbers

- Keep the salary in CNY and switch the display to CNY, VND, INR, ZWG, USD, or EUR.
- Store a manual display rate for each currency locally; no exchange-rate service is called.
- Show today's earnings to eight decimal places with digit-by-digit rolling motion.
- Respect the operating system's reduced-motion preference.

## 中文说明

- 工资统一按人民币保存，可切换显示人民币、越南盾、印度卢比、津巴布韦币、美元与欧元。
- 汇率在设置中手动填写并仅保存在本机，不请求联网汇率服务。
- 今日收入显示小数点后 8 位，并逐位平滑滚动。
- 系统开启“减少动态效果”时关闭数字动画。

本版保留原有工作日程、发薪倒计时、专注时钟、中英文界面、系统托盘与迷你窗口。旧版配置会自动补上人民币显示与参考汇率，不重置薪资或日程。

当前源码已完成前端类型检查、生产构建与 58 项前端测试。Windows 桌面包需要在安装 Rust stable、MSVC C++ Build Tools 与 Tauri 依赖的环境中构建；本目录尚未包含该构建产物。

English and Simplified Chinese now work throughout the dashboard, settings, focus timer, compact window, tray menu, notifications, and validation messages. Switch languages from the sidebar; changes apply immediately and survive restarts. System mode defaults to Chinese in Chinese locales and English elsewhere, including the `C` locale used by the AppImage catalog. Existing salary and schedule settings are preserved.

Linux AppImages now use the catalog’s recommended name: `Wage_Slave_Motivator-1.1.2-x86_64.AppImage`. Application and package metadata use an English name and description. Currency remains CNY in both languages.

## Downloads

- Windows x64: `wage_slave_motivator_1.1.2_windows_x64-setup.exe`
- macOS Universal (Apple Silicon and Intel): `wage_slave_motivator_1.1.2_macos_universal.dmg` and `.app.tar.gz`
- Linux x64: `wage_slave_motivator_1.1.2_linux_x64.deb` and `Wage_Slave_Motivator-1.1.2-x86_64.AppImage`
- `SHA256SUMS.txt`: SHA-256 checksums for all packages

Installers are unsigned; macOS packages are not notarized. All packages are built and checked on their respective platforms before publication.

## 中文说明

新增完整的中英文界面，覆盖概览、设置、专注、迷你窗口、托盘、通知与表单校验。侧栏语言选择器与原有按钮使用一致的图标、细边框与圆角样式。可即时切换 English、简体中文或跟随系统，选择自动保存，重启后保留。中文环境默认中文，其余环境回退英文。Linux 按 `LC_ALL`、`LC_MESSAGES`、`LANG` 的优先级读取语言；`C` 环境默认英文。

旧配置自动迁移，保留薪资与工作日程；币种仍为人民币。Linux AppImage 文件名及应用元数据按 AppImage 目录约定调整。

验证覆盖语言回退与优先级、旧配置迁移、持久化、前端类型与生产构建、Rust 配置校验与 Clippy，以及 Windows WebView2 实际程序中的语言切换、原生标题、计时、托盘与重启恢复。英文界面检查覆盖 1180×800、860×680 与 640×800 布局。
