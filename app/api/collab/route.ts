/**
 * Collaboration API Route
 *
 * Health check endpoint for the HTTP polling-based collaboration system.
 * Actual sync operations are handled by /api/collab/sync
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Collaboration server is running. Uses HTTP polling via /api/collab/sync',
    mode: 'http-polling',
  });
}
