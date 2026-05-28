import * as Select from "@radix-ui/react-select";
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
      <Select.Root
        value={activeWorkspaceId ?? ""}
        onValueChange={(value) => setActiveWorkspace(value ? value : null)}
      >
        <Select.Trigger
          data-testid="workspace-select-trigger"
          data-current-workspace-id={activeWorkspaceId ?? ""}
          aria-label={t("workspace")}
          title={
            activeWorkspaceId
              ? (workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? "")
              : ""
          }
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
        >
          <Select.Value
            placeholder={t("select_workspace")}
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.2,
              padding: "2px 0",
            }}
          />
          <Select.Icon style={{ color: "hsl(var(--muted-foreground))" }}>▾</Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            style={{
              zIndex: 50,
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
              overflow: "hidden",
            }}
          >
            <Select.Viewport
              style={{
                padding: 6,
                maxHeight: 320,
                width: "var(--radix-select-trigger-width)",
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {t("select_workspace")}
              </div>
              {workspaces.map((workspace) => (
                <Select.Item
                  key={workspace.id}
                  value={workspace.id}
                  data-testid={`workspace-select-item-${workspace.id}`}
                  title={workspace.name}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <Select.ItemText>{workspace.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
