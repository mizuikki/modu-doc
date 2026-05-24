use crate::types::WorkspaceLoadResult;

pub struct SnapshotService;

impl SnapshotService {
    pub fn active_recipe_id(load: &WorkspaceLoadResult) -> Option<String> {
        load.recipes
            .iter()
            .find(|recipe| recipe.is_active)
            .or_else(|| load.recipes.first())
            .map(|recipe| recipe.id.clone())
    }
}
