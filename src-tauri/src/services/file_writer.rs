use std::io::{ErrorKind, Write};
use std::path::Path;
#[cfg(windows)]
use std::fs::OpenOptions;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::commands;
use crate::db;
use crate::debug_log;
use crate::types::Document;

// NOTE: `commands::emit_document_status` is currently a compile error
// at the `commands::*` re-export level — the helper exists in both
// `commands::fragments` and `commands::snapshots` (with identical
// 4-arg signatures), and the new `commands::documents` copy is not
// yet registered in `commands/mod.rs`. Another agent is responsible
// for consolidating the duplicates and re-exporting a single
// `emit_document_status` from `commands/mod.rs`. Until that lands,
// this service file is part of the same compile-error surface and
// the call sites are intentionally written against the
// post-consolidation API.

pub struct FileWriterService;

impl FileWriterService {
    fn map_io_error(err: std::io::Error) -> String {
        match err.kind() {
            ErrorKind::NotFound => "target_missing".into(),
            ErrorKind::PermissionDenied => "target_not_writable".into(),
            // NOTE: the fallback string is "database_error" — a misnomer
            // inherited from the project-dimension code. We keep it for
            // now to avoid breaking callers that already branch on this
            // code; a follow-up PR should rename it to a generic
            // "write_failed" (or similar).
            _ => "database_error".into(),
        }
    }

    /// Write a single document to its bound `target_path`.
    ///
    /// Flow:
    /// 1. Bail with `"target_missing"` if the document has no target.
    /// 2. Detect external conflict: if the file already exists on disk
    ///    AND its hash differs from `document.last_written_hash`, mark
    ///    the document `conflict` and return `"external_conflict"`.
    ///    (The command layer runs `check_document_conflict` first as a
    ///    fast-path; this check is defense-in-depth for the window
    ///    between check and write.)
    /// 3. Create the parent directory, atomic-rename into place, mark
    ///    the watcher as ignored, optionally create a `Before write`
    ///    snapshot (best-effort), then update the document row and
    ///    re-SELECT it.
    pub async fn write_document_to_file(
        app: AppHandle<impl Runtime>,
        state: State<'_, crate::db::DbState>,
        document: Document,
    ) -> Result<Document, String> {
        Self::write_document_to_file_inner(app, state, document, true).await
    }

    pub async fn overwrite_document_to_file(
        app: AppHandle<impl Runtime>,
        state: State<'_, crate::db::DbState>,
        document: Document,
    ) -> Result<Document, String> {
        Self::write_document_to_file_inner(app, state, document, false).await
    }

    async fn write_document_to_file_inner(
        app: AppHandle<impl Runtime>,
        state: State<'_, crate::db::DbState>,
        document: Document,
        detect_conflict: bool,
    ) -> Result<Document, String> {
        let document_id = document.id.clone();
        let project_id = document.project_id.clone();
        let target_path = match document.target_path.clone() {
            Some(value) => value,
            None => {
                Self::set_document_status(state.pool(), &document_id, "error").await;
                return Err("target_missing".into());
            }
        };
        let target = Path::new(&target_path);

        // Conflict detection. We only fire this branch if the file is
        // already on disk and differs from the hash we last wrote.
        if detect_conflict {
            if let Some(last_hash) = document.last_written_hash.as_deref() {
                if tokio::fs::metadata(target).await.is_ok() {
                    let existing = match tokio::fs::read_to_string(target).await {
                        Ok(value) => value,
                        Err(err) => {
                            let code = Self::map_io_error(err);
                            Self::set_document_status(state.pool(), &document_id, "error").await;
                            return Err(code);
                        }
                    };
                    if db::content_hash(&existing) != last_hash {
                        debug_log!(
                            "[modudoc][write_document_to_file] external_conflict document_id={} target={}",
                            document_id,
                            target_path
                        );
                        Self::set_document_status(state.pool(), &document_id, "conflict").await;
                        commands::emit_document_status(
                            &app,
                            "document_conflict",
                            Some(&project_id),
                            Some(&document_id),
                        );
                        return Err("external_conflict".into());
                    }
                }
            }
        }

        // Ensure parent dir exists.
        if let Some(parent) = target.parent() {
            if !parent.as_os_str().is_empty() {
                if let Err(err) = tokio::fs::create_dir_all(parent).await {
                    let code = Self::map_io_error(err);
                    Self::set_document_status(state.pool(), &document_id, "error").await;
                    commands::emit_document_status(
                        &app,
                        "document_writing_failed",
                        Some(&project_id),
                        Some(&document_id),
                    );
                    return Err(code);
                }
            }
        }

        // Mark the watcher as ignored for this content hash BEFORE we
        // touch disk, so the post-write notify event is swallowed.
        let new_hash = db::content_hash(&document.content);
        let watcher_state = app
            .state::<crate::services::watcher::WatcherState>()
            .inner()
            .clone();
        watcher_state.mark_ignored(target_path.clone(), new_hash.clone());

        // Atomic temp + rename.
        if let Err(err) = Self::replace_file(&document.content, target).await {
            Self::set_document_status(state.pool(), &document_id, "error").await;
            commands::emit_document_status(
                &app,
                "document_writing_failed",
                Some(&project_id),
                Some(&document_id),
            );
            return Err(err);
        }

        // Best-effort pre-write snapshot. SnapshotService de-duplicates by
        // content hash, so this can run for every write including first save.
        if let Err(err) = crate::services::snapshot::SnapshotService::create_for_document(
            state.pool(),
            &document_id,
            "Before write",
        )
        .await
        {
            debug_log!(
                "[modudoc][write_document_to_file] snapshot create failed document_id={} err={}",
                document_id,
                err
            );
        }

        // Update the document row in a single statement.
        let timestamp = db::now_iso();
        sqlx::query(
            r#"
            UPDATE documents
            SET last_written_at = ?2,
                last_written_hash = ?3,
                save_state = 'saved',
                updated_at = ?2
            WHERE id = ?1
            "#,
        )
        .bind(&document_id)
        .bind(&timestamp)
        .bind(&new_hash)
        .execute(state.pool())
        .await
        .map_err(crate::error::normalize_error)?;

        commands::emit_document_status(
            &app,
            "document_written",
            Some(&project_id),
            Some(&document_id),
        );

        // Re-SELECT and return the fresh row.
        let updated_row: crate::types::DocumentRow =
            sqlx::query_as("SELECT * FROM documents WHERE id = ?1")
                .bind(&document_id)
                .fetch_one(state.pool())
                .await
                .map_err(crate::error::normalize_error)?;
        Ok(updated_row.into())
    }

    async fn set_document_status(pool: &sqlx::SqlitePool, document_id: &str, status: &str) {
        let _ = sqlx::query(
            "UPDATE documents SET save_state = ?2, updated_at = ?3 WHERE id = ?1",
        )
        .bind(document_id)
        .bind(status)
        .bind(db::now_iso())
        .execute(pool)
        .await;
    }

    async fn replace_file(content: &str, target: &Path) -> Result<(), String> {
        let Some(parent) = target.parent() else {
            return Err("invalid_target_path".into());
        };
        let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(Self::map_io_error)?;
        temp.write_all(content.as_bytes())
            .map_err(Self::map_io_error)?;
        temp.as_file().sync_all().map_err(Self::map_io_error)?;
        match temp.persist(target) {
            Ok(_) => {}
            Err(err) => {
                #[cfg(windows)]
                {
                    // On Windows, replacing an existing file via rename can fail if the destination
                    // is momentarily locked (e.g. by AV scanners) or opened without share-delete.
                    // Falling back to in-place truncate+write is less atomic, but more reliable.
                    if err.error.kind() == ErrorKind::PermissionDenied {
                        return Self::write_in_place(content, target);
                    }

                    // Some platforms/FS drivers can still report AlreadyExists for the replace;
                    // best-effort remove + retry once.
                    if err.error.kind() == ErrorKind::AlreadyExists {
                        let _ = std::fs::remove_file(target);
                        err.file
                            .persist(target)
                            .map_err(|err| Self::map_io_error(err.error))?;
                    } else {
                        return Err(Self::map_io_error(err.error));
                    }
                }

                #[cfg(not(windows))]
                {
                    return Err(Self::map_io_error(err.error));
                }
            }
        }
        Ok(())
    }

    #[cfg(windows)]
    fn write_in_place(content: &str, target: &Path) -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(target)
            .map_err(Self::map_io_error)?;
        file.write_all(content.as_bytes())
            .map_err(Self::map_io_error)?;
        file.sync_all().map_err(Self::map_io_error)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Document;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    use tauri::test::{mock_builder, mock_context, noop_assets};
    use tauri::Manager;

    async fn test_pool() -> sqlx::SqlitePool {
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

    async fn seed_project_and_document(
        pool: &sqlx::SqlitePool,
        target_path: &str,
        last_written_hash: Option<&str>,
    ) -> (String, String) {
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        let project_id = "project-writer".to_string();
        let document_id = "document-writer".to_string();

        sqlx::query(
            r#"
            INSERT INTO projects (id, name, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?3)
            "#,
        )
        .bind(&project_id)
        .bind("Writer")
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("project");

        sqlx::query(
            r#"
            INSERT INTO documents (
              id, project_id, name, content, content_hash, target_path,
              save_state, last_written_at, last_written_hash, sort_order,
              deleted_at, description, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, NULL, NULL, ?10, ?10)
            "#,
        )
        .bind(&document_id)
        .bind(&project_id)
        .bind("Doc")
        .bind("current content")
        .bind(db::content_hash("current content"))
        .bind(target_path)
        .bind(if last_written_hash.is_some() {
            "saved"
        } else {
            "unsaved"
        })
        .bind(timestamp.clone())
        .bind(last_written_hash)
        .bind(&timestamp)
        .execute(pool)
        .await
        .expect("document");

        (project_id, document_id)
    }

    async fn load_document(pool: &sqlx::SqlitePool, id: &str) -> Document {
        let row: crate::types::DocumentRow = sqlx::query_as("SELECT * FROM documents WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await
            .expect("document row");
        row.into()
    }

    fn build_app(pool: sqlx::SqlitePool) -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .manage(crate::db::DbState::new(pool))
            .manage(crate::services::watcher::WatcherState::new())
            .build(mock_context(noop_assets()))
            .expect("app")
    }

    #[tokio::test]
    async fn write_document_to_file_marks_conflict_when_external_change_detected() {
        let pool = test_pool().await;
        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("doc.md");
        tokio::fs::write(&target_path, "external change")
            .await
            .expect("write external");

        // Last-written hash is the hash of "previous" — which differs
        // from the actual file content "external change".
        let (_, document_id) = seed_project_and_document(
            &pool,
            &target_path.to_string_lossy(),
            Some(&db::content_hash("previous")),
        )
        .await;

        let app = build_app(pool.clone());
        let handle = app.handle().clone();
        let state = handle.state::<crate::db::DbState>();

        let document = load_document(&pool, &document_id).await;
        let err = FileWriterService::write_document_to_file(
            handle.clone(),
            state,
            document,
        )
        .await
        .unwrap_err();
        assert_eq!(err, "external_conflict");

        let updated = load_document(&pool, &document_id).await;
        assert_eq!(updated.save_state, "conflict");
    }

    #[tokio::test]
    async fn write_document_to_file_succeeds_and_updates_hashes() {
        let pool = test_pool().await;
        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("doc.md");
        // File on disk matches the last_written_hash → no conflict.
        tokio::fs::write(&target_path, "previous")
            .await
            .expect("write previous");

        let (_, document_id) = seed_project_and_document(
            &pool,
            &target_path.to_string_lossy(),
            Some(&db::content_hash("previous")),
        )
        .await;

        let app = build_app(pool.clone());
        let handle = app.handle().clone();
        let state = handle.state::<crate::db::DbState>();

        let document = load_document(&pool, &document_id).await;
        let updated = FileWriterService::write_document_to_file(
            handle.clone(),
            state,
            document,
        )
        .await
        .expect("write succeeds");

        assert_eq!(updated.save_state, "saved");
        assert_eq!(
            updated.last_written_hash.as_deref(),
            Some(db::content_hash("current content").as_str())
        );
        assert!(updated.last_written_at.is_some());

        let on_disk = tokio::fs::read_to_string(&target_path)
            .await
            .expect("read back");
        assert_eq!(on_disk, "current content");
    }

    #[tokio::test]
    async fn replace_file_overwrites_existing_target() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("doc.md");
        tokio::fs::write(&target_path, "old").await.expect("write old");

        FileWriterService::replace_file("new", &target_path)
            .await
            .expect("replace");

        let content = tokio::fs::read_to_string(&target_path)
            .await
            .expect("read");
        assert_eq!(content, "new");
    }
}
