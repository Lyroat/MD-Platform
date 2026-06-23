'use client';

import { useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

export default function MarkdownViewer({
  content,
  comments = [],
  activeCommentId,
  onTextSelect,
  onClickComment,
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLDivElement>(null);

  // 处理文本选择 - 和原项目一样，使用 Range 计算精确字符偏移
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

  // 高亮批注文本 - 使用 DOM TreeWalker + Range.surroundContents（和原项目一致）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const unresolvedComments = comments.filter((c) => !c.resolved);

    // 1. 清除现有高亮
    const existingHighlights = container.querySelectorAll('[data-comment-id]');
    existingHighlights.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });

    if (unresolvedComments.length === 0) return;

    // 2. 构建文本节点映射（每个文本节点的字符偏移范围）
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: { node: Text; start: number; end: number }[] = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.textContent?.length || 0;
      textNodes.push({ node, start: offset, end: offset + len });
      offset += len;
    }

    // 3. 对每个评论，找到对应的文本节点范围并用 span 包裹
    for (const comment of unresolvedComments) {
      const nodes = [...textNodes]; // 复制，因为 DOM 操作会改变原数组
      for (const { node, start, end } of nodes) {
        const overlapStart = Math.max(comment.start_offset, start);
        const overlapEnd = Math.min(comment.end_offset, end);
        if (overlapStart >= overlapEnd) continue;

        const relStart = overlapStart - start;
        const relEnd = overlapEnd - start;

        try {
          const range = document.createRange();
          range.setStart(node, relStart);
          range.setEnd(node, relEnd);

          const span = document.createElement('span');
          span.dataset.commentId = comment.id;
          span.className =
            comment.id === activeCommentId
              ? 'bg-yellow-200 border-b-2 border-yellow-400 cursor-pointer transition-colors'
              : 'bg-yellow-100 border-b border-yellow-300 cursor-pointer hover:bg-yellow-200 transition-colors';
          span.onclick = (e) => {
            e.stopPropagation();
            onClickComment?.(comment.id);
          };
          range.surroundContents(span);
        } catch {
          // Range 可能因 DOM 变更而无效，忽略
        }
        break; // 只处理第一个匹配的文本节点段
      }
    }
  }, [content, comments, activeCommentId, onClickComment]);

  // 给 heading 添加 data-heading-index，供 TOC 定位
  // 在渲染后通过 useEffect 给 heading 元素添加 data 属性
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, idx) => {
      heading.setAttribute('data-heading-index', String(idx));
      heading.id = `toc-heading-${idx}`;
    });
  }, [content]);

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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
