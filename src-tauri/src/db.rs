use std::{path::PathBuf, str::FromStr};

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Clone)]
pub struct DbState {
    pool: SqlitePool,
}

impl DbState {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

pub async fn initialize<R: Runtime>(app: AppHandle<R>) -> anyhow::Result<SqlitePool> {
    let app_dir: PathBuf = if let Ok(dir_override) = std::env::var("MODUDOC_DATA_DIR") {
        PathBuf::from(dir_override)
    } else {
        let app_data_dir = app.path().app_data_dir()?;
        app_data_dir.join("modudoc")
    };
    tokio::fs::create_dir_all(&app_dir).await?;
    let db_path = app_dir.join("modudoc.sqlite");
    let connect_options =
        SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))?
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal);
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(connect_options)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn content_hash(content: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn migration_initializes_database() {
        let temp_dir = tempdir().expect("temp dir");
        let db_path = temp_dir.path().join("modudoc.sqlite");
        let connect_options =
            SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))
                .expect("connect options")
                .create_if_missing(true)
                .foreign_keys(true)
                .journal_mode(SqliteJournalMode::Wal)
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
        let table_exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'",
        )
        .fetch_one(&pool)
        .await
        .expect("app_meta table");
        assert_eq!(table_exists, 1);
    }

    #[tokio::test]
    async fn migration_makes_snapshot_recipe_required() {
        let temp_dir = tempdir().expect("temp dir");
        let db_path = temp_dir.path().join("modudoc.sqlite");
        let connect_options =
            SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path.display()))
                .expect("connect options")
                .create_if_missing(true)
                .foreign_keys(true)
                .journal_mode(SqliteJournalMode::Wal)
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
        let not_null: i64 = sqlx::query_scalar(
            "SELECT `notnull` FROM pragma_table_info('snapshots') WHERE name = 'recipe_id'",
        )
        .fetch_one(&pool)
        .await
        .expect("recipe id notnull");
        assert_eq!(not_null, 1);
    }

    #[tokio::test]
    async fn initialize_respects_data_dir_override() {
        let temp_dir = tempdir().expect("temp dir");
        std::env::set_var(
            "MODUDOC_DATA_DIR",
            temp_dir
                .path()
                .join("override")
                .to_string_lossy()
                .to_string(),
        );

        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("app");
        let pool = initialize(app.handle().clone()).await.expect("pool");

        let table_exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'",
        )
        .fetch_one(&pool)
        .await
        .expect("app_meta table");
        assert_eq!(table_exists, 1);
    }
}
