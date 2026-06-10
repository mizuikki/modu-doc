-- ModuDoc document-first baseline migration
--
-- This is the new clean schema baseline (no legacy compatibility).
-- Document is the primary object; Project is a pure container.
-- Snapshot is bound to document_id; Fragment is a material library;
-- Recipe is preserved as an advanced feature only.

PRAGMA foreign_keys = ON;

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  target_path TEXT,
  save_state TEXT NOT NULL DEFAULT 'draft' CHECK (
    save_state IN ('draft', 'unsaved', 'saved', 'conflict', 'error')
  ),
  last_written_at TEXT,
  last_written_hash TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE fragments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  fragment_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (fragment_id) REFERENCES fragments(id) ON DELETE CASCADE
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  label TEXT,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_documents_project_order
  ON documents(project_id, deleted_at, sort_order, created_at);

CREATE UNIQUE INDEX idx_documents_target_path_unique
  ON documents(target_path)
  WHERE target_path IS NOT NULL;

CREATE INDEX idx_fragments_project_order
  ON fragments(project_id, deleted_at, sort_order, created_at);

CREATE INDEX idx_recipes_project_order
  ON recipes(project_id, deleted_at, created_at);

CREATE INDEX idx_recipe_items_recipe_order
  ON recipe_items(recipe_id, sort_order);

CREATE INDEX idx_snapshots_document_created
  ON snapshots(document_id, created_at DESC);

INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '1', datetime('now'));
