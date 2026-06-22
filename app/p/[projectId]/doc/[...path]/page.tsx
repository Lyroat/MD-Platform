'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Eye, Edit3, Loader2, ArrowLeft, MessageSquare, History } from 'lucide-react';
import Navbar from '@/app/components/navbar';
import FileTree from '@/app/components/file-tree';
import MarkdownViewer from '@/app/components/markdown-viewer';
import CommentPanel from '@/app/components/comment-panel';
import HistoryPanel from '@/app/components/history-panel';
import TiptapCollabEditor from '@/app/components/tiptap-collab-editor';
import { markdownToHtml, htmlToMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

type ViewMode = 'view' | 'edit';
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
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ViewMode>('view');
  const [rightPanel, setRightPanel] = useState<RightPanel>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | undefined>();
  const [editorHtml, setEditorHtml] = useState('');

  // 获取当前用户的数据库 ID
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
          setHtmlContent(markdownToHtml(data.content));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, filePath]);

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

    const newMarkdown = mode === 'edit' ? htmlToMarkdown(editorHtml) : markdown;

    try {
      await fetch('/api/gitlab/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          content: newMarkdown,
          commitMessage: `Update ${filePath} via MD-Platform`,
          branch: 'main',
        }),
      });
      setMarkdown(newMarkdown);
      setHtmlContent(markdownToHtml(newMarkdown));
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

  // 文件选择处理
  const handleSelectFile = (path: string) => {
    router.push(`/p/${projectId}/doc/${path}`);
  };

  if (!filePath) {
    // 没有选择文件时显示文件树
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
              <Edit3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>请从左侧选择一个 Markdown 文件</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* 工具栏 */}
      <div className="h-12 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/p/${projectId}/doc`)}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 truncate max-w-md">{filePath}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setMode('view')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                mode === 'view' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Eye className="w-3.5 h-3.5" /> 查看
            </button>
            <button
              onClick={() => setMode('edit')}
              className={cn(
                'px-3 py-1.5 text-xs flex items-center gap-1',
                mode === 'edit' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" /> 编辑
            </button>
          </div>

          {/* 右侧面板切换 */}
          <button
            onClick={() => setRightPanel(rightPanel === 'comments' ? null : 'comments')}
            className={cn(
              'p-1.5 rounded',
              rightPanel === 'comments' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === 'history' ? null : 'history')}
            className={cn(
              'p-1.5 rounded',
              rightPanel === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            <History className="w-4 h-4" />
          </button>

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex h-[calc(100vh-56px-48px)]">
        {/* 左侧文件树 */}
        <div className="w-60 border-r border-gray-200 bg-white overflow-y-auto p-2">
          <FileTree
            projectId={projectId}
            onSelectFile={handleSelectFile}
            selectedPath={filePath}
          />
        </div>

        {/* 中间内容区 */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : mode === 'view' ? (
            <div className="p-6 max-w-4xl mx-auto">
              <MarkdownViewer
                content={markdown}
                comments={comments}
                activeCommentId={activeCommentId}
                onAddComment={handleAddComment}
                onClickComment={setActiveCommentId}
              />
            </div>
          ) : (
            <TiptapCollabEditor
              documentId={`${projectId}/${filePath}`}
              initialContent={htmlContent}
              editable={true}
              onChange={setEditorHtml}
            />
          )}
        </div>

        {/* 右侧面板 */}
        {rightPanel && (
          <div className="w-72 border-l border-gray-200 bg-white">
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
