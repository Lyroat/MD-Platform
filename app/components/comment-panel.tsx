'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Check, Trash2, Reply, ChevronDown, ChevronRight, X, Send } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { TextSelection } from './markdown-viewer';

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

interface CommentPanelProps {
  comments: Comment[];
  currentUserId?: string;
  activeCommentId?: string;
  pendingSelection?: TextSelection | null;
  onSubmitComment?: (content: string) => void;
  onCancelSelection?: () => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => void;
  onClickComment: (id: string) => void;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="w-7 h-7 rounded-full" />;
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
      {initial}
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  currentUserId,
  isActive,
  onResolve,
  onDelete,
  onReply,
  onClick,
}: {
  comment: Comment;
  replies: Comment[];
  currentUserId?: string;
  isActive: boolean;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => void;
  onClick: () => void;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  return (
    <div
      data-panel-comment-id={comment.id}
      className={cn(
        'border rounded-lg p-3 transition-all cursor-pointer',
        isActive
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      )}
      onClick={onClick}
    >
      {/* 锚点文本 - 引用样式 */}
      {comment.anchor_text && (
        <div className="text-xs bg-yellow-50 border-l-3 border-yellow-400 rounded-r px-2 py-1.5 mb-2 text-gray-600 line-clamp-2 break-words overflow-hidden">
          <span className="italic">&ldquo;{comment.anchor_text}&rdquo;</span>
        </div>
      )}

      {/* 评论作者和内容 */}
      <div className="flex items-start gap-2">
        <Avatar name={comment.author.name} url={comment.author.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{comment.author.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words overflow-hidden">{comment.content}</p>
        </div>
      </div>

      {/* 回复列表 */}
      {replies.length > 0 && (
        <div className="ml-9 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <Avatar name={reply.author.name} url={reply.author.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">{reply.author.name}</span>
                  <span className="text-xs text-gray-400">{formatRelativeTime(reply.created_at)}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap break-words overflow-hidden">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 mt-2 ml-9">
        <button
          onClick={(e) => { e.stopPropagation(); setShowReplyInput(!showReplyInput); }}
          className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
        >
          <Reply className="w-3 h-3" /> 回复
        </button>
        {!comment.resolved && (
          <button
            onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}
            className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1 transition-colors"
          >
            <Check className="w-3 h-3" /> 解决
          </button>
        )}
        {currentUserId === comment.author_id && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> 删除
          </button>
        )}
      </div>

      {/* 回复输入框 */}
      {showReplyInput && (
        <div className="ml-9 mt-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitReply(); } }}
            placeholder="输入回复..."
            className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-2 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              onClick={() => { setShowReplyInput(false); setReplyText(''); }}
              className="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
              className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommentPanel({
  comments,
  currentUserId,
  activeCommentId,
  pendingSelection,
  onSubmitComment,
  onCancelSelection,
  onResolve,
  onDelete,
  onReply,
  onClickComment,
}: CommentPanelProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 当有待提交的选区时，自动聚焦输入框
  useEffect(() => {
    if (pendingSelection && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pendingSelection]);

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const unresolved = topLevelComments.filter((c) => !c.resolved);
  const resolved = topLevelComments.filter((c) => c.resolved);

  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const handleSubmitNewComment = () => {
    if (newCommentText.trim() && onSubmitComment) {
      onSubmitComment(newCommentText.trim());
      setNewCommentText('');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 shrink-0">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          批注 ({unresolved.length})
        </span>
      </div>

      {/* 新建批注输入区 - 当有 pendingSelection 时显示 */}
      {pendingSelection && (
        <div className="border-b border-blue-200 bg-blue-50 p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700">新建批注</span>
            <button
              onClick={onCancelSelection}
              className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* 引用选中的文本 */}
          <div className="mb-2 rounded bg-white border border-blue-100 px-2.5 py-1.5 text-xs text-gray-600 italic line-clamp-3 break-words overflow-hidden">
            &ldquo;{pendingSelection.text}&rdquo;
          </div>
          {/* 输入框和发送按钮 */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitNewComment(); } }}
              placeholder="输入批注内容..."
              className="flex-1 text-sm border border-blue-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
            />
            <button
              onClick={handleSubmitNewComment}
              disabled={!newCommentText.trim()}
              className="px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 评论列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {unresolved.length === 0 && !pendingSelection && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            暂无批注<br />
            <span className="text-xs text-gray-300 mt-1 block">
              在预览模式下选中文字后点击"批注"按钮添加
            </span>
          </div>
        )}

        {unresolved.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            currentUserId={currentUserId}
            isActive={activeCommentId === comment.id}
            onResolve={onResolve}
            onDelete={onDelete}
            onReply={onReply}
            onClick={() => onClickComment(comment.id)}
          />
        ))}

        {/* 已解决的评论 */}
        {resolved.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showResolved ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              已解决 ({resolved.length})
            </button>
            {showResolved && (
              <div className="mt-2 space-y-2 opacity-60">
                {resolved.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    replies={getReplies(comment.id)}
                    currentUserId={currentUserId}
                    isActive={activeCommentId === comment.id}
                    onResolve={onResolve}
                    onDelete={onDelete}
                    onReply={onReply}
                    onClick={() => onClickComment(comment.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
