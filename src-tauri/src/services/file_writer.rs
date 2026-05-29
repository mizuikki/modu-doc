use std::io::{ErrorKind, Write};
use std::path::Path;
#[cfg(windows)]
use std::fs::OpenOptions;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::commands;
use crate::db;
use crate::debug_log;

pub struct FileWriterService;

impl FileWriterService {
    fn map_io_error(err: std::io::Error) -> String {
        match err.kind() {
            ErrorKind::NotFound => "target_missing".into(),
            ErrorKind::PermissionDenied => "target_not_writable".into(),
            _ => "database_error".into(),
        }
    }

    pub async fn write_target_file(
        app: AppHandle<impl Runtime>,
        state: State<'_, crate::db::DbState>,
        workspace_id: String,
        conflict_policy: String,
    ) -> Result<(), String> {
        debug_log!(
            "[modudoc][write_target_file] workspace_id={} policy={}",
            workspace_id,
            conflict_policy
        );
        let load = commands::load_workspace(state.clone(), workspace_id.clone()).await?;
        let Some(target_path) = load.workspace.target_path.clone() else {
            Self::set_workspace_status(state.pool(), &workspace_id, "error").await;
            return Err("invalid_target_path".into());
        };
        let content = commands::compile_workspace(state.clone(), workspace_id.clone()).await?;
        let target = Path::new(&target_path);
        if let Some(parent) = target.parent() {
            if let Err(err) = tokio::fs::create_dir_all(parent).await {
                let code = Self::map_io_error(err);
                Self::set_workspace_status(state.pool(), &workspace_id, "error").await;
                return Err(code);
            }
        }
        let existing_hash = if tokio::fs::metadata(target).await.is_ok() {
            let existing = match tokio::fs::read_to_string(target).await {
                Ok(value) => value,
                Err(err) => {
                    let code = Self::map_io_error(err);
                    Self::set_workspace_status(state.pool(), &workspace_id, "error").await;
                    return Err(code);
                }
            };
            Some(db::content_hash(&existing))
        } else {
            None
        };
        let compiled_hash = db::content_hash(&content);
        let last_compiled_hash = load
            .workspace
            .last_compiled_hash
            .clone()
            .unwrap_or_default();
        let should_create_snapshot =
            load.workspace.last_compiled_hash.as_deref() != Some(compiled_hash.as_str());
        let conflict = match existing_hash.as_deref() {
            Some(existing) if existing != last_compiled_hash => true,
            Some(_) => false,
            None => false,
        };
        if conflict && conflict_policy == "import_as_fragment" {
            debug_log!(
                "[modudoc][write_target_file] conflict import_as_fragment workspace_id={}",
                workspace_id
            );
            commands::import_markdown_file(
                app.clone(),
                state.clone(),
                workspace_id.clone(),
                target_path.clone(),
                "import_as_fragment".into(),
            )
            .await?;
            sqlx::query(
                "UPDATE workspaces SET status = 'conflicted', updated_at = ?2 WHERE id = ?1",
            )
            .bind(&workspace_id)
            .bind(db::now_iso())
            .execute(state.pool())
            .await
            .map_err(crate::error::normalize_error)?;
            commands::emit_workspace_status_for(
                &app,
                "conflict_imported_as_fragment",
                &workspace_id,
            );
            return Ok(());
        }
        if conflict
            && conflict_policy != "backup_then_overwrite"
            && conflict_policy != "overwrite_target"
            && conflict_policy != "safe_sync"
        {
            debug_log!(
                "[modudoc][write_target_file] conflict detected workspace_id={}",
                workspace_id
            );
            Self::set_workspace_status(state.pool(), &workspace_id, "conflicted").await;
            return Err("external_conflict".into());
        }
        if conflict && conflict_policy == "safe_sync" {
            debug_log!(
                "[modudoc][write_target_file] conflict safe_sync workspace_id={}",
                workspace_id
            );
            Self::set_workspace_status(state.pool(), &workspace_id, "conflicted").await;
            return Err("external_conflict".into());
        }
        if conflict && conflict_policy == "backup_then_overwrite" {
            let backup_path =
                target.with_extension(format!("{}.bak", chrono::Utc::now().format("%Y%m%d%H%M%S")));
            if let Err(err) = tokio::fs::copy(target, &backup_path).await {
                let code = Self::map_io_error(err);
                Self::set_workspace_status(state.pool(), &workspace_id, "error").await;
                return Err(code);
            }
        }
        let watcher_state = app
            .state::<crate::services::watcher::WatcherState>()
            .clone();
        watcher_state.mark_ignored(target_path.clone(), compiled_hash.clone());
        if let Err(err) = Self::replace_file(content.as_str(), target).await {
            Self::set_workspace_status(state.pool(), &workspace_id, "error").await;
            return Err(err);
        }
        let timestamp = db::now_iso();
        sqlx::query(
      "UPDATE workspaces SET last_compiled_at = ?2, last_compiled_hash = ?3, status = 'ready', updated_at = ?2 WHERE id = ?1",
    )
    .bind(&workspace_id)
    .bind(&timestamp)
    .bind(&compiled_hash)
    .execute(state.pool())
    .await
    .map_err(crate::error::normalize_error)?;
        let existing_link = sqlx::query_as::<_, (String,)>(
            "SELECT id FROM file_links WHERE workspace_id = ?1 AND path = ?2 LIMIT 1",
        )
        .bind(&workspace_id)
        .bind(&target_path)
        .fetch_optional(state.pool())
        .await
        .map_err(crate::error::normalize_error)?;
        if let Some((id,)) = existing_link {
            sqlx::query("UPDATE file_links SET last_known_hash = ?3, last_seen_at = ?4, is_managed = 1 WHERE id = ?1 AND workspace_id = ?2")
        .bind(id)
        .bind(&workspace_id)
        .bind(&compiled_hash)
        .bind(&timestamp)
        .execute(state.pool())
        .await
        .map_err(crate::error::normalize_error)?;
        } else {
            sqlx::query(
        "INSERT INTO file_links (id, workspace_id, path, last_known_hash, last_seen_at, is_managed) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
      )
      .bind(uuid::Uuid::new_v4().to_string())
      .bind(&workspace_id)
      .bind(&target_path)
      .bind(&compiled_hash)
      .bind(&timestamp)
      .execute(state.pool())
      .await
      .map_err(crate::error::normalize_error)?;
        }
        if should_create_snapshot {
            let _ = commands::create_snapshot(
                app.clone(),
                state.clone(),
                workspace_id.clone(),
                Some("auto_snapshot".into()),
            )
            .await;
        }
        commands::emit_workspace_status_for(&app, "workspace_synced", &workspace_id);
        Ok(())
    }

    async fn set_workspace_status(pool: &sqlx::SqlitePool, workspace_id: &str, status: &str) {
        let _ = sqlx::query("UPDATE workspaces SET status = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(workspace_id)
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

    #[tokio::test]
    async fn safe_sync_conflict_marks_workspace_conflicted() {
        let pool = test_pool().await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();

        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("workspace.md");
        tokio::fs::write(&target_path, "external change")
            .await
            .expect("write");

        sqlx::query("INSERT INTO workspaces (id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'ready', NULL, ?5, ?6, ?6)")
            .bind("workspace-writer")
            .bind("Writer")
            .bind(target_path.to_string_lossy().to_string())
            .bind("recipe-writer")
            .bind("oldhash")
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("workspace");
        sqlx::query("INSERT INTO recipes (id, workspace_id, name, description, is_active, created_at, updated_at) VALUES (?1, ?2, 'Default', '', 1, ?3, ?3)")
            .bind("recipe-writer")
            .bind("workspace-writer")
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("recipe");

        let app = mock_builder()
            .manage(crate::db::DbState::new(pool.clone()))
            .build(mock_context(noop_assets()))
            .expect("app");
        let handle = app.handle().clone();
        let state = handle.state::<crate::db::DbState>();

        let err = FileWriterService::write_target_file(
            handle.clone(),
            state,
            "workspace-writer".into(),
            "safe_sync".into(),
        )
        .await
        .unwrap_err();
        assert_eq!(err, "external_conflict");

        let status: String = sqlx::query_scalar("SELECT status FROM workspaces WHERE id = ?1")
            .bind("workspace-writer")
            .fetch_one(&pool)
            .await
            .expect("status");
        assert_eq!(status, "conflicted");
    }

    #[tokio::test]
    async fn replace_file_overwrites_existing_target() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target_path = dir.path().join("workspace.md");
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
