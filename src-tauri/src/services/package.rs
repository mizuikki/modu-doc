use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use crate::types::*;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

pub struct PackageService;

impl PackageService {
    pub fn export_workspace(path: &Path, package: &WorkspacePackageExport) -> Result<(), String> {
        let file = File::create(path).map_err(crate::error::normalize_error)?;
        let mut writer = ZipWriter::new(file);
        let options: FileOptions<'_, ()> =
            FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let manifest = WorkspacePackageManifest {
            schema_version: package.schema_version,
            app_version: package.app_version.clone(),
            exported_at: package.exported_at.clone(),
            workspace: package.workspace.clone(),
        };

        writer
            .start_file("workspace.json", options)
            .map_err(crate::error::normalize_error)?;
        writer
            .write_all(
                serde_json::to_string_pretty(&manifest)
                    .map_err(crate::error::normalize_error)?
                    .as_bytes(),
            )
            .map_err(crate::error::normalize_error)?;

        writer
            .start_file("fragments.json", options)
            .map_err(crate::error::normalize_error)?;
        writer
            .write_all(
                serde_json::to_string_pretty(&package.fragments)
                    .map_err(crate::error::normalize_error)?
                    .as_bytes(),
            )
            .map_err(crate::error::normalize_error)?;

        writer
            .start_file("recipes.json", options)
            .map_err(crate::error::normalize_error)?;
        writer
            .write_all(
                serde_json::to_string_pretty(&package.recipes)
                    .map_err(crate::error::normalize_error)?
                    .as_bytes(),
            )
            .map_err(crate::error::normalize_error)?;

        writer
            .add_directory("snapshots/", options)
            .map_err(crate::error::normalize_error)?;
        writer
            .add_directory("assets/", options)
            .map_err(crate::error::normalize_error)?;

        writer
            .start_file("snapshots/index.json", options)
            .map_err(crate::error::normalize_error)?;
        writer
            .write_all(
                serde_json::to_string_pretty(&package.snapshots)
                    .map_err(crate::error::normalize_error)?
                    .as_bytes(),
            )
            .map_err(crate::error::normalize_error)?;

        for snapshot in package.snapshots.iter() {
            let snapshot_path = format!("snapshots/{}.json", snapshot.id);
            writer
                .start_file(snapshot_path, options)
                .map_err(crate::error::normalize_error)?;
            writer
                .write_all(
                    serde_json::to_string_pretty(snapshot)
                        .map_err(crate::error::normalize_error)?
                        .as_bytes(),
                )
                .map_err(crate::error::normalize_error)?;
        }

        writer.finish().map_err(crate::error::normalize_error)?;
        Ok(())
    }

    pub fn import_workspace(path: &Path) -> Result<WorkspacePackageExport, String> {
        let file = File::open(path).map_err(crate::error::normalize_error)?;
        let mut archive = ZipArchive::new(file).map_err(crate::error::normalize_error)?;
        let mut workspace_json = String::new();
        let mut fragments_json = String::new();
        let mut recipes_json = String::new();
        let mut snapshots_json = String::new();

        archive
            .by_name("workspace.json")
            .map_err(crate::error::normalize_error)?
            .read_to_string(&mut workspace_json)
            .map_err(crate::error::normalize_error)?;
        archive
            .by_name("fragments.json")
            .map_err(crate::error::normalize_error)?
            .read_to_string(&mut fragments_json)
            .map_err(crate::error::normalize_error)?;
        archive
            .by_name("recipes.json")
            .map_err(crate::error::normalize_error)?
            .read_to_string(&mut recipes_json)
            .map_err(crate::error::normalize_error)?;
        let has_snapshot_index = {
            match archive.by_name("snapshots/index.json") {
                Ok(mut entry) => {
                    entry
                        .read_to_string(&mut snapshots_json)
                        .map_err(crate::error::normalize_error)?;
                    true
                }
                Err(_) => false,
            }
        };
        if !has_snapshot_index {
            archive
                .by_name("snapshots.json")
                .map_err(crate::error::normalize_error)?
                .read_to_string(&mut snapshots_json)
                .map_err(crate::error::normalize_error)?;
        }

        let manifest: WorkspacePackageManifest =
            serde_json::from_str(&workspace_json).map_err(crate::error::normalize_error)?;
        if manifest.schema_version != 1 {
            return Err("import_schema_mismatch".into());
        }
        let mut package = WorkspacePackageExport {
            schema_version: manifest.schema_version,
            app_version: manifest.app_version,
            exported_at: manifest.exported_at,
            workspace: manifest.workspace,
            fragments: Vec::new(),
            recipes: Vec::new(),
            snapshots: Vec::new(),
        };
        package.fragments =
            serde_json::from_str(&fragments_json).map_err(crate::error::normalize_error)?;
        package.recipes =
            serde_json::from_str(&recipes_json).map_err(crate::error::normalize_error)?;
        package.snapshots =
            serde_json::from_str(&snapshots_json).map_err(crate::error::normalize_error)?;
        Ok(package)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn sample_package() -> WorkspacePackageExport {
        WorkspacePackageExport {
            schema_version: 1,
            app_version: "0.1.0".into(),
            exported_at: "2026-05-23T10:00:00Z".into(),
            workspace: WorkspacePackageWorkspace {
                name: "Example".into(),
                target_path_hint: Some("example.md".into()),
            },
            fragments: vec![WorkspacePackageFragment {
                id: "fragment-id".into(),
                name: "Role Definition".into(),
                content: "# Role".into(),
                content_hash: "hash".into(),
            }],
            recipes: vec![WorkspacePackageRecipe {
                id: "recipe-id".into(),
                name: "Default".into(),
                description: String::new(),
                is_active: true,
                items: vec![WorkspacePackageRecipeItem {
                    fragment_id: "fragment-id".into(),
                    enabled: true,
                    sort_order: 0,
                }],
            }],
            snapshots: vec![WorkspacePackageSnapshot {
                id: "snapshot-id".into(),
                recipe_id: "recipe-id".into(),
                label: "Snapshot".into(),
                snapshot_json: "{}".into(),
                compiled_text: "# Role".into(),
                compiled_hash: "hash".into(),
                created_at: "2026-05-23T10:00:00Z".into(),
            }],
        }
    }

    #[test]
    fn rejects_schema_version_mismatch() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("bad.agentpack");
        let mut package = sample_package();
        package.schema_version = 2;
        PackageService::export_workspace(&path, &package).expect("export");

        let err = PackageService::import_workspace(&path).unwrap_err();
        assert_eq!(err, "import_schema_mismatch");
    }

    #[test]
    fn exports_agentpack_zip_structure() {
        let temp_dir = tempdir().expect("temp dir");
        let archive_path = temp_dir.path().join("workspace.agentpack");

        PackageService::export_workspace(&archive_path, &sample_package()).expect("export");

        let file = fs::File::open(&archive_path).expect("zip file");
        let mut archive = ZipArchive::new(file).expect("zip archive");
        let workspace_json = {
            let mut entry = archive.by_name("workspace.json").expect("workspace.json");
            let mut content = String::new();
            entry.read_to_string(&mut content).expect("read manifest");
            content
        };
        assert!(workspace_json.contains("\"schemaVersion\": 1"));
        assert!(archive.by_name("fragments.json").is_ok());
        assert!(archive.by_name("recipes.json").is_ok());
        assert!(archive.by_name("snapshots/index.json").is_ok());
        assert!(archive.by_name("snapshots/snapshot-id.json").is_ok());
        assert!(archive.by_name("assets/").is_ok());
    }

    #[test]
    fn imports_agentpack_zip_structure() {
        let temp_dir = tempdir().expect("temp dir");
        let archive_path = temp_dir.path().join("workspace.agentpack");
        PackageService::export_workspace(&archive_path, &sample_package()).expect("export");

        let package = PackageService::import_workspace(&archive_path).expect("import");
        assert_eq!(package.schema_version, 1);
        assert_eq!(package.workspace.name, "Example");
        assert_eq!(package.fragments.len(), 1);
        assert_eq!(package.recipes.len(), 1);
        assert_eq!(package.snapshots.len(), 1);
    }
}
