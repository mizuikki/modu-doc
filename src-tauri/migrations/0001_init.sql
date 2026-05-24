CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_path TEXT,
  default_recipe_id TEXT,
  status TEXT NOT NULL DEFAULT 'missing_target',
  last_compiled_at TEXT,
  last_compiled_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fragments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  fragment_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (fragment_id) REFERENCES fragments(id) ON DELETE CASCADE
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recipe_id TEXT,
  label TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  compiled_text TEXT NOT NULL DEFAULT '',
  compiled_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE file_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  path TEXT NOT NULL,
  last_known_hash TEXT,
  last_seen_at TEXT,
  is_managed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_fragments_workspace_order ON fragments(workspace_id, sort_order);
CREATE INDEX idx_recipe_items_recipe_order ON recipe_items(recipe_id, sort_order);
CREATE INDEX idx_snapshots_workspace_created ON snapshots(workspace_id, created_at);

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '1', datetime('now'));
