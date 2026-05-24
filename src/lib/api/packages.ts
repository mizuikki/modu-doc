import { tauriInvoke } from "./tauri";

export async function importMarkdownFile(args: {
  workspaceId: string;
  path: string;
  mode: "import_as_fragment";
}) {
  await tauriInvoke("import_markdown_file", {
    workspaceId: args.workspaceId,
    path: args.path,
    mode: args.mode,
  });
}

export async function exportWorkspace(args: { workspaceId: string; path: string }) {
  await tauriInvoke("export_workspace", {
    workspaceId: args.workspaceId,
    options: { path: args.path },
  });
}

export async function importWorkspacePackage(path: string) {
  return await tauriInvoke<string>("import_workspace_package", { path });
}
