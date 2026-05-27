use super::*;

#[tauri::command]
pub async fn open_target_in_file_manager(
    state: State<'_, db::DbState>,
    workspace_id: String,
) -> Result<(), String> {
    let workspace = sqlx::query_as::<_, WorkspaceRow>(
    "SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at FROM workspaces WHERE id = ?1",
  )
  .bind(&workspace_id)
  .fetch_one(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;
    let Some(target_path) = workspace.target_path else {
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
