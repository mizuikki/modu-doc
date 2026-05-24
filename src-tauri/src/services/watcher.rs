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
use crate::types::WorkspaceRow;

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
    watchers: Mutex<HashMap<String, WorkspaceWatcher>>,
}

struct WorkspaceWatcher {
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

    pub async fn watch_workspace(
        &self,
        pool: SqlitePool,
        workspace_id: String,
        target_path: PathBuf,
        state: WatcherState,
    ) -> Result<(), String> {
        let watch_path = watch_path_for_target(&target_path);
        if let Ok(mut guard) = self.watchers.lock() {
            if let Some(existing) = guard.get_mut(&workspace_id) {
                if existing.target_path == target_path {
                    return Ok(());
                }
                let _ = existing.watcher.unwatch(&existing.watch_path);
            }
            guard.remove(&workspace_id);
        }

        let path_key = target_path.to_string_lossy().to_string();
        let workspace_key = workspace_id.clone();
        let watched_path = target_path.clone();
        let watch_root = watch_path.clone();
        let app = self.app.clone();
        let mut watcher = RecommendedWatcher::new(
      move |result: notify::Result<Event>| {
        if let Ok(event) = result {
          if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
            if !event_mentions_target(&event, &watched_path) {
              return;
            }
            let pool = pool.clone();
            let state = state.clone();
            let workspace_id = workspace_id.clone();
            let target_path = watched_path.clone();
            let path_key = path_key.clone();
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
              if let Ok(content) = tokio::fs::read_to_string(&target_path).await {
                let content_hash = db::content_hash(&content);
                if state.should_ignore(&path_key, &content_hash) {
                  return;
                }
                let current_hash = sqlx::query_scalar::<_, Option<String>>(
                    "SELECT last_compiled_hash FROM workspaces WHERE id = ?1",
                )
                .bind(&workspace_id)
                .fetch_one(&pool)
                .await
                .ok()
                .flatten();
                if current_hash.as_deref() == Some(content_hash.as_str()) {
                  return;
                }
                let _ = sqlx::query("UPDATE workspaces SET status = 'conflicted', updated_at = ?2 WHERE id = ?1")
                  .bind(&workspace_id)
                  .bind(db::now_iso())
                  .execute(&pool)
                  .await;
                debug_log!(
                  "[modudoc][watcher] external_conflict workspace_id={}",
                  workspace_id
                );
                commands::emit_workspace_status_for(&app, "external_conflict", &workspace_id);
              }
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
                workspace_key,
                WorkspaceWatcher {
                    target_path,
                    watch_path,
                    watcher,
                },
            );
        }
        Ok(())
    }

    pub fn unwatch_workspace(&self, workspace_id: &str) {
        if let Ok(mut guard) = self.watchers.lock() {
            if let Some(mut registration) = guard.remove(workspace_id) {
                let _ = registration.watcher.unwatch(&registration.watch_path);
            }
        }
    }
}

pub async fn prime_watchers(
    pool: SqlitePool,
    state: WatcherState,
    service: std::sync::Arc<WatcherService>,
) -> Result<(), String> {
    let rows = sqlx::query_as::<_, WorkspaceRow>(
    "SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at FROM workspaces WHERE target_path IS NOT NULL",
  )
  .fetch_all(&pool)
  .await
  .map_err(crate::error::normalize_error)?;
    for row in rows {
        if let Some(target_path) = row.target_path {
            service
                .watch_workspace(
                    pool.clone(),
                    row.id,
                    PathBuf::from(target_path),
                    state.clone(),
                )
                .await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn watches_parent_directory_for_target_file() {
        let target = Path::new("/tmp/modudoc/workspace.md");
        assert_eq!(watch_path_for_target(target), PathBuf::from("/tmp/modudoc"));
    }

    #[test]
    fn event_filter_matches_only_target_file() {
        let target = PathBuf::from("/tmp/modudoc/workspace.md");
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
