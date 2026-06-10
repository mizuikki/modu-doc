use std::error::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppErrorCode {
    DatabaseError,
    ExternalConflict,
    ImportSchemaMismatch,
    InvalidImportMode,
    InvalidTargetPath,
    MissingImportIdMapping,
    MissingProjectOrRecipe,
    SnapshotNotFound,
    TargetMissing,
    TargetNotWritable,
    Unknown,
}

impl AppErrorCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DatabaseError => "database_error",
            Self::ExternalConflict => "external_conflict",
            Self::ImportSchemaMismatch => "import_schema_mismatch",
            Self::InvalidImportMode => "invalid_import_mode",
            Self::InvalidTargetPath => "invalid_target_path",
            Self::MissingImportIdMapping => "missing_import_id_mapping",
            Self::MissingProjectOrRecipe => "missing_project_or_recipe",
            Self::SnapshotNotFound => "snapshot_not_found",
            Self::TargetMissing => "target_missing",
            Self::TargetNotWritable => "target_not_writable",
            Self::Unknown => "unknown",
        }
    }
}

pub fn normalize_error<E>(err: E) -> String
where
    E: Error + 'static,
{
    normalize_error_ref(&err)
}

fn normalize_error_ref(err: &(dyn Error + 'static)) -> String {
    if let Some(io_error) = err.downcast_ref::<std::io::Error>() {
        return normalize_io_error(io_error).to_owned();
    }
    if let Some(sqlx_error) = err.downcast_ref::<sqlx::Error>() {
        return normalize_sqlx_error(sqlx_error).to_owned();
    }
    if let Some(zip_error) = err.downcast_ref::<zip::result::ZipError>() {
        return normalize_zip_error(zip_error).to_owned();
    }
    if let Some(json_error) = err.downcast_ref::<serde_json::Error>() {
        return normalize_json_error(json_error).to_owned();
    }
    normalize_error_text(&err.to_string()).to_owned()
}

fn normalize_error_text(text: &str) -> &'static str {
    match text {
        "external_conflict" => AppErrorCode::ExternalConflict.as_str(),
        "import_schema_mismatch" => AppErrorCode::ImportSchemaMismatch.as_str(),
        "invalid_import_mode" => AppErrorCode::InvalidImportMode.as_str(),
        "invalid_target_path" => AppErrorCode::InvalidTargetPath.as_str(),
        "missing_project_or_recipe" => AppErrorCode::MissingProjectOrRecipe.as_str(),
        "snapshot_not_found" => AppErrorCode::SnapshotNotFound.as_str(),
        "target_missing" => AppErrorCode::TargetMissing.as_str(),
        "target_not_writable" => AppErrorCode::TargetNotWritable.as_str(),
        "database_error" => AppErrorCode::DatabaseError.as_str(),
        "unknown" => AppErrorCode::Unknown.as_str(),
        "missing_import_id_mapping" => AppErrorCode::MissingImportIdMapping.as_str(),
        _ if text.starts_with("missing_import_id_mapping:") => {
            AppErrorCode::MissingImportIdMapping.as_str()
        }
        _ => AppErrorCode::Unknown.as_str(),
    }
}

fn normalize_io_error(err: &std::io::Error) -> &'static str {
    match err.kind() {
        std::io::ErrorKind::NotFound => AppErrorCode::TargetMissing.as_str(),
        std::io::ErrorKind::PermissionDenied => AppErrorCode::TargetNotWritable.as_str(),
        _ => AppErrorCode::DatabaseError.as_str(),
    }
}

fn normalize_sqlx_error(err: &sqlx::Error) -> &'static str {
    match err {
        sqlx::Error::RowNotFound => AppErrorCode::Unknown.as_str(),
        sqlx::Error::Database(database_error) => {
            let message = database_error.message().to_ascii_lowercase();
            if message.contains("foreign key") || message.contains("constraint") {
                AppErrorCode::DatabaseError.as_str()
            } else {
                AppErrorCode::DatabaseError.as_str()
            }
        }
        _ => AppErrorCode::DatabaseError.as_str(),
    }
}

fn normalize_zip_error(_: &zip::result::ZipError) -> &'static str {
    AppErrorCode::ImportSchemaMismatch.as_str()
}

fn normalize_json_error(_: &serde_json::Error) -> &'static str {
    AppErrorCode::DatabaseError.as_str()
}
