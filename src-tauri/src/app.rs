use crate::commands;
use crate::db;
use crate::services::watcher::{prime_watchers, WatcherService, WatcherState};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::list_workspaces,
            commands::create_workspace,
            commands::update_workspace,
            commands::delete_workspace,
            commands::load_workspace,
            commands::search_workspace_content,
            commands::create_fragment,
            commands::update_fragment,
            commands::soft_delete_fragment,
            commands::restore_fragment,
            commands::create_recipe,
            commands::activate_recipe,
            commands::update_recipe_items,
            commands::compile_workspace,
            commands::compile_fragments_with_markers,
            commands::write_target_file,
            commands::import_markdown_file,
            commands::export_workspace,
            commands::import_workspace_package,
            commands::create_snapshot,
            commands::list_snapshots,
            commands::restore_snapshot,
            commands::open_target_in_file_manager,
            commands::get_setting,
            commands::set_setting,
            commands::list_settings,
            commands::delete_setting
        ])
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::initialize(app.handle().clone()))?;
            app.manage(db::DbState::new(pool));
            app.manage(WatcherState::new());
            app.manage(Arc::new(WatcherService::new(app.handle().clone())));
            let watcher_service = app.state::<Arc<WatcherService>>().inner().clone();
            let watcher_state = app.state::<WatcherState>().inner().clone();
            let pool = app.state::<db::DbState>().pool().clone();
            tauri::async_runtime::spawn(async move {
                let _ = prime_watchers(pool, watcher_state, watcher_service).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
