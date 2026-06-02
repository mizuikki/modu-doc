use super::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SettingsRecord {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn get_setting(
    state: State<'_, db::DbState>,
    key: String,
) -> Result<Option<String>, String> {
    let row = sqlx::query_scalar::<_, String>(
        r#"
        SELECT value FROM settings WHERE key = ?1
        "#,
    )
    .bind(&key)
    .fetch_optional(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(row)
}

#[tauri::command]
pub async fn set_setting(
    state: State<'_, db::DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let timestamp = now();
    sqlx::query(
        r#"
        INSERT INTO settings (key, value, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        "#,
    )
    .bind(&key)
    .bind(&value)
    .bind(&timestamp)
    .execute(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(())
}

#[tauri::command]
pub async fn list_settings(state: State<'_, db::DbState>) -> Result<Vec<SettingsRecord>, String> {
    let rows = sqlx::query_as::<_, SettingsRecord>(
        r#"
        SELECT key, value, updated_at FROM settings ORDER BY key ASC
        "#,
    )
    .fetch_all(pool(&state))
    .await
    .map_err(crate::error::normalize_error)?;
    Ok(rows)
}

#[tauri::command]
pub async fn delete_setting(state: State<'_, db::DbState>, key: String) -> Result<bool, String> {
    let result = sqlx::query("DELETE FROM settings WHERE key = ?1")
        .bind(&key)
        .execute(pool(&state))
        .await
        .map_err(crate::error::normalize_error)?;
    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_record_round_trips_through_json() {
        let record = SettingsRecord {
            key: "theme".to_string(),
            value: "dark".to_string(),
            updated_at: "2026-06-02T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&record).expect("serialize");
        assert!(json.contains("\"updated_at\""));
        assert!(json.contains("\"key\""));
        assert!(json.contains("\"value\""));
    }

    #[test]
    fn settings_record_deserializes_from_json() {
        let json = r#"{"key":"theme","value":"dark","updated_at":"2026-06-02T00:00:00Z"}"#;
        let record: SettingsRecord = serde_json::from_str(json).expect("deserialize");
        assert_eq!(record.key, "theme");
        assert_eq!(record.value, "dark");
        assert_eq!(record.updated_at, "2026-06-02T00:00:00Z");
    }
}
