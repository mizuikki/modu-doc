use super::*;

#[tauri::command]
pub async fn create_fragment(
    app: AppHandle,
    state: State<'_, db::DbState>,
    workspace_id: String,
    name: String,
    content: Option<String>,
    attach_to_recipe: Option<bool>,
) -> Result<Fragment, String> {
    let fragment = insert_fragment(
        pool(&state),
        &workspace_id,
        &name,
        content.as_deref().unwrap_or_default(),
        attach_to_recipe.unwrap_or(true),
    )
    .await?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "fragment_created", &workspace_id);
    Ok(fragment)
}

#[tauri::command]
pub async fn update_fragment(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
    name: Option<String>,
    content: Option<String>,
) -> Result<Fragment, String> {
    let current = sqlx::query_as::<_, FragmentRow>(
    r#"
    SELECT id, workspace_id, name, content, content_hash, sort_order, is_archived, deleted_at, created_at, updated_at
    FROM fragments WHERE id = ?1
    "#,
  )
  .bind(&id)
  .fetch_one(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;

    let updated_name = name.unwrap_or(current.name.clone());
    let updated_content = content.unwrap_or(current.content.clone());
    let updated_hash = hash(&updated_content);
    let timestamp = now();

    sqlx::query(
        r#"
    UPDATE fragments
    SET name = ?2, content = ?3, content_hash = ?4, updated_at = ?5
    WHERE id = ?1
    "#,
    )
    .bind(&id)
    .bind(&updated_name)
    .bind(&updated_content)
    .bind(&updated_hash)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &current.workspace_id).await?;
    emit_workspace_status_for(&app, "fragment_updated", &current.workspace_id);

    Ok(Fragment {
        id,
        workspace_id: current.workspace_id,
        name: updated_name,
        content: updated_content,
        content_hash: updated_hash,
        sort_order: current.sort_order,
        is_archived: current.is_archived != 0,
        deleted_at: current.deleted_at,
        created_at: current.created_at,
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn soft_delete_fragment(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    let workspace_id: String =
        sqlx::query_scalar("SELECT workspace_id FROM fragments WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool(&state))
            .await
            .map_err(crate::error::normalize_error)?;
    let timestamp = now();
    sqlx::query("UPDATE fragments SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "fragment_deleted", &workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn restore_fragment(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    let workspace_id: String =
        sqlx::query_scalar("SELECT workspace_id FROM fragments WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool(&state))
            .await
            .map_err(crate::error::normalize_error)?;
    let timestamp = now();
    sqlx::query("UPDATE fragments SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "fragment_restored", &workspace_id);
    Ok(())
}
