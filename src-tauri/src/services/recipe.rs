use crate::types::RecipeItem;

pub struct RecipeService;

impl RecipeService {
    pub fn sorted_items_for_recipe(mut items: Vec<RecipeItem>) -> Vec<RecipeItem> {
        items.sort_by_key(|item| item.sort_order);
        items
    }
}
