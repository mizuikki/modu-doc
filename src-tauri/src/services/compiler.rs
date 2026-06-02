use crate::types::{Fragment, RecipeItem};
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarkerFormat {
    HRule,
    CustomFragment,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SegmentInfo {
    pub fragment_id: String,
    pub fragment_name: String,
    pub start_line: usize,
    pub end_line: usize,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CompileWithMarkers {
    pub compiled_text: String,
    pub segments: Vec<SegmentInfo>,
}

pub fn compile_with_markers(
    fragments: &[Fragment],
    items: &[RecipeItem],
    marker: MarkerFormat,
) -> CompileWithMarkers {
    let mut ordered_items: Vec<&RecipeItem> =
        items.iter().filter(|item| item.enabled).collect();
    ordered_items.sort_by_key(|item| item.sort_order);

    let mut compiled_text = String::new();
    let mut segments: Vec<SegmentInfo> = Vec::new();
    let mut current_line: usize = 1;

    for item in ordered_items {
        let Some(fragment) = fragments
            .iter()
            .find(|fragment| fragment.id == item.fragment_id)
        else {
            continue;
        };

        if !segments.is_empty() {
            let separator = match marker {
                MarkerFormat::HRule => "\n\n---\n\n".to_string(),
                MarkerFormat::CustomFragment => {
                    format!("\n\n---FRAGMENT:{}---\n\n", fragment.id)
                }
            };
            current_line += separator.matches('\n').count();
            compiled_text.push_str(&separator);
        }

        let start_line = current_line;
        let newline_count = fragment.content.matches('\n').count();
        compiled_text.push_str(&fragment.content);
        let end_line = current_line + newline_count;
        current_line = end_line;

        segments.push(SegmentInfo {
            fragment_id: fragment.id.clone(),
            fragment_name: fragment.name.clone(),
            start_line,
            end_line,
            enabled: true,
        });
    }

    CompileWithMarkers {
        compiled_text,
        segments,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fragment(id: &str, name: &str, content: &str, sort_order: i64) -> Fragment {
        Fragment {
            id: id.into(),
            workspace_id: "workspace".into(),
            name: name.into(),
            content: content.into(),
            content_hash: format!("hash-{id}"),
            sort_order,
            is_archived: false,
            deleted_at: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    fn recipe_item(id: &str, fragment_id: &str, enabled: bool, sort_order: i64) -> RecipeItem {
        RecipeItem {
            id: id.into(),
            recipe_id: "recipe".into(),
            fragment_id: fragment_id.into(),
            enabled,
            sort_order,
        }
    }

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

    #[test]
    fn compile_with_markers_hrule_three_enabled_one_disabled() {
        let fragments = vec![
            fragment("a", "Alpha", "hello\nworld", 0),
            fragment("b", "Beta", "second\nfragment", 1),
            fragment("c", "Gamma", "third\nfragment", 2),
            fragment("d", "Delta", "hidden", 3),
        ];
        let items = vec![
            recipe_item("ri-a", "a", true, 0),
            recipe_item("ri-b", "b", true, 1),
            recipe_item("ri-c", "c", true, 2),
            recipe_item("ri-d", "d", false, 3),
        ];

        let result = compile_with_markers(&fragments, &items, MarkerFormat::HRule);

        let expected_text =
            "hello\nworld\n\n---\n\nsecond\nfragment\n\n---\n\nthird\nfragment";
        assert_eq!(result.compiled_text, expected_text);
        assert_eq!(result.segments.len(), 3);
        assert_eq!(
            result.segments[0],
            SegmentInfo {
                fragment_id: "a".into(),
                fragment_name: "Alpha".into(),
                start_line: 1,
                end_line: 2,
                enabled: true,
            }
        );
        assert_eq!(
            result.segments[1],
            SegmentInfo {
                fragment_id: "b".into(),
                fragment_name: "Beta".into(),
                start_line: 6,
                end_line: 7,
                enabled: true,
            }
        );
        assert_eq!(
            result.segments[2],
            SegmentInfo {
                fragment_id: "c".into(),
                fragment_name: "Gamma".into(),
                start_line: 11,
                end_line: 12,
                enabled: true,
            }
        );

        let lines: Vec<&str> = result.compiled_text.split('\n').collect();
        for segment in &result.segments {
            assert!(segment.start_line >= 1);
            assert!(segment.end_line >= segment.start_line);
            assert!(segment.end_line <= lines.len());
        }
        assert_eq!(lines[3], "---");
        assert_eq!(lines[8], "---");
    }

    #[test]
    fn compile_with_markers_custom_fragment_embeds_id() {
        let fragments = vec![
            fragment("alpha", "Alpha", "one", 0),
            fragment("beta", "Beta", "two", 1),
        ];
        let items = vec![
            recipe_item("ri-1", "alpha", true, 0),
            recipe_item("ri-2", "beta", true, 1),
        ];

        let result =
            compile_with_markers(&fragments, &items, MarkerFormat::CustomFragment);

        assert_eq!(
            result.compiled_text,
            "one\n\n---FRAGMENT:beta---\n\ntwo"
        );
        assert_eq!(result.segments.len(), 2);
        assert_eq!(result.segments[0].start_line, 1);
        assert_eq!(result.segments[0].end_line, 1);
        assert_eq!(result.segments[1].start_line, 5);
        assert_eq!(result.segments[1].end_line, 5);
        let lines: Vec<&str> = result.compiled_text.split('\n').collect();
        assert_eq!(lines[2], "---FRAGMENT:beta---");
    }

    #[test]
    fn compile_with_markers_empty_recipe_returns_empty() {
        let fragments: Vec<Fragment> = Vec::new();
        let items: Vec<RecipeItem> = Vec::new();

        let result = compile_with_markers(&fragments, &items, MarkerFormat::HRule);

        assert_eq!(result.compiled_text, "");
        assert!(result.segments.is_empty());
    }

    #[test]
    fn compile_with_markers_empty_recipe_with_disabled_items_only() {
        let fragments = vec![fragment("a", "Alpha", "ignored", 0)];
        let items = vec![recipe_item("ri-a", "a", false, 0)];

        let result = compile_with_markers(&fragments, &items, MarkerFormat::HRule);

        assert_eq!(result.compiled_text, "");
        assert!(result.segments.is_empty());
    }
}
