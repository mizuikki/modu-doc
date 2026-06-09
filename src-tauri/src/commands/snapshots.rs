use super::*;
use tauri::Runtime;
use uuid::Uuid;

#[tauri::command]
pub async fn create_snapshot(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    document_id: String,
    label: Option<String>,
) -> Result<Snapshot, String> {
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

    let latest: Option<SnapshotRow> = sqlx::query_as::<_, SnapshotRow>(
        r#"
        SELECT id, document_id, label, content, content_hash, created_at
        FROM snapshots
        WHERE document_id = ?1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(&document_id)
    .fetch_optional(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    if let Some(latest) = latest {
        if latest.content_hash == document.content_hash {
            emit_document_status(
                &app,
                "snapshot_created",
                Some(&document.workspace_id),
                Some(&document_id),
            );
            return Ok(latest.into());
        }
    }

    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let new_snapshot = Snapshot {
        id: id.clone(),
        document_id: document_id.clone(),
        label: label.clone(),
        content: document.content.clone(),
        content_hash: document.content_hash.clone(),
        created_at: timestamp.clone(),
    };
    sqlx::query(
        r#"
        INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        "#,
    )
    .bind(&id)
    .bind(&document_id)
    .bind(&label)
    .bind(&document.content)
    .bind(&document.content_hash)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    emit_document_status(
        &app,
        "snapshot_created",
        Some(&document.workspace_id),
        Some(&document_id),
    );
    Ok(new_snapshot)
}

#[tauri::command]
pub async fn list_document_snapshots(
    _app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    document_id: String,
) -> Result<Vec<Snapshot>, String> {
    let rows = sqlx::query_as::<_, SnapshotRow>(
        r#"
        SELECT id, document_id, label, content, content_hash, created_at
        FROM snapshots
        WHERE document_id = ?1
        ORDER BY created_at DESC
        "#,
    )
    .bind(&document_id)
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(rows.into_iter().map(Snapshot::from).collect())
}

#[tauri::command]
pub async fn restore_snapshot(
    app: AppHandle<impl Runtime>,
    state: State<'_, db::DbState>,
    document_id: String,
    snapshot_id: String,
    mode: String,
) -> Result<Document, String> {
    let snapshot = sqlx::query_as::<_, SnapshotRow>(
        r#"
        SELECT id, document_id, label, content, content_hash, created_at
        FROM snapshots WHERE id = ?1
        "#,
    )
    .bind(&snapshot_id)
    .fetch_one(pool(&state))
    .await
    .map_err(|_| "snapshot_not_found".to_string())?;

    let source = sqlx::query_as::<_, DocumentRow>(
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

    let new_id = Uuid::new_v4().to_string();
    let timestamp = now();
    let new_status = if source.target_path.is_some() {
        "dirty"
    } else {
        "missing_target"
    };

    let result_document: Document = if mode == "new_doc" {
        let sort_order: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM documents WHERE workspace_id = ?1",
        )
        .bind(&source.workspace_id)
        .fetch_one(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
        let new_name = format!("{} (Restored)", source.name);
        sqlx::query(
            r#"
            INSERT INTO documents (
                id, workspace_id, name, content, content_hash, target_path, file_status,
                last_written_at, last_written_hash, sort_order, deleted_at, description,
                created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8, NULL, NULL, ?9, ?9)
            "#,
        )
        .bind(&new_id)
        .bind(&source.workspace_id)
        .bind(&new_name)
        .bind(&snapshot.content)
        .bind(&snapshot.content_hash)
        .bind(&source.target_path)
        .bind(new_status)
        .bind(sort_order)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
        sqlx::query_as::<_, DocumentRow>(
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
        .into()
    } else {
        sqlx::query(
            r#"
            UPDATE documents
            SET content = ?2, content_hash = ?3, file_status = ?4, updated_at = ?5
            WHERE id = ?1
            "#,
        )
        .bind(&document_id)
        .bind(&snapshot.content)
        .bind(&snapshot.content_hash)
        .bind(new_status)
        .bind(&timestamp)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
        sqlx::query_as::<_, DocumentRow>(
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
        .into()
    };

    emit_document_status(
        &app,
        "snapshot_restored",
        Some(&result_document.workspace_id),
        Some(&result_document.id),
    );
    Ok(result_document)
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

    async fn seed_workspace_and_document(pool: &SqlitePool) -> (String, String) {
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
            INSERT INTO documents (
                id, workspace_id, name, content, content_hash, target_path, file_status,
                last_written_at, last_written_hash, sort_order, deleted_at, description,
                created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, NULL, 'missing_target', NULL, NULL, 0, NULL, NULL, ?6, ?6)
            "#,
        )
        .bind("doc-1")
        .bind("ws-1")
        .bind("Doc 1")
        .bind("hello world")
        .bind(crate::db::content_hash("hello world"))
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("document");
        ("ws-1".to_string(), "doc-1".to_string())
    }

    #[tokio::test]
    async fn create_snapshot_skips_when_content_hash_unchanged() {
        let pool = test_pool().await;
        let (_ws_id, doc_id) = seed_workspace_and_document(&pool).await;

        let snapshot = Snapshot {
            id: "snap-1".to_string(),
            document_id: doc_id.clone(),
            label: Some("first".to_string()),
            content: "hello world".to_string(),
            content_hash: crate::db::content_hash("hello world"),
            created_at: "2026-05-23T10:00:00Z".to_string(),
        };
        sqlx::query(
            "INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&snapshot.id)
        .bind(&snapshot.document_id)
        .bind(&snapshot.label)
        .bind(&snapshot.content)
        .bind(&snapshot.content_hash)
        .bind(&snapshot.created_at)
        .execute(&pool)
        .await
        .expect("snapshot");

        let latest: Option<SnapshotRow> = sqlx::query_as::<_, SnapshotRow>(
            "SELECT id, document_id, label, content, content_hash, created_at
             FROM snapshots WHERE document_id = ?1 ORDER BY created_at DESC LIMIT 1",
        )
        .bind(&doc_id)
        .fetch_optional(&pool)
        .await
        .expect("latest");
        let doc: DocumentRow = sqlx::query_as::<_, DocumentRow>(
            "SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
                    last_written_at, last_written_hash, sort_order, deleted_at, description,
                    created_at, updated_at
             FROM documents WHERE id = ?1",
        )
        .bind(&doc_id)
        .fetch_one(&pool)
        .await
        .expect("doc");
        assert_eq!(latest.unwrap().content_hash, doc.content_hash);
    }

    #[tokio::test]
    async fn restore_snapshot_in_new_doc_mode_copies_content() {
        let pool = test_pool().await;
        let (_ws_id, doc_id) = seed_workspace_and_document(&pool).await;

        let snapshot = Snapshot {
            id: "snap-1".to_string(),
            document_id: doc_id.clone(),
            label: Some("checkpoint".to_string()),
            content: "restored content".to_string(),
            content_hash: crate::db::content_hash("restored content"),
            created_at: "2026-05-23T10:00:00Z".to_string(),
        };
        sqlx::query(
            "INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&snapshot.id)
        .bind(&snapshot.document_id)
        .bind(&snapshot.label)
        .bind(&snapshot.content)
        .bind(&snapshot.content_hash)
        .bind(&snapshot.created_at)
        .execute(&pool)
        .await
        .expect("snapshot");

        let new_id = "doc-restored-1".to_string();
        let new_name = format!("{} (Restored)", "Doc 1");
        let new_status = "missing_target";
        let timestamp = "2026-05-23T11:00:00Z".to_string();
        sqlx::query(
            r#"
            INSERT INTO documents (
                id, workspace_id, name, content, content_hash, target_path, file_status,
                last_written_at, last_written_hash, sort_order, deleted_at, description,
                created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL, NULL, 1, NULL, NULL, ?7, ?7)
            "#,
        )
        .bind(&new_id)
        .bind("ws-1")
        .bind(&new_name)
        .bind(&snapshot.content)
        .bind(&snapshot.content_hash)
        .bind(new_status)
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("new doc");

        let restored: DocumentRow = sqlx::query_as::<_, DocumentRow>(
            "SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
                    last_written_at, last_written_hash, sort_order, deleted_at, description,
                    created_at, updated_at
             FROM documents WHERE id = ?1",
        )
        .bind(&new_id)
        .fetch_one(&pool)
        .await
        .expect("restored");
        assert_eq!(restored.content, "restored content");
        assert_eq!(restored.workspace_id, "ws-1");
        assert_eq!(restored.file_status, "missing_target");
    }
}
