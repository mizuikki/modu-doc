use super::*;
use crate::debug_log;
use tauri::Runtime;

#[tauri::command]
pub async fn create_snapshot(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    workspace_id: String,
    label: Option<String>,
) -> Result<Snapshot, String> {
    debug_log!(
        "[modudoc][create_snapshot] workspace_id={} label={:?}",
        workspace_id,
        label
    );
    let load = load_workspace(state.clone(), workspace_id.clone()).await?;
    let compiled_text = compile_workspace(state.clone(), workspace_id.clone()).await?;
    let compiled_hash = hash(&compiled_text);
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let snapshot_json = serde_json::to_string(&load).map_err(crate::error::normalize_error)?;
    let label = label.unwrap_or_default();
    let active_recipe_id = crate::services::snapshot::SnapshotService::active_recipe_id(&load)
        .ok_or_else(|| "missing_workspace_or_recipe".to_string())?;
    sqlx::query(
    r#"
    INSERT INTO snapshots (id, workspace_id, recipe_id, label, snapshot_json, compiled_text, compiled_hash, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    "#,
  )
  .bind(&id)
  .bind(&workspace_id)
  .bind(&active_recipe_id)
  .bind(&label)
  .bind(&snapshot_json)
  .bind(&compiled_text)
  .bind(&compiled_hash)
  .bind(&timestamp)
  .execute(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;
    emit_workspace_status_for(&app, "snapshot_created", &workspace_id);
    Ok(Snapshot {
        id,
        workspace_id,
        recipe_id: active_recipe_id,
        label,
        compiled_text,
        compiled_hash,
        created_at: timestamp,
    })
}

#[tauri::command]
pub async fn list_snapshots(
    state: State<'_, db::DbState>,
    workspace_id: String,
) -> Result<Vec<Snapshot>, String> {
    let rows = sqlx::query_as::<_, SnapshotSummaryRow>(
    r#"
    SELECT id, workspace_id, recipe_id, label, compiled_text, compiled_hash, created_at
    FROM snapshots
    WHERE workspace_id = ?1
    ORDER BY created_at DESC
    "#,
  )
  .bind(&workspace_id)
  .fetch_all(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;
    Ok(rows.into_iter().map(Snapshot::from).collect())
}

#[tauri::command]
pub async fn restore_snapshot(
    app: AppHandle,
    state: State<'_, db::DbState>,
    snapshot_id: String,
) -> Result<(), String> {
    debug_log!("[modudoc][restore_snapshot] snapshot_id={}", snapshot_id);
    let snapshot = sqlx::query_as::<_, SnapshotRow>(
    "SELECT id, workspace_id, recipe_id, label, snapshot_json, compiled_text, compiled_hash, created_at FROM snapshots WHERE id = ?1",
  )
  .bind(&snapshot_id)
  .fetch_one(pool(&state))
  .await
  .map_err(|_| "snapshot_not_found".to_string())?;
    let load: WorkspaceLoadResult =
        serde_json::from_str(&snapshot.snapshot_json).map_err(crate::error::normalize_error)?;
    restore_workspace_snapshot(pool(&state), &load).await?;
    if load.workspace.target_path.is_some() {
        match write_target_file(
            app.clone(),
            state.clone(),
            load.workspace.id.clone(),
            "safe_sync".into(),
        )
        .await
        {
            Ok(()) => {}
            Err(err) => {
                let timestamp = now();
                sqlx::query("UPDATE workspaces SET status = ?3, updated_at = ?2 WHERE id = ?1")
                    .bind(&load.workspace.id)
                    .bind(&timestamp)
                    .bind(restore_snapshot_failure_status(&err))
                    .execute(pool(&state))
                    .await
                    .map_err(crate::error::normalize_error)?;
                emit_workspace_status_for(&app, &err, &load.workspace.id);
                return Err(err);
            }
        }
    }
    emit_workspace_status_for(&app, "snapshot_restored", &load.workspace.id);
    Ok(())
}

pub(crate) async fn restore_workspace_snapshot(
    pool: &SqlitePool,
    load: &WorkspaceLoadResult,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(crate::error::normalize_error)?;
    sqlx::query("DELETE FROM recipe_items WHERE recipe_id IN (SELECT id FROM recipes WHERE workspace_id = ?1)")
        .bind(&load.workspace.id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query("DELETE FROM recipes WHERE workspace_id = ?1")
        .bind(&load.workspace.id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query("DELETE FROM fragments WHERE workspace_id = ?1")
        .bind(&load.workspace.id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query(
    r#"
    INSERT INTO workspaces (id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      target_path = excluded.target_path,
      default_recipe_id = excluded.default_recipe_id,
      status = excluded.status,
      last_compiled_at = excluded.last_compiled_at,
      last_compiled_hash = excluded.last_compiled_hash,
      updated_at = excluded.updated_at
    "#,
  )
  .bind(&load.workspace.id)
  .bind(&load.workspace.name)
  .bind(&load.workspace.target_path)
  .bind(&load.workspace.default_recipe_id)
  .bind(&load.workspace.status)
  .bind(&load.workspace.last_compiled_at)
  .bind(&load.workspace.last_compiled_hash)
  .bind(&load.workspace.created_at)
  .bind(&load.workspace.updated_at)
  .execute(&mut *tx)
  .await
  .map_err(crate::error::normalize_error)?;
    for fragment in &load.fragments {
        sqlx::query(
      r#"
      INSERT INTO fragments (id, workspace_id, name, content, content_hash, sort_order, is_archived, deleted_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      "#,
    )
    .bind(&fragment.id)
    .bind(&fragment.workspace_id)
    .bind(&fragment.name)
    .bind(&fragment.content)
    .bind(&fragment.content_hash)
    .bind(fragment.sort_order)
    .bind(i64::from(fragment.is_archived))
    .bind(&fragment.deleted_at)
    .bind(&fragment.created_at)
    .bind(&fragment.updated_at)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;
    }
    for recipe in &load.recipes {
        sqlx::query(
            r#"
      INSERT INTO recipes (id, workspace_id, name, description, is_active, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      "#,
        )
        .bind(&recipe.id)
        .bind(&recipe.workspace_id)
        .bind(&recipe.name)
        .bind(&recipe.description)
        .bind(i64::from(recipe.is_active))
        .bind(&recipe.created_at)
        .bind(&recipe.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    }
    for item in &load.recipe_items {
        sqlx::query(
            r#"
      INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
      VALUES (?1, ?2, ?3, ?4, ?5)
      "#,
        )
        .bind(&item.id)
        .bind(&item.recipe_id)
        .bind(&item.fragment_id)
        .bind(i64::from(item.enabled))
        .bind(item.sort_order)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    }
    tx.commit().await.map_err(crate::error::normalize_error)?;
    Ok(())
}
