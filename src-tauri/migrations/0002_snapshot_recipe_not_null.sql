PRAGMA foreign_keys = OFF;

CREATE TABLE snapshots_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  compiled_text TEXT NOT NULL DEFAULT '',
  compiled_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO snapshots_new (
  id,
  workspace_id,
  recipe_id,
  label,
  snapshot_json,
  compiled_text,
  compiled_hash,
  created_at
)
SELECT
  s.id,
  s.workspace_id,
  COALESCE(
    s.recipe_id,
    w.default_recipe_id,
    (
      SELECT r.id
      FROM recipes r
      WHERE r.workspace_id = s.workspace_id
      ORDER BY r.is_active DESC, r.created_at ASC
      LIMIT 1
    )
  ) AS recipe_id,
  s.label,
  s.snapshot_json,
  s.compiled_text,
  s.compiled_hash,
  s.created_at
FROM snapshots s
LEFT JOIN workspaces w ON w.id = s.workspace_id;

DROP TABLE snapshots;
ALTER TABLE snapshots_new RENAME TO snapshots;

CREATE INDEX idx_snapshots_workspace_created ON snapshots(workspace_id, created_at);

PRAGMA foreign_keys = ON;
