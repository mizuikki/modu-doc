import { tauriInvoke } from "./tauri";
import type { FragmentWire } from "./types";

export async function createFragment(args: {
  projectId: string;
  name: string;
  content?: string | null;
  tags?: string[] | null;
  category?: string | null;
}) {
  return await tauriInvoke<FragmentWire>("create_fragment", {
    projectId: args.projectId,
    name: args.name,
    content: args.content ?? null,
    tags: args.tags ?? null,
    category: args.category ?? null,
  });
}

export async function updateFragment(args: {
  id: string;
  name?: string | null;
  content?: string | null;
  tags?: string[] | null;
  category?: string | null;
}) {
  return await tauriInvoke<FragmentWire>("update_fragment", {
    id: args.id,
    name: args.name ?? null,
    content: args.content ?? null,
    tags: args.tags ?? null,
    category: args.category ?? null,
  });
}

export async function softDeleteFragment(id: string) {
  await tauriInvoke("soft_delete_fragment", { id });
}

export async function restoreFragment(id: string) {
  return await tauriInvoke<FragmentWire>("restore_fragment", { id });
}
