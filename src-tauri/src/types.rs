use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub target_path: Option<String>,
    pub default_recipe_id: Option<String>,
    pub status: String,
    pub last_compiled_at: Option<String>,
    pub last_compiled_hash: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WorkspaceRow {
    pub id: String,
    pub name: String,
    pub target_path: Option<String>,
    pub default_recipe_id: Option<String>,
    pub status: String,
    pub last_compiled_at: Option<String>,
    pub last_compiled_hash: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fragment {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
    pub sort_order: i64,
    pub is_archived: bool,
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
    pub sort_order: i64,
    pub is_archived: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub is_active: i64,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub workspace_id: String,
    pub recipe_id: String,
    pub label: String,
    pub snapshot_json: String,
    pub compiled_text: String,
    pub compiled_hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SnapshotRow {
    pub id: String,
    pub workspace_id: String,
    pub recipe_id: String,
    pub label: String,
    pub snapshot_json: String,
    pub compiled_text: String,
    pub compiled_hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageExport {
    pub schema_version: i64,
    pub app_version: String,
    pub exported_at: String,
    pub workspace: WorkspacePackageWorkspace,
    pub fragments: Vec<WorkspacePackageFragment>,
    pub recipes: Vec<WorkspacePackageRecipe>,
    pub snapshots: Vec<WorkspacePackageSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageWorkspace {
    pub name: String,
    pub target_path_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageRecipe {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub items: Vec<WorkspacePackageRecipeItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageRecipeItem {
    pub fragment_id: String,
    pub enabled: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageFragment {
    pub id: String,
    pub name: String,
    pub content: String,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageSnapshot {
    pub id: String,
    pub recipe_id: String,
    pub label: String,
    pub snapshot_json: String,
    pub compiled_text: String,
    pub compiled_hash: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageManifest {
    pub schema_version: i64,
    pub app_version: String,
    pub exported_at: String,
    pub workspace: WorkspacePackageWorkspace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLoadResult {
    pub workspace: Workspace,
    pub fragments: Vec<Fragment>,
    pub recipes: Vec<Recipe>,
    pub recipe_items: Vec<RecipeItem>,
    pub snapshots: Vec<Snapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub kind: String,
    pub id: String,
    pub workspace_id: Option<String>,
    pub title: String,
    pub subtitle: String,
}

impl From<WorkspaceRow> for Workspace {
    fn from(value: WorkspaceRow) -> Self {
        Self {
            id: value.id,
            name: value.name,
            target_path: value.target_path,
            default_recipe_id: value.default_recipe_id,
            status: value.status,
            last_compiled_at: value.last_compiled_at,
            last_compiled_hash: value.last_compiled_hash,
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
            sort_order: value.sort_order,
            is_archived: value.is_archived != 0,
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
            is_active: value.is_active != 0,
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
            workspace_id: value.workspace_id,
            recipe_id: value.recipe_id,
            label: value.label,
            snapshot_json: value.snapshot_json,
            compiled_text: value.compiled_text,
            compiled_hash: value.compiled_hash,
            created_at: value.created_at,
        }
    }
}
