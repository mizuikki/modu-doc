use super::*;

pub(crate) async fn search_workspace_content_impl(
    pool: &sqlx::SqlitePool,
    query: &str,
    limit: i64,
) -> Result<Vec<SearchResult>, String> {
    crate::services::search::SearchService::search(pool, query, limit).await
}

#[tauri::command]
pub async fn search_workspace_content(
    state: State<'_, db::DbState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, String> {
    search_workspace_content_impl(pool(&state), &query, limit.unwrap_or(8)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;

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
    async fn search_workspace_content_impl_returns_results() {
        let pool = test_pool().await;
        let timestamp = "2026-05-23T10:00:00Z".to_string();
        sqlx::query("INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)")
            .bind("workspace-search")
            .bind("Search Space")
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("workspace");
        sqlx::query("INSERT INTO fragments (id, workspace_id, name, content, content_hash, tags, category, sort_order, deleted_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, '', '[]', NULL, 0, NULL, ?5, ?5)")
            .bind("fragment-search")
            .bind("workspace-search")
            .bind("Intro")
            .bind("Hello Search")
            .bind(&timestamp)
            .execute(&pool)
            .await
            .expect("fragment");

        let results = search_workspace_content_impl(&pool, "search", 8)
            .await
            .expect("search");
        assert!(results.iter().any(|entry| entry.kind == "workspace"));
        assert!(results.iter().any(|entry| entry.kind == "fragment"));
    }
}
