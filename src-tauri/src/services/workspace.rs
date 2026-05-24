use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

use crate::db;

pub struct WorkspaceService;

impl WorkspaceService {
    pub fn validate_target_path(path: &str) -> Result<(), String> {
        let candidate = Path::new(path);
        let extension = candidate
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if extension != "md" {
            return Err("invalid_target_path".into());
        }
        Ok(())
    }

    pub fn status_for_target_path(target_path: Option<&str>) -> &'static str {
        match target_path {
            Some(path) if Self::probe_writable(path).is_ok() => "dirty",
            Some(_) => "error",
            None => "missing_target",
        }
    }

    pub fn probe_writable(path: &str) -> Result<(), String> {
        let candidate = Path::new(path);
        let parent = candidate
            .parent()
            .ok_or_else(|| "invalid_target_path".to_string())?;
        std::fs::create_dir_all(parent).map_err(Self::map_io_error)?;
        let probe_path = parent.join(format!(".modudoc-write-probe-{}", uuid::Uuid::new_v4()));
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&probe_path)
            .map_err(Self::map_io_error)?;
        file.write_all(b"probe").map_err(Self::map_io_error)?;
        drop(file);
        let _ = std::fs::remove_file(&probe_path);
        Ok(())
    }

    fn map_io_error(err: std::io::Error) -> String {
        match err.kind() {
            std::io::ErrorKind::NotFound => "target_missing".into(),
            std::io::ErrorKind::PermissionDenied => "target_not_writable".into(),
            _ => "database_error".into(),
        }
    }

    pub fn now() -> String {
        db::now_iso()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn status_for_target_path_maps_missing_and_writable() {
        assert_eq!(
            WorkspaceService::status_for_target_path(None),
            "missing_target"
        );

        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("example.md");
        let status =
            WorkspaceService::status_for_target_path(Some(path.to_string_lossy().as_ref()));
        assert_eq!(status, "dirty");
    }

    #[test]
    fn status_for_target_path_maps_unwritable_to_error() {
        let status =
            WorkspaceService::status_for_target_path(Some("/proc/modudoc-test/example.md"));
        assert_eq!(status, "error");
    }
}
