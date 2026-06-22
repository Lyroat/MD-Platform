/**
 * WebSocket Collaboration API Route
 *
 * 使用 Next.js Route Handler 处理 WebSocket 升级请求
 * 集成 Hocuspocus 服务器用于 Yjs 文档协作
 *
 * 注意：由于 Next.js App Router 对 WebSocket 的支持限制，
 * 这里使用 custom server 方案在服务器启动时初始化 Hocuspocus
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // 这个路由作为健康检查端点
  // 实际的 WebSocket 连接通过 custom server 处理
  return NextResponse.json({
    status: 'ok',
    message: 'Collaboration server is running. Connect via WebSocket at /api/collab/ws',
  });
}
