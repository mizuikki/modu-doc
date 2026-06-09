import { useState } from "react";
import { mapDocument } from "@/app/workspaceMappers";
import { updateDocument } from "@/lib/api/documents";
import { useAppStore } from "@/store/appStore";
import { selectActiveDocument } from "@/store/selectors";
import type { CenterMode } from "@/store/types";

const MODES: CenterMode[] = ["edit", "split", "preview", "history"];

export function DocumentHeader() {
  const doc = useAppStore(selectActiveDocument);
  const centerMode = useAppStore((s) => s.ui.centerMode);
  const setCenterMode = useAppStore((s) => s.setCenterMode);
  const patch = useAppStore((s) => s.patchDocument);
  const [editing, setEditing] = useState(false);
  if (!doc) return null;

  const rename = async (name: string) => {
    if (!name || name === doc.name) {
      setEditing(false);
      return;
    }
    try {
      const updated = await updateDocument({ id: doc.id, name });
      patch(doc.id, mapDocument(updated));
    } finally {
      setEditing(false);
    }
  };

  return (
    <header className="document-header" data-testid="document-header">
      {editing ? (
        <input
          defaultValue={doc.name}
          // biome-ignore lint/a11y/noAutofocus: inline rename entered by double-clicking the heading
          autoFocus
          data-testid="document-header-title"
          onBlur={(e) => {
            void rename(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
        />
      ) : (
        <h2
          onDoubleClick={() => setEditing(true)}
          data-testid="document-header-title"
          data-rename-target="true"
        >
          {doc.name}
        </h2>
      )}
      <div className="center-mode-switcher">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCenterMode(mode)}
            data-testid={`document-header-mode-${mode}`}
            data-active={mode === centerMode ? "true" : "false"}
            className={mode === centerMode ? "active" : ""}
          >
            {mode}
          </button>
        ))}
      </div>
    </header>
  );
}
