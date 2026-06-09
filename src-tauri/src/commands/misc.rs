use super::*;
use crate::db;
use std::path::Path;

#[tauri::command]
pub async fn open_target_in_file_manager(
    state: State<'_, db::DbState>,
    document_id: String,
) -> Result<(), String> {
    let target_path: Option<String> =
        sqlx::query_scalar("SELECT target_path FROM documents WHERE id = ?1")
            .bind(&document_id)
            .fetch_optional(pool(&state))
            .await
            .map_err(crate::error::normalize_error)?;

    let Some(target_path) = target_path else {
        return Err("invalid_target_path".into());
    };

    // During e2e we only assert the command path doesn't error; actually opening a file manager
    // window makes cleanup flaky (and can show "file not found" dialogs after temp cleanup).
    if std::env::var("MODUDOC_E2E_SKIP_REVEAL")
        .ok()
        .is_some_and(|value| value.trim() == "1")
    {
        return Ok(());
    }

    reveal_item_in_dir(Path::new(&target_path)).map_err(crate::error::normalize_error)
}
