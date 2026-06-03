#[tauri::command]
pub fn debug_log_frontend(label: String, at_ms: f64, payload: Option<String>) {
    let payload = payload.unwrap_or_default();
    if payload.is_empty() {
        crate::debug_log!("[frontend] +{at_ms:.1}ms {label}");
    } else {
        crate::debug_log!("[frontend] +{at_ms:.1}ms {label} {payload}");
    }
}
