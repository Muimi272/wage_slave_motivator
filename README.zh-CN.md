# 牛马鼓励器

[English](README.md) · [下载最新版本](https://github.com/Muimi272/wage_slave_motivator/releases/latest)

Rust + Tauri 2 + Vue 3 + TypeScript 桌面应用。实时显示当日工资，提供工作日程、发薪倒计时、专注时钟与置顶迷你窗口。无账号、无遥测，离线运行。

![浅色界面预览](docs/preview.png)

## 开发

需要 Node.js 22.12+、Rust stable 和 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)。Windows 需要 MSVC C++ Build Tools 与 WebView2。

```sh
npm ci
npm run tauri dev
```

仅预览界面：`npm run dev`，打开 `http://127.0.0.1:1420`。浏览器预览使用 localStorage；桌面版薪资与偏好由 Rust 原子写入系统应用配置目录中的 `settings.json`。专注状态、专注完成记录与金额隐藏偏好存于 WebView 本地存储。所有功能均无需远程服务。

## 校验与打包

```sh
npm test
npm run build
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
npm run tauri build
```

Windows 安装包在 `target/release/bundle/nsis/`，独立程序在 `target/release/wage_slave_motivator.exe`。安装包使用当前用户安装，无需管理员权限；缺少 WebView2 时安装器会引导安装。分发前可按需配置代码签名；本地构建的安装包未签名。

`npm run test:desktop` 在 Windows 上启动真实的发行版程序进行冒烟测试，包括一分钟的自然计时结束。数据隔离于项目 `.qa/`，截图与报告写入 `artifacts/`。需先完成发行版构建，运行测试时请退出其他已运行的牛马鼓励器。

`npm run release:windows` 构建后将安装器、独立程序、许可证、发行说明和 SHA-256 校验文件整理至 `artifacts/release/`。

## 使用

- 在「薪资与偏好」设置税后月薪、月计薪天数、工作日、工作时间、午休及发薪日。
- 首次启动直接打开设置。设置文件可通过绝对路径环境变量 `MOTIVATOR_DATA_DIR` 指定其他存储目录。
- 日薪 = 月薪 ÷ 月计薪天数；时薪 = 日薪 ÷ 每日有效工作小时。仅在选定工作日计薪，启用午休后午休不计薪。当前版本支持同日班次。
- 金额按系统绝对时间计算，休眠恢复后自动校准。当日收入在午夜重置。本周预计收入按当前设置推算，未来日期不计入，并非历史工资账本。
- 发薪日在短月份自动取该月最后一天。倒计时按自然日计算，不考虑节假日顺延。
- 迷你模式始终置顶，拖动标题空白区域移动；展开按钮或 `Esc` 返回主窗口。
- 关闭窗口后继续在系统托盘运行。左键托盘恢复主窗口，右键可打开设置或彻底退出。再次启动应用会恢复已有窗口。
- 专注结束后手动开始休息；休息结束后手动开始下一次专注。暂停与重启不会丢失当前进度。只有完整结束的专注计入完成记录。
- 提醒默认关闭，在设置中启用后发送午休、下班及计时结束的系统通知。应用完全退出时不运行后台提醒；重新打开会校准已有计时。
- 眼睛按钮隐藏金额；侧栏底部切换深浅主题，也可在设置中选择跟随系统。
- 侧栏「迷你模式」上方的语言选择器可即时切换 English、简体中文或跟随系统，选择会自动保存；窗口、托盘、通知与日期同步切换。中文系统默认中文，其他语言回退英文。Linux 按 `LC_ALL`、`LC_MESSAGES`、`LANG` 的顺序读取语言，`C`、`POSIX` 与未支持的语言使用英文。旧版配置自动补上语言设置，不重置薪资与日程。切换语言不改变人民币计价。

## 发布

版本号维护于 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`。推送 `v*` 标签后，GitHub Actions 创建草稿 Release，分别在 Windows、macOS 与 Linux 上运行检查并构建安装包。全部平台成功后上传 SHA-256 校验文件并自动公开发布；失败时保留草稿。可手动触发流程重试未发布的标签。macOS 为 Apple Silicon 与 Intel 通用包，Linux 提供 `.deb` 与 `.AppImage`。

安装包未签名，macOS 包未做公证。当前源码不包含自动更新或外部网络服务。应用支持简体中文与英文界面。

许可证：[MIT](LICENSE)。
