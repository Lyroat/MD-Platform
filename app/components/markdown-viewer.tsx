'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  anchor_text: string;
  start_offset: number;
  end_offset: number;
  content: string;
  resolved: boolean;
}

interface MarkdownViewerProps {
  content: string;
  comments?: Comment[];
  activeCommentId?: string;
  onAddComment?: (anchorText: string, startOffset: number, endOffset: number) => void;
  onClickComment?: (commentId: string) => void;
}

export default function MarkdownViewer({
  content,
  comments = [],
  activeCommentId,
  onAddComment,
  onClickComment,
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
    x: number;
    y: number;
  } | null>(null);

  // 处理文本选择
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      setSelectionInfo(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();

    if (!text || !containerRef.current.contains(range.commonAncestorContainer)) {
      setSelectionInfo(null);
      return;
    }

    // 计算选区在容器内的文本偏移
    const preRange = document.createRange();
    preRange.setStart(containerRef.current, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + text.length;

    // 获取选区位置用于显示按钮
    const rect = range.getBoundingClientRect();
    setSelectionInfo({
      text,
      startOffset,
      endOffset,
      x: rect.left + rect.width / 2,
      y: rect.top - 40,
    });
  }, []);

  // 点击其他地方取消选择
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.annotation-button')) {
        // 延迟清除，让按钮点击事件有时间触发
        setTimeout(() => setSelectionInfo(null), 200);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAnnotate = () => {
    if (selectionInfo && onAddComment) {
      onAddComment(selectionInfo.text, selectionInfo.startOffset, selectionInfo.endOffset);
      setSelectionInfo(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  // 高亮评论锚点文本的函数
  const highlightText = (text: string): React.ReactNode => {
    if (!comments || comments.length === 0) return text;

    const unresolvedComments = comments.filter((c) => !c.resolved && c.anchor_text);
    if (unresolvedComments.length === 0) return text;

    // 简单的字符串匹配高亮
    let result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    for (const comment of unresolvedComments) {
      const idx = remaining.indexOf(comment.anchor_text);
      if (idx !== -1) {
        if (idx > 0) {
          result.push(remaining.slice(0, idx));
        }
        result.push(
          <span
            key={key++}
            className={cn(
              'cursor-pointer rounded px-0.5',
              activeCommentId === comment.id
                ? 'bg-yellow-300'
                : 'bg-yellow-100 hover:bg-yellow-200'
            )}
            onClick={() => onClickComment?.(comment.id)}
          >
            {comment.anchor_text}
          </span>
        );
        remaining = remaining.slice(idx + comment.anchor_text.length);
      }
    }
    if (remaining) result.push(remaining);

    return result.length > 0 ? result : text;
  };

  return (
    <div className="relative">
      {/* 批注浮动按钮 */}
      {selectionInfo && onAddComment && (
        <button
          className="annotation-button fixed z-50 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md shadow-lg hover:bg-blue-700 transition-colors"
          style={{ left: selectionInfo.x, top: selectionInfo.y, transform: 'translateX(-50%)' }}
          onClick={handleAnnotate}
        >
          批注
        </button>
      )}

      <div
        ref={containerRef}
        className="prose prose-sm max-w-none"
        onMouseUp={handleMouseUp}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p>{typeof children === 'string' ? highlightText(children) : children}</p>,
            li: ({ children }) => <li>{typeof children === 'string' ? highlightText(children) : children}</li>,
            td: ({ children }) => <td>{typeof children === 'string' ? highlightText(children) : children}</td>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
