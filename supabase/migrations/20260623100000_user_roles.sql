-- User Roles table (per-project permission control)
-- role: 'owner' | 'editor' | 'viewer'
-- owner: can edit, comment, and manage roles
-- editor: can edit and comment
-- viewer: can only view and comment (cannot edit markdown)

CREATE TABLE IF NOT EXISTS a1ej74pytnlr_user_roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL,
  gitlab_id INTEGER NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, gitlab_id)
);

CREATE INDEX IF NOT EXISTS idx_a1ej74pytnlr_user_roles_lookup
  ON a1ej74pytnlr_user_roles(project_id, gitlab_id);
