//! Path normalization for `documents.target_path`.
//!
//! This module is the single source of truth for turning a user-supplied
//! path string into the canonical absolute string we store in SQLite.
//!
//! The rules match the Phase 1 spec ("路径规范化规则"):
//!
//! 1. Trim and reject empty input.
//! 2. Reject non-absolute paths.
//! 3. If the target already exists on disk, canonicalize it (resolve
//!    symlinks via `std::fs::canonicalize`).
//! 4. If the target does not exist, canonicalize the existing parent
//!    and append the file name. We never auto-create parents here — the
//!    writer does that.
//! 5. On Windows, also fold to lowercase and normalize separators to
//!    `\`. macOS / Linux preserve case and use `/`.
//!
//! On any failure, `normalize_target_path` returns the string
//! `"invalid_target_path"` so the caller can map it to a Tauri error
//! code.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathNormalizationError {
    Empty,
    NotAbsolute,
    ParentMissing,
    IoError(String),
}

impl std::fmt::Display for PathNormalizationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Empty => write!(f, "empty target path"),
            Self::NotAbsolute => write!(f, "target path is not absolute"),
            Self::ParentMissing => write!(f, "target path parent does not exist"),
            Self::IoError(message) => write!(f, "io error: {message}"),
        }
    }
}

impl std::error::Error for PathNormalizationError {}

fn to_invalid_target_path_err(err: &PathNormalizationError) -> String {
    // The Phase 1 contract surfaces a single error code for normalization
    // failures; the typed variant is for tests / future diagnostics.
    let _ = err;
    "invalid_target_path".to_string()
}

/// Normalize a user-supplied target path into the canonical absolute
/// string stored in `documents.target_path`.
///
/// Returns the literal string `"invalid_target_path"` on any failure
/// so the caller can map it to a Tauri error code without juggling a
/// typed error type across the FFI boundary.
pub fn normalize_target_path(input: &str) -> Result<String, String> {
    match normalize(input) {
        Ok(value) => Ok(value),
        Err(err) => Err(to_invalid_target_path_err(&err)),
    }
}

fn normalize(input: &str) -> Result<String, PathNormalizationError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(PathNormalizationError::Empty);
    }

    let path = Path::new(trimmed);
    if !path.is_absolute() {
        return Err(PathNormalizationError::NotAbsolute);
    }

    // Existing file or directory: canonicalize the full path.
    if path.exists() {
        let canonical = std::fs::canonicalize(path)
            .map_err(|err| PathNormalizationError::IoError(err.to_string()))?;
        return Ok(normalize_for_platform(canonical));
    }

    // Non-existing path: canonicalize the parent and append the file
    // name. We deliberately do not create the parent here — the writer
    // is responsible for that.
    let parent = path
        .parent()
        .ok_or(PathNormalizationError::ParentMissing)?;
    if parent.as_os_str().is_empty() {
        return Err(PathNormalizationError::ParentMissing);
    }
    if !parent.exists() {
        return Err(PathNormalizationError::ParentMissing);
    }

    let canonical_parent = std::fs::canonicalize(parent)
        .map_err(|err| PathNormalizationError::IoError(err.to_string()))?;

    let file_name = path
        .file_name()
        .ok_or(PathNormalizationError::ParentMissing)?;
    let joined = canonical_parent.join(file_name);
    Ok(normalize_for_platform(joined))
}

#[cfg(windows)]
fn normalize_for_platform(p: PathBuf) -> String {
    let s = p.to_string_lossy().to_string();
    s.replace('/', "\\").to_lowercase()
}

#[cfg(not(windows))]
fn normalize_for_platform(p: PathBuf) -> String {
    p.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn normalize_existing_file_uses_canonical_path() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("doc.md");
        std::fs::write(&file_path, "hello").expect("write file");

        let input = file_path.to_string_lossy().to_string();
        let normalized = normalize_target_path(&input).expect("normalize");

        let expected = std::fs::canonicalize(&file_path)
            .expect("canonicalize")
            .to_string_lossy()
            .to_string();

        // On Windows, normalize_for_platform lower-cases and uses `\`.
        // On macOS / Linux, the result must match the canonical path
        // byte-for-byte (modulo whatever the OS normalizes for the
        // prefix — canonicalize handles that).
        let expected_normalized = normalize_for_platform(PathBuf::from(&expected));
        assert_eq!(normalized, expected_normalized);
    }

    #[cfg(windows)]
    #[test]
    fn normalize_existing_file_lowercases_on_windows() {
        let dir = tempdir().expect("tempdir");
        let file_path = dir.path().join("Doc.MD");
        std::fs::write(&file_path, "hello").expect("write file");

        let upper = file_path.to_string_lossy().to_string();
        let normalized = normalize_target_path(&upper).expect("normalize");

        let lower_input = upper.to_lowercase().replace('/', "\\");
        let lower_canonical = std::fs::canonicalize(&lower_input)
            .expect("canonicalize")
            .to_string_lossy()
            .to_string()
            .replace('/', "\\")
            .to_lowercase();
        assert_eq!(normalized, lower_canonical);
        assert!(normalized.contains('\\'));
    }

    #[test]
    fn normalize_missing_file_uses_canonical_parent() {
        let dir = tempdir().expect("tempdir");
        let missing = dir.path().join("not-yet-written.md");

        let normalized = normalize_target_path(&missing.to_string_lossy())
            .expect("normalize");

        let expected_parent = std::fs::canonicalize(dir.path())
            .expect("canonicalize parent")
            .to_string_lossy()
            .to_string();
        let expected = format!(
            "{}{}not-yet-written.md",
            expected_parent,
            std::path::MAIN_SEPARATOR
        );
        let expected_normalized = normalize_for_platform(PathBuf::from(expected));
        assert_eq!(normalized, expected_normalized);
    }

    #[test]
    fn normalize_rejects_relative_path() {
        let err = normalize_target_path("docs/main.md").unwrap_err();
        assert_eq!(err, "invalid_target_path");
    }

    #[test]
    fn normalize_rejects_empty_string() {
        let err = normalize_target_path("   ").unwrap_err();
        assert_eq!(err, "invalid_target_path");
    }

    #[test]
    fn normalize_rejects_when_parent_missing() {
        let err = normalize_target_path("/nonexistent-dir/abc.md").unwrap_err();
        assert_eq!(err, "invalid_target_path");
    }
}
