use crate::db;
use crate::types::*;
use sqlx::SqlitePool;
use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::Arc,
};
use tauri::State;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_opener::reveal_item_in_dir;
use uuid::Uuid;

#[derive(Clone, serde::Serialize)]
pub(crate) struct WorkspaceStatusEvent {
    pub kind: String,
    pub workspace_id: Option<String>,
}

mod fragments;
mod misc;
mod packages;
mod recipes;
mod search;
mod settings;
mod snapshots;
mod sync;
mod workspaces;

pub use fragments::*;
pub use misc::*;
pub use packages::*;
pub use recipes::*;
pub use search::*;
pub use settings::*;
pub use snapshots::*;
pub use sync::*;
pub use workspaces::*;

pub(crate) fn pool<'a>(state: &'a State<'a, db::DbState>) -> &'a SqlitePool {
    state.pool()
}

pub(crate) fn now() -> String {
    crate::services::workspace::WorkspaceService::now()
}

pub(crate) fn hash(content: &str) -> String {
    db::content_hash(content)
}

pub(crate) fn emit_workspace_status_for<R: Runtime>(
    app: &AppHandle<R>,
    message: &str,
    workspace_id: &str,
) {
    let payload = WorkspaceStatusEvent {
        kind: message.to_string(),
        workspace_id: Some(workspace_id.to_string()),
    };
    let _ = app.emit("workspace-status-updated", payload);
}

pub(crate) fn resolve_updated_target_path(
    current_target: Option<String>,
    next_target: Option<String>,
    clear_target_path: bool,
) -> Option<String> {
    if clear_target_path {
        None
    } else {
        next_target.or(current_target)
    }
}

pub(crate) async fn mark_workspace_dirty(
    pool: &SqlitePool,
    workspace_id: &str,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE workspaces SET status = 'dirty', updated_at = ?2 WHERE id = ?1 AND target_path IS NOT NULL AND status NOT IN ('conflicted', 'error')",
    )
    .bind(workspace_id)
    .bind(now())
    .execute(pool)
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(())
}

pub(crate) fn restore_snapshot_failure_status(error_code: &str) -> &'static str {
    if error_code == "external_conflict" {
        "conflicted"
    } else {
        "error"
    }
}

#[cfg(test)]
mod tests {
    use crate::commands::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
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

    #[test]
    fn update_workspace_target_updates_support_clear_and_replace() {
        assert_eq!(
            resolve_updated_target_path(Some("a".into()), Some("b".into()), false),
            Some("b".into())
        );
        assert_eq!(
            resolve_updated_target_path(Some("a".into()), None, false),
            Some("a".into())
        );
        assert_eq!(
            resolve_updated_target_path(Some("a".into()), Some("b".into()), true),
            None
        );
    }

    #[tokio::test]
    async fn mark_workspace_dirty_updates_ready_workspaces() {
        let pool = test_pool().await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        sqlx::query(
            "INSERT INTO workspaces (id, name, target_path, default_recipe_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?5)",
        )
        .bind("workspace-dirty")
        .bind("Dirty")
        .bind("/tmp/example.md")
        .bind("ready")
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("workspace");

        mark_workspace_dirty(&pool, "workspace-dirty")
            .await
            .expect("mark dirty");

        let status: String = sqlx::query_scalar("SELECT status FROM workspaces WHERE id = ?1")
            .bind("workspace-dirty")
            .fetch_one(&pool)
            .await
            .expect("status");
        assert_eq!(status, "dirty");
    }

    #[test]
    fn remapped_snapshot_json_keeps_its_own_recipe_binding() {
        let snapshot_json = r#"{
          "workspace": {"id":"workspace-original","name":"w","target_path":null,"default_recipe_id":"recipe-original","status":"ready","last_compiled_at":null,"last_compiled_hash":null,"created_at":"t","updated_at":"t"},
          "fragments": [],
          "recipes": [{"id":"recipe-original","workspace_id":"workspace-original","name":"Default","description":"","is_active":true,"created_at":"t","updated_at":"t"}],
          "recipe_items": [],
          "snapshots": []
        }"#;
        let fragment_id_map = HashMap::new();
        let recipe_id_map = HashMap::from([(
            String::from("recipe-original"),
            String::from("recipe-remapped"),
        )]);
        let snapshot_id_map = HashMap::new();
        let remapped = super::packages::remap_workspace_load_result_json(
            snapshot_json,
            "workspace-remapped",
            &fragment_id_map,
            &recipe_id_map,
            &snapshot_id_map,
        )
        .expect("remap");
        let load: WorkspaceLoadResult = serde_json::from_str(&remapped).expect("load");
        assert_eq!(
            load.workspace.default_recipe_id.as_deref(),
            Some("recipe-remapped")
        );
    }

    #[test]
    fn snapshot_recipe_id_mapping_uses_snapshot_recipe() {
        let snapshot = WorkspacePackageSnapshot {
            id: "snapshot-id".into(),
            recipe_id: "recipe-alt".into(),
            label: "Alt Snapshot".into(),
            snapshot_json: "{}".into(),
            compiled_text: "".into(),
            compiled_hash: "".into(),
            created_at: "2026-05-23T10:00:00Z".into(),
        };
        let recipe_id_map = HashMap::from([
            (
                String::from("recipe-default"),
                String::from("recipe-default-remapped"),
            ),
            (
                String::from("recipe-alt"),
                String::from("recipe-alt-remapped"),
            ),
        ]);

        let remapped =
            super::packages::remap_workspace_package_snapshot_recipe_id(&snapshot, &recipe_id_map)
                .expect("remap snapshot recipe");

        assert_eq!(remapped, "recipe-alt-remapped");
    }

    #[test]
    fn package_snapshot_preserves_own_recipe_id() {
        let package_snapshot = WorkspacePackageSnapshot {
            id: "snapshot-id".into(),
            recipe_id: "recipe-id".into(),
            label: "Snapshot".into(),
            snapshot_json: "{}".into(),
            compiled_text: "".into(),
            compiled_hash: "".into(),
            created_at: "2026-05-23T10:00:00Z".into(),
        };

        assert_eq!(package_snapshot.recipe_id, "recipe-id");
    }

    #[tokio::test]
    async fn restore_workspace_snapshot_keeps_snapshots_table_rows() {
        let pool = test_pool().await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        let load = WorkspaceLoadResult {
            workspace: Workspace {
                id: "workspace-history".into(),
                name: "History".into(),
                target_path: None,
                default_recipe_id: Some("recipe-history".into()),
                status: "ready".into(),
                last_compiled_at: None,
                last_compiled_hash: None,
                created_at: timestamp.clone(),
                updated_at: timestamp.clone(),
            },
            fragments: vec![],
            recipes: vec![Recipe {
                id: "recipe-history".into(),
                workspace_id: "workspace-history".into(),
                name: "Default".into(),
                description: String::new(),
                is_active: true,
                created_at: timestamp.clone(),
                updated_at: timestamp.clone(),
            }],
            recipe_items: vec![],
            snapshots: vec![],
        };

        sqlx::query(
            r#"
            INSERT INTO workspaces (id, name, target_path, default_recipe_id, status, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
        )
        .bind("workspace-history")
        .bind("Old")
        .bind(Option::<String>::None)
        .bind("recipe-old")
        .bind("dirty")
        .bind(&timestamp)
        .bind(&timestamp)
        .execute(&pool)
        .await
        .expect("workspace");

        for index in 0..2 {
            sqlx::query(
                r#"
                INSERT INTO snapshots (id, workspace_id, recipe_id, label, snapshot_json, compiled_text, compiled_hash, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
            )
            .bind(format!("snapshot-{index}"))
            .bind("workspace-history")
            .bind("recipe-old")
            .bind(format!("Snapshot {index}"))
            .bind("{}")
            .bind("")
            .bind("")
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("snapshot");
        }

        super::snapshots::restore_workspace_snapshot(&pool, &load)
            .await
            .expect("restore");

        let snapshot_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM snapshots WHERE workspace_id = ?1")
                .bind("workspace-history")
                .fetch_one(&pool)
                .await
                .expect("snapshot count");

        assert_eq!(snapshot_count, 2);
    }
}
