'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Loader2, ArrowLeft, MessageSquare, History, PanelLeftOpen, PanelLeftClose, Pencil, Columns2, Eye, Settings } from 'lucide-react';
import RoleManager from '@/app/components/role-manager';
import { useCollabSync } from '@/app/hooks/use-collab-sync';
import Navbar from '@/app/components/navbar';
import FileTree from '@/app/components/file-tree';
import MarkdownViewer from '@/app/components/markdown-viewer';
import type { TextSelection } from '@/app/components/markdown-viewer';
import CommentPanel from '@/app/components/comment-panel';
import HistoryPanel from '@/app/components/history-panel';
import MarkdownToolbar from '@/app/components/markdown-toolbar';
import TocSlider from '@/app/components/toc-slider';
import MarkdownHighlightOverlay from '@/app/components/markdown-highlight-overlay';
import { cn } from '@/lib/utils';

// 三种视图模式（仿 HackMD）
type ViewMode = 'edit' | 'split' | 'preview';
type RightPanel = 'comments' | 'history' | null;

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
  author: { name: string; avatar_url: string | null };
}

export default function DocPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const projectId = params.projectId as string;
  const pathSegments = params.path as string[] | undefined;
  const filePath = pathSegments
    ? pathSegments.map((seg) => {
        try { return decodeURIComponent(seg); }
        catch { return seg; }
      }).join('/')
    : '';

  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ViewMode>('split');
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
  const [pendingSelection, setPendingSelection] = useState<TextSelection | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocPinned, setTocPinned] = useState(false);

  // 用户权限角色
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer'>('editor');
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const canManageRoles = userRole === 'owner';
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);

  // 编辑器相关
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  // 光标位置（用于底部状态栏）
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  // Undo/Redo 栈
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedForUndo = useRef<string>('');

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-50), markdown]);
    setRedoStack([]);
  }, [markdown]);

  // 防抖版本的 pushUndo — 连续输入时只在停顿 500ms 后保存一次快照
  const debouncedPushUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      if (lastSavedForUndo.current !== markdown) {
        setUndoStack(prev => [...prev.slice(-50), markdown]);
        setRedoStack([]);
        lastSavedForUndo.current = markdown;
      }
    }, 500);
  }, [markdown]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, markdown]);
    setMarkdown(prev);
  }, [undoStack, markdown]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, markdown]);
    setMarkdown(next);
  }, [redoStack, markdown]);

  // cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const currentUserId = (session?.user as Record<string, unknown>)?.gitlabId
    ? String((session?.user as Record<string, unknown>).gitlabId)
    : undefined;

  // 实时协作同步
  const { isConnected, connectedUsers, remoteCursors } = useCollabSync({
    projectId,
    filePath,
    userName: (session?.user as Record<string, unknown>)?.name as string || '匿名用户',
    userId: currentUserId || 'anonymous',
    markdown,
    setMarkdown,
    cursorLine,
  });

  // 计算行数
  const lines = markdown.split('\n');
  const lineCount = lines.length;

  // 测量每行实际渲染高度（使用 mirror div）
  // 同步测量（在 Layout Effect 中）避免行数与高度不匹配
  useEffect(() => {
    const measureLines = () => {
      const mirror = mirrorRef.current;
      if (!mirror) return;
      const children = mirror.children;
      // 安全检查：只有当 mirror 子元素数量和当前行数匹配时才更新
      if (children.length !== lineCount) return;
      const heights: number[] = [];
      for (let i = 0; i < children.length; i++) {
        heights.push((children[i] as HTMLElement).offsetHeight);
      }
      setLineHeights(heights);
    };
    // 使用 RAF 确保 DOM 已更新
    const raf = requestAnimationFrame(measureLines);
    return () => cancelAnimationFrame(raf);
  }, [markdown, mode, sidebarOpen, lineCount]);

  // 也在容器宽度变化时重新测量
  useEffect(() => {
    const container = editorContentRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const mirror = mirrorRef.current;
      if (!mirror) return;
      const children = mirror.children;
      const heights: number[] = [];
      for (let i = 0; i < children.length; i++) {
        heights.push((children[i] as HTMLElement).offsetHeight);
      }
      setLineHeights(heights);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 加载文件内容
  useEffect(() => {
    if (!projectId || !filePath) return;

    setLoading(true);
    fetch(`/api/gitlab/file?projectId=${projectId}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setMarkdown(data.content);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, filePath]);

  // 获取当前用户的权限角色
  useEffect(() => {
    if (!projectId || !currentUserId) return;
    fetch(`/api/roles?projectId=${projectId}&gitlabId=${currentUserId}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (data.role && !data.isDefault) {
          // 用户有明确设置的角色
          setUserRole(data.role);
          if (data.role === 'viewer') {
            setMode('preview');
          }
        } else {
          // 用户没有明确角色，检查是否有任何人配置了角色
          try {
            const allRolesRes = await fetch(`/api/roles?projectId=${projectId}`);
            const allRolesData = await allRolesRes.json();
            if (!allRolesData.roles || allRolesData.roles.length === 0) {
              // 这个项目没有任何角色配置 → 当前用户自动成为管理员
              setUserRole('owner');
            } else {
              // 有人配置了角色但当前用户不在列表中 → 默认编辑者
              setUserRole('editor');
            }
          } catch {
            setUserRole('editor');
          }
        }
      })
      .catch(() => {
        // If role fetch fails, default to editor (most permissive fallback)
        setUserRole('editor');
      });
  }, [projectId, currentUserId]);

  // 更新光标位置
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = markdown.slice(0, pos);
    const lineNum = textBefore.split('\n').length;
    const lastNewline = textBefore.lastIndexOf('\n');
    const colNum = pos - lastNewline;
    setCursorLine(lineNum);
    setCursorCol(colNum);
  }, [markdown]);

  // 加载评论
  const loadComments = useCallback(async () => {
    if (!projectId || !filePath) return;
    try {
      const res = await fetch(
        `/api/comments?projectId=${projectId}&filePath=${encodeURIComponent(filePath)}&branch=main`
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [projectId, filePath]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 保存文件
  const handleSave = async () => {
    if (!projectId || !filePath) return;
    setSaving(true);
    try {
      await fetch('/api/gitlab/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          content: markdown,
          commitMessage: `Update ${filePath} via MD-Platform`,
          branch: 'main',
        }),
      });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // 文本选中回调
  const handleTextSelect = (selection: TextSelection) => {
    setPendingSelection(selection);
    setRightPanel('comments');
  };

  const handleCancelSelection = () => {
    setPendingSelection(null);
  };

  // 提交新批注
  const handleSubmitComment = async (content: string) => {
    if (!pendingSelection || !currentUserId) return;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          branch: 'main',
          anchorText: pendingSelection.text,
          startOffset: pendingSelection.startOffset,
          endOffset: pendingSelection.endOffset,
          content,
          authorId: currentUserId,
        }),
      });
      setPendingSelection(null);
      loadComments();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  // 解决评论
  const handleResolve = async (id: string) => {
    try {
      await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: true }),
      });
      loadComments();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  // 删除评论
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条批注吗？')) return;
    try {
      await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
      loadComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // 回复评论
  const handleReply = async (parentId: string, content: string) => {
    if (!currentUserId) return;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          branch: 'main',
          anchorText: '',
          startOffset: 0,
          endOffset: 0,
          content,
          authorId: currentUserId,
          parentId,
        }),
      });
      loadComments();
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  // 同步滚动 - 使用"当前行"锚定方式
  // 原理：找到编辑器中当前可见的第一个标题行号，然后在预览中滚动到对应标题
  const syncScrollLock = useRef<'editor' | 'preview' | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorScroll = useCallback(() => {
    if (mode !== 'split' || syncScrollLock.current === 'preview') return;
    const editor = editorScrollRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    syncScrollLock.current = 'editor';
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    // 简单比例同步
    const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
    if (maxEditorScroll <= 0) return;
    const ratio = editor.scrollTop / maxEditorScroll;
    const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
    preview.scrollTop = ratio * maxPreviewScroll;

    syncTimeoutRef.current = setTimeout(() => { syncScrollLock.current = null; }, 100);
  }, [mode]);

  const handlePreviewScroll = useCallback(() => {
    if (mode !== 'split' || syncScrollLock.current === 'editor') return;
    const editor = editorScrollRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    syncScrollLock.current = 'preview';
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
    if (maxPreviewScroll <= 0) return;
    const ratio = preview.scrollTop / maxPreviewScroll;
    const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
    editor.scrollTop = ratio * maxEditorScroll;

    syncTimeoutRef.current = setTimeout(() => { syncScrollLock.current = null; }, 100);
  }, [mode]);

  const handleEditorContentScroll = useCallback(() => {
    handleEditorScroll();
  }, [handleEditorScroll]);

  // 文件选择
  const handleSelectFile = (path: string) => {
    const encodedPath = path.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    router.push(`/p/${projectId}/doc/${encodedPath}`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (canEdit) handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  if (!filePath) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex h-[calc(100vh-56px)]">
          <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto p-3">
            <h2 className="text-sm font-medium text-gray-700 mb-3">文件浏览器</h2>
            <FileTree
              projectId={projectId}
              onSelectFile={handleSelectFile}
              selectedPath={filePath}
            />
          </div>
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Pencil className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>请从左侧选择一个 Markdown 文件</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 计算字符数
  const charCount = markdown.length;

  return (
    <div className="h-screen bg-[#1e1e2e] flex flex-col overflow-hidden">
      {/* 顶部工具栏 - 固定，不随内容滚动 */}
      <div className="h-12 border-b border-gray-700 bg-[#2d2d3d] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/p/${projectId}/doc`)}
            className="text-gray-400 hover:text-white transition-colors"
            title="返回项目"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              'p-1.5 rounded transition-colors',
              sidebarOpen ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700'
            )}
            title={sidebarOpen ? '收起文件列表' : '展开文件列表'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* 三模式切换按钮 */}
          <div className="flex items-center bg-gray-700/50 rounded-md p-0.5">
            {canEdit && (
              <button
                onClick={() => setMode('edit')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  mode === 'edit' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                )}
                title="编辑模式"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMode(canEdit ? 'split' : 'preview')}
              className={cn(
                'p-1.5 rounded transition-colors',
                mode === 'split' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
              )}
              title={canEdit ? '分屏模式' : '分屏模式（只读）'}
            >
              <Columns2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('preview')}
              className={cn(
                'p-1.5 rounded transition-colors',
                mode === 'preview' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
              )}
              title="预览模式"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* 在线用户头像 + 协作状态 */}
          <div className="flex items-center gap-1 ml-2">
            {/* 当前用户头像（自己） */}
            <div className="relative group">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white ring-2 ring-gray-800 cursor-default"
                style={{ backgroundColor: '#60a5fa' }}
              >
                {(session?.user?.name || '我')[0]}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {session?.user?.name || '我'}（你）
              </div>
            </div>
            {/* 其他在线用户头像 */}
            {connectedUsers.map((user) => (
              <div key={user.clientId} className="relative group -ml-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white ring-2 ring-gray-800 cursor-default"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name[0]}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {user.name}
                </div>
              </div>
            ))}
            {/* 连接状态小圆点 */}
            <div className="relative group ml-1">
              {isConnected ? (
                <div className="w-2 h-2 rounded-full bg-green-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-500" />
              )}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {isConnected ? '协作已连接' : '协作未连接'}
              </div>
            </div>
          </div>

          <span className="text-sm text-gray-300 truncate max-w-md">{filePath}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRightPanel(rightPanel === 'comments' ? null : 'comments')}
            className={cn(
              'p-1.5 rounded relative',
              rightPanel === 'comments' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700'
            )}
            title="批注"
          >
            <MessageSquare className="w-4 h-4" />
            {comments.filter(c => !c.resolved).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {comments.filter(c => !c.resolved).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === 'history' ? null : 'history')}
            className={cn(
              'p-1.5 rounded',
              rightPanel === 'history' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700'
            )}
            title="历史记录"
          >
            <History className="w-4 h-4" />
          </button>

          {/* 权限管理按钮（仅管理员可见） */}
          {canManageRoles && (
            <button
              onClick={() => setRoleManagerOpen(true)}
              className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              title="权限管理"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {canEdit ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-600/20 text-amber-300 text-xs rounded-md">
              👁️ 仅阅读
            </span>
          )}
        </div>
      </div>

      {/* 主内容区 - 占满剩余高度 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧文件树 */}
        <div
          className={cn(
            'border-r border-gray-700 bg-[#252535] overflow-hidden transition-all duration-300 ease-in-out shrink-0',
            sidebarOpen ? 'w-60' : 'w-0 border-r-0'
          )}
        >
          <div className="w-60 h-full overflow-y-auto p-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-2">文件列表</h3>
            <FileTree
              projectId={projectId}
              onSelectFile={handleSelectFile}
              selectedPath={filePath}
            />
          </div>
        </div>

        {/* 编辑器 + 预览区 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 内容区域 */}
          <div className="flex flex-1 min-h-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : (
              <>
                {/* Markdown 编辑器 */}
                {(mode === 'edit' || mode === 'split') && (
                  <div
                    className={cn(
                      'flex flex-col min-h-0',
                      mode === 'split' ? 'w-1/2 border-r border-gray-700' : 'flex-1'
                    )}
                  >
                    {/* 工具栏 - 固定在编辑器顶部（仅编辑权限可见） */}
                    {canEdit ? (
                      <MarkdownToolbar
                        textareaRef={textareaRef}
                        markdown={markdown}
                        setMarkdown={setMarkdown}
                        undoStack={undoStack}
                        redoStack={redoStack}
                        pushUndo={pushUndo}
                        undo={undo}
                        redo={redo}
                      />
                    ) : (
                      <div className="h-8 bg-[#1e1e2e] border-b border-gray-700 flex items-center px-3">
                        <span className="text-xs text-amber-400/70">📖 只读模式 — 可在预览页添加批注</span>
                      </div>
                    )}
                    {/* 编辑器内容区 - 单一滚动容器 */}
                    <div
                      ref={editorScrollRef}
                      className="flex-1 min-h-0 overflow-auto"
                      onScroll={handleEditorContentScroll}
                    >
                      <div className="flex min-h-full">
                        {/* 行号列 - 高度由 lineHeights 驱动，精确对齐 */}
                        <div className="shrink-0 w-12 bg-[#1e1e2e] border-r border-gray-800 select-none pt-3 pb-3">
                          {/* 只在 lineHeights 和 lines 数量完全匹配时使用动态高度 */}
                          {lines.map((_, i) => {
                            const cursorsOnLine = remoteCursors.filter(c => c.line === i + 1);
                            return (
                              <div
                                key={i}
                                className="text-gray-600 text-xs font-mono text-right pr-2 flex items-start justify-end leading-[21px] relative"
                                style={{ height: `${(lineHeights.length === lineCount && lineHeights[i]) ? lineHeights[i] : 21}px` }}
                              >
                                {cursorsOnLine.length > 0 && (
                                  <span
                                    className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                                    style={{ backgroundColor: cursorsOnLine[0].color }}
                                    title={cursorsOnLine.map(c => c.name).join(', ')}
                                  />
                                )}
                                {i + 1}
                              </div>
                            );
                          })}
                        </div>
                        {/* 编辑区域 */}
                        <div ref={editorContentRef} className="flex-1 min-w-0 relative">
                          {/* 隐藏的镜像 div - 用于测量每行实际渲染高度 */}
                          <div
                            ref={mirrorRef}
                            aria-hidden="true"
                            className="absolute top-0 left-0 w-full font-mono text-sm leading-[21px] whitespace-pre-wrap break-words pointer-events-none pt-3 pb-3 px-3"
                            style={{ visibility: 'hidden', wordBreak: 'break-all' }}
                          >
                            {lines.map((line, idx) => (
                              <div key={`mirror-${idx}-${lineCount}`} className="leading-[21px] whitespace-pre-wrap break-words" style={{ wordBreak: 'break-all' }}>
                                {line || '\u00A0'}
                              </div>
                            ))}
                          </div>
                          {/* 语法高亮覆盖层 */}
                          <MarkdownHighlightOverlay content={markdown} />
                          {/* textarea */}
                          <textarea
                            ref={textareaRef}
                            value={markdown}
                            readOnly={!canEdit}
                            onChange={(e) => {
                              if (!canEdit) return;
                              debouncedPushUndo();
                              setMarkdown(e.target.value);
                            }}
                            onKeyUp={updateCursorPosition}
                            onMouseUp={updateCursorPosition}
                            className={cn(
                              "relative z-10 w-full bg-transparent font-mono text-sm leading-[21px] p-3 resize-none outline-none whitespace-pre-wrap break-words text-transparent selection:bg-blue-500/30",
                              canEdit ? "caret-white" : "caret-transparent cursor-default"
                            )}
                            style={{
                              minHeight: `${(lineHeights.length === lineCount ? lineHeights.reduce((a, b) => a + b, 0) : lineCount * 21) + 24}px`,
                              wordBreak: 'break-all',
                            }}
                            spellCheck={false}
                            placeholder={canEdit ? "在此输入 Markdown..." : "只读模式"}
                          />
                        </div>
                      </div>
                    </div>
                    {/* 底部状态栏 - 仅在编辑器侧显示 */}
                    <div className="h-6 bg-[#252535] border-t border-gray-700 px-3 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
                      <div className="flex items-center gap-3">
                        <span>行 {cursorLine}, 列 {cursorCol}</span>
                        <span>{lineCount} 行</span>
                        <span>{charCount} 字符</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>Markdown</span>
                        <span>UTF-8</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview 区 */}
                {(mode === 'split' || mode === 'preview') && (
                  <div
                    className={cn(
                      'flex min-h-0',
                      mode === 'split' ? 'w-1/2' : 'flex-1'
                    )}
                  >
                    {/* Preview 主内容 - 可滚动 */}
                    <div
                      ref={previewRef}
                      className={cn(
                        'flex-1 overflow-y-auto bg-white',
                        tocPinned && 'mr-0' // TOC 固定时不需要额外 margin
                      )}
                      onScroll={handlePreviewScroll}
                    >
                      <div className="p-6 max-w-4xl mx-auto">
                        <MarkdownViewer
                          content={markdown}
                          comments={comments}
                          activeCommentId={activeCommentId}
                          onTextSelect={handleTextSelect}
                          onClickComment={(commentId) => {
                            setActiveCommentId(commentId);
                            setRightPanel('comments');
                            // 滚动评论面板到对应评论
                            setTimeout(() => {
                              const commentEl = document.querySelector(`[data-panel-comment-id="${commentId}"]`);
                              if (commentEl) {
                                commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }, 100);
                          }}
                        />
                      </div>
                    </div>
                    {/* 目录 - 固定在右侧，不随内容滚动 */}
                    <TocSlider
                      content={markdown}
                      previewRef={previewRef}
                      pinned={tocPinned}
                      onPinChange={setTocPinned}
                    />
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* 右侧面板 */}
        {rightPanel && (
          <div className="w-72 border-l border-gray-200 bg-white shrink-0 overflow-y-auto">
            {rightPanel === 'comments' ? (
              <CommentPanel
                comments={comments}
                currentUserId={currentUserId}
                activeCommentId={activeCommentId}
                pendingSelection={pendingSelection}
                onSubmitComment={handleSubmitComment}
                onCancelSelection={handleCancelSelection}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={handleReply}
                onClickComment={(commentId) => {
                  setActiveCommentId(commentId);
                  // 滚动预览区域到对应批注高亮位置
                  setTimeout(() => {
                    const highlight = previewRef.current?.querySelector(`[data-comment-id="${commentId}"]`);
                    if (highlight && previewRef.current) {
                      const containerRect = previewRef.current.getBoundingClientRect();
                      const highlightRect = highlight.getBoundingClientRect();
                      const scrollOffset = highlightRect.top - containerRect.top + previewRef.current.scrollTop - containerRect.height / 3;
                      previewRef.current.scrollTo({ top: Math.max(0, scrollOffset), behavior: 'smooth' });
                    }
                  }, 50);
                }}
              />
            ) : (
              <HistoryPanel projectId={projectId} filePath={filePath} />
            )}
          </div>
        )}
      </div>

      {/* 权限管理弹窗 */}
      <RoleManager
        projectId={projectId}
        isOpen={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
      />
    </div>
  );
}
