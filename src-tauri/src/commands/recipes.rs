use super::*;

#[tauri::command]
pub async fn create_recipe(
    app: AppHandle,
    state: State<'_, db::DbState>,
    workspace_id: String,
    name: String,
    description: Option<String>,
) -> Result<Recipe, String> {
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let description = description.unwrap_or_default();
    sqlx::query(
        r#"
    INSERT INTO recipes (id, workspace_id, name, description, is_active, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)
    "#,
    )
    .bind(&id)
    .bind(&workspace_id)
    .bind(&name)
    .bind(&description)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "recipe_created", &workspace_id);

    Ok(Recipe {
        id,
        workspace_id,
        name,
        description,
        is_active: false,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn activate_recipe(
    app: AppHandle,
    state: State<'_, db::DbState>,
    recipe_id: String,
) -> Result<(), String> {
    let recipe = sqlx::query_as::<_, RecipeRow>(
    "SELECT id, workspace_id, name, description, is_active, created_at, updated_at FROM recipes WHERE id = ?1",
  )
  .bind(&recipe_id)
  .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let timestamp = now();
    let mut tx = pool(&state)
        .begin()
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query("UPDATE recipes SET is_active = 0, updated_at = ?2 WHERE workspace_id = ?1")
        .bind(&recipe.workspace_id)
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
    tx.commit().await.map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &recipe.workspace_id).await?;
    emit_workspace_status_for(&app, "recipe_activated", &recipe.workspace_id);
    Ok(())
}

#[tauri::command]
pub async fn update_recipe_items(
    app: AppHandle,
    state: State<'_, db::DbState>,
    recipe_id: String,
    items: Vec<RecipeItem>,
) -> Result<(), String> {
    let workspace_id: String = sqlx::query_scalar("SELECT workspace_id FROM recipes WHERE id = ?1")
        .bind(&recipe_id)
        .fetch_one(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    let mut tx = pool(&state)
        .begin()
        .await
        .map_err(crate::error::normalize_error)?;
    sqlx::query("DELETE FROM recipe_items WHERE recipe_id = ?1")
        .bind(&recipe_id)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;

    for item in items {
        sqlx::query(
            r#"
      INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
      VALUES (?1, ?2, ?3, ?4, ?5)
      "#,
        )
        .bind(&item.id)
        .bind(&recipe_id)
        .bind(&item.fragment_id)
        .bind(i64::from(item.enabled))
        .bind(item.sort_order)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    }
    tx.commit().await.map_err(crate::error::normalize_error)?;
    mark_workspace_dirty(pool(&state), &workspace_id).await?;
    emit_workspace_status_for(&app, "recipe_items_updated", &workspace_id);
    Ok(())
}
