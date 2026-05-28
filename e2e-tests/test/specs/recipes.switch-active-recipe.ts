import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { safeClick, safeSetValue, selectWorkspaceById } from "../support/ui";
import { createAndSelectWorkspace, loadWorkspace } from "../support/workspace";

describe("Recipes", () => {
  it("switches active recipe via UI and affects compilation + write output", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "modudoc-e2e-recipes-"));
    const targetPath = path.join(tempDir, "workspace.md");

    const workspaceName = `E2E Recipe switch ${Date.now()}`;
    const workspace = await createAndSelectWorkspace({ name: workspaceName, targetPath });
    await selectWorkspaceById(workspace.id);

    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Alpha",
      content: "A-content",
    });
    await tauriInvoke("create_fragment", {
      workspaceId: workspace.id,
      name: "Beta",
      content: "B-content",
    });

    const bundle = await loadWorkspace(workspace.id);
    const defaultRecipe =
      bundle.recipes.find((recipe) => recipe.is_active) ?? bundle.recipes[0] ?? null;
    expect(defaultRecipe).not.toBeNull();

    const fragmentByName = new Map(bundle.fragments.map((fragment) => [fragment.name, fragment]));
    const alpha = fragmentByName.get("Alpha");
    const beta = fragmentByName.get("Beta");
    if (!alpha || !beta || !defaultRecipe) throw new Error("missing fragments or recipe");

    // Create a second recipe and set it active later.
    const altRecipe = await tauriInvoke<{ id: string }>("create_recipe", {
      workspaceId: workspace.id,
      name: "Alt",
      description: "",
    });

    // Default recipe: only Alpha enabled.
    const defaultItems = bundle.recipe_items
      .filter((item) => item.recipe_id === defaultRecipe.id)
      .map((item) => ({
        ...item,
        enabled: item.fragment_id === alpha.id,
      }));
    await tauriInvoke("update_recipe_items", { recipeId: defaultRecipe.id, items: defaultItems });

    // Alt recipe: only Beta enabled.
    const altItems = [
      {
        id: `${Date.now()}-alpha-item`,
        recipe_id: altRecipe.id,
        fragment_id: alpha.id,
        enabled: false,
        sort_order: 0,
      },
      {
        id: `${Date.now()}-beta-item`,
        recipe_id: altRecipe.id,
        fragment_id: beta.id,
        enabled: true,
        sort_order: 1,
      },
    ];
    await tauriInvoke("update_recipe_items", { recipeId: altRecipe.id, items: altItems });

    // Switch active recipe in UI.
    await safeClick("[data-testid='recipe-select']", 20000);
    await safeClick(`[data-testid='recipe-select-item-${altRecipe.id}']`, 20000);

    // Verify compilation reflects active recipe by writing target.
    await tauriInvoke("write_target_file", {
      workspaceId: workspace.id,
      conflictPolicy: "overwrite_target",
    });
    const written = await readFile(targetPath, "utf8");
    expect(written).toContain("B-content");
    expect(written).not.toContain("A-content");

    // Also verify global search can find the alt recipe and navigate.
    await safeSetValue("[data-testid='global-search-input']", "Alt");
    await safeClick(`button*=Alt`);
    await browser.waitUntil(
      async () => {
        const trigger = await $("[data-testid='recipe-select']");
        const title = await trigger.getAttribute("title");
        return title === "Alt";
      },
      { timeout: 20000, interval: 200 },
    );
  });
});
