use super::*;

#[tauri::command]
pub async fn compile_workspace(
    state: State<'_, db::DbState>,
    workspace_id: String,
) -> Result<String, String> {
    let load = load_workspace(state.clone(), workspace_id).await?;
    let active_recipe = load
        .recipes
        .iter()
        .find(|recipe| recipe.is_active)
        .or_else(|| load.recipes.first());
    let Some(recipe) = active_recipe else {
        return Ok(String::new());
    };

    let items: Vec<RecipeItem> = crate::services::recipe::RecipeService::sorted_items_for_recipe(
        load.recipe_items
            .into_iter()
            .filter(|item| item.recipe_id == recipe.id)
            .collect(),
    );
    let fragments: Vec<Fragment> = load
        .fragments
        .into_iter()
        .filter(|fragment| fragment.deleted_at.is_none())
        .collect();
    let fragment_ids: HashSet<String> = fragments
        .iter()
        .map(|fragment| fragment.id.clone())
        .collect();
    let items: Vec<RecipeItem> = items
        .into_iter()
        .filter(|item| fragment_ids.contains(&item.fragment_id))
        .collect();
    Ok(crate::services::compiler::compile_fragments(
        &fragments, &items,
    ))
}

#[tauri::command]
pub async fn write_target_file(
    app: AppHandle,
    state: State<'_, db::DbState>,
    workspace_id: String,
    conflict_policy: String,
) -> Result<(), String> {
    crate::services::file_writer::FileWriterService::write_target_file(
        app,
        state,
        workspace_id,
        conflict_policy,
    )
    .await
}
