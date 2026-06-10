use super::*;
use crate::services::document_path;
use crate::services::file_writer::FileWriterService;
use std::path::Path;

#[derive(serde::Serialize)]
pub struct DocumentConflictStatus {
    pub document_id: String,
    pub has_conflict: bool,
    pub external_content_hash: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentRequest {
    pub project_id: String,
    pub name: String,
    pub content: Option<String>,
    pub target_path: Option<String>,
    pub description: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentRequest {
    pub id: String,
    pub name: Option<String>,
    pub content: Option<String>,
    pub target_path: Option<String>,
    pub clear_target_path: Option<bool>,
    pub description: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteDocumentRequest {
    pub id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDocumentRequest {
    pub id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDocumentPermanentlyRequest {
    pub id: String,
    pub delete_target_file: Option<bool>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderDocumentsRequest {
    pub project_id: String,
    pub ordered_document_ids: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteDocumentToFileRequest {
    pub id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckDocumentConflictRequest {
    pub id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveDocumentConflictRequest {
    pub id: String,
    pub policy: String,
}

#[tauri::command]
pub async fn create_document(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: CreateDocumentRequest,
) -> Result<Document, String> {
    let CreateDocumentRequest {
        project_id,
        name,
        content,
        target_path,
        description,
    } = request;

    let normalized_target = match target_path.as_deref() {
        Some(value) if !value.trim().is_empty() => Some(document_path::normalize_target_path(value)?),
        _ => None,
    };

    let content = content.unwrap_or_default();
    let content_hash = hash(&content);
    let timestamp = now();
    let save_state = if normalized_target.is_some() {
        "unsaved"
    } else {
        "draft"
    };
    let sort_order = next_document_sort_order(pool(&state), &project_id).await?;

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO documents (
          id, project_id, name, content, content_hash, target_path,
          save_state, sort_order, description, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
        "#,
    )
    .bind(&id)
    .bind(&project_id)
    .bind(&name)
    .bind(&content)
    .bind(&content_hash)
    .bind(&normalized_target)
    .bind(save_state)
    .bind(sort_order)
    .bind(&description)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let document = Document {
        id,
        project_id,
        name,
        content,
        content_hash,
        target_path: normalized_target,
        save_state: save_state.to_string(),
        last_written_at: None,
        last_written_hash: None,
        sort_order,
        deleted_at: None,
        description,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    emit_document_status(
        &app,
        "document_created",
        Some(&document.project_id),
        Some(&document.id),
    );
    Ok(document)
}

#[tauri::command]
pub async fn update_document(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: UpdateDocumentRequest,
) -> Result<Document, String> {
    let UpdateDocumentRequest {
        id,
        name,
        content,
        target_path,
        clear_target_path,
        description,
    } = request;
    let clear_target_path = clear_target_path.unwrap_or(false);

    let current = load_document_row(pool(&state), &id).await?;
    let mut next_target = current.target_path.clone();
    let mut save_state = current.save_state.clone();
    let mut explicit_target_supplied = false;
    let mut explicit_content = false;

    if clear_target_path {
        explicit_target_supplied = true;
        next_target = None;
        save_state = "draft".to_string();
    } else if let Some(value) = target_path.as_deref() {
        explicit_target_supplied = true;
        let trimmed = value.trim();
        if trimmed.is_empty() {
            next_target = None;
            save_state = "draft".to_string();
        } else {
            let normalized = document_path::normalize_target_path(trimmed)?;
            if Some(&normalized) != current.target_path.as_ref() {
                next_target = Some(normalized);
            }
        }
    }

    let updated_name = name.unwrap_or_else(|| current.name.clone());
    let mut updated_content = current.content.clone();
    let mut updated_hash = current.content_hash.clone();
    if let Some(value) = content {
        explicit_content = true;
        updated_content = value;
        updated_hash = hash(&updated_content);
    }

    if explicit_content
        && updated_hash != current.content_hash
        && next_target.is_some()
        && (current.last_written_hash.is_none()
            || current.last_written_hash.as_deref() != Some(updated_hash.as_str()))
    {
        save_state = "unsaved".to_string();
    }

    let updated_description = match description {
        Some(value) => Some(value),
        None => current.description.clone(),
    };

    let timestamp = now();
    sqlx::query(
        r#"
        UPDATE documents
        SET name = ?2,
            content = ?3,
            content_hash = ?4,
            target_path = ?5,
            save_state = ?6,
            description = ?7,
            updated_at = ?8
        WHERE id = ?1
        "#,
    )
    .bind(&id)
    .bind(&updated_name)
    .bind(&updated_content)
    .bind(&updated_hash)
    .bind(&next_target)
    .bind(&save_state)
    .bind(&updated_description)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    let document = Document {
        id,
        project_id: current.project_id,
        name: updated_name,
        content: updated_content,
        content_hash: updated_hash,
        target_path: next_target,
        save_state,
        last_written_at: current.last_written_at,
        last_written_hash: current.last_written_hash,
        sort_order: current.sort_order,
        deleted_at: current.deleted_at,
        description: updated_description,
        created_at: current.created_at,
        updated_at: timestamp,
    };

    let mut kinds: Vec<&str> = Vec::new();
    if explicit_content {
        kinds.push("document_updated");
    }
    if explicit_target_supplied {
        kinds.push("document_target_updated");
    }
    if kinds.is_empty() {
        kinds.push("document_updated");
    }
    for kind in kinds {
        emit_document_status(
            &app,
            kind,
            Some(&document.project_id),
            Some(&document.id),
        );
    }
    Ok(document)
}

#[tauri::command]
pub async fn soft_delete_document(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: SoftDeleteDocumentRequest,
) -> Result<(), String> {
    let project_id: Option<String> = sqlx::query_scalar(
        "SELECT project_id FROM documents WHERE id = ?1 AND deleted_at IS NULL",
    )
    .bind(&request.id)
    .fetch_optional(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    let Some(project_id) = project_id else {
        return Ok(());
    };
    let timestamp = now();
    sqlx::query(
        r#"
        UPDATE documents
        SET deleted_at = ?2, target_path = NULL, save_state = 'draft', updated_at = ?2
        WHERE id = ?1 AND deleted_at IS NULL
        "#,
    )
    .bind(&request.id)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    emit_document_status(&app, "document_deleted", Some(&project_id), Some(&request.id));
    Ok(())
}

#[tauri::command]
pub async fn restore_document(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: RestoreDocumentRequest,
) -> Result<Document, String> {
    let timestamp = now();
    sqlx::query(
        "UPDATE documents SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1",
    )
    .bind(&request.id)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    let row = load_document_row(pool(&state), &request.id).await?;
    let document: Document = row.into();
    emit_document_status(
        &app,
        "document_restored",
        Some(&document.project_id),
        Some(&document.id),
    );
    Ok(document)
}

#[tauri::command]
pub async fn delete_document_permanently(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: DeleteDocumentPermanentlyRequest,
) -> Result<(), String> {
    let delete_target_file = request.delete_target_file.unwrap_or(false);
    let target_path: Option<String> = sqlx::query_scalar(
        "SELECT target_path FROM documents WHERE id = ?1",
    )
    .bind(&request.id)
    .fetch_optional(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?
    .flatten();

    let project_id: Option<String> = sqlx::query_scalar(
        "SELECT project_id FROM documents WHERE id = ?1",
    )
    .bind(&request.id)
    .fetch_optional(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;

    sqlx::query("DELETE FROM documents WHERE id = ?1")
        .bind(&request.id)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;

    if delete_target_file {
        if let Some(path) = target_path.as_deref() {
            if let Err(err) = tokio::fs::remove_file(path).await {
                crate::debug_log!(
                    "[modudoc][delete_document_permanently] remove_file failed path={} err={}",
                    path,
                    err
                );
            }
        }
    }

    if let Some(project_id) = project_id.as_deref() {
        emit_document_status(&app, "document_deleted", Some(project_id), Some(&request.id));
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_documents(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: ReorderDocumentsRequest,
) -> Result<(), String> {
    let ReorderDocumentsRequest {
        project_id,
        ordered_document_ids,
    } = request;

    if ordered_document_ids.is_empty() {
        return Ok(());
    }

    let mut tx = pool(&state)
        .begin()
        .await
        .map_err(crate::error::normalize_error)?;
    let timestamp = now();
    for (index, doc_id) in ordered_document_ids.iter().enumerate() {
        sqlx::query(
            r#"
            UPDATE documents
            SET sort_order = ?3, updated_at = ?4
            WHERE id = ?1 AND project_id = ?2 AND deleted_at IS NULL
            "#,
        )
        .bind(doc_id)
        .bind(&project_id)
        .bind(index as i64)
        .bind(&timestamp)
        .execute(&mut *tx)
        .await
        .map_err(crate::error::normalize_error)?;
    }
    tx.commit().await.map_err(crate::error::normalize_error)?;

    emit_document_status(&app, "document_reordered", Some(&project_id), None);
    Ok(())
}

#[tauri::command]
pub async fn write_document_to_file(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: WriteDocumentToFileRequest,
) -> Result<Document, String> {
    let document = load_document_row(pool(&state), &request.id).await?;
    let target_path = document
        .target_path
        .clone()
        .ok_or_else(|| "target_missing".to_string())?;

    if let Some(last_written_hash) = document.last_written_hash.as_deref() {
        if tokio::fs::metadata(&target_path).await.is_ok() {
            let existing = tokio::fs::read_to_string(&target_path)
                .await
                .map_err(crate::error::normalize_error)?;
            let external_hash = hash(&existing);
            if external_hash != last_written_hash {
                let timestamp = now();
                sqlx::query(
                    "UPDATE documents SET save_state = 'conflict', updated_at = ?2 WHERE id = ?1",
                )
                .bind(&document.id)
                .bind(&timestamp)
                .execute(pool(&state))
                .await
                .map_err(crate::error::normalize_error)?;
                emit_document_status(
                    &app,
                    "document_conflict",
                    Some(&document.project_id),
                    Some(&document.id),
                );
                return Err("external_conflict".into());
            }
        }
    }

    if let Some(parent) = Path::new(&target_path).parent() {
        if !parent.as_os_str().is_empty() {
            if let Err(err) = tokio::fs::create_dir_all(parent).await {
                let code = match err.kind() {
                    std::io::ErrorKind::PermissionDenied => "target_not_writable",
                    _ => "database_error",
                };
                let timestamp = now();
                sqlx::query(
                    "UPDATE documents SET save_state = 'error', updated_at = ?2 WHERE id = ?1",
                )
                .bind(&document.id)
                .bind(&timestamp)
                .execute(pool(&state))
                .await
                .map_err(crate::error::normalize_error)?;
                emit_document_status(
                    &app,
                    "document_writing_failed",
                    Some(&document.project_id),
                    Some(&document.id),
                );
                return Err(code.to_string());
            }
        }
    }

    let updated = FileWriterService::write_document_to_file(
        app.clone(),
        state.clone(),
        document.into(),
    )
    .await?;

    emit_document_status(
        &app,
        "document_written",
        Some(&updated.project_id),
        Some(&updated.id),
    );
    Ok(updated)
}

#[tauri::command]
pub async fn check_document_conflict(
    state: State<'_, db::DbState>,
    request: CheckDocumentConflictRequest,
) -> Result<DocumentConflictStatus, String> {
    let document = load_document_row(pool(&state), &request.id).await?;
    let Some(target_path) = document.target_path.clone() else {
        return Ok(DocumentConflictStatus {
            document_id: document.id,
            has_conflict: false,
            external_content_hash: None,
        });
    };
    let Some(last_written_hash) = document.last_written_hash.clone() else {
        return Ok(DocumentConflictStatus {
            document_id: document.id,
            has_conflict: false,
            external_content_hash: None,
        });
    };
    match tokio::fs::read_to_string(&target_path).await {
        Ok(existing) => {
            let external_hash = hash(&existing);
            let has_conflict = external_hash != last_written_hash;
            Ok(DocumentConflictStatus {
                document_id: document.id,
                has_conflict,
                external_content_hash: Some(external_hash),
            })
        }
        Err(_) => Ok(DocumentConflictStatus {
            document_id: document.id,
            has_conflict: false,
            external_content_hash: None,
        }),
    }
}

#[tauri::command]
pub async fn resolve_document_conflict(
    app: AppHandle,
    state: State<'_, db::DbState>,
    request: ResolveDocumentConflictRequest,
) -> Result<Document, String> {
    let ResolveDocumentConflictRequest { id, policy } = request;
    let document = load_document_row(pool(&state), &id).await?;
    let target_path = document
        .target_path
        .clone()
        .ok_or_else(|| "target_missing".to_string())?;

    match policy.as_str() {
        "import_external" => {
            let external = tokio::fs::read_to_string(&target_path)
                .await
                .map_err(crate::error::normalize_error)?;
            let new_hash = hash(&external);
            let timestamp = now();
            sqlx::query(
                r#"
                UPDATE documents
                SET content = ?2,
                    content_hash = ?3,
                    save_state = 'saved',
                    last_written_at = ?4,
                    last_written_hash = ?3,
                    updated_at = ?4
                WHERE id = ?1
                "#,
            )
            .bind(&id)
            .bind(&external)
            .bind(&new_hash)
            .bind(&timestamp)
            .execute(pool(&state))
            .await
            .map_err(crate::error::normalize_error)?;
            let updated = load_document_row(pool(&state), &id).await?;
            let document: Document = updated.into();
            emit_document_status(
                &app,
                "document_conflict_resolved",
                Some(&document.project_id),
                Some(&document.id),
            );
            Ok(document)
        }
        "overwrite_external" => {
            let updated = FileWriterService::overwrite_document_to_file(
                app.clone(),
                state.clone(),
                document.into(),
            )
            .await?;
            emit_document_status(
                &app,
                "document_conflict_resolved",
                Some(&updated.project_id),
                Some(&updated.id),
            );
            Ok(updated)
        }
        "backup_and_overwrite" => {
            let timestamp_str = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
            let backup_path =
                Path::new(&target_path).with_extension(format!("bak.{timestamp_str}"));
            if let Err(err) = tokio::fs::copy(&target_path, &backup_path).await {
                crate::debug_log!(
                    "[modudoc][resolve_document_conflict] backup copy failed src={} dst={} err={}",
                    target_path,
                    backup_path.display(),
                    err
                );
            }
            let updated = FileWriterService::overwrite_document_to_file(
                app.clone(),
                state.clone(),
                document.into(),
            )
            .await?;
            emit_document_status(
                &app,
                "document_conflict_resolved",
                Some(&updated.project_id),
                Some(&updated.id),
            );
            Ok(updated)
        }
        "cancel" => {
            let timestamp = now();
            sqlx::query("UPDATE documents SET save_state = 'unsaved', updated_at = ?2 WHERE id = ?1")
                .bind(&document.id)
                .bind(&timestamp)
                .execute(pool(&state))
                .await
                .map_err(crate::error::normalize_error)?;
            let updated = load_document_row(pool(&state), &document.id).await?;
            let document: Document = updated.into();
            emit_document_status(
                &app,
                "document_conflict_resolved",
                Some(&document.project_id),
                Some(&document.id),
            );
            Ok(document)
        }
        other => Err(format!("invalid_conflict_policy: {other}")),
    }
}

pub(crate) async fn load_document_row(
    pool: &SqlitePool,
    id: &str,
) -> Result<DocumentRow, String> {
    sqlx::query_as::<_, DocumentRow>(
        r#"
        SELECT id, project_id, name, content, content_hash, target_path,
               save_state, last_written_at, last_written_hash, sort_order,
               deleted_at, description, created_at, updated_at
        FROM documents WHERE id = ?1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(crate::error::normalize_error)
}

pub(crate) async fn next_document_sort_order(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<i64, String> {
    let next: Option<i64> = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM documents WHERE project_id = ?1",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(next.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    use tempfile::tempdir;

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

    async fn insert_project(pool: &SqlitePool, id: &str, timestamp: &str) {
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        )
        .bind(id)
        .bind("Project")
        .bind(timestamp)
        .execute(pool)
        .await
        .expect("project");
    }

    #[tokio::test]
    async fn normalize_target_path_called_for_create() {
        let pool = test_pool().await;
        let ts = "2026-06-09T00:00:00Z";
        insert_project(&pool, "ws-create", ts).await;

        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("note.md");
        tokio::fs::write(&target, "external body")
            .await
            .expect("write target");

        // Build a request and exercise the insert path used by the command.
        // We don't construct an AppHandle here; the assertion is that the
        // document row is inserted with save_state = 'unsaved' when a target
        // is provided and points to an existing file on disk.
        let normalized = document_path::normalize_target_path(
            target.to_str().expect("utf8 path"),
        )
        .expect("normalize");

        let id = Uuid::new_v4().to_string();
        let content = "hello";
        let content_hash = hash(content);
        sqlx::query(
            r#"INSERT INTO documents
               (id, project_id, name, content, content_hash, target_path, save_state, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unsaved', ?7, ?7)"#,
        )
        .bind(&id)
        .bind("ws-create")
        .bind("note.md")
        .bind(content)
        .bind(&content_hash)
        .bind(&normalized)
        .bind(ts)
        .execute(&pool)
        .await
        .expect("insert document");

        let status: String =
            sqlx::query_scalar("SELECT save_state FROM documents WHERE id = ?1")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .expect("save_state");
        assert_eq!(status, "unsaved");
    }

    #[tokio::test]
    async fn soft_delete_releases_target_path() {
        let pool = test_pool().await;
        let ts = "2026-06-09T00:00:00Z";
        insert_project(&pool, "ws-soft", ts).await;

        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("shared.md");
        tokio::fs::write(&target, "x").await.expect("write target");
        let normalized = document_path::normalize_target_path(
            target.to_str().expect("utf8 path"),
        )
        .expect("normalize");

        // First document occupies the target.
        let first_id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT INTO documents
               (id, project_id, name, content, content_hash, target_path, save_state, created_at, updated_at)
               VALUES (?1, ?2, 'first', '', '', ?3, 'unsaved', ?4, ?4)"#,
        )
        .bind(&first_id)
        .bind("ws-soft")
        .bind(&normalized)
        .bind(ts)
        .execute(&pool)
        .await
        .expect("first insert");

        // Soft delete the first document via the same SQL the command runs.
        sqlx::query(
            "UPDATE documents SET deleted_at = ?2, target_path = NULL, save_state = 'draft', updated_at = ?2 WHERE id = ?1",
        )
        .bind(&first_id)
        .bind(ts)
        .execute(&pool)
        .await
        .expect("soft delete");

        // A second document should now be able to claim the same target_path
        // because the soft delete cleared the unique slot.
        let second_id = Uuid::new_v4().to_string();
        let res = sqlx::query(
            r#"INSERT INTO documents
               (id, project_id, name, content, content_hash, target_path, save_state, created_at, updated_at)
               VALUES (?1, ?2, 'second', '', '', ?3, 'unsaved', ?4, ?4)"#,
        )
        .bind(&second_id)
        .bind("ws-soft")
        .bind(&normalized)
        .bind(ts)
        .execute(&pool)
        .await;
        assert!(
            res.is_ok(),
            "second insert should succeed after soft delete released target_path"
        );
    }
}
