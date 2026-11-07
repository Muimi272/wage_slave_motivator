pub fn detect_locale(value: &str) -> &'static str {
    let value = value.to_ascii_lowercase();
    if value == "zh"
        || value.starts_with("zh_")
        || value.starts_with("zh-")
        || value.starts_with("zh.")
        || value.starts_with("zh@")
    {
        "zh-CN"
    } else {
        "en"
    }
}

fn preferred_locale(values: &[Option<String>], platform: Option<String>) -> String {
    values
        .iter()
        .flatten()
        .find(|value| !value.is_empty())
        .cloned()
        .or(platform)
        .unwrap_or_else(|| "en".into())
}

pub fn system_locale() -> String {
    preferred_locale(
        &[
            std::env::var("LC_ALL").ok(),
            std::env::var("LC_MESSAGES").ok(),
            std::env::var("LANG").ok(),
        ],
        sys_locale::get_locale(),
    )
}

pub fn resolve(language: &str) -> &'static str {
    if language == "system" {
        detect_locale(&system_locale())
    } else if language == "zh-CN" {
        "zh-CN"
    } else {
        "en"
    }
}

pub fn default_language() -> String {
    "system".into()
}

pub fn labels(locale: &str) -> [&'static str; 4] {
    if locale == "zh-CN" {
        ["牛马鼓励器", "显示主窗口", "薪资与偏好", "退出牛马鼓励器"]
    } else {
        [
            "Wage Slave Motivator",
            "Show main window",
            "Salary & preferences",
            "Quit Wage Slave Motivator",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_fallbacks() {
        for locale in ["C", "C.UTF-8", "POSIX", "en_US.UTF-8", "de_DE", "", "zhfoo"] {
            assert_eq!(detect_locale(locale), "en");
        }
        for locale in ["zh", "zh_CN.UTF-8", "zh-Hans-CN", "zh_TW", "ZH-hk"] {
            assert_eq!(detect_locale(locale), "zh-CN");
        }
    }

    #[test]
    fn respects_posix_message_locale_precedence() {
        let zh = Some("zh_CN.UTF-8".into());
        let en = Some("C".into());
        assert_eq!(
            preferred_locale(&[en.clone(), zh.clone(), zh.clone()], zh.clone()),
            "C"
        );
        assert_eq!(
            preferred_locale(&[Some(String::new()), en, zh.clone()], zh.clone()),
            "C"
        );
        assert_eq!(
            preferred_locale(&[None, None, zh.clone()], None),
            "zh_CN.UTF-8"
        );
        assert_eq!(preferred_locale(&[None, None, None], zh), "zh_CN.UTF-8");
        assert_eq!(preferred_locale(&[None, None, None], None), "en");
    }
}
