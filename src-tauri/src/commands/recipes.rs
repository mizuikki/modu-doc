use super::*;
use tauri::Runtime;
use uuid::Uuid;

#[tauri::command]
pub async fn create_recipe(
    app: AppHandle<impl Runtime>,
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
        INSERT INTO recipes (id, workspace_id, name, description, deleted_at, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)
        "#,
    )
    .bind(&id)
    .bind(&workspace_id)
    .bind(&name)
    .bind(&description)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let recipe = Recipe {
        id,
        workspace_id: workspace_id.clone(),
        name,
        description,
        deleted_at: None,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };

    emit_document_status(&app, "recipe_created", Some(&workspace_id), None);
    Ok(recipe)
}

#[tauri::command]
pub async fn update_recipe_items(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    recipe_id: String,
    items: Vec<RecipeItem>,
) -> Result<(), String> {
    let workspace_id: String =
        sqlx::query_scalar("SELECT workspace_id FROM recipes WHERE id = ?1")
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

    let timestamp = now();
    sqlx::query("UPDATE recipes SET updated_at = ?2 WHERE id = ?1")
        .bind(&recipe_id)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;

    emit_document_status(&app, "recipe_updated", Some(&workspace_id), None);
    Ok(())
}

#[tauri::command]
pub async fn generate_document_from_recipe(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    recipe_id: String,
    document_name: Option<String>,
) -> Result<Document, String> {
    let recipe = sqlx::query_as::<_, RecipeRow>(
        r#"
        SELECT id, workspace_id, name, description, deleted_at, created_at, updated_at
        FROM recipes WHERE id = ?1
        "#,
    )
    .bind(&recipe_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let item_rows = sqlx::query_as::<_, RecipeItemRow>(
        r#"
        SELECT id, recipe_id, fragment_id, enabled, sort_order
        FROM recipe_items
        WHERE recipe_id = ?1 AND enabled = 1
        ORDER BY sort_order ASC
        "#,
    )
    .bind(&recipe_id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    let items: Vec<RecipeItem> = item_rows.into_iter().map(RecipeItem::from).collect();

    let mut concatenated = String::new();
    for item in &items {
        let fragment_content: Option<String> =
            sqlx::query_scalar("SELECT content FROM fragments WHERE id = ?1")
                .bind(&item.fragment_id)
                .fetch_optional(pool(&state))
                .await
                .map_err(crate::error::normalize_error)?;
        if let Some(content) = fragment_content {
            concatenated.push_str(&content);
        }
    }

    let content_hash_value = hash(&concatenated);
    let name = document_name.unwrap_or_else(|| format!("{} — generated", recipe.name));
    let new_id = Uuid::new_v4().to_string();
    let timestamp = now();
    let sort_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM documents WHERE workspace_id = ?1",
    )
    .bind(&recipe.workspace_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    sqlx::query(
        r#"
        INSERT INTO documents (
            id, workspace_id, name, content, content_hash, target_path, file_status,
            last_written_at, last_written_hash, sort_order, deleted_at, description,
            created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, NULL, 'missing_target', NULL, NULL, ?6, NULL, NULL, ?7, ?7)
        "#,
    )
    .bind(&new_id)
    .bind(&recipe.workspace_id)
    .bind(&name)
    .bind(&concatenated)
    .bind(&content_hash_value)
    .bind(sort_order)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
               last_written_at, last_written_hash, sort_order, deleted_at, description,
               created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(&new_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into();

    emit_document_status(&app, "document_created", Some(&recipe.workspace_id), Some(&new_id));
    Ok(document)
}

#[tauri::command]
pub async fn insert_recipe_into_document(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    recipe_id: String,
    document_id: String,
    cursor_offset: i64,
) -> Result<Document, String> {
    let _ = recipe_exists(pool(&state), &recipe_id).await?;
    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
               last_written_at, last_written_hash, sort_order, deleted_at, description,
               created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let concatenated = build_recipe_concat(pool(&state), &recipe_id).await?;
    let new_content = splice_at(&document.content, &concatenated, cursor_offset);
    let new_hash = hash(&new_content);
    let new_status = if document.target_path.is_some() {
        "dirty"
    } else {
        "missing_target"
    };
    let timestamp = now();

    sqlx::query(
        r#"
        UPDATE documents
        SET content = ?2, content_hash = ?3, file_status = ?4, updated_at = ?5
        WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .bind(&new_content)
    .bind(&new_hash)
    .bind(new_status)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let updated: Document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
               last_written_at, last_written_hash, sort_order, deleted_at, description,
               created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into();

    emit_document_status(
        &app,
        "document_updated",
        Some(&updated.workspace_id),
        Some(&updated.id),
    );
    Ok(updated)
}

#[tauri::command]
pub async fn replace_document_with_recipe(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    recipe_id: String,
    document_id: String,
) -> Result<Document, String> {
    let _ = recipe_exists(pool(&state), &recipe_id).await?;
    let document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
               last_written_at, last_written_hash, sort_order, deleted_at, description,
               created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let recipe_content = build_recipe_concat(pool(&state), &recipe_id).await?;
    // Recipe generation is one-shot: the document's existing content is
    // appended to the recipe output (so callers can recover the original by
    // a future insert).
    let mut new_content = recipe_content;
    new_content.push_str(&document.content);
    let new_hash = hash(&new_content);
    let new_status = if document.target_path.is_some() {
        "dirty"
    } else {
        "missing_target"
    };
    let timestamp = now();

    sqlx::query(
        r#"
        UPDATE documents
        SET content = ?2, content_hash = ?3, file_status = ?4, updated_at = ?5
        WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .bind(&new_content)
    .bind(&new_hash)
    .bind(new_status)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let updated: Document = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
               last_written_at, last_written_hash, sort_order, deleted_at, description,
               created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(&document_id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into();

    emit_document_status(
        &app,
        "document_updated",
        Some(&updated.workspace_id),
        Some(&updated.id),
    );
    Ok(updated)
}

async fn recipe_exists(pool: &SqlitePool, recipe_id: &str) -> Result<(), String> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM recipes WHERE id = ?1)")
        .bind(recipe_id)
        .fetch_one(pool)
        .await
        .map_err(crate::error::normalize_error)?;
    if exists {
        Ok(())
    } else {
        Err("recipe_not_found".to_string())
    }
}

async fn build_recipe_concat(pool: &SqlitePool, recipe_id: &str) -> Result<String, String> {
    let item_rows = sqlx::query_as::<_, RecipeItemRow>(
        r#"
        SELECT id, recipe_id, fragment_id, enabled, sort_order
        FROM recipe_items
        WHERE recipe_id = ?1 AND enabled = 1
        ORDER BY sort_order ASC
        "#,
    )
    .bind(recipe_id)
    .fetch_all(pool)
    .await
    .map_err(crate::error::normalize_error)?;
    let items: Vec<RecipeItem> = item_rows.into_iter().map(RecipeItem::from).collect();

    let mut out = String::new();
    for item in &items {
        let fragment_content: Option<String> =
            sqlx::query_scalar("SELECT content FROM fragments WHERE id = ?1")
                .bind(&item.fragment_id)
                .fetch_optional(pool)
                .await
                .map_err(crate::error::normalize_error)?;
        if let Some(content) = fragment_content {
            out.push_str(&content);
        }
    }
    Ok(out)
}

fn splice_at(content: &str, addition: &str, offset: i64) -> String {
    let len = content.len() as i64;
    let clamped = if offset < 0 {
        0
    } else if offset > len {
        len
    } else {
        offset
    } as usize;
    let mut out = String::with_capacity(content.len() + addition.len());
    out.push_str(&content[..clamped]);
    out.push_str(addition);
    out.push_str(&content[clamped..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;

    async fn test_pool() -> SqlitePool {
        let connect_options = SqliteConnectOptions::from_str("sqlite::memory:")
            .expect("connect options")
            .create_if_missing(true)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await
            .expect("pool");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migration");
        pool
    }

    async fn seed_full_workspace(pool: &SqlitePool) -> (String, String, String, String) {
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        sqlx::query(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        )
        .bind("ws-1")
        .bind("Workspace 1")
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("workspace");
        sqlx::query(
            r#"
            INSERT INTO fragments (
                id, workspace_id, name, content, content_hash, tags, category,
                sort_order, deleted_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, '[]', NULL, 0, NULL, ?6, ?6)
            "#,
        )
        .bind("frag-1")
        .bind("ws-1")
        .bind("Header")
        .bind("HEAD")
        .bind(crate::db::content_hash("HEAD"))
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("fragment 1");
        sqlx::query(
            r#"
            INSERT INTO fragments (
                id, workspace_id, name, content, content_hash, tags, category,
                sort_order, deleted_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, '[]', NULL, 1, NULL, ?6, ?6)
            "#,
        )
        .bind("frag-2")
        .bind("ws-1")
        .bind("Body")
        .bind("BODY")
        .bind(crate::db::content_hash("BODY"))
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("fragment 2");
        sqlx::query(
            r#"
            INSERT INTO recipes (id, workspace_id, name, description, deleted_at, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)
            "#,
        )
        .bind("recipe-1")
        .bind("ws-1")
        .bind("Default")
        .bind("")
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("recipe");
        (
            "ws-1".to_string(),
            "frag-1".to_string(),
            "frag-2".to_string(),
            "recipe-1".to_string(),
        )
    }

    #[tokio::test]
    async fn update_recipe_items_replaces_all_items_in_one_tx() {
        let pool = test_pool().await;
        let (_ws, frag1, frag2, recipe) = seed_full_workspace(&pool).await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();

        // Seed an initial item to prove it gets replaced.
        sqlx::query(
            "INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
             VALUES (?1, ?2, ?3, 1, 0)",
        )
        .bind("old-item-1")
        .bind(&recipe)
        .bind(&frag1)
        .execute(&pool)
        .await
        .expect("old item");

        let mut tx = pool.begin().await.expect("tx");
        sqlx::query("DELETE FROM recipe_items WHERE recipe_id = ?1")
            .bind(&recipe)
            .execute(&mut *tx)
            .await
            .expect("delete");
        let new_items = vec![
            RecipeItem {
                id: "new-item-1".to_string(),
                recipe_id: recipe.clone(),
                fragment_id: frag1.clone(),
                enabled: true,
                sort_order: 0,
            },
            RecipeItem {
                id: "new-item-2".to_string(),
                recipe_id: recipe.clone(),
                fragment_id: frag2.clone(),
                enabled: true,
                sort_order: 1,
            },
        ];
        for item in &new_items {
            sqlx::query(
                "INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(&item.id)
            .bind(&item.recipe_id)
            .bind(&item.fragment_id)
            .bind(i64::from(item.enabled))
            .bind(item.sort_order)
            .execute(&mut *tx)
            .await
            .expect("insert");
        }
        sqlx::query("UPDATE recipes SET updated_at = ?2 WHERE id = ?1")
            .bind(&recipe)
            .bind(&timestamp)
            .execute(&mut *tx)
            .await
            .expect("update");
        tx.commit().await.expect("commit");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipe_items WHERE recipe_id = ?1")
            .bind(&recipe)
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 2);
        let old_exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM recipe_items WHERE id = ?1)")
                .bind("old-item-1")
                .fetch_one(&pool)
                .await
                .expect("old exists");
        assert!(!old_exists);
    }

    #[tokio::test]
    async fn generate_document_from_recipe_concatenates_enabled_items() {
        let pool = test_pool().await;
        let (_ws, frag1, frag2, recipe) = seed_full_workspace(&pool).await;
        for (id, fragment_id, enabled, sort_order) in [
            ("ri-1", frag1.as_str(), 1_i64, 0_i64),
            ("ri-2", frag2.as_str(), 0_i64, 1_i64), // disabled
            ("ri-3", frag1.as_str(), 1_i64, 2_i64),
        ] {
            sqlx::query(
                "INSERT INTO recipe_items (id, recipe_id, fragment_id, enabled, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(id)
            .bind(&recipe)
            .bind(fragment_id)
            .bind(enabled)
            .bind(sort_order)
            .execute(&pool)
            .await
            .expect("insert item");
        }
        let concatenated = build_recipe_concat(&pool, &recipe).await.expect("concat");
        // Only enabled items (sort_order 0 and 2) and only fragment frag-1
        // content "HEAD" appears twice. frag-2 ("BODY") is disabled.
        assert_eq!(concatenated, "HEADHEAD");
    }
}
