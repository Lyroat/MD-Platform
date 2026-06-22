# 研究发现和技术决策

## 源项目分析

### 架构图
```
Browser → Next.js (port 3000) → GitLab API
       → Hocuspocus WebSocket (port 1234) → .yjs files on disk
       → Prisma → SQLite (file DB)
```

### 依赖清单（需安装）
```
# Tiptap 编辑器
@tiptap/react @tiptap/starter-kit @tiptap/pm
@tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
@tiptap/extension-code-block-lowlight @tiptap/extension-highlight
@tiptap/extension-link @tiptap/extension-placeholder
@tiptap/extension-table @tiptap/extension-table-cell
@tiptap/extension-table-header @tiptap/extension-table-row
@tiptap/extension-task-item @tiptap/extension-task-list
@tiptap/extension-typography @tiptap/y-tiptap

# 协作
yjs y-websocket @hocuspocus/server @hocuspocus/provider @hocuspocus/extension-database

# Markdown
react-markdown remark-gfm rehype-highlight marked turndown @types/turndown

# 认证
next-auth

# UI
lucide-react clsx tailwind-merge

# 数据库
pg @types/pg
```

### 数据库 Schema 迁移方案
SQLite → PostgreSQL (Supabase)

**User 表**:
```sql
CREATE TABLE a1ej74pytnlr_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gitlab_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Comment 表**:
```sql
CREATE TABLE a1ej74pytnlr_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT DEFAULT '',
  file_path TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  anchor_text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  author_id TEXT NOT NULL REFERENCES a1ej74pytnlr_users(id),
  parent_id TEXT REFERENCES a1ej74pytnlr_comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_lookup ON a1ej74pytnlr_comments(project_id, file_path, branch);
```

**Collab Documents 表**（替代 .yjs 文件存储）:
```sql
CREATE TABLE a1ej74pytnlr_collab_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_name TEXT UNIQUE NOT NULL,
  state BYTEA,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 协作服务器合并方案

**方案**: 使用 Next.js custom server + WebSocket 升级

由于 Rush 平台只有一个端口（8000），需要：
1. 使用 Next.js 的 custom server 模式
2. 拦截 WebSocket 升级请求（路径如 `/ws/collab`）
3. 在同一端口上同时处理 HTTP 和 WebSocket

或者更简单的方案：使用 `@hocuspocus/server` 的 `handleConnection` 方法，在 Next.js API route 中处理 WebSocket 升级。

### 认证方案

保留 NextAuth + GitLab OAuth 的架构，用户需要配置环境变量。如果用户无法提供 GitLab 凭据，可以用一个简单的用户名登录作为 fallback。
