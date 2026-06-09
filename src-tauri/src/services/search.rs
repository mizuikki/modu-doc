use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchResultKind {
    Workspace,
    Document,
    Fragment,
    Recipe,
    Snapshot,
}

impl SearchResultKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Workspace => "workspace",
            Self::Document => "document",
            Self::Fragment => "fragment",
            Self::Recipe => "recipe",
            Self::Snapshot => "snapshot",
        }
    }
}

pub struct SearchService;

impl SearchService {
    pub fn sanitize_query(query: &str) -> String {
        query.trim().to_string()
    }

    fn like_pattern(normalized: &str) -> String {
        format!("%{}%", normalized.replace('%', "\\%").replace('_', "\\_"))
    }

    pub async fn search(
        pool: &SqlitePool,
        query: &str,
        limit: i64,
    ) -> Result<Vec<crate::types::SearchResult>, String> {
        let query = Self::sanitize_query(query);
        if query.is_empty() || limit <= 0 {
            return Ok(Vec::new());
        }
        let limit = limit.min(50);
        let pattern = Self::like_pattern(&query.to_lowercase());

        let mut results: Vec<crate::types::SearchResult> = Vec::new();

        // 1. Workspaces (top of list, by name).
        let workspace_rows = sqlx::query_as::<_, crate::types::WorkspaceRow>(
            r#"
            SELECT id, name, created_at, updated_at
            FROM workspaces
            WHERE lower(name) LIKE ?1 ESCAPE '\'
            ORDER BY name ASC
            LIMIT ?2
            "#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(crate::error::normalize_error)?;
        for row in workspace_rows {
            let workspace = crate::types::Workspace::from(row);
            results.push(crate::types::SearchResult {
                kind: SearchResultKind::Workspace.as_str().to_string(),
                id: workspace.id,
                workspace_id: None,
                title: workspace.name,
                subtitle: workspace.created_at,
            });
        }

        // 2. Documents (only non-soft-deleted, by updated_at DESC).
        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let document_rows = sqlx::query_as::<_, crate::types::DocumentRow>(
                r#"
                SELECT id, workspace_id, name, content, content_hash, target_path, file_status,
                       last_written_at, last_written_hash, sort_order, deleted_at, description,
                       created_at, updated_at
                FROM documents
                WHERE deleted_at IS NULL
                  AND (lower(name) LIKE ?1 ESCAPE '\' OR lower(content) LIKE ?1 ESCAPE '\')
                ORDER BY updated_at DESC
                LIMIT ?2
                "#,
            )
            .bind(&pattern)
            .bind(remain)
            .fetch_all(pool)
            .await
            .map_err(crate::error::normalize_error)?;
            for row in document_rows {
                let document = crate::types::Document::from(row);
                results.push(crate::types::SearchResult {
                    kind: SearchResultKind::Document.as_str().to_string(),
                    id: document.id,
                    workspace_id: Some(document.workspace_id),
                    title: document.name,
                    subtitle: document
                        .content
                        .chars()
                        .take(80)
                        .collect::<String>()
                        .trim()
                        .to_string(),
                });
            }
        }

        // 3. Fragments (only non-soft-deleted, by updated_at DESC).
        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let fragment_rows = sqlx::query_as::<_, crate::types::FragmentRow>(
                r#"
                SELECT id, workspace_id, name, content, content_hash, tags, category, sort_order,
                       deleted_at, created_at, updated_at
                FROM fragments
                WHERE deleted_at IS NULL
                  AND (lower(name) LIKE ?1 ESCAPE '\' OR lower(content) LIKE ?1 ESCAPE '\')
                ORDER BY updated_at DESC
                LIMIT ?2
                "#,
            )
            .bind(&pattern)
            .bind(remain)
            .fetch_all(pool)
            .await
            .map_err(crate::error::normalize_error)?;
            for row in fragment_rows {
                let fragment = crate::types::Fragment::from(row);
                results.push(crate::types::SearchResult {
                    kind: SearchResultKind::Fragment.as_str().to_string(),
                    id: fragment.id,
                    workspace_id: Some(fragment.workspace_id),
                    title: fragment.name,
                    subtitle: fragment
                        .content
                        .chars()
                        .take(80)
                        .collect::<String>()
                        .trim()
                        .to_string(),
                });
            }
        }

        // 4. Recipes (by updated_at DESC).
        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let recipe_rows = sqlx::query_as::<_, crate::types::RecipeRow>(
                r#"
                SELECT id, workspace_id, name, description, deleted_at, created_at, updated_at
                FROM recipes
                WHERE lower(name) LIKE ?1 ESCAPE '\' OR lower(description) LIKE ?1 ESCAPE '\'
                ORDER BY updated_at DESC
                LIMIT ?2
                "#,
            )
            .bind(&pattern)
            .bind(remain)
            .fetch_all(pool)
            .await
            .map_err(crate::error::normalize_error)?;
            for row in recipe_rows {
                let recipe = crate::types::Recipe::from(row);
                results.push(crate::types::SearchResult {
                    kind: SearchResultKind::Recipe.as_str().to_string(),
                    id: recipe.id,
                    workspace_id: Some(recipe.workspace_id),
                    title: recipe.name,
                    subtitle: recipe.description,
                });
            }
        }

        // 5. Snapshots (by created_at DESC, bound to a document).
        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let snapshot_rows = sqlx::query_as::<_, crate::types::SnapshotRow>(
                r#"
                SELECT id, document_id, label, content, content_hash, created_at
                FROM snapshots
                WHERE lower(COALESCE(label, '')) LIKE ?1 ESCAPE '\'
                   OR lower(content) LIKE ?1 ESCAPE '\'
                ORDER BY created_at DESC
                LIMIT ?2
                "#,
            )
            .bind(&pattern)
            .bind(remain)
            .fetch_all(pool)
            .await
            .map_err(crate::error::normalize_error)?;
            for row in snapshot_rows {
                let snapshot = crate::types::Snapshot::from(row);
                let label = snapshot.label.clone().unwrap_or_default();
                let subtitle = snapshot
                    .content
                    .chars()
                    .take(80)
                    .collect::<String>()
                    .trim()
                    .to_string();
                results.push(crate::types::SearchResult {
                    kind: SearchResultKind::Snapshot.as_str().to_string(),
                    id: snapshot.id,
                    // Snapshots are document-scoped; expose document_id through this field
                    // so the frontend can route to the right document timeline.
                    workspace_id: Some(snapshot.document_id),
                    title: if label.is_empty() {
                        snapshot.created_at.clone()
                    } else {
                        label
                    },
                    subtitle,
                });
            }
        }

        Ok(results.into_iter().take(limit as usize).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteSynchronous};
    use std::str::FromStr;
    use tempfile::{tempdir, TempDir};

    struct TestDb {
        _temp_dir: TempDir,
        pool: SqlitePool,
    }

    async fn setup() -> TestDb {
        let temp_dir = tempdir().expect("temp dir");
        let db_path = temp_dir.path().join("modudoc.sqlite");
        let connect_options =
            SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))
                .expect("connect options")
                .create_if_missing(true)
                .foreign_keys(true)
                .synchronous(SqliteSynchronous::Normal);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await
            .expect("pool");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migration");
        TestDb {
            _temp_dir: temp_dir,
            pool,
        }
    }

    #[tokio::test]
    async fn search_returns_empty_for_blank_query() {
        let db = setup().await;
        let results = SearchService::search(&db.pool, "   ", 20)
            .await
            .expect("search");
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn search_finds_items_across_workspaces() {
        let db = setup().await;
        let pool = &db.pool;
        let w1 = uuid::Uuid::new_v4().to_string();
        let w2 = uuid::Uuid::new_v4().to_string();
        let now = db::now_iso();

        // Workspaces (pure container — no target_path / status / default_recipe_id).
        sqlx::query(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&w1)
        .bind("Alpha Workspace")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("workspace 1");
        sqlx::query(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&w2)
        .bind("Beta Workspace")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("workspace 2");

        // Documents (need a document for the snapshot to bind to).
        let d1 = uuid::Uuid::new_v4().to_string();
        let d2 = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO documents (id, workspace_id, name, content, content_hash, file_status, sort_order, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, '', 'missing_target', 0, ?5, ?6)",
        )
        .bind(&d1)
        .bind(&w1)
        .bind("Alpha Notes")
        .bind("Notes from Alpha workspace")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("document 1");
        sqlx::query(
            "INSERT INTO documents (id, workspace_id, name, content, content_hash, file_status, sort_order, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, '', 'missing_target', 0, ?5, ?6)",
        )
        .bind(&d2)
        .bind(&w2)
        .bind("Beta Notes")
        .bind("Notes from Beta workspace")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("document 2");

        // Fragments (no is_archived).
        let f1 = uuid::Uuid::new_v4().to_string();
        let f2 = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO fragments (id, workspace_id, name, content, content_hash, tags, sort_order, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, '', '[]', 0, ?5, ?6)",
        )
        .bind(&f1)
        .bind(&w1)
        .bind("Intro")
        .bind("Hello from Alpha")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("fragment 1");
        sqlx::query(
            "INSERT INTO fragments (id, workspace_id, name, content, content_hash, tags, sort_order, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, '', '[]', 0, ?5, ?6)",
        )
        .bind(&f2)
        .bind(&w2)
        .bind("Intro")
        .bind("Hello from Beta")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("fragment 2");

        // Recipe (no is_active).
        let r1 = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO recipes (id, workspace_id, name, description, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&r1)
        .bind(&w2)
        .bind("Beta Recipe")
        .bind("A recipe in Beta workspace")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await
        .expect("recipe");

        // Snapshot (no workspace_id, no recipe_id, no snapshot_json / compiled_text / compiled_hash).
        let s1 = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at) \
             VALUES (?1, ?2, ?3, ?4, '', ?5)",
        )
        .bind(&s1)
        .bind(&d2)
        .bind("Beta Snapshot")
        .bind("Compiled text from Beta")
        .bind(&now)
        .execute(pool)
        .await
        .expect("snapshot");

        let results = SearchService::search(pool, "beta", 20)
            .await
            .expect("search");
        let kinds: Vec<&str> = results.iter().map(|r| r.kind.as_str()).collect();
        assert!(
            results
                .iter()
                .any(|r| r.kind == "workspace" && r.title.contains("Beta")),
            "expected a workspace result for 'beta', got kinds={:?}",
            kinds
        );
        assert!(
            results.iter().any(|r| r.kind == "document" && r.id == d2),
            "expected a document result bound to d2, got kinds={:?}",
            kinds
        );
        assert!(
            results
                .iter()
                .any(|r| r.kind == "fragment" && r.workspace_id.as_deref() == Some(&w2)),
            "expected a fragment result in w2, got kinds={:?}",
            kinds
        );
        assert!(
            results.iter().any(|r| r.kind == "recipe" && r.id == r1),
            "expected a recipe result, got kinds={:?}",
            kinds
        );
        assert!(
            results.iter().any(|r| r.kind == "snapshot" && r.id == s1),
            "expected a snapshot result, got kinds={:?}",
            kinds
        );
    }
}
