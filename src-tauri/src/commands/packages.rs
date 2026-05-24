use super::*;
use crate::debug_log;
use tauri::Runtime;

#[tauri::command]
pub async fn import_markdown_file(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    workspace_id: String,
    path: String,
    mode: String,
) -> Result<(), String> {
    debug_log!(
        "[modudoc][import_markdown_file] workspace_id={} path={}",
        workspace_id,
        path
    );
    if mode != "import_as_fragment" {
        return Err("invalid_import_mode".into());
    }
    let is_markdown = Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("md"));
    if !is_markdown {
        return Err("invalid_target_path".into());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|err| match err.kind() {
            std::io::ErrorKind::NotFound => String::from("target_missing"),
            std::io::ErrorKind::PermissionDenied => String::from("target_not_writable"),
            _ => String::from("database_error"),
        })?;
    insert_fragment(
        pool(&state),
        &workspace_id,
        "Imported markdown",
        &content,
        false,
    )
    .await?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "markdown_imported", &workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn export_workspace(
    state: State<'_, db::DbState>,
    workspace_id: String,
    options: serde_json::Value,
) -> Result<String, String> {
    debug_log!(
        "[modudoc][export_workspace] workspace_id={} path={}",
        workspace_id,
        options
            .get("path")
            .and_then(|value| value.as_str())
            .unwrap_or("<missing>")
    );
    let load = load_workspace(state.clone(), workspace_id).await?;
    let export_path = options
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "invalid_target_path".to_string())?;
    let is_agentpack = Path::new(export_path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("agentpack"));
    if !is_agentpack {
        return Err("invalid_target_path".into());
    }
    let recipe_items_by_recipe: HashMap<String, Vec<WorkspacePackageRecipeItem>> = {
        let mut map = HashMap::new();
        for item in load.recipe_items {
            map.entry(item.recipe_id)
                .or_insert_with(Vec::new)
                .push(WorkspacePackageRecipeItem {
                    fragment_id: item.fragment_id,
                    enabled: item.enabled,
                    sort_order: item.sort_order,
                });
        }
        map
    };

    let package = WorkspacePackageExport {
        schema_version: 1,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: now(),
        workspace: WorkspacePackageWorkspace {
            name: load.workspace.name,
            target_path_hint: load.workspace.target_path,
        },
        fragments: load
            .fragments
            .into_iter()
            .map(|fragment| WorkspacePackageFragment {
                id: fragment.id,
                name: fragment.name,
                content: fragment.content,
                content_hash: fragment.content_hash,
            })
            .collect(),
        recipes: load
            .recipes
            .into_iter()
            .map(|recipe| WorkspacePackageRecipe {
                id: recipe.id.clone(),
                name: recipe.name,
                description: recipe.description,
                is_active: recipe.is_active,
                items: recipe_items_by_recipe
                    .get(&recipe.id)
                    .cloned()
                    .unwrap_or_default(),
            })
            .collect(),
        snapshots: {
            let mut snapshots = Vec::with_capacity(load.snapshots.len().min(20));
            for snapshot in load.snapshots.into_iter().take(20) {
                snapshots.push(WorkspacePackageSnapshot {
                    id: snapshot.id,
                    recipe_id: snapshot.recipe_id,
                    label: snapshot.label,
                    snapshot_json: snapshot.snapshot_json,
                    compiled_text: snapshot.compiled_text,
                    compiled_hash: snapshot.compiled_hash,
                    created_at: snapshot.created_at,
                });
            }
            snapshots
        },
    };
    crate::services::package::PackageService::export_workspace(Path::new(export_path), &package)?;
    Ok(export_path.to_string())
}

#[tauri::command]
pub async fn import_workspace_package(
    app: AppHandle,
    state: State<'_, db::DbState>,
    path: String,
) -> Result<String, String> {
    debug_log!("[modudoc][import_workspace_package] path={}", path);
    let is_agentpack = Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("agentpack"));
    if !is_agentpack {
        return Err("invalid_target_path".into());
    }
    let package = crate::services::package::PackageService::import_workspace(Path::new(&path))?;
    let workspace_id = Uuid::new_v4().to_string();
    let timestamp = now();
    let status = "missing_target";
    let fragment_id_map: HashMap<String, String> = package
        .fragments
        .iter()
        .map(|fragment| (fragment.id.clone(), Uuid::new_v4().to_string()))
        .collect();
    let recipe_id_map: HashMap<String, String> = package
        .recipes
        .iter()
        .map(|recipe| (recipe.id.clone(), Uuid::new_v4().to_string()))
        .collect();
    let snapshot_id_map: HashMap<String, String> = package
        .snapshots
        .iter()
        .map(|snapshot| (snapshot.id.clone(), Uuid::new_v4().to_string()))
        .collect();
    let default_recipe_id = package
        .recipes
        .iter()
        .find(|recipe| recipe.is_active)
        .or_else(|| package.recipes.first())
        .map(|recipe| recipe_id_map.get(&recipe.id).cloned())
        .flatten();

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
  .bind(&workspace_id)
  .bind(&package.workspace.name)
  .bind(Option::<String>::None)
  .bind(status)
  .bind(&timestamp)
  .bind(&timestamp)
  .execute(&mut *tx)
  .await
  .map_err(crate::error::normalize_error)?;

    for (index, fragment) in package.fragments.iter().enumerate() {
        let fragment_id = remap_required_id(&fragment_id_map, "fragment", &fragment.id)?;
        sqlx::query(
      r#"
      INSERT INTO fragments (id, workspace_id, name, content, content_hash, sort_order, is_archived, deleted_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, NULL, ?7, ?8)
      "#,
    )
    .bind(&fragment_id)
    .bind(&workspace_id)
    .bind(&fragment.name)
    .bind(&fragment.content)
    .bind(&fragment.content_hash)
    .bind(index as i64)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;
    }

    for recipe in &package.recipes {
        let recipe_id = remap_required_id(&recipe_id_map, "recipe", &recipe.id)?;
        sqlx::query(
            r#"
      INSERT INTO recipes (id, workspace_id, name, description, is_active, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      "#,
        )
        .bind(&recipe_id)
        .bind(&workspace_id)
        .bind(&recipe.name)
        .bind(&recipe.description)
        .bind(i64::from(recipe.is_active))
        .bind(&timestamp)
        .bind(&timestamp)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    }

    for recipe in &package.recipes {
        let recipe_id = remap_required_id(&recipe_id_map, "recipe", &recipe.id)?;
        for item in &recipe.items {
            let fragment_id = remap_required_id(&fragment_id_map, "fragment", &item.fragment_id)?;
            sqlx::query(
                r#"
        INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&recipe_id)
            .bind(&fragment_id)
            .bind(i64::from(item.enabled))
            .bind(item.sort_order)
            .execute(&mut *tx)
            .await
            .map_err(crate::error::normalize_error)?;
        }
    }

    if let Some(recipe_id) = default_recipe_id.clone() {
        sqlx::query("UPDATE recipes SET is_active = 0, updated_at = ?2 WHERE workspace_id = ?1")
            .bind(&workspace_id)
            .bind(&timestamp)
            .execute(&mut *tx)
            .await
            .map_err(crate::error::normalize_error)?;
        sqlx::query("UPDATE recipes SET is_active = 1, updated_at = ?2 WHERE id = ?1")
            .bind(&recipe_id)
            .bind(&timestamp)
            .execute(&mut *tx)
            .await
            .map_err(crate::error::normalize_error)?;
        sqlx::query("UPDATE workspaces SET default_recipe_id = ?2 WHERE id = ?1")
            .bind(&workspace_id)
            .bind(&recipe_id)
            .execute(&mut *tx)
            .await
            .map_err(crate::error::normalize_error)?;
    }

    for snapshot in &package.snapshots {
        let snapshot_id = remap_required_id(&snapshot_id_map, "snapshot", &snapshot.id)?;
        let snapshot_json = remap_workspace_load_result_json(
            &snapshot.snapshot_json,
            &workspace_id,
            &fragment_id_map,
            &recipe_id_map,
            &snapshot_id_map,
        )?;
        let snapshot_recipe_id =
            remap_workspace_package_snapshot_recipe_id(snapshot, &recipe_id_map)?;
        sqlx::query(
      r#"
      INSERT INTO snapshots (id, workspace_id, recipe_id, label, snapshot_json, compiled_text, compiled_hash, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      "#,
    )
    .bind(&snapshot_id)
    .bind(&workspace_id)
    .bind(snapshot_recipe_id)
    .bind(&snapshot.label)
    .bind(&snapshot_json)
    .bind(&snapshot.compiled_text)
    .bind(&snapshot.compiled_hash)
    .bind(&snapshot.created_at)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;
    }

    tx.commit().await.map_err(crate::error::normalize_error)?;
    emit_workspace_status_for(&app, "workspace_package_imported", &workspace_id);
    Ok(workspace_id)
}

fn remap_required_id(
    map: &HashMap<String, String>,
    kind: &str,
    original: &str,
) -> Result<String, String> {
    map.get(original).cloned().ok_or_else(|| {
        let _ = (kind, original);
        "missing_import_id_mapping".to_string()
    })
}

pub(crate) fn remap_workspace_package_snapshot_recipe_id(
    snapshot: &WorkspacePackageSnapshot,
    recipe_id_map: &HashMap<String, String>,
) -> Result<String, String> {
    remap_required_id(recipe_id_map, "recipe", &snapshot.recipe_id)
}

pub(crate) fn remap_workspace_load_result_json(
    snapshot_json: &str,
    workspace_id: &str,
    fragment_id_map: &HashMap<String, String>,
    recipe_id_map: &HashMap<String, String>,
    snapshot_id_map: &HashMap<String, String>,
) -> Result<String, String> {
    let load: WorkspaceLoadResult =
        serde_json::from_str(snapshot_json).map_err(crate::error::normalize_error)?;
    let remapped = remap_workspace_load_result(
        load,
        workspace_id,
        fragment_id_map,
        recipe_id_map,
        snapshot_id_map,
    )?;
    serde_json::to_string(&remapped).map_err(crate::error::normalize_error)
}

fn remap_workspace_load_result(
    mut load: WorkspaceLoadResult,
    workspace_id: &str,
    fragment_id_map: &HashMap<String, String>,
    recipe_id_map: &HashMap<String, String>,
    snapshot_id_map: &HashMap<String, String>,
) -> Result<WorkspaceLoadResult, String> {
    load.workspace.id = workspace_id.to_string();
    load.workspace.target_path = None;
    load.workspace.status = "missing_target".into();
    load.workspace.last_compiled_at = None;
    load.workspace.last_compiled_hash = None;
    if let Some(default_recipe_id) = load.workspace.default_recipe_id.as_deref() {
        load.workspace.default_recipe_id = Some(remap_required_id(
            recipe_id_map,
            "recipe",
            default_recipe_id,
        )?);
    }

    for fragment in &mut load.fragments {
        fragment.id = remap_required_id(fragment_id_map, "fragment", &fragment.id)?;
        fragment.workspace_id = workspace_id.to_string();
    }

    for recipe in &mut load.recipes {
        recipe.id = remap_required_id(recipe_id_map, "recipe", &recipe.id)?;
        recipe.workspace_id = workspace_id.to_string();
    }

    let mut remapped_items = Vec::with_capacity(load.recipe_items.len());
    for item in load.recipe_items {
        remapped_items.push(RecipeItem {
            id: Uuid::new_v4().to_string(),
            recipe_id: remap_required_id(recipe_id_map, "recipe", &item.recipe_id)?,
            fragment_id: remap_required_id(fragment_id_map, "fragment", &item.fragment_id)?,
            enabled: item.enabled,
            sort_order: item.sort_order,
        });
    }
    load.recipe_items = remapped_items;

    let mut remapped_snapshots = Vec::with_capacity(load.snapshots.len());
    for snapshot in load.snapshots {
        remapped_snapshots.push(remap_workspace_snapshot(
            snapshot,
            workspace_id,
            fragment_id_map,
            recipe_id_map,
            snapshot_id_map,
        )?);
    }
    load.snapshots = remapped_snapshots;
    Ok(load)
}

fn remap_workspace_snapshot(
    mut snapshot: Snapshot,
    workspace_id: &str,
    fragment_id_map: &HashMap<String, String>,
    recipe_id_map: &HashMap<String, String>,
    snapshot_id_map: &HashMap<String, String>,
) -> Result<Snapshot, String> {
    snapshot.id = remap_required_id(snapshot_id_map, "snapshot", &snapshot.id)?;
    snapshot.workspace_id = workspace_id.to_string();
    snapshot.recipe_id = remap_required_id(recipe_id_map, "recipe", &snapshot.recipe_id)?;
    snapshot.snapshot_json = remap_workspace_load_result_json(
        &snapshot.snapshot_json,
        workspace_id,
        fragment_id_map,
        recipe_id_map,
        snapshot_id_map,
    )?;
    Ok(snapshot)
}
