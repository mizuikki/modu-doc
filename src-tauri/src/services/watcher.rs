//! Document-dimension file watcher.
//!
//! Each `Document` with a non-null `target_path` gets its own
//! `RecommendedWatcher` rooted at the target's parent directory. When
//! the OS reports a modify/create event on the target file, we:
//!
//! 1. Read the file content and compute its hash.
//! 2. Skip if the event matches our own `mark_ignored` window.
//! 3. Skip if the file's hash matches the document's
//!    `last_written_hash` (i.e. the only "change" is from our own
//!    atomic rename, or a touch).
//! 4. Otherwise mark the document `conflict` and emit
//!    `document_conflict`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use sqlx::SqlitePool;
use tauri::AppHandle;

use crate::commands;
use crate::db;
use crate::debug_log;

// NOTE: see the matching comment in `services/file_writer.rs` — the
// `emit_document_status` helper is duplicated across the commands
// sub-modules and the new `commands::documents` copy is not yet
// re-exported. We call the post-consolidation
// `commands::emit_document_status` path; another agent is
// responsible for making it resolve.

#[derive(Clone, Default)]
pub struct WatcherState {
    ignored_hashes: Arc<Mutex<HashMap<String, (String, Instant)>>>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn mark_ignored(&self, path: String, hash: String) {
        if let Ok(mut entries) = self.ignored_hashes.lock() {
            entries.insert(path, (hash, Instant::now()));
        }
    }

    pub fn should_ignore(&self, path: &str, hash: &str) -> bool {
        self.ignored_hashes
            .lock()
            .map(|mut entries| {
                let now = Instant::now();
                entries.retain(|_, (_, inserted_at)| {
                    now.duration_since(*inserted_at) <= Duration::from_secs(2)
                });
                matches!(
                    entries.get(path),
                    Some((existing_hash, inserted_at))
                        if existing_hash == hash
                            && now.duration_since(*inserted_at) <= Duration::from_secs(2)
                )
            })
            .unwrap_or(false)
    }
}

pub struct WatcherService {
    app: AppHandle,
    watchers: Mutex<HashMap<String, DocumentWatcher>>,
}

struct DocumentWatcher {
    target_path: PathBuf,
    watch_path: PathBuf,
    watcher: RecommendedWatcher,
}

fn watch_path_for_target(target_path: &Path) -> PathBuf {
    match target_path.parent() {
        Some(parent) if parent.as_os_str().is_empty() => PathBuf::from("."),
        Some(parent) => parent.to_path_buf(),
        None => target_path.to_path_buf(),
    }
}

fn event_mentions_target(event: &Event, target_path: &Path) -> bool {
    event.paths.iter().any(|path| path == target_path)
}

impl WatcherService {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            watchers: Mutex::new(HashMap::new()),
        }
    }

    /// Register a watcher for one document. If a watcher is already
    /// registered for the same `document_id` with the same target, this
    /// is a no-op. If the target path changed, the old watcher is
    /// dropped first.
    pub async fn watch_document(
        &self,
        pool: SqlitePool,
        document_id: String,
        target_path: PathBuf,
        state: WatcherState,
    ) -> Result<(), String> {
        let watch_path = watch_path_for_target(&target_path);
        if let Ok(mut guard) = self.watchers.lock() {
            if let Some(existing) = guard.get_mut(&document_id) {
                if existing.target_path == target_path {
                    return Ok(());
                }
                let _ = existing.watcher.unwatch(&existing.watch_path);
            }
            guard.remove(&document_id);
        }

        let path_key = target_path.to_string_lossy().to_string();
        let watched_path = target_path.clone();
        let watch_root = watch_path.clone();
        let app = self.app.clone();
        // Clone for the closure — the original is needed to register
        // the watcher after construction.
        let document_id_for_closure = document_id.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result: notify::Result<Event>| {
                if let Ok(event) = result {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        if !event_mentions_target(&event, &watched_path) {
                            return;
                        }
                        let pool = pool.clone();
                        let state = state.clone();
                        let document_id = document_id_for_closure.clone();
                        let target_path = watched_path.clone();
                        let path_key = path_key.clone();
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            handle_document_event(
                                pool,
                                state,
                                document_id,
                                target_path,
                                path_key,
                                app,
                            )
                            .await;
                        });
                    }
                }
            },
            Config::default(),
        )
        .map_err(crate::error::normalize_error)?;
        watcher
            .watch(&watch_root, RecursiveMode::NonRecursive)
            .map_err(crate::error::normalize_error)?;
        if let Ok(mut guard) = self.watchers.lock() {
            guard.insert(
                document_id,
                DocumentWatcher {
                    target_path,
                    watch_path,
                    watcher,
                },
            );
        }
        Ok(())
    }
}

async fn handle_document_event(
    pool: SqlitePool,
    state: WatcherState,
    document_id: String,
    target_path: PathBuf,
    path_key: String,
    app: AppHandle,
) {
    let content = match tokio::fs::read_to_string(&target_path).await {
        Ok(value) => value,
        Err(err) => {
            debug_log!(
                "[modudoc][watcher] read failed document_id={} path={} err={}",
                document_id,
                target_path.display(),
                err
            );
            return;
        }
    };
    let content_hash = db::content_hash(&content);
    if state.should_ignore(&path_key, &content_hash) {
        return;
    }
    let last_written_hash: Option<String> = match sqlx::query_scalar(
        "SELECT last_written_hash FROM documents WHERE id = ?1",
    )
    .bind(&document_id)
    .fetch_one(&pool)
    .await
    {
        Ok(value) => value,
        Err(err) => {
            debug_log!(
                "[modudoc][watcher] db read failed document_id={} err={}",
                document_id,
                err
            );
            return;
        }
    };
    if last_written_hash.as_deref() == Some(content_hash.as_str()) {
        // File matches our last write — the event was caused by our
        // own atomic rename or a touch. Nothing to do.
        return;
    }
    let project_id: Option<String> = match sqlx::query_scalar(
        "SELECT project_id FROM documents WHERE id = ?1",
    )
    .bind(&document_id)
    .fetch_optional(&pool)
    .await
    {
        Ok(value) => value.flatten(),
        Err(err) => {
            debug_log!(
                "[modudoc][watcher] project_id lookup failed document_id={} err={}",
                document_id,
                err
            );
            return;
        }
    };
    if let Err(err) = sqlx::query(
        "UPDATE documents SET save_state = 'conflict', updated_at = ?2 WHERE id = ?1",
    )
    .bind(&document_id)
    .bind(db::now_iso())
    .execute(&pool)
    .await
    {
        debug_log!(
            "[modudoc][watcher] conflict update failed document_id={} err={}",
            document_id,
            err
        );
        return;
    }
    debug_log!(
        "[modudoc][watcher] external_conflict document_id={} target={}",
        document_id,
        target_path.display()
    );
    commands::emit_document_status(
        &app,
        "document_conflict",
        project_id.as_deref(),
        Some(&document_id),
    );
}

/// Bootstrap: register a watcher for every non-deleted document with
/// a bound `target_path`.
pub async fn prime_watchers(
    pool: SqlitePool,
    state: WatcherState,
    service: std::sync::Arc<WatcherService>,
) -> Result<(), String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, target_path FROM documents \
         WHERE target_path IS NOT NULL AND deleted_at IS NULL",
    )
    .fetch_all(&pool)
    .await
    .map_err(crate::error::normalize_error)?;
    for (document_id, target_path) in rows {
        service
            .watch_document(
                pool.clone(),
                document_id,
                PathBuf::from(target_path),
                state.clone(),
            )
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watches_parent_directory_for_target_file() {
        let target = Path::new("/tmp/modudoc/project.md");
        assert_eq!(watch_path_for_target(target), PathBuf::from("/tmp/modudoc"));
    }

    #[test]
    fn event_filter_matches_only_target_file() {
        let target = PathBuf::from("/tmp/modudoc/project.md");
        let matching = Event {
            kind: EventKind::Create(notify::event::CreateKind::File),
            paths: vec![target.clone()],
            attrs: Default::default(),
        };
        let other = Event {
            kind: EventKind::Create(notify::event::CreateKind::File),
            paths: vec![PathBuf::from("/tmp/modudoc/other.md")],
            attrs: Default::default(),
        };

        assert!(event_mentions_target(&matching, &target));
        assert!(!event_mentions_target(&other, &target));
    }
}
