use sqlx::SqlitePool;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchResultKind {
    Workspace,
    Fragment,
    Recipe,
    Snapshot,
}

impl SearchResultKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Workspace => "workspace",
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

        let workspace_rows = sqlx::query_as::<_, crate::types::WorkspaceRow>(
            r#"
        SELECT id, name, target_path, default_recipe_id, status, last_compiled_at, last_compiled_hash, created_at, updated_at
        FROM workspaces
        WHERE lower(name) LIKE ?1 ESCAPE '\'
        ORDER BY created_at ASC
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
                subtitle: workspace.status,
            });
        }

        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let fragment_rows = sqlx::query_as::<_, crate::types::FragmentRow>(
                r#"
            SELECT id, workspace_id, name, content, content_hash, sort_order, is_archived, deleted_at, created_at, updated_at
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

        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let recipe_rows = sqlx::query_as::<_, crate::types::RecipeRow>(
                r#"
            SELECT id, workspace_id, name, description, is_active, created_at, updated_at
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

        if (results.len() as i64) < limit {
            let remain = limit - results.len() as i64;
            let snapshot_rows = sqlx::query_as::<_, crate::types::SnapshotRow>(
                r#"
            SELECT id, workspace_id, recipe_id, label, snapshot_json, compiled_text, compiled_hash, created_at
            FROM snapshots
            WHERE lower(label) LIKE ?1 ESCAPE '\' OR lower(compiled_text) LIKE ?1 ESCAPE '\'
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
                results.push(crate::types::SearchResult {
                    kind: SearchResultKind::Snapshot.as_str().to_string(),
                    id: snapshot.id,
                    workspace_id: Some(snapshot.workspace_id),
                    title: if snapshot.label.is_empty() {
                        snapshot.created_at.clone()
                    } else {
                        snapshot.label
                    },
                    subtitle: snapshot.created_at,
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

        sqlx::query("INSERT INTO workspaces (id, name, status, created_at, updated_at) VALUES (?1, ?2, 'missing_target', ?3, ?4)")
            .bind(&w1)
            .bind("Alpha Workspace")
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .expect("workspace 1");
        sqlx::query("INSERT INTO workspaces (id, name, status, created_at, updated_at) VALUES (?1, ?2, 'missing_target', ?3, ?4)")
            .bind(&w2)
            .bind("Beta Workspace")
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .expect("workspace 2");

        let f1 = uuid::Uuid::new_v4().to_string();
        let f2 = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO fragments (id, workspace_id, name, content, content_hash, sort_order, is_archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, '', 0, 0, ?5, ?6)")
            .bind(&f1)
            .bind(&w1)
            .bind("Intro")
            .bind("Hello from Alpha")
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .expect("fragment 1");
        sqlx::query("INSERT INTO fragments (id, workspace_id, name, content, content_hash, sort_order, is_archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, '', 0, 0, ?5, ?6)")
            .bind(&f2)
            .bind(&w2)
            .bind("Intro")
            .bind("Hello from Beta")
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .expect("fragment 2");

        let results = SearchService::search(&pool, "beta", 10)
            .await
            .expect("search");
        assert!(results
            .iter()
            .any(|r| r.kind == "workspace" && r.title.contains("Beta")));
        assert!(results
            .iter()
            .any(|r| r.kind == "fragment" && r.workspace_id.as_deref() == Some(&w2)));
    }
}
