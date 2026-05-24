pub fn enabled() -> bool {
    matches!(
        std::env::var("MODUDOC_DEBUG").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {{
        if crate::debug::enabled() {
            eprintln!($($arg)*);
        }
    }};
}
