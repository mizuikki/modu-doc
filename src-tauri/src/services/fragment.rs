use sqlx::SqlitePool;

pub struct FragmentService;

impl FragmentService {
    pub async fn next_sort_order(pool: &SqlitePool, workspace_id: &str) -> Result<i64, String> {
        sqlx::query_scalar::<_, i64>(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM fragments WHERE workspace_id = ?1",
        )
        .bind(workspace_id)
        .fetch_one(pool)
        .await
        .map_err(crate::error::normalize_error)
    }
}
