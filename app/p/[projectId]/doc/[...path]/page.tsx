'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Loader2, ArrowLeft, MessageSquare, History, PanelLeftOpen, PanelLeftClose, Pencil, Columns2, Eye } from 'lucide-react';
import Navbar from '@/app/components/navbar';
import FileTree from '@/app/components/file-tree';
import MarkdownViewer from '@/app/components/markdown-viewer';
import CommentPanel from '@/app/components/comment-panel';
import HistoryPanel from '@/app/components/history-panel';
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
  const filePath = pathSegments ? pathSegments.join('/') : '';

  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ViewMode>('split');
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 编辑器相关
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const currentUserId = (session?.user as Record<string, unknown>)?.gitlabId
    ? String((session?.user as Record<string, unknown>).gitlabId)
    : undefined;

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

  // 更新行数
  useEffect(() => {
    const lines = markdown.split('\n').length;
    setLineCount(lines);
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

  // 添加评论
  const handleAddComment = async (anchorText: string, startOffset: number, endOffset: number) => {
    const content = prompt('请输入批注内容:');
    if (!content || !currentUserId) return;

    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          branch: 'main',
          anchorText,
          startOffset,
          endOffset,
          content,
          authorId: currentUserId,
        }),
      });
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

  // 同步滚动（分屏模式）
  const handleEditorScroll = useCallback(() => {
    if (mode !== 'split' || !editorWrapperRef.current || !previewRef.current) return;
    const editor = editorWrapperRef.current;
    const preview = previewRef.current;
    const scrollRatio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
  }, [mode]);

  // 文件选择
  const handleSelectFile = (path: string) => {
    router.push(`/p/${projectId}/doc/${path}`);
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
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

  return (
    <div className="min-h-screen bg-[#1e1e2e] flex flex-col">
      {/* 顶部工具栏 - 深色主题 */}
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

          {/* 三模式切换按钮 - HackMD 风格 */}
          <div className="flex items-center bg-gray-700/50 rounded-md p-0.5">
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
            <button
              onClick={() => setMode('split')}
              className={cn(
                'p-1.5 rounded transition-colors',
                mode === 'split' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
              )}
              title="分屏模式"
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

          <span className="text-sm text-gray-300 truncate max-w-md">{filePath}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 右侧面板切换 */}
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

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧文件树 - 可折叠 */}
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
        <div className="flex-1 flex min-w-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <>
              {/* Markdown 编辑器 - 显示在 edit 和 split 模式 */}
              {(mode === 'edit' || mode === 'split') && (
                <div
                  ref={editorWrapperRef}
                  className={cn(
                    'flex overflow-y-auto bg-[#1e1e2e]',
                    mode === 'split' ? 'w-1/2 border-r border-gray-700' : 'flex-1'
                  )}
                  onScroll={handleEditorScroll}
                >
                  {/* 行号 */}
                  <div className="shrink-0 w-12 bg-[#1e1e2e] border-r border-gray-800 text-right py-3 select-none">
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div key={i} className="text-gray-600 text-xs leading-6 pr-2 font-mono">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* 文本编辑区 */}
                  <textarea
                    ref={textareaRef}
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    className="flex-1 bg-transparent text-gray-200 font-mono text-sm leading-6 p-3 resize-none outline-none min-h-full"
                    spellCheck={false}
                    placeholder="在此输入 Markdown..."
                  />
                </div>
              )}

              {/* Preview 区 - 显示在 split 和 preview 模式 */}
              {(mode === 'split' || mode === 'preview') && (
                <div
                  ref={previewRef}
                  className={cn(
                    'overflow-y-auto bg-white',
                    mode === 'split' ? 'w-1/2' : 'flex-1'
                  )}
                >
                  <div className="p-6 max-w-4xl mx-auto">
                    <MarkdownViewer
                      content={markdown}
                      comments={comments}
                      activeCommentId={activeCommentId}
                      onAddComment={mode === 'preview' ? handleAddComment : undefined}
                      onClickComment={setActiveCommentId}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧面板 */}
        {rightPanel && (
          <div className="w-72 border-l border-gray-200 bg-white shrink-0">
            {rightPanel === 'comments' ? (
              <CommentPanel
                comments={comments}
                currentUserId={currentUserId}
                activeCommentId={activeCommentId}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={handleReply}
                onClickComment={setActiveCommentId}
              />
            ) : (
              <HistoryPanel projectId={projectId} filePath={filePath} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
