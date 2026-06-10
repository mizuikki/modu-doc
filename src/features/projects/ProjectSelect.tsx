import * as Select from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";

export function ProjectSelect() {
  const { t } = useTranslation();
  const projects = useAppStore((state) => state.projects);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const setActiveProject = useAppStore((state) => state.setActiveProject);

  return (
    <div>
      <label htmlFor="project-select" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        {t("project")}
      </label>
      <Select.Root
        value={activeProjectId ?? ""}
        onValueChange={(value) => setActiveProject(value ? value : null)}
      >
        <Select.Trigger
          data-testid="project-select-trigger"
          data-current-project-id={activeProjectId ?? ""}
          aria-label={t("project")}
          title={
            activeProjectId
              ? (projects.find((project) => project.id === activeProjectId)?.name ?? "")
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
            placeholder={t("select_project")}
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
                {t("select_project")}
              </div>
              {projects.map((project) => (
                <Select.Item
                  key={project.id}
                  value={project.id}
                  data-testid={`project-select-item-${project.id}`}
                  title={project.name}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <Select.ItemText>{project.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
