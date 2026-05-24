use crate::types::{Fragment, RecipeItem};

pub fn compile_fragments(fragments: &[Fragment], items: &[RecipeItem]) -> String {
    let mut ordered_items: Vec<&RecipeItem> = items.iter().filter(|item| item.enabled).collect();
    ordered_items.sort_by_key(|item| item.sort_order);

    let mut parts = Vec::new();
    for item in ordered_items {
        if let Some(fragment) = fragments
            .iter()
            .find(|fragment| fragment.id == item.fragment_id)
        {
            parts.push(fragment.content.clone());
        }
    }

    parts.join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_enabled_fragments_in_order() {
        let fragments = vec![
            Fragment {
                id: "a".into(),
                workspace_id: "workspace".into(),
                name: "A".into(),
                content: "# A".into(),
                content_hash: "hash-a".into(),
                sort_order: 0,
                is_archived: false,
                deleted_at: None,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-01T00:00:00Z".into(),
            },
            Fragment {
                id: "b".into(),
                workspace_id: "workspace".into(),
                name: "B".into(),
                content: "# B".into(),
                content_hash: "hash-b".into(),
                sort_order: 1,
                is_archived: false,
                deleted_at: None,
                created_at: "2026-01-01T00:00:00Z".into(),
                updated_at: "2026-01-01T00:00:00Z".into(),
            },
        ];
        let items = vec![
            RecipeItem {
                id: "item-a".into(),
                recipe_id: "recipe".into(),
                fragment_id: "b".into(),
                enabled: true,
                sort_order: 1,
            },
            RecipeItem {
                id: "item-b".into(),
                recipe_id: "recipe".into(),
                fragment_id: "a".into(),
                enabled: true,
                sort_order: 0,
            },
            RecipeItem {
                id: "item-c".into(),
                recipe_id: "recipe".into(),
                fragment_id: "b".into(),
                enabled: false,
                sort_order: 2,
            },
        ];

        assert_eq!(compile_fragments(&fragments, &items), "# A\n\n# B");
    }
}
