/**
 * POST /api/gitlab/save
 * 保存文件到 GitLab
 */

import { NextResponse } from 'next/server';
import { saveFile } from '@/lib/gitlab';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, filePath, content, commitMessage, branch } = body;

    if (!projectId || !filePath || content === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const result = await saveFile(
      projectId,
      filePath,
      content,
      commitMessage || `Update ${filePath}`,
      branch || 'main'
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/gitlab/save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save file' },
      { status: 500 }
    );
  }
}
