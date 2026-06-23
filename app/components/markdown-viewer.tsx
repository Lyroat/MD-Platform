'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import React from 'react';

interface Comment {
  id: string;
  anchor_text: string;
  start_offset: number;
  end_offset: number;
  content: string;
  resolved: boolean;
}

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
}

interface MarkdownViewerProps {
  content: string;
  comments?: Comment[];
  activeCommentId?: string;
  onTextSelect?: (selection: TextSelection) => void;
  onClickComment?: (commentId: string) => void;
}

/**
 * 将纯文本中的批注区域高亮渲染为 React 元素
 * 不再使用 DOM 操作，而是通过 React 渲染管道实现
 */
function highlightTextWithComments(
  text: string,
  comments: Comment[],
  activeCommentId: string | undefined,
  onClickComment: ((commentId: string) => void) | undefined
): React.ReactNode {
  if (!text || comments.length === 0) return text;

  // 找到所有需要高亮的区间
  const highlights: { start: number; end: number; commentId: string }[] = [];

  for (const comment of comments) {
    if (!comment.anchor_text || comment.resolved) continue;
    const idx = text.indexOf(comment.anchor_text);
    if (idx === -1) continue;
    highlights.push({
      start: idx,
      end: idx + comment.anchor_text.length,
      commentId: comment.id,
    });
  }

  if (highlights.length === 0) return text;

  // 按 start 排序
  highlights.sort((a, b) => a.start - b.start);

  // 构建分段的 React 元素
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    // 跳过重叠的
    if (h.start < lastEnd) continue;

    // 添加高亮前的普通文本
    if (h.start > lastEnd) {
      parts.push(text.slice(lastEnd, h.start));
    }

    // 添加高亮部分
    const isActive = h.commentId === activeCommentId;
    parts.push(
      <span
        key={`hl-${h.commentId}-${i}`}
        data-comment-id={h.commentId}
        className={
          isActive
            ? 'bg-yellow-200 border-b-2 border-yellow-400 cursor-pointer transition-colors'
            : 'bg-yellow-100 border-b border-yellow-300 cursor-pointer hover:bg-yellow-200 transition-colors'
        }
        onClick={(e) => {
          e.stopPropagation();
          onClickComment?.(h.commentId);
        }}
      >
        {text.slice(h.start, h.end)}
      </span>
    );

    lastEnd = h.end;
  }

  // 添加最后的普通文本
  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }

  return parts.length > 0 ? parts : text;
}

export default function MarkdownViewer({
  content,
  comments = [],
  activeCommentId,
  onTextSelect,
  onClickComment,
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLDivElement>(null);

  // 处理文本选择 - 计算精确字符偏移
  const handleMouseUp = useCallback(() => {
    if (!onTextSelect) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      if (addButtonRef.current) addButtonRef.current.style.display = 'none';
      return;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) return;

    // 计算精确字符偏移（从容器起始到选区开始）
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + text.length;

    // 定位浮动按钮到选区上方（容器相对定位）
    if (addButtonRef.current) {
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      addButtonRef.current.style.display = 'flex';
      addButtonRef.current.style.top = `${rect.top - containerRect.top - 36}px`;
      addButtonRef.current.style.left = `${rect.left - containerRect.left + rect.width / 2 - 16}px`;
      addButtonRef.current.onclick = () => {
        onTextSelect({ text, startOffset, endOffset });
        addButtonRef.current!.style.display = 'none';
        selection.removeAllRanges();
      };
    }
  }, [onTextSelect]);

  // 给 heading 添加 data-heading-index，供 TOC 定位
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, idx) => {
      heading.setAttribute('data-heading-index', String(idx));
      heading.id = `toc-heading-${idx}`;
    });
  }, [content]);

  // 将渲染后的纯文本提取出来用于高亮匹配
  // 使用 useMemo 缓存未解决的评论列表
  const unresolvedComments = useMemo(
    () => comments.filter((c) => !c.resolved && c.anchor_text),
    [comments]
  );

  // 创建自定义 ReactMarkdown components，在渲染时内联高亮批注
  // 这样完全避免了 useEffect DOM 操作
  const markdownComponents = useMemo(() => {
    if (unresolvedComments.length === 0) return undefined;

    // 递归处理 children，将文本节点中的批注内容高亮
    const processChildren = (children: React.ReactNode): React.ReactNode => {
      return React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return highlightTextWithComments(child, unresolvedComments, activeCommentId, onClickComment);
        }
        if (React.isValidElement(child)) {
          const props = child.props as Record<string, unknown>;
          if (props.children) {
            return React.cloneElement(child, {
              ...props,
              children: processChildren(props.children as React.ReactNode),
            } as Record<string, unknown>);
          }
        }
        return child;
      });
    };

    // 为常见的文本容器元素创建包装组件
    const createWrapper = (Tag: string) => {
      const Wrapper = ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown }) => {
        const { node: _node, ...restProps } = props as Record<string, unknown>;
        const processed = processChildren(children);
        return React.createElement(Tag, restProps, processed);
      };
      Wrapper.displayName = `Wrapper_${Tag}`;
      return Wrapper;
    };

    return {
      p: createWrapper('p'),
      li: createWrapper('li'),
      td: createWrapper('td'),
      th: createWrapper('th'),
      strong: createWrapper('strong'),
      em: createWrapper('em'),
      del: createWrapper('del'),
      blockquote: createWrapper('blockquote'),
      h1: createWrapper('h1'),
      h2: createWrapper('h2'),
      h3: createWrapper('h3'),
      h4: createWrapper('h4'),
      h5: createWrapper('h5'),
      h6: createWrapper('h6'),
    };
  }, [unresolvedComments, activeCommentId, onClickComment]);

  return (
    <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* 浮动"添加批注"按钮 - 容器相对定位 */}
      <div
        ref={addButtonRef}
        className="absolute z-50 hidden items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md shadow-lg cursor-pointer hover:bg-blue-700 transition-colors select-none"
        style={{ pointerEvents: 'auto' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        批注
      </div>

      {/* Markdown 渲染内容 - 优化排版 */}
      <div className="prose prose-base max-w-none
        prose-headings:text-gray-900 prose-headings:font-bold prose-headings:leading-tight prose-headings:mt-8 prose-headings:mb-4
        prose-h1:text-3xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mt-0
        prose-h2:text-2xl prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-2
        prose-h3:text-xl
        prose-h4:text-lg
        prose-p:text-gray-700 prose-p:leading-7 prose-p:my-4
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-gray-900
        prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:shadow-sm
        prose-blockquote:border-l-4 prose-blockquote:border-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-md prose-blockquote:not-italic prose-blockquote:text-gray-700
        prose-li:my-1 prose-li:leading-7
        prose-ul:my-4 prose-ol:my-4
        prose-table:border-collapse prose-th:bg-gray-50 prose-th:border prose-th:border-gray-200 prose-th:px-4 prose-th:py-2 prose-td:border prose-td:border-gray-200 prose-td:px-4 prose-td:py-2
        prose-hr:my-8 prose-hr:border-gray-200
        prose-img:rounded-lg prose-img:shadow-md
      ">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
