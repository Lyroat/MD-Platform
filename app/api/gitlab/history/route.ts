/**
 * GET /api/gitlab/history?projectId=xxx&path=xxx&ref=main
 * 获取文件提交历史
 */

import { NextResponse } from 'next/server';
import { getFileHistory } from '@/lib/gitlab';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const path = searchParams.get('path');
    const ref = searchParams.get('ref') || 'main';

    if (!projectId || !path) {
      return NextResponse.json({ error: '缺少 projectId 或 path 参数' }, { status: 400 });
    }

    const history = await getFileHistory(projectId, path, ref);
    return NextResponse.json(history);
  } catch (error) {
    console.error('GET /api/gitlab/history error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
