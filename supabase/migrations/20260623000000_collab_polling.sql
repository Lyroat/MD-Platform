-- Migration: Replace Yjs binary state storage with plain text storage + version tracking
-- This enables HTTP polling-based collaboration instead of WebSocket (Hocuspocus)

-- Replace the Yjs binary state storage with plain text storage + version tracking
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_collab_docs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_name TEXT UNIQUE NOT NULL,  -- format: "projectId:filePath"
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT  -- user name who last edited
);

-- Online presence table (auto-expires after 10 seconds of no heartbeat)
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_collab_presence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_color TEXT NOT NULL DEFAULT '#60a5fa',
  cursor_line INTEGER NOT NULL DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_name, user_id)
);
