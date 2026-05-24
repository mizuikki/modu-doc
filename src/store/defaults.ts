import type { AppState } from "./types";

export function createDefaultWorkspaceState(): Pick<
  AppState,
  "workspaces" | "fragments" | "recipes" | "recipeItems" | "snapshots"
> {
  return {
    workspaces: [
      {
        id: "workspace-default",
        name: "Default Workspace",
        targetPath: null,
        defaultRecipeId: "recipe-default",
        status: "missing_target",
        lastCompiledAt: null,
        lastCompiledHash: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    fragments: [
      {
        id: "fragment-default",
        workspaceId: "workspace-default",
        name: "AGENTS.md",
        content: "# ModuDoc\n",
        contentHash: "",
        sortOrder: 0,
        isArchived: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    recipes: [
      {
        id: "recipe-default",
        workspaceId: "workspace-default",
        name: "Default",
        description: "",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    recipeItems: [
      {
        id: "recipe-item-default",
        recipeId: "recipe-default",
        fragmentId: "fragment-default",
        enabled: true,
        sortOrder: 0,
      },
    ],
    snapshots: [],
  };
}
