use super::*;

#[tauri::command]
pub async fn list_workspaces(state: State<'_, db::DbState>) -> Result<Vec<Workspace>, String> {
    let started = std::time::Instant::now();
    crate::debug_log!("[rust] list_workspaces start");
    let rows = sqlx::query_as::<_, WorkspaceRow>(
    r#"
    SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at
    FROM workspaces
    ORDER BY created_at ASC
    "#,
  )
  .fetch_all(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;
    crate::debug_log!(
        "[rust] list_workspaces done rows={} took={:.1}ms",
        rows.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );
    Ok(rows.into_iter().map(Workspace::from).collect())
}

#[tauri::command]
pub async fn create_workspace(
    app: AppHandle,
    state: State<'_, db::DbState>,
    name: String,
    target_path: Option<String>,
) -> Result<Workspace, String> {
    let id = Uuid::new_v4().to_string();
    let default_recipe_id = Uuid::new_v4().to_string();
    let timestamp = now();
    if let Some(path) = target_path.as_deref() {
        crate::services::workspace::WorkspaceService::validate_target_path(path)?;
    }
    let status = crate::services::workspace::WorkspaceService::status_for_target_path(
        target_path.as_deref(),
    );
    let mut tx = pool(&state)
        .begin()
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query(
    r#"
    INSERT INTO workspaces (id, name, target_path, default_recipe_id, status, created_at, updated_at)
    VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6)
    "#,
  )
  .bind(&id)
  .bind(&name)
  .bind(&target_path)
  .bind(status)
  .bind(&timestamp)
  .bind(&timestamp)
  .execute(&mut *tx)
  .await
  .map_err(crate::error::normalize_error)?;
    sqlx::query(
        r#"
    INSERT INTO recipes (id, workspace_id, name, description, is_active, created_at, updated_at)
    VALUES (?1, ?2, 'Default', '', 1, ?3, ?4)
    "#,
    )
    .bind(&default_recipe_id)
    .bind(&id)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;
    sqlx::query("UPDATE workspaces SET default_recipe_id = ?2, updated_at = ?3 WHERE id = ?1")
        .bind(&id)
        .bind(&default_recipe_id)
        .bind(&timestamp)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    tx.commit().await.map_err(crate::error::normalize_error)?;

    if let Some(path) = &target_path {
        let watcher_service = app
            .state::<Arc<crate::services::watcher::WatcherService>>()
            .inner()
            .clone();
        let watcher_state = app
            .state::<crate::services::watcher::WatcherState>()
            .clone();
        let _ = watcher_service
            .watch_workspace(
                pool(&state).clone(),
                id.clone(),
                Path::new(path).to_path_buf(),
                watcher_state.inner().clone(),
            )
            .await;
    }

    emit_workspace_status_for(&app, "workspace_created", &id);
    Ok(Workspace {
        id,
        name,
        target_path,
        default_recipe_id: Some(default_recipe_id),
        status: status.to_string(),
        last_compiled_at: None,
        last_compiled_hash: None,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn update_workspace(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
    name: Option<String>,
    target_path: Option<String>,
    clear_target_path: Option<bool>,
) -> Result<Workspace, String> {
    let current = sqlx::query_as::<_, WorkspaceRow>(
    r#"
    SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at
    FROM workspaces WHERE id = ?1
    "#,
  )
  .bind(&id)
  .fetch_one(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?;

    let current_target = current.target_path.clone();
    let updated_name = name.unwrap_or(current.name);
    let updated_target = resolve_updated_target_path(
        current_target.clone(),
        target_path,
        clear_target_path.unwrap_or(false),
    );
    if let Some(path) = updated_target.as_deref() {
        crate::services::workspace::WorkspaceService::validate_target_path(path)?;
    }
    let status = crate::services::workspace::WorkspaceService::status_for_target_path(
        updated_target.as_deref(),
    );
    let timestamp = now();

    sqlx::query(
        r#"
    UPDATE workspaces
    SET name = ?2, target_path = ?3, status = ?4, updated_at = ?5
    WHERE id = ?1
    "#,
    )
    .bind(&id)
    .bind(&updated_name)
    .bind(&updated_target)
    .bind(status)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let watcher_service = app
        .state::<Arc<crate::services::watcher::WatcherService>>()
        .inner()
        .clone();
    if updated_target != current_target {
        watcher_service.unwatch_workspace(&id);
    }

    if let Some(path) = &updated_target {
        let watcher_state = app
            .state::<crate::services::watcher::WatcherState>()
            .clone();
        watcher_state.mark_ignored(
            path.clone(),
            current.last_compiled_hash.clone().unwrap_or_default(),
        );
        let _ = watcher_service
            .watch_workspace(
                pool(&state).clone(),
                id.clone(),
                Path::new(path).to_path_buf(),
                watcher_state.inner().clone(),
            )
            .await;
    }

    emit_workspace_status_for(&app, "workspace_updated", &id);
    Ok(Workspace {
        id,
        name: updated_name,
        target_path: updated_target,
        default_recipe_id: current.default_recipe_id,
        status: status.to_string(),
        last_compiled_at: current.last_compiled_at,
        last_compiled_hash: current.last_compiled_hash,
        created_at: current.created_at,
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn delete_workspace(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM workspaces WHERE id = ?1")
        .bind(&id)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    app.state::<Arc<crate::services::watcher::WatcherService>>()
        .inner()
        .unwatch_workspace(&id);
    emit_workspace_status_for(&app, "workspace_deleted", &id);
    Ok(())
}

#[tauri::command]
pub async fn load_workspace(
    state: State<'_, db::DbState>,
    id: String,
) -> Result<WorkspaceLoadResult, String> {
    let started = std::time::Instant::now();
    crate::debug_log!("[rust] load_workspace start id={}", id);

    let workspace = sqlx::query_as::<_, WorkspaceRow>(
    r#"
    SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at
    FROM workspaces WHERE id = ?1
    "#,
  )
  .bind(&id)
  .fetch_one(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?
  .into();
    crate::debug_log!(
        "[rust] load_workspace workspace row took={:.1}ms",
        started.elapsed().as_secs_f64() * 1000.0
    );

    let fragments: Vec<Fragment> = sqlx::query_as::<_, FragmentRow>(
    r#"
    SELECT id, workspace_id, name, content, content_hash, sort_order, is_archived, deleted_at, created_at, updated_at
    FROM fragments
    WHERE workspace_id = ?1
    ORDER BY deleted_at IS NOT NULL ASC, sort_order ASC, created_at ASC
    "#,
  )
  .bind(&id)
  .fetch_all(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?
  .into_iter()
  .map(Fragment::from)
  .collect();
    crate::debug_log!(
        "[rust] load_workspace fragments={} took={:.1}ms",
        fragments.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let recipes: Vec<Recipe> = sqlx::query_as::<_, RecipeRow>(
        r#"
    SELECT id, workspace_id, name, description, is_active, created_at, updated_at
    FROM recipes
    WHERE workspace_id = ?1
    ORDER BY created_at ASC
    "#,
    )
    .bind(&id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into_iter()
    .map(Recipe::from)
    .collect();
    crate::debug_log!(
        "[rust] load_workspace recipes={} took={:.1}ms",
        recipes.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let recipe_items: Vec<RecipeItem> = sqlx::query_as::<_, RecipeItemRow>(
        r#"
    SELECT id, recipe_id, fragment_id, enabled, sort_order
    FROM recipe_items
    WHERE recipe_id IN (SELECT id FROM recipes WHERE workspace_id = ?1)
    ORDER BY sort_order ASC, id ASC
    "#,
    )
    .bind(&id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into_iter()
    .map(RecipeItem::from)
    .collect();
    crate::debug_log!(
        "[rust] load_workspace recipe_items={} took={:.1}ms",
        recipe_items.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let snapshots: Vec<Snapshot> = sqlx::query_as::<_, SnapshotSummaryRow>(
    r#"
    SELECT id, workspace_id, recipe_id, label, compiled_text, compiled_hash, created_at
    FROM snapshots
    WHERE workspace_id = ?1
    ORDER BY created_at DESC
    "#,
  )
  .bind(&id)
  .fetch_all(pool(&state))
  .await
  .map_err(crate::error::normalize_error)?
  .into_iter()
  .map(Snapshot::from)
  .collect();
    let compiled_text_bytes: usize = snapshots.iter().map(|snapshot| snapshot.compiled_text.len()).sum();
    crate::debug_log!(
        "[rust] load_workspace snapshots={} compiled_text_bytes={} took={:.1}ms",
        snapshots.len(),
        compiled_text_bytes,
        started.elapsed().as_secs_f64() * 1000.0
    );
    crate::debug_log!(
        "[rust] load_workspace done id={} total={:.1}ms",
        id,
        started.elapsed().as_secs_f64() * 1000.0
    );

    Ok(WorkspaceLoadResult {
        workspace,
        fragments,
        recipes,
        recipe_items,
        snapshots,
    })
}

pub(crate) async fn insert_fragment(
    pool: &SqlitePool,
    workspace_id: &str,
    name: &str,
    content: &str,
    attach_to_recipe: bool,
) -> Result<Fragment, String> {
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let content_hash = hash(content);
    let sort_order =
        crate::services::fragment::FragmentService::next_sort_order(pool, workspace_id).await?;

    sqlx::query(
    r#"
    INSERT INTO fragments (id, workspace_id, name, content, content_hash, sort_order, is_archived, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)
    "#,
  )
  .bind(&id)
  .bind(workspace_id)
  .bind(name)
  .bind(content)
  .bind(&content_hash)
  .bind(sort_order)
  .bind(&timestamp)
  .bind(&timestamp)
  .execute(pool)
  .await
  .map_err(crate::error::normalize_error)?;

    if attach_to_recipe {
        let workspace = sqlx::query_as::<_, WorkspaceRow>(
      "SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at FROM workspaces WHERE id = ?1",
    )
    .bind(workspace_id)
    .fetch_one(pool)
    .await
    .map_err(crate::error::normalize_error)?;
        let recipe_id = if let Some(default_recipe_id) = workspace.default_recipe_id {
            Some(default_recipe_id)
        } else {
            sqlx::query_scalar::<_, String>(
        "SELECT id FROM recipes WHERE workspace_id = ?1 ORDER BY is_active DESC, created_at ASC LIMIT 1",
      )
      .bind(workspace_id)
      .fetch_optional(pool)
      .await
      .map_err(crate::error::normalize_error)?
        };
        if let Some(recipe_id) = recipe_id {
            let sort_order =
                crate::services::fragment::FragmentService::next_recipe_item_sort_order(
                    pool, &recipe_id,
                )
                .await?;
            sqlx::query(
                r#"
        INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
        VALUES (?1, ?2, ?3, 1, ?4)
        "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&recipe_id)
            .bind(&id)
            .bind(sort_order)
            .execute(pool)
            .await
            .map_err(crate::error::normalize_error)?;
        }
    }

    Ok(Fragment {
        id,
        workspace_id: workspace_id.to_string(),
        name: name.to_string(),
        content: content.to_string(),
        content_hash,
        sort_order,
        is_archived: false,
        deleted_at: None,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}
