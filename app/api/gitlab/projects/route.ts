/**
 * GET /api/gitlab/projects
 * 获取 GitLab 组内的所有项目
 */

import { NextResponse } from 'next/server';
import { getGroupProjects } from '@/lib/gitlab';

export async function GET() {
  try {
    const groupPath = process.env.GITLAB_GROUP_PATH;
    if (!groupPath) {
      return NextResponse.json(
        { error: '未配置 GITLAB_GROUP_PATH 环境变量' },
        { status: 500 }
      );
    }

    const projects = await getGroupProjects(groupPath);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET /api/gitlab/projects error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
