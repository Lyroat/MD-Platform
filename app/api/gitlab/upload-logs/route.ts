/**
 * Upload Logs API
 *
 * GET /api/gitlab/upload-logs?projectId=xxx — Get upload history for a project
 */

import { NextResponse } from 'next/server';
import { selectMany } from '@/app/api/supabase/lib/db-helpers';
import { isDbConfigured } from '@/app/api/supabase/lib/db';

const TABLE = 'a1ej74pytnlr_upload_logs';

interface UploadLog {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  file_path: string;
  file_size: number;
  commit_sha: string;
  created_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const logs = await selectMany<UploadLog>(TABLE, { project_id: projectId });
    // Sort by created_at descending
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ logs });
  } catch (err) {
    console.error('[Upload Logs API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
