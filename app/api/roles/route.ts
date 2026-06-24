/**
 * User Roles API
 *
 * GET /api/roles?projectId=xxx — Get all roles for a project
 * GET /api/roles?projectId=xxx&gitlabId=123 — Get specific user's role
 * POST /api/roles — Create or update a user's role
 * DELETE /api/roles?projectId=xxx&gitlabId=123 — Remove a user's role (reverts to default)
 */

import { NextResponse } from 'next/server';
import {
  selectOne,
  selectMany,
  upsert,
  deleteRecords,
} from '@/app/api/supabase/lib/db-helpers';
import { isDbConfigured } from '@/app/api/supabase/lib/db';

const TABLE = 'a1ej74pytnlr_user_roles';

interface UserRole {
  id: string;
  project_id: string;
  gitlab_id: number;
  user_name: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const gitlabId = searchParams.get('gitlabId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    if (gitlabId) {
      // Get specific user's role for this project
      const role = await selectOne<UserRole>(TABLE, {
        project_id: projectId,
        gitlab_id: parseInt(gitlabId),
      });

      if (role) {
        return NextResponse.json({ role: role.role, isDefault: false, userName: role.user_name });
      }

      // No role for this specific project → check if user is owner in ANY project (global admin)
      const allUserRoles = await selectMany<UserRole>(TABLE, {
        gitlab_id: parseInt(gitlabId),
      });
      const ownerRole = allUserRoles.find((r) => r.role === 'owner');
      if (ownerRole) {
        // User is owner in another project → treat as owner everywhere
        return NextResponse.json({ role: 'owner', isDefault: false, userName: ownerRole.user_name });
      }

      // Default: users without explicit role are viewers (read-only + can annotate)
      return NextResponse.json({ role: 'viewer', isDefault: true });
    }

    // Get all roles for the project
    const roles = await selectMany<UserRole>(TABLE, { project_id: projectId });
    return NextResponse.json({ roles });
  } catch (err) {
    console.error('[Roles API] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { projectId, gitlabId, userName, role } = body;

    if (!projectId || !gitlabId || !role) {
      return NextResponse.json({ error: 'Missing required fields (projectId, gitlabId, role)' }, { status: 400 });
    }

    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be: owner, editor, or viewer' }, { status: 400 });
    }

    // If userName is not provided (e.g., when just updating role), preserve existing user_name
    const upsertData: Record<string, unknown> = {
      project_id: projectId,
      gitlab_id: parseInt(gitlabId),
      role,
      updated_at: new Date().toISOString(),
    };

    // Only set user_name if explicitly provided (non-empty)
    if (userName) {
      upsertData.user_name = userName;
    }

    const result = await upsert<UserRole>(
      TABLE,
      upsertData,
      ['project_id', 'gitlab_id']
    );

    return NextResponse.json({ success: true, role: result });
  } catch (err) {
    console.error('[Roles API] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const gitlabId = searchParams.get('gitlabId');

  if (!projectId || !gitlabId) {
    return NextResponse.json({ error: 'Missing projectId or gitlabId' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    await deleteRecords(TABLE, {
      project_id: projectId,
      gitlab_id: parseInt(gitlabId),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Roles API] DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
