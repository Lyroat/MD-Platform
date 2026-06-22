'use client';

import { useState } from 'react';
import { MessageSquare, Check, Trash2, Reply, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

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
      className={cn(
        'border rounded-lg p-3 transition-colors cursor-pointer',
        isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      )}
      onClick={onClick}
    >
      {/* 锚点文本 */}
      {comment.anchor_text && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2 italic text-gray-600 line-clamp-2">
          &ldquo;{comment.anchor_text}&rdquo;
        </div>
      )}

      {/* 评论内容 */}
      <div className="flex items-start gap-2">
        <Avatar name={comment.author.name} url={comment.author.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{comment.author.name}</span>
            <span className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
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
                <p className="text-xs text-gray-600 mt-0.5">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mt-2 ml-9">
        <button
          onClick={(e) => { e.stopPropagation(); setShowReplyInput(!showReplyInput); }}
          className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
        >
          <Reply className="w-3 h-3" /> 回复
        </button>
        {!comment.resolved && (
          <button
            onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}
            className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> 解决
          </button>
        )}
        {currentUserId === comment.author_id && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
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
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-300"
            rows={2}
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={() => setShowReplyInput(false)}
              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
            <button
              onClick={handleSubmitReply}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
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
  onResolve,
  onDelete,
  onReply,
  onClickComment,
}: CommentPanelProps) {
  const [showResolved, setShowResolved] = useState(false);

  const topLevelComments = comments.filter((c) => !c.parent_id);
  const unresolved = topLevelComments.filter((c) => !c.resolved);
  const resolved = topLevelComments.filter((c) => c.resolved);

  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          批注 ({unresolved.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {unresolved.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无批注<br />
            选中文字后点击"批注"按钮添加
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
          <div className="mt-4">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
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
