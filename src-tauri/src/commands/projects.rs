use super::*;
use std::collections::HashMap;

#[tauri::command]
pub async fn list_projects(state: State<'_, db::DbState>) -> Result<Vec<Project>, String> {
    let started = std::time::Instant::now();
    crate::debug_log!("[rust] list_projects start");
    let rows = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, name, created_at, updated_at
        FROM projects
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    crate::debug_log!(
        "[rust] list_projects done rows={} took={:.1}ms",
        rows.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );
    Ok(rows.into_iter().map(Project::from).collect())
}

#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    state: State<'_, db::DbState>,
    name: String,
    initial_document_name: Option<String>,
) -> Result<Project, String> {
    let id = Uuid::new_v4().to_string();
    let document_id = Uuid::new_v4().to_string();
    let timestamp = now();
    let document_name = initial_document_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Untitled.md".to_string());

    let mut tx = pool(&state)
        .begin()
        .await
        .map_err(crate::error::normalize_error)?;

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        "#,
    )
    .bind(&id)
    .bind(&name)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;

    sqlx::query(
        r#"
        INSERT INTO documents (
            id, project_id, name, content, content_hash,
            target_path, save_state, sort_order, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, '', '', NULL, 'draft', 0, ?4, ?5)
        "#,
    )
    .bind(&document_id)
    .bind(&id)
    .bind(&document_name)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&mut *tx)
    .await
    .map_err(crate::error::normalize_error)?;

    tx.commit().await.map_err(crate::error::normalize_error)?;

    emit_project_status_for(&app, "project_created", &id);
    Ok(Project {
        id,
        name,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn update_project(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
    name: Option<String>,
) -> Result<Project, String> {
    let current = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, name, created_at, updated_at
        FROM projects WHERE id = ?1
        "#,
    )
    .bind(&id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let updated_name = name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or(current.name.clone());
    let timestamp = now();

    sqlx::query(
        r#"
        UPDATE projects
        SET name = ?2, updated_at = ?3
        WHERE id = ?1
        "#,
    )
    .bind(&id)
    .bind(&updated_name)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    emit_project_status_for(&app, "project_updated", &id);
    Ok(Project {
        id,
        name: updated_name,
        created_at: current.created_at,
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn delete_project(
    app: AppHandle,
    state: State<'_, db::DbState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM projects WHERE id = ?1")
        .bind(&id)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    emit_project_status_for(&app, "project_deleted", &id);
    Ok(())
}

#[tauri::command]
pub async fn load_project(
    state: State<'_, db::DbState>,
    id: String,
) -> Result<ProjectLoadResult, String> {
    let started = std::time::Instant::now();
    crate::debug_log!("[rust] load_project start id={}", id);

    let project: Project = sqlx::query_as::<_, ProjectRow>(
        r#"
        SELECT id, name, created_at, updated_at
        FROM projects WHERE id = ?1
        "#,
    )
    .bind(&id)
    .fetch_one(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into();
    crate::debug_log!(
        "[rust] load_project project row took={:.1}ms",
        started.elapsed().as_secs_f64() * 1000.0
    );

    let documents: Vec<Document> = sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, project_id, name, content, content_hash, target_path,
               save_state, last_written_at, last_written_hash, sort_order,
               deleted_at, description, created_at, updated_at
        FROM documents
        WHERE project_id = ?1
        ORDER BY (deleted_at IS NOT NULL) ASC, sort_order ASC, created_at ASC
        "#,
    )
    .bind(&id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .into_iter()
    .map(Document::from)
    .collect();
    crate::debug_log!(
        "[rust] load_project documents={} took={:.1}ms",
        documents.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let fragments: Vec<Fragment> = sqlx::query_as::<_, FragmentRow>(
        r#"
        SELECT id, project_id, name, content, content_hash, tags, category,
               sort_order, deleted_at, created_at, updated_at
        FROM fragments
        WHERE project_id = ?1
        ORDER BY (deleted_at IS NOT NULL) ASC, sort_order ASC, created_at ASC
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
        "[rust] load_project fragments={} took={:.1}ms",
        fragments.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let recipes: Vec<Recipe> = sqlx::query_as::<_, RecipeRow>(
        r#"
        SELECT id, project_id, name, description, deleted_at, created_at, updated_at
        FROM recipes
        WHERE project_id = ?1
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
        "[rust] load_project recipes={} took={:.1}ms",
        recipes.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let recipe_items: Vec<RecipeItem> = sqlx::query_as::<_, RecipeItemRow>(
        r#"
        SELECT id, recipe_id, fragment_id, enabled, sort_order
        FROM recipe_items
        WHERE recipe_id IN (SELECT id FROM recipes WHERE project_id = ?1)
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
        "[rust] load_project recipe_items={} took={:.1}ms",
        recipe_items.len(),
        started.elapsed().as_secs_f64() * 1000.0
    );

    let snapshot_rows = sqlx::query_as::<_, SnapshotRow>(
        r#"
        SELECT id, document_id, label, content, content_hash, created_at
        FROM snapshots
        WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?1)
        ORDER BY created_at DESC
        "#,
    )
    .bind(&id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let mut snapshots: HashMap<String, Vec<Snapshot>> = HashMap::new();
    for row in snapshot_rows {
        snapshots
            .entry(row.document_id.clone())
            .or_default()
            .push(Snapshot::from(row));
    }
    crate::debug_log!(
        "[rust] load_project snapshot_groups={} total_snapshots={} took={:.1}ms",
        snapshots.len(),
        snapshots.values().map(|items| items.len()).sum::<usize>(),
        started.elapsed().as_secs_f64() * 1000.0
    );
    crate::debug_log!(
        "[rust] load_project done id={} total={:.1}ms",
        id,
        started.elapsed().as_secs_f64() * 1000.0
    );

    Ok(ProjectLoadResult {
        project,
        documents,
        fragments,
        recipes,
        recipe_items,
        snapshots,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;
    use std::collections::HashMap;
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

    #[tokio::test]
    async fn create_project_inserts_first_untitled_document() {
        let pool = test_pool().await;
        let timestamp = "2026-06-09T10:00:00Z".to_string();
        let project_id = "ws-main";
        let document_id = "doc-main";

        let mut tx = pool.begin().await.expect("tx");
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(project_id)
        .bind("Main Project")
        .bind(&timestamp)
        .bind(&timestamp)
        .execute(&mut *tx)
        .await
        .expect("project");
        sqlx::query(
            r#"
            INSERT INTO documents (
                id, project_id, name, content, content_hash,
                target_path, save_state, sort_order, created_at, updated_at
            )
            VALUES (?1, ?2, 'Untitled.md', '', '', NULL, 'draft', 0, ?3, ?4)
            "#,
        )
        .bind(document_id)
        .bind(project_id)
        .bind(&timestamp)
        .bind(&timestamp)
        .execute(&mut *tx)
        .await
        .expect("document");
        tx.commit().await.expect("commit");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM documents WHERE project_id = ?1")
            .bind(project_id)
            .fetch_one(&pool)
            .await
            .expect("count");
        assert_eq!(count, 1);

        let (name, save_state, target_path, sort_order): (String, String, Option<String>, i64) =
            sqlx::query_as(
                r#"
                SELECT name, save_state, target_path, sort_order
                FROM documents WHERE id = ?1
                "#,
            )
            .bind(document_id)
            .fetch_one(&pool)
            .await
            .expect("document row");
        assert_eq!(name, "Untitled.md");
        assert_eq!(save_state, "draft");
        assert!(target_path.is_none());
        assert_eq!(sort_order, 0);
    }

    #[tokio::test]
    async fn load_project_groups_snapshots_by_document_id() {
        let pool = test_pool().await;
        let timestamp = "2026-06-09T10:00:00Z".to_string();
        let project_id = "ws-snap";

        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(project_id)
        .bind("Snap Project")
        .bind(&timestamp)
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("project");

        for (doc_id, doc_name) in [("doc-a", "A.md"), ("doc-b", "B.md")] {
            sqlx::query(
                r#"
                INSERT INTO documents (
                    id, project_id, name, content, content_hash,
                    target_path, save_state, sort_order, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, '', '', NULL, 'draft', 0, ?4, ?5)
                "#,
            )
            .bind(doc_id)
            .bind(project_id)
            .bind(doc_name)
            .bind(&timestamp)
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("document");
        }

        for (snap_id, doc_id) in [
            ("snap-a-1", "doc-a"),
            ("snap-a-2", "doc-a"),
            ("snap-b-1", "doc-b"),
        ] {
            sqlx::query(
                r#"
                INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at)
                VALUES (?1, ?2, NULL, '', '', ?3)
                "#,
            )
            .bind(snap_id)
            .bind(doc_id)
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("snapshot");
        }

        let snapshot_rows = sqlx::query_as::<_, SnapshotRow>(
            r#"
            SELECT id, document_id, label, content, content_hash, created_at
            FROM snapshots
            WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?1)
            ORDER BY created_at DESC
            "#,
        )
        .bind(project_id)
        .fetch_all(&pool)
        .await
        .expect("snapshot rows");

        let mut snapshots: HashMap<String, Vec<Snapshot>> = HashMap::new();
        for row in snapshot_rows {
            snapshots
                .entry(row.document_id.clone())
                .or_default()
                .push(Snapshot::from(row));
        }

        assert_eq!(snapshots.len(), 2);
        assert_eq!(snapshots.get("doc-a").map(|items| items.len()), Some(2));
        assert_eq!(snapshots.get("doc-b").map(|items| items.len()), Some(1));
    }
}
