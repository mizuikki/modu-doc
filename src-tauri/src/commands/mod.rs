use crate::db;
use crate::types::*;
use sqlx::SqlitePool;
use tauri::State;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_opener::reveal_item_in_dir;
use uuid::Uuid;

mod debug;
mod documents;
mod fragments;
mod misc;
mod recipes;
mod search;
mod settings;
mod snapshots;
mod projects;

pub use debug::*;
pub use documents::*;
pub use fragments::*;
pub use misc::*;
pub use recipes::*;
pub use search::*;
pub use settings::*;
pub use snapshots::*;
pub use projects::*;

/// Legacy project-level event payload. The new model uses
/// `document-status-updated` for primary flows, but project lifecycle
/// (created/updated/deleted) is still surfaced here for the sidebar /
/// project switcher.
#[derive(Clone, serde::Serialize)]
pub(crate) struct ProjectStatusEvent {
    pub kind: String,
    pub project_id: Option<String>,
}

/// Document-level event payload. This is the canonical event for
/// document state changes (created, updated, written, conflict, ...).
#[derive(Clone, serde::Serialize)]
pub(crate) struct DocumentStatusEvent {
    pub kind: String,
    pub project_id: Option<String>,
    pub document_id: Option<String>,
}

pub(crate) fn pool<'a>(state: &'a State<'a, db::DbState>) -> &'a SqlitePool {
    state.pool()
}

pub(crate) fn now() -> String {
    crate::services::project::ProjectService::now()
}

pub(crate) fn hash(content: &str) -> String {
    db::content_hash(content)
}

pub(crate) fn emit_project_status_for<R: Runtime>(
    app: &AppHandle<R>,
    message: &str,
    project_id: &str,
) {
    let payload = ProjectStatusEvent {
        kind: message.to_string(),
        project_id: Some(project_id.to_string()),
    };
    let _ = app.emit("project-status-updated", payload);
}

pub(crate) fn emit_document_status<R: Runtime>(
    app: &AppHandle<R>,
    kind: &str,
    project_id: Option<&str>,
    document_id: Option<&str>,
) {
    let payload = DocumentStatusEvent {
        kind: kind.to_string(),
        project_id: project_id.map(String::from),
        document_id: document_id.map(String::from),
    };
    let _ = app.emit("document-status-updated", payload);
}

#[allow(dead_code)]
pub(crate) fn _uuid() -> String {
    Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_status_event_serializes_required_fields() {
        let event = DocumentStatusEvent {
            kind: "document_written".to_string(),
            project_id: Some("ws-1".to_string()),
            document_id: Some("doc-1".to_string()),
        };
        let json = serde_json::to_string(&event).expect("serialize");
        assert!(json.contains("document_written"));
        assert!(json.contains("ws-1"));
        assert!(json.contains("doc-1"));
    }

    #[test]
    fn document_status_event_supports_project_only() {
        let event = DocumentStatusEvent {
            kind: "fragment_created".to_string(),
            project_id: Some("ws-1".to_string()),
            document_id: None,
        };
        let json = serde_json::to_string(&event).expect("serialize");
        assert!(json.contains("fragment_created"));
        assert!(json.contains("ws-1"));
        assert!(json.contains("null"));
    }
}
