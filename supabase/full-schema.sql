-- MD-Platform Full Schema
-- This file represents the complete current state of the database

-- Users table (synced from GitLab OAuth)
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gitlab_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table (text annotations with threading)
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  anchor_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  author_id TEXT NOT NULL REFERENCES a1ej74pytnlr_users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES a1ej74pytnlr_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a1ej74pytnlr_comments_lookup
  ON a1ej74pytnlr_comments(project_id, file_path, branch);

CREATE INDEX IF NOT EXISTS idx_a1ej74pytnlr_comments_parent
  ON a1ej74pytnlr_comments(parent_id);

-- Collaboration documents (Yjs state storage)
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_collab_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_name TEXT UNIQUE NOT NULL,
  state BYTEA,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions support
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES a1ej74pytnlr_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
