use super::*;
use serde_json;
use tauri::Runtime;
use uuid::Uuid;

fn tags_to_string(tags: Option<&Vec<String>>) -> String {
    match tags {
        Some(list) => serde_json::to_string(list).unwrap_or_else(|_| "[]".to_string()),
        None => "[]".to_string(),
    }
}

#[tauri::command]
pub async fn create_fragment(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    project_id: String,
    name: String,
    content: Option<String>,
    tags: Option<Vec<String>>,
    category: Option<String>,
) -> Result<Fragment, String> {
    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let content_value = content.unwrap_or_default();
    let content_hash_value = hash(&content_value);
    let tags_value = tags_to_string(tags.as_ref());
    let sort_order =
        crate::services::fragment::FragmentService::next_sort_order(pool(&state), &project_id)
            .await?;

    sqlx::query(
        r#"
        INSERT INTO fragments (
            id, project_id, name, content, content_hash, tags, category,
            sort_order, deleted_at, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?9)
        "#,
    )
    .bind(&id)
    .bind(&project_id)
    .bind(&name)
    .bind(&content_value)
    .bind(&content_hash_value)
    .bind(&tags_value)
    .bind(&category)
    .bind(sort_order)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let fragment = Fragment {
        id,
        project_id,
        name,
        content: content_value,
        content_hash: content_hash_value,
        tags: tags_value,
        category,
        sort_order,
        deleted_at: None,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };

    emit_document_status(&app, "fragment_created", Some(&fragment.project_id), None);
    Ok(fragment)
}

#[tauri::command]
pub async fn update_fragment(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    id: String,
    name: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    category: Option<String>,
) -> Result<Fragment, String> {
    let current = sqlx::query_as::<_, FragmentRow>(
        r#"
        SELECT id, project_id, name, content, content_hash, tags, category,
               sort_order, deleted_at, created_at, updated_at
        FROM fragments WHERE id = ?1
        "#,
    )
    .bind(&id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let updated_name = name.unwrap_or_else(|| current.name.clone());
    // If content is provided, recompute the hash. If not provided, keep the
    // existing hash (and existing content).
    let (updated_content, updated_hash) = match content {
        Some(c) => {
            let h = hash(&c);
            (c, h)
        }
        None => (current.content.clone(), current.content_hash.clone()),
    };
    // `tags = Some(..)` replaces the JSON array; `None` leaves it untouched.
    let updated_tags = match tags.as_ref() {
        Some(_) => tags_to_string(tags.as_ref()),
        None => current.tags.clone(),
    };
    // `category = Some("")` clears to NULL. `Some(other)` sets to other.
    // `None` leaves the existing category untouched.
    let updated_category: Option<String> = match category {
        Some(c) if c.is_empty() => None,
        other => other,
    };
    let timestamp = now();

    sqlx::query(
        r#"
        UPDATE fragments
        SET name = ?2, content = ?3, content_hash = ?4, tags = ?5, category = ?6, updated_at = ?7
        WHERE id = ?1
        "#,
    )
    .bind(&id)
    .bind(&updated_name)
    .bind(&updated_content)
    .bind(&updated_hash)
    .bind(&updated_tags)
    .bind(&updated_category)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let updated = Fragment {
        id,
        project_id: current.project_id.clone(),
        name: updated_name,
        content: updated_content,
        content_hash: updated_hash,
        tags: updated_tags,
        category: updated_category,
        sort_order: current.sort_order,
        deleted_at: current.deleted_at,
        created_at: current.created_at,
        updated_at: timestamp,
    };

    emit_document_status(&app, "fragment_updated", Some(&current.project_id), None);
    Ok(updated)
}

#[tauri::command]
pub async fn soft_delete_fragment(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    let project_id: String =
        sqlx::query_scalar("SELECT project_id FROM fragments WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool(&state))
            .await
            .map_err(crate::error::normalize_error)?;
    let timestamp = now();
    sqlx::query("UPDATE fragments SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(&id)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    emit_document_status(&app, "fragment_deleted", Some(&project_id), None);
    Ok(())
}

#[tauri::command]
pub async fn restore_fragment(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<Fragment, String> {
    let current = sqlx::query_as::<_, FragmentRow>(
        r#"
        SELECT id, project_id, name, content, content_hash, tags, category,
               sort_order, deleted_at, created_at, updated_at
        FROM fragments WHERE id = ?1
        "#,
    )
    .bind(&id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    let timestamp = now();
    sqlx::query("UPDATE fragments SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1")
        .bind(&id)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    let restored = Fragment {
        deleted_at: None,
        updated_at: timestamp.clone(),
        ..current.into()
    };
    emit_document_status(&app, "fragment_restored", Some(&restored.project_id), None);
    Ok(restored)
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

    async fn seed_project(pool: &SqlitePool, id: &str) {
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        )
        .bind(id)
        .bind("Project")
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("project");
    }

    #[tokio::test]
    async fn create_fragment_persists_tags_as_json_array() {
        let pool = test_pool().await;
        seed_project(&pool, "ws-1").await;
        let tags = vec!["intro".to_string(), "guide".to_string()];
        let tags_value = tags_to_string(Some(&tags));
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        let sort_order =
            crate::services::fragment::FragmentService::next_sort_order(&pool, "ws-1")
                .await
                .expect("sort order");
        sqlx::query(
            r#"
            INSERT INTO fragments (
                id, project_id, name, content, content_hash, tags, category,
                sort_order, deleted_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?9)
            "#,
        )
        .bind("frag-1")
        .bind("ws-1")
        .bind("Intro")
        .bind("")
        .bind(crate::db::content_hash(""))
        .bind(&tags_value)
        .bind(Option::<String>::None)
        .bind(sort_order)
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("fragment");

        let stored_tags: String =
            sqlx::query_scalar("SELECT tags FROM fragments WHERE id = ?1")
                .bind("frag-1")
                .fetch_one(&pool)
                .await
                .expect("tags");
        let parsed: Vec<String> = serde_json::from_str(&stored_tags).expect("parse");
        assert_eq!(parsed, vec!["intro", "guide"]);
    }

    #[tokio::test]
    async fn soft_delete_fragment_uses_deleted_at() {
        let pool = test_pool().await;
        seed_project(&pool, "ws-1").await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        sqlx::query(
            r#"
            INSERT INTO fragments (
                id, project_id, name, content, content_hash, tags, category,
                sort_order, deleted_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, '[]', NULL, 0, NULL, ?6, ?6)
            "#,
        )
        .bind("frag-1")
        .bind("ws-1")
        .bind("Intro")
        .bind("")
        .bind(crate::db::content_hash(""))
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("fragment");

        let now_ts = "2026-05-23T11:00:00Z".to_string();
        sqlx::query("UPDATE fragments SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
            .bind("frag-1")
            .bind(&now_ts)
            .execute(&pool)
            .await
            .expect("soft delete");

        let deleted_at: Option<String> =
            sqlx::query_scalar("SELECT deleted_at FROM fragments WHERE id = ?1")
                .bind("frag-1")
                .fetch_one(&pool)
                .await
                .expect("deleted_at");
        assert_eq!(deleted_at, Some(now_ts));
    }
}
