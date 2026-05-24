import { tauriInvoke } from "./tauri";

export async function createFragment(args: {
  workspaceId: string;
  name: string;
  content?: string;
  attachToRecipe?: boolean;
}) {
  return await tauriInvoke("create_fragment", {
    workspaceId: args.workspaceId,
    name: args.name,
    content: args.content ?? "",
    attachToRecipe: args.attachToRecipe ?? true,
  });
}

export async function updateFragment(args: {
  id: string;
  name?: string | null;
  content?: string | null;
}) {
  return await tauriInvoke("update_fragment", {
    id: args.id,
    name: args.name ?? null,
    content: args.content ?? null,
  });
}

export async function softDeleteFragment(id: string) {
  await tauriInvoke("soft_delete_fragment", { id });
}

export async function restoreFragment(id: string) {
  await tauriInvoke("restore_fragment", { id });
}
