import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";

export function WorkspaceSelect() {
  const { t } = useTranslation();
  const workspaces = useAppStore((state) => state.workspaces);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);

  return (
    <div>
      <label htmlFor="workspace-select" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        {t("workspace")}
      </label>
      <select
        id="workspace-select"
        style={{
          width: "100%",
          padding: 8,
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
        }}
        value={activeWorkspaceId ?? ""}
        onChange={(event) => setActiveWorkspace(event.target.value || null)}
      >
        <option value="">{t("select_workspace")}</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
