/**
 * Comments API - CRUD for text annotations
 */

import { NextResponse } from 'next/server';
import {
  selectMany,
  insertOne,
  updateOne,
  deleteRecords,
} from '@/app/api/supabase/lib/db-helpers';

interface Comment {
  id: string;
  project_id: string;
  file_path: string;
  branch: string;
  anchor_text: string;
  start_offset: number;
  end_offset: number;
  content: string;
  resolved: boolean;
  author_id: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'a1ej74pytnlr_comments';

/**
 * GET /api/comments?projectId=xxx&filePath=xxx&branch=main
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || '';
    const filePath = searchParams.get('filePath') || '';
    const branch = searchParams.get('branch') || 'main';

    const comments = await selectMany<Comment>(
      TABLE,
      { project_id: projectId, file_path: filePath, branch },
      { orderBy: 'created_at', ascending: true }
    );

    // Join with user data
    const userIds = [...new Set(comments.map((c) => c.author_id))];
    let users: Record<string, { name: string; avatar_url: string | null; gitlab_id: number | null }> = {};

    if (userIds.length > 0) {
      const userRows = await selectMany<{ id: string; name: string; avatar_url: string | null; gitlab_id: number | null }>(
        'a1ej74pytnlr_users',
        { id: { $in: userIds } }
      );
      users = Object.fromEntries(userRows.map((u) => [u.id, { name: u.name, avatar_url: u.avatar_url, gitlab_id: u.gitlab_id }]));
    }

    const enriched = comments.map((c) => ({
      ...c,
      author: users[c.author_id] || { name: 'Unknown', avatar_url: null },
      author_gitlab_id: users[c.author_id]?.gitlab_id ? String(users[c.author_id].gitlab_id) : null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/comments error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/**
 * POST /api/comments
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, filePath, branch, anchorText, startOffset, endOffset, content, authorId, parentId } = body;

    if (!filePath || !content || !authorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // authorId 可能是 gitlab_id（数字字符串），需要解析为内部 user.id
    // 先按 gitlab_id 查找用户
    let userId = authorId;
    const users = await selectMany<{ id: string; gitlab_id: number }>(
      'a1ej74pytnlr_users',
      { gitlab_id: Number(authorId) }
    );
    if (users.length > 0) {
      userId = users[0].id;
    } else {
      // 也尝试直接用 id 查找（如果传入的已经是 UUID）
      const usersById = await selectMany<{ id: string }>(
        'a1ej74pytnlr_users',
        { id: authorId }
      );
      if (usersById.length === 0) {
        return NextResponse.json({ error: 'User not found. Please log in first.' }, { status: 403 });
      }
    }

    const comment = await insertOne<Comment>(TABLE, {
      project_id: projectId || '',
      file_path: filePath,
      branch: branch || 'main',
      anchor_text: anchorText || '',
      start_offset: startOffset || 0,
      end_offset: endOffset || 0,
      content,
      resolved: false,
      author_id: userId,
      parent_id: parentId || null,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('POST /api/comments error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

/**
 * PATCH /api/comments
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, content, resolved } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing comment id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (content !== undefined) updateData.content = content;
    if (resolved !== undefined) updateData.resolved = resolved;

    const updated = await updateOne<Comment>(TABLE, { id }, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/comments error:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

/**
 * DELETE /api/comments
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing comment id' }, { status: 400 });
    }

    // Delete replies first, then the comment itself
    await deleteRecords(TABLE, { parent_id: id });
    await deleteRecords(TABLE, { id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/comments error:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
