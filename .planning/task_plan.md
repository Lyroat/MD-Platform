# 任务计划：MD-Platform 适配部署到 Rush

## 项目概述
将 GitHub 上的 MD-Platform（教研协作平台）完整适配并部署到 Rush 平台。

## 源项目技术栈
- **框架**: Next.js 16 + React 19
- **编辑器**: Tiptap v3 + Yjs + Hocuspocus（实时协作）
- **数据库**: SQLite + Prisma ORM
- **认证**: NextAuth + GitLab OAuth
- **协作服务**: 独立 WebSocket 服务（Hocuspocus，端口 1234）
- **样式**: Tailwind CSS v4

## 适配挑战
1. **双进程架构** → 合并为单进程（Next.js 自定义 server 或 API Route）
2. **SQLite** → 迁移到 Supabase (PostgreSQL)
3. **GitLab OAuth** → 需要用户提供凭据或改为其他认证方式
4. **WebSocket 协作** → 集成到 Next.js 进程内
5. **端口** → 统一到 Rush 的 8000 端口
6. **Tailwind v4** → 确认 Rush 模板兼容性

---

## Phase 1: 项目初始化 `pending`
- [ ] 使用 `nextjs-fullstack` 模板创建项目
- [ ] 安装依赖
- [ ] 启动开发服务器验证

## Phase 2: 数据库迁移（SQLite → Supabase） `pending`
- [ ] 创建 Supabase 数据库
- [ ] 设计 PostgreSQL schema（User + Comment 表）
- [ ] 创建 migration 文件
- [ ] 执行数据库初始化
- [ ] 创建数据库工具库（替代 Prisma）

## Phase 3: 核心基础设施 `pending`
- [ ] 迁移 Markdown 工具库（marked + turndown）
- [ ] 迁移 GitLab API 客户端
- [ ] 创建认证系统（简化版，无需 GitLab OAuth 可改为简单用户系统）
- [ ] 安装 Tiptap 和 Yjs 相关依赖

## Phase 4: 合并协作服务器 `pending`
- [ ] 将 Hocuspocus 服务器集成到 Next.js 自定义 server / API Route
- [ ] 实现 WebSocket 升级处理
- [ ] 实现文档状态持久化（使用 Supabase 存储 Yjs 状态）
- [ ] 测试 WebSocket 连接

## Phase 5: API Routes 迁移 `pending`
- [ ] `/api/comments` - 评论 CRUD
- [ ] `/api/gitlab/file` - 获取文件
- [ ] `/api/gitlab/tree` - 获取仓库文件树
- [ ] `/api/gitlab/save` - 保存文件到 GitLab
- [ ] `/api/gitlab/history` - 获取提交历史
- [ ] `/api/gitlab/projects` - 获取项目列表

## Phase 6: 前端组件迁移 `pending`
- [ ] 页面布局和导航栏
- [ ] 文件树浏览器（FileTree）
- [ ] Markdown 查看器（带批注高亮）
- [ ] Tiptap 协作编辑器
- [ ] 评论面板
- [ ] 提交历史面板
- [ ] 登录页面

## Phase 7: 集成测试和修复 `pending`
- [ ] 验证文件浏览功能
- [ ] 验证 Markdown 渲染
- [ ] 验证评论功能
- [ ] 验证协作编辑
- [ ] 执行 `pnpm run build` 确认无类型错误

---

## 关键决策待确认
1. **认证方式**：是否保留 GitLab OAuth？需要用户提供 GitLab 凭据。
2. **GitLab 连接**：是否需要连接真实 GitLab 实例？还是用 mock 数据演示？
3. **协作服务**：Rush 平台的 WebSocket 支持情况待验证。
