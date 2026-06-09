use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Public, fully-decoded workspace payload. Workspace is a pure container
/// in the document-first model: no target path, no recipe binding, no
/// status. All file state lives on `Document`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Document is the primary object. `target_path` is the normalized absolute
/// path (canonicalized by the Rust service layer before persist).
/// `file_status` mirrors one of the `DocumentFileStatus` constants and is
/// driven exclusively by the backend writer / watcher.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
    pub target_path: Option<String>,
    pub file_status: String,
    pub last_written_at: Option<String>,
    pub last_written_hash: Option<String>,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
    pub target_path: Option<String>,
    pub file_status: String,
    pub last_written_at: Option<String>,
    pub last_written_hash: Option<String>,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Fragment is a workspace-scoped material library entry. `tags` is a
/// JSON string array (kept as a string in Phase 1 to avoid an extra table).
/// `category` is an optional human group. `is_archived` is gone: use
/// `deleted_at` to mean "soft deleted".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fragment {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
    pub tags: String,
    pub category: Option<String>,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FragmentRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
    pub tags: String,
    pub category: Option<String>,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Recipe is a high-level assembly template. `is_active` is gone: the
/// concept of "active recipe" no longer drives the main flow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeItem {
    pub id: String,
    pub recipe_id: String,
    pub fragment_id: String,
    pub enabled: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeItemRow {
    pub id: String,
    pub recipe_id: String,
    pub fragment_id: String,
    pub enabled: i64,
    pub sort_order: i64,
}

/// Snapshot binds to a single Document, not a workspace or recipe.
/// `content` is the document content at snapshot time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub document_id: String,
    pub label: Option<String>,
    pub content: String,
    pub content_hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SnapshotRow {
    pub id: String,
    pub document_id: String,
    pub label: Option<String>,
    pub content: String,
    pub content_hash: String,
    pub created_at: String,
}

/// Result returned by `load_workspace`. Snapshots are grouped by
/// `document_id` so the frontend can hydrate per-document timelines
/// without an extra round-trip.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLoadResult {
    pub workspace: Workspace,
    pub documents: Vec<Document>,
    pub fragments: Vec<Fragment>,
    pub recipes: Vec<Recipe>,
    pub recipe_items: Vec<RecipeItem>,
    pub snapshots: HashMap<String, Vec<Snapshot>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub kind: String,
    pub id: String,
    pub workspace_id: Option<String>,
    pub title: String,
    pub subtitle: String,
}

// ---- conversions ----

impl From<WorkspaceRow> for Workspace {
    fn from(value: WorkspaceRow) -> Self {
        Self {
            id: value.id,
            name: value.name,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<DocumentRow> for Document {
    fn from(value: DocumentRow) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            name: value.name,
            content: value.content,
            content_hash: value.content_hash,
            target_path: value.target_path,
            file_status: value.file_status,
            last_written_at: value.last_written_at,
            last_written_hash: value.last_written_hash,
            sort_order: value.sort_order,
            deleted_at: value.deleted_at,
            description: value.description,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<FragmentRow> for Fragment {
    fn from(value: FragmentRow) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            name: value.name,
            content: value.content,
            content_hash: value.content_hash,
            tags: value.tags,
            category: value.category,
            sort_order: value.sort_order,
            deleted_at: value.deleted_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<RecipeRow> for Recipe {
    fn from(value: RecipeRow) -> Self {
        Self {
            id: value.id,
            workspace_id: value.workspace_id,
            name: value.name,
            description: value.description,
            deleted_at: value.deleted_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<RecipeItemRow> for RecipeItem {
    fn from(value: RecipeItemRow) -> Self {
        Self {
            id: value.id,
            recipe_id: value.recipe_id,
            fragment_id: value.fragment_id,
            enabled: value.enabled != 0,
            sort_order: value.sort_order,
        }
    }
}

impl From<SnapshotRow> for Snapshot {
    fn from(value: SnapshotRow) -> Self {
        Self {
            id: value.id,
            document_id: value.document_id,
            label: value.label,
            content: value.content,
            content_hash: value.content_hash,
            created_at: value.created_at,
        }
    }
}
