#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, PhysicalSize, Size, WindowEvent,
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    monthly_salary: f64,
    work_days_per_month: f64,
    payday: u8,
    work_start: String,
    work_end: String,
    lunch_start: String,
    lunch_end: String,
    lunch_enabled: bool,
    workdays: Vec<u8>,
    focus_minutes: u16,
    break_minutes: u16,
    notifications: bool,
    theme: String,
}

fn minutes(value: &str) -> Option<u16> {
    let bytes = value.as_bytes();
    if bytes.len() != 5
        || bytes[2] != b':'
        || ![bytes[0], bytes[1], bytes[3], bytes[4]]
            .iter()
            .all(u8::is_ascii_digit)
    {
        return None;
    }
    let hour: u16 = value[..2].parse().ok()?;
    let minute: u16 = value[3..].parse().ok()?;
    (hour < 24 && minute < 60).then_some(hour * 60 + minute)
}

fn validate(config: &Config) -> Result<(), String> {
    let fail = || "设置内容无效，请检查薪资与工作时间".to_string();
    if !config.monthly_salary.is_finite()
        || config.monthly_salary <= 0.0
        || config.monthly_salary > 100_000_000.0
        || !config.work_days_per_month.is_finite()
        || !(1.0..=31.0).contains(&config.work_days_per_month)
        || !(1..=31).contains(&config.payday)
        || config.workdays.is_empty()
        || config.workdays.iter().any(|day| *day > 6)
        || !(1..=180).contains(&config.focus_minutes)
        || !(1..=180).contains(&config.break_minutes)
        || !["light", "dark", "system"].contains(&config.theme.as_str())
    {
        return Err(fail());
    }
    let mut days = config.workdays.clone();
    days.sort();
    days.dedup();
    if days.len() != config.workdays.len() {
        return Err(fail());
    }
    let start = minutes(&config.work_start).ok_or_else(fail)?;
    let end = minutes(&config.work_end).ok_or_else(fail)?;
    let lunch_start = minutes(&config.lunch_start).ok_or_else(fail)?;
    let lunch_end = minutes(&config.lunch_end).ok_or_else(fail)?;
    if start >= end
        || (config.lunch_enabled
            && (lunch_start < start
                || lunch_end > end
                || lunch_start >= lunch_end
                || lunch_end - lunch_start >= end - start))
    {
        return Err(fail());
    }
    Ok(())
}

#[derive(Default)]
struct AppState {
    data_dir: Option<std::path::PathBuf>,
    saved_window: Mutex<Option<(PhysicalSize<u32>, PhysicalPosition<i32>)>>,
    storage: Mutex<()>,
}

fn config_dir(app: &tauri::AppHandle, state: &AppState) -> Result<std::path::PathBuf, String> {
    if let Some(path) = &state.data_dir {
        if !path.is_absolute() {
            return Err("MOTIVATOR_DATA_DIR 必须是绝对路径".into());
        }
        return Ok(path.clone());
    }
    app.path().app_config_dir().map_err(|e| e.to_string())
}

#[tauri::command]
fn load_config(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<Option<Config>, String> {
    let _guard = state.storage.lock().map_err(|e| e.to_string())?;
    let path = config_dir(&app, &state)?.join("settings.json");
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let config: Config =
        serde_json::from_slice(&data).map_err(|e| format!("设置文件无法读取：{e}"))?;
    validate(&config)?;
    Ok(Some(config))
}

#[tauri::command]
fn save_config(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    config: Config,
) -> Result<(), String> {
    validate(&config)?;
    let _guard = state.storage.lock().map_err(|e| e.to_string())?;
    let dir = config_dir(&app, &state)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let temporary = dir.join("settings.tmp");
    let data = serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?;
    use std::io::Write;
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(&data)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temporary, dir.join("settings.json")).map_err(|e| e.to_string())?;
    Ok(())
}

fn restore(window: &tauri::WebviewWindow, state: &AppState) -> Result<(), String> {
    let mut saved = state.saved_window.lock().map_err(|e| e.to_string())?;
    if let Some((size, position)) = saved.as_ref() {
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_size(*size).map_err(|e| e.to_string())?;
        window
            .set_min_size(Some(Size::Logical(tauri::LogicalSize::new(860.0, 680.0))))
            .map_err(|e| e.to_string())?;
        window.set_position(*position).map_err(|e| e.to_string())?;
        *saved = None;
    }
    window
        .emit("compact-changed", false)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_compact(
    window: tauri::WebviewWindow,
    state: tauri::State<AppState>,
    compact: bool,
) -> Result<(), String> {
    if !compact {
        return restore(&window, &state);
    }
    let mut saved = state.saved_window.lock().map_err(|e| e.to_string())?;
    if saved.is_some() {
        return Ok(());
    }
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    window.unmaximize().map_err(|e| e.to_string())?;
    window
        .set_min_size(None::<Size>)
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(360.0, 166.0))
        .map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    *saved = Some((size, position));
    window
        .emit("compact-changed", true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn show_main(app: &tauri::AppHandle, settings: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let state = app.state::<AppState>();
        let _ = restore(&window, &state);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if settings {
            let _ = window.emit("navigate-settings", ());
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            data_dir: std::env::var_os("MOTIVATOR_DATA_DIR").map(std::path::PathBuf::from),
            ..AppState::default()
        })
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app, false)
        }))
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            set_compact
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "薪资与偏好", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出牛马鼓励器", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("bundled icon").clone())
                .tooltip("牛马鼓励器")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app, false),
                    "settings" => show_main(app, true),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle(), false);
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("应用启动失败");
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config() -> Config {
        serde_json::from_str(r#"{"monthlySalary":12000,"workDaysPerMonth":21.75,"payday":10,"workStart":"09:00","workEnd":"18:00","lunchStart":"12:00","lunchEnd":"13:00","lunchEnabled":true,"workdays":[1,2,3,4,5],"focusMinutes":25,"breakMinutes":5,"notifications":false,"theme":"light"}"#).unwrap()
    }
    #[test]
    fn rejects_invalid_time_and_salary() {
        assert!(validate(&config()).is_ok());
        let mut c = config();
        c.work_start = "25:00".into();
        assert!(validate(&c).is_err());
        let mut c = config();
        c.monthly_salary = f64::NAN;
        assert!(validate(&c).is_err());
        let mut c = config();
        c.lunch_end = "19:00".into();
        assert!(validate(&c).is_err());
        let mut c = config();
        c.workdays.clear();
        assert!(validate(&c).is_err());
    }
}
