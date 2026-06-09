use sqlx::SqlitePool;
use uuid::Uuid;

use crate::debug_log;
use crate::types::Snapshot;

pub struct SnapshotService;

impl SnapshotService {
    /// Insert a "Before write" snapshot for a document, but only if the
    /// document's current `content_hash` differs from the latest existing
    /// snapshot's hash. Returns the freshly inserted (or pre-existing)
    /// snapshot.
    pub async fn create_for_document(
        pool: &SqlitePool,
        document_id: &str,
        label: &str,
    ) -> Result<Snapshot, String> {
        let doc_hash: Option<String> =
            sqlx::query_scalar("SELECT content_hash FROM documents WHERE id = ?1")
                .bind(document_id)
                .fetch_optional(pool)
                .await
                .map_err(crate::error::normalize_error)?;
        let Some(content_hash) = doc_hash else {
            return Err("document_not_found".into());
        };

        let latest_hash: Option<String> = sqlx::query_scalar(
            "SELECT content_hash FROM snapshots WHERE document_id = ?1
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(document_id)
        .fetch_optional(pool)
        .await
        .map_err(crate::error::normalize_error)?;

        if latest_hash.as_deref() == Some(content_hash.as_str()) {
            // Hash unchanged — return the existing latest snapshot.
            let row: crate::types::SnapshotRow = sqlx::query_as(
                "SELECT id, document_id, label, content, content_hash, created_at
                 FROM snapshots WHERE document_id = ?1
                 ORDER BY created_at DESC LIMIT 1",
            )
            .bind(document_id)
            .fetch_one(pool)
            .await
            .map_err(crate::error::normalize_error)?;
            return Ok(Snapshot::from(row));
        }

        let content: String =
            sqlx::query_scalar("SELECT content FROM documents WHERE id = ?1")
                .bind(document_id)
                .fetch_one(pool)
                .await
                .map_err(crate::error::normalize_error)?;

        let id = Uuid::new_v4().to_string();
        let timestamp = crate::db::now_iso();
        let label_value: Option<&str> = if label.is_empty() { None } else { Some(label) };

        sqlx::query(
            "INSERT INTO snapshots (id, document_id, label, content, content_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(document_id)
        .bind(label_value)
        .bind(&content)
        .bind(&content_hash)
        .bind(&timestamp)
        .execute(pool)
        .await
        .map_err(crate::error::normalize_error)?;

        debug_log!(
            "[modudoc][snapshot] created id={} document_id={} label={:?}",
            id,
            document_id,
            label_value
        );

        Ok(Snapshot {
            id,
            document_id: document_id.to_string(),
            label: label_value.map(str::to_string),
            content,
            content_hash,
            created_at: timestamp,
        })
    }
}
