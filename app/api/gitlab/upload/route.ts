/**
 * GitLab File Upload API
 *
 * POST /api/gitlab/upload — Upload files to a GitLab repository
 * Uses the user's own OAuth access token for attribution
 *
 * Body: FormData with:
 *   - projectId: GitLab project ID
 *   - path: target directory path in the repository
 *   - files: File[] (multiple files supported)
 *   - accessToken: user's GitLab OAuth access token
 *   - userName: user's display name (for commit message)
 */

import { NextResponse } from 'next/server';
import { insertOne } from '@/app/api/supabase/lib/db-helpers';
import { isDbConfigured } from '@/app/api/supabase/lib/db';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab-ee.zhenguanyu.com';
const ADMIN_TOKEN = process.env.GITLAB_TOKEN || '';

interface UploadAction {
  action: 'create' | 'update';
  file_path: string;
  content: string;
  encoding: 'base64';
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const targetPath = (formData.get('path') as string) || '';
    const accessToken = formData.get('accessToken') as string;
    const userName = formData.get('userName') as string;
    const userId = formData.get('userId') as string;
    const files = formData.getAll('files') as File[];

    if (!projectId || files.length === 0) {
      return NextResponse.json(
        { error: 'Missing projectId or files' },
        { status: 400 }
      );
    }

    // Try user's token first, fall back to admin token if it fails
    let token = accessToken || ADMIN_TOKEN;
    let authHeader: Record<string, string> = accessToken
      ? { Authorization: `Bearer ${token}` }
      : { 'PRIVATE-TOKEN': token };

    // Verify token is valid by making a quick API call
    if (accessToken) {
      try {
        const verifyRes = await fetch(`${GITLAB_URL}/api/v4/user`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!verifyRes.ok) {
          // User token expired/invalid, fall back to admin token
          console.log('[Upload API] User token invalid, falling back to admin token');
          token = ADMIN_TOKEN;
          authHeader = { 'PRIVATE-TOKEN': ADMIN_TOKEN };
        }
      } catch {
        token = ADMIN_TOKEN;
        authHeader = { 'PRIVATE-TOKEN': ADMIN_TOKEN };
      }
    }

    // Prepare commit actions (one per file)
    const actions: UploadAction[] = [];
    const uploadedFiles: string[] = [];

    // Get the default branch name first (for file existence checks)
    let defaultBranch = 'main';
    try {
      const projectRes = await fetch(
        `${GITLAB_URL}/api/v4/projects/${projectId}`,
        { headers: authHeader }
      );
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        defaultBranch = projectData.default_branch || 'main';
      }
    } catch {
      // Fall back to 'main'
    }

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Content = Buffer.from(arrayBuffer).toString('base64');

      // file.name contains the relative path (set by the client)
      const fileName = file.name;
      const filePath = targetPath ? `${targetPath}/${fileName}` : fileName;

      // Check if file already exists (to decide create vs update)
      let action: 'create' | 'update' = 'create';
      try {
        const checkRes = await fetch(
          `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}?ref=${defaultBranch}`,
          { headers: authHeader }
        );
        if (checkRes.ok) {
          action = 'update';
        }
      } catch {
        // File doesn't exist, use 'create'
      }

      actions.push({
        action,
        file_path: filePath,
        content: base64Content,
        encoding: 'base64',
      });
      uploadedFiles.push(filePath);
    }

    // Create a single commit with all files
    const commitMessage = `上传 ${files.length} 个文件${userName ? ` (by ${userName})` : ''}`;

    const commitRes = await fetch(
      `${GITLAB_URL}/api/v4/projects/${projectId}/repository/commits`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          branch: defaultBranch,
          commit_message: commitMessage,
          actions,
        }),
      }
    );

    if (!commitRes.ok) {
      const errorData = await commitRes.json().catch(() => ({}));
      console.error('[Upload API] GitLab commit failed:', commitRes.status, errorData);
      return NextResponse.json(
        { error: errorData.message || `GitLab API error: ${commitRes.status}` },
        { status: commitRes.status }
      );
    }

    const commitData = await commitRes.json();

    // Log the upload to database
    if (isDbConfigured() && userId) {
      try {
        for (const filePath of uploadedFiles) {
          await insertOne('a1ej74pytnlr_upload_logs', {
            project_id: projectId,
            user_id: userId,
            user_name: userName || 'unknown',
            file_path: filePath,
            file_size: 0, // Could calculate from files array
            commit_sha: commitData.id || '',
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[Upload API] Failed to log upload:', err);
        // Don't fail the upload just because logging failed
      }
    }

    return NextResponse.json({
      success: true,
      commit: {
        id: commitData.id,
        message: commitData.message,
        author_name: commitData.author_name,
      },
      files: uploadedFiles,
    });
  } catch (err) {
    console.error('[Upload API] Error:', err);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
