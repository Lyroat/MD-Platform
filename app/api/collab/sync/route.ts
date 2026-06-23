/**
 * Collaboration Sync API (HTTP Polling mode)
 *
 * GET /api/collab/sync?doc=projectId:filePath — Get document state and online users
 * POST /api/collab/sync — Push content update or presence heartbeat
 */

import { NextResponse } from 'next/server';
import {
  selectOne,
  selectMany,
  upsert,
} from '@/app/api/supabase/lib/db-helpers';
import { isDbConfigured } from '@/app/api/supabase/lib/db';

const DOCS_TABLE = 'a1ej74pytnlr_collab_docs';
const PRESENCE_TABLE = 'a1ej74pytnlr_collab_presence';

interface CollabDoc {
  id: string;
  document_name: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
}

interface PresenceRow {
  id: string;
  document_name: string;
  user_id: string;
  user_name: string;
  user_color: string;
  cursor_line: number;
  last_seen: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doc = searchParams.get('doc');

  if (!doc) {
    return NextResponse.json({ error: 'Missing doc parameter' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    // Get document
    const document = await selectOne<CollabDoc>(DOCS_TABLE, { document_name: doc });

    // Get online users — selectMany doesn't support interval comparison,
    // so we fetch all and filter in JS (presence table is small)
    const allPresence = await selectMany<PresenceRow>(
      PRESENCE_TABLE,
      { document_name: doc },
      { orderBy: 'last_seen', ascending: false }
    );

    // Filter to users seen in last 15 seconds, excluding anonymous entries
    const now = Date.now();
    const activeUsers = allPresence.filter(p => {
      const lastSeen = new Date(p.last_seen).getTime();
      const isRecent = (now - lastSeen) < 15000; // 15 seconds
      const isReal = p.user_id !== 'anonymous' && p.user_name !== '匿名用户' && p.user_name !== '';
      return isRecent && isReal;
    });

    const users = activeUsers.map(r => ({
      userId: r.user_id,
      name: r.user_name,
      color: r.user_color,
      cursorLine: r.cursor_line,
    }));

    return NextResponse.json({
      content: document?.content || '',
      version: document?.version || 0,
      updatedBy: document?.updated_by || null,
      users,
    });
  } catch (err) {
    console.error('[Collab Sync] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { documentName, content, version, userName, userId, userColor, cursorLine } = body;

    if (!documentName) {
      return NextResponse.json({ error: 'Missing documentName' }, { status: 400 });
    }

    // Update presence (heartbeat) — only for real users (not anonymous)
    if (userId && userId !== 'anonymous' && userName && userName !== '匿名用户') {
      try {
        await upsert<PresenceRow>(
          PRESENCE_TABLE,
          {
            document_name: documentName,
            user_id: userId,
            user_name: userName,
            user_color: userColor || '#60a5fa',
            cursor_line: cursorLine || 1,
            last_seen: new Date().toISOString(),
          },
          ['document_name', 'user_id']
        );
      } catch (presenceErr) {
        // Presence update failure is non-critical, continue
        console.warn('[Collab Sync] Presence update failed:', presenceErr);
      }
    }

    // If no content provided, this is just a presence update (heartbeat)
    if (content === undefined || content === null) {
      const doc = await selectOne<CollabDoc>(DOCS_TABLE, { document_name: documentName });
      return NextResponse.json({
        status: 'heartbeat',
        content: doc?.content || '',
        version: doc?.version || 0,
      });
    }

    // Get current document state
    const currentDoc = await selectOne<CollabDoc>(DOCS_TABLE, { document_name: documentName });

    if (!currentDoc) {
      // Document doesn't exist yet — create it
      const newDoc = await upsert<CollabDoc>(
        DOCS_TABLE,
        {
          document_name: documentName,
          content,
          version: 1,
          updated_by: userName,
          updated_at: new Date().toISOString(),
        },
        ['document_name']
      );
      return NextResponse.json({ status: 'ok', version: newDoc.version });
    }

    // Check version for conflict
    if (currentDoc.version !== version) {
      // Version conflict — return server's current state
      return NextResponse.json({
        status: 'conflict',
        content: currentDoc.content,
        version: currentDoc.version,
      });
    }

    // Version matches — update document
    const updatedDoc = await upsert<CollabDoc>(
      DOCS_TABLE,
      {
        document_name: documentName,
        content,
        version: currentDoc.version + 1,
        updated_by: userName,
        updated_at: new Date().toISOString(),
      },
      ['document_name']
    );

    return NextResponse.json({ status: 'ok', version: updatedDoc.version });
  } catch (err) {
    console.error('[Collab Sync] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
