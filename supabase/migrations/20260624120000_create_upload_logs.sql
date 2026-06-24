-- Upload logs table
CREATE TABLE IF NOT EXISTS a1ej74pytnlr_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  commit_sha TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by project
CREATE INDEX IF NOT EXISTS idx_upload_logs_project ON a1ej74pytnlr_upload_logs(project_id, created_at DESC);
