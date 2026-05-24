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
    reveal_item_in_dir(Path::new(&target_path)).map_err(crate::error::normalize_error)
}
