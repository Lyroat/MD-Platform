/**
 * GET /api/gitlab/file?projectId=xxx&path=xxx&ref=main
 * 获取单个文件内容
 */

import { NextResponse } from 'next/server';
import { getFileContent } from '@/lib/gitlab';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const path = searchParams.get('path');
    const ref = searchParams.get('ref') || 'main';

    if (!projectId || !path) {
      return NextResponse.json({ error: '缺少 projectId 或 path 参数' }, { status: 400 });
    }

    const file = await getFileContent(projectId, path, ref);
    return NextResponse.json(file);
  } catch (error) {
    console.error('GET /api/gitlab/file error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch file' },
      { status: 500 }
    );
  }
}
