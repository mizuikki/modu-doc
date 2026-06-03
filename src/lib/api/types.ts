export type WorkspaceLoadResult = {
  workspace: {
    id: string;
    name: string;
    target_path: string | null;
    default_recipe_id: string | null;
    status: string;
    last_compiled_at: string | null;
    last_compiled_hash: string | null;
    created_at: string;
    updated_at: string;
  };
  fragments: Array<{
    id: string;
    workspace_id: string;
    name: string;
    content: string;
    content_hash: string;
    sort_order: number;
    is_archived: boolean;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  recipes: Array<{
    id: string;
    workspace_id: string;
    name: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  recipe_items: Array<{
    id: string;
    recipe_id: string;
    fragment_id: string;
    enabled: boolean;
    sort_order: number;
  }>;
  snapshots: Array<{
    id: string;
    workspace_id: string;
    recipe_id: string;
    label: string;
    compiled_text: string;
    compiled_hash: string;
    created_at: string;
  }>;
};

export type SearchResult =
  | {
      kind: "workspace";
      id: string;
      workspace_id: null;
      title: string;
      subtitle: string;
    }
  | {
      kind: "fragment" | "recipe" | "snapshot";
      id: string;
      workspace_id: string;
      title: string;
      subtitle: string;
    };
