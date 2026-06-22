/**
 * Custom Next.js Server
 *
 * 集成 Hocuspocus WebSocket 协作服务器到 Next.js 进程中
 * 所有流量通过同一端口（8000）处理
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { getPgPool } from './app/api/supabase/lib/db';
import { ensureEnvLoaded } from './app/api/supabase/lib/env-loader';

// 加载环境变量
ensureEnvLoaded();

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '8000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * 创建 Hocuspocus 服务器实例
 * 使用 PostgreSQL 存储 Yjs 文档状态（替代文件系统）
 */
const hocuspocus = new Hocuspocus({
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        try {
          const pool = getPgPool();
          if (!pool) return null;

          const result = await pool.query(
            'SELECT state FROM a1ej74pytnlr_collab_documents WHERE document_name = $1',
            [documentName]
          );

          if (result.rows.length > 0 && result.rows[0].state) {
            return Buffer.from(result.rows[0].state);
          }
          return null;
        } catch (err) {
          console.error('[Collab] fetch error:', err);
          return null;
        }
      },
      store: async ({ documentName, state }) => {
        try {
          const pool = getPgPool();
          if (!pool) return;

          await pool.query(
            `INSERT INTO a1ej74pytnlr_collab_documents (document_name, state, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (document_name) DO UPDATE SET state = $2, updated_at = NOW()`,
            [documentName, Buffer.from(state)]
          );
        } catch (err) {
          console.error('[Collab] store error:', err);
        }
      },
    }),
  ],
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  // 创建 WebSocket 服务器用于协作
  const wss = new WebSocketServer({ noServer: true });

  // 处理 WebSocket 升级请求
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === '/api/collab/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        // 将升级后的 WebSocket 连接交给 Hocuspocus
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hocuspocus.handleConnection(ws, request as any);
      });
    }
    // Next.js HMR WebSocket 等其他升级请求不拦截
  });

  server.listen(port, hostname, () => {
    console.log(`[Server] Ready on http://${hostname}:${port}`);
    console.log(`[Collab] WebSocket collaboration available at ws://${hostname}:${port}/api/collab/ws`);
  });
});
