import { browser, expect } from "@wdio/globals";
import { tauriInvoke } from "../support/tauri";
import { createAndOpenWorkspace, loadWorkspace } from "../support/workspace";

/**
 * Re-runs the given poll until it returns a truthy value, throwing a
 * descriptive timeout error otherwise. Mirrors the helper the other e2e
 * specs use inline so we keep the file self-contained.
 */
async function waitFor<T>(
  label: string,
  fn: () => Promise<T | null | undefined>,
  timeoutMs = 20000,
) {
  return browser.waitUntil(async () => Boolean(await fn()), {
    timeout: timeoutMs,
    interval: 200,
    timeoutMsg: label,
  });
}

describe("Recipes", () => {
  it("generates a new document from a recipe with all 3 fragments enabled", async () => {
    // 1. Fresh workspace via the support helper (auto-activates Main.md).
    const workspaceName = `E2E Recipe generate ${Date.now()}`;
    const { workspaceId } = await createAndOpenWorkspace(workspaceName);

    // 2. Create 3 fragments with deterministic names + content so the
    //    assertion can detect the concatenation order from sort_order.
    const fragments = [
      { name: "Alpha", content: "alpha body" },
      { name: "Beta", content: "beta body" },
      { name: "Gamma", content: "gamma body" },
    ];
    for (const fragment of fragments) {
      await tauriInvoke("create_fragment", {
        workspace_id: workspaceId,
        name: fragment.name,
        content: fragment.content,
      });
    }
    await waitFor("3 fragments visible in bundle", async () => {
      const bundle = await loadWorkspace(workspaceId);
      return fragments.every((f) => bundle.fragments.some((entry) => entry.name === f.name));
    });

    // 3. Create a fresh recipe so the test owns its items (workspaces
    //    come with a default recipe whose items we don't want to assert
    //    against). The default recipe stays untouched.
    const recipe = await tauriInvoke<{ id: string; workspace_id: string }>("create_recipe", {
      workspace_id: workspaceId,
      name: "Generate recipe",
      description: "All 3 fragments enabled in alpha, beta, gamma order",
    });
    expect(recipe.id).toBeTruthy();
    expect(recipe.workspace_id).toBe(workspaceId);

    // 4. Build a deterministic items list: every fragment enabled, in
    //    the order declared above. The backend expects each item to
    //    carry its own id, so we synthesize stable ids locally.
    const bundle = await loadWorkspace(workspaceId);
    const fragmentByName = new Map(bundle.fragments.map((entry) => [entry.name, entry]));
    const items = fragments.map((fragment, index) => {
      const match = fragmentByName.get(fragment.name);
      if (!match) {
        throw new Error(`fragment ${fragment.name} not found in bundle`);
      }
      return {
        id: `item-${recipe.id}-${match.id}`,
        recipe_id: recipe.id,
        fragment_id: match.id,
        enabled: true,
        sort_order: index,
      };
    });
    await tauriInvoke("update_recipe_items", { recipe_id: recipe.id, items });

    // 5. Sanity: the items landed on the recipe and are all enabled.
    await waitFor("recipe has 3 enabled items", async () => {
      const refreshed = await loadWorkspace(workspaceId);
      const recipeItems = refreshed.recipe_items.filter((item) => item.recipe_id === recipe.id);
      return (
        recipeItems.length === 3 &&
        recipeItems.every((item) => item.enabled) &&
        recipeItems.every((item) => items.some((local) => local.id === item.id))
      );
    });

    // 6. Generate a new document from the recipe. The backend creates
    //    a document whose content is the concatenation of the enabled
    //    fragments in sort_order. We name it explicitly so the
    //    assertion is robust against any future default-name tweaks.
    const newName = `Generated ${Date.now()}`;
    const generated = await tauriInvoke<{
      id: string;
      workspace_id: string;
      name: string;
      content: string;
    }>("generate_document_from_recipe", {
      recipe_id: recipe.id,
      document_name: newName,
    });
    expect(generated.id).toBeTruthy();
    expect(generated.workspace_id).toBe(workspaceId);
    expect(generated.name).toBe(newName);

    // 7. The new document should appear in load_workspace(...) and
    //    its content should contain every fragment's body in the order
    //    we configured.
    await waitFor("generated document is in the workspace bundle", async () => {
      const refreshed = await loadWorkspace(workspaceId);
      const match = refreshed.documents.find((entry) => entry.id === generated.id);
      if (!match) return false;
      return match.name === newName;
    });
    const refreshed = await loadWorkspace(workspaceId);
    const match = refreshed.documents.find((entry) => entry.id === generated.id);
    expect(match).toBeTruthy();
    const concat = fragments.map((fragment) => fragment.content).join("");
    expect(match?.content).toContain(concat);

    // 8. The bundle should also reflect a sane file_status: the new
    //    document has no target_path yet, so missing_target is the
    //    expected default after generation.
    expect(match?.target_path).toBeNull();
    expect(match?.file_status).toBe("missing_target");
  });
});
