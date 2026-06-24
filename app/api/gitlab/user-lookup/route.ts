/**
 * GitLab User Lookup API
 *
 * GET /api/gitlab/user-lookup?username=xxx
 * Looks up a GitLab user by username and returns their ID and name
 */

import { NextResponse } from 'next/server';

const GITLAB_URL = process.env.GITLAB_URL || 'https://gitlab-ee.zhenguanyu.com';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 });
  }

  try {
    // Search for user by username
    const res = await fetch(
      `${GITLAB_URL}/api/v4/users?username=${encodeURIComponent(username)}`,
      {
        headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'GitLab API error' }, { status: res.status });
    }

    const users = await res.json();

    if (!Array.isArray(users) || users.length === 0) {
      // Also try searching by name (in case they entered display name instead of username)
      const searchRes = await fetch(
        `${GITLAB_URL}/api/v4/users?search=${encodeURIComponent(username)}`,
        {
          headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
        }
      );

      if (searchRes.ok) {
        const searchUsers = await searchRes.json();
        if (Array.isArray(searchUsers) && searchUsers.length > 0) {
          const user = searchUsers[0];
          return NextResponse.json({
            id: user.id,
            username: user.username,
            name: user.name,
            avatar_url: user.avatar_url,
          });
        }
      }

      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      avatar_url: user.avatar_url,
    });
  } catch (err) {
    console.error('[User Lookup] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
