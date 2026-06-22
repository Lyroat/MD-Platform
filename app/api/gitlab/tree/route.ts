/**
 * GET /api/gitlab/tree?projectId=xxx&path=xxx&ref=main
 * 获取仓库文件树
 */

import { NextResponse } from 'next/server';
import { getRepoTree } from '@/lib/gitlab';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const path = searchParams.get('path') || '';
    const ref = searchParams.get('ref') || 'main';

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const tree = await getRepoTree(projectId, path, ref);

    // 仅保留文件夹和 .md 文件
    const filtered = (tree as Array<{ name: string; type: string; path: string }>).filter(
      (item) => item.type === 'tree' || item.name.endsWith('.md')
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('GET /api/gitlab/tree error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tree' },
      { status: 500 }
    );
  }
}
