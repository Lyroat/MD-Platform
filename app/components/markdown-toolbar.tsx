'use client';

import { RefObject, useCallback } from 'react';
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  Code, Quote, List, ListOrdered, ListChecks, Link, Image, Table,
  Minus, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  markdown: string;
  setMarkdown: (value: string) => void;
  undoStack: string[];
  redoStack: string[];
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

type ToolAction = {
  icon: React.ReactNode;
  title: string;
  action: () => void;
};

export default function MarkdownToolbar({
  textareaRef,
  markdown,
  setMarkdown,
  undoStack,
  redoStack,
  pushUndo,
  undo,
  redo,
}: MarkdownToolbarProps) {
  // 获取 textarea 选区信息
  const getSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: 0, end: 0, text: '' };
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: markdown.slice(textarea.selectionStart, textarea.selectionEnd),
    };
  }, [textareaRef, markdown]);

  // 通用：包裹选中文字（保持滚动位置不变）
  const wrapSelection = useCallback((prefix: string, suffix: string, placeholder?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();

    const { start, end, text } = getSelection();
    const scrollTop = textarea.parentElement?.parentElement?.scrollTop ?? 0;
    const content = text || placeholder || '';
    const newText = markdown.slice(0, start) + prefix + content + suffix + markdown.slice(end);
    setMarkdown(newText);

    // 延迟设置光标位置，并恢复滚动位置
    setTimeout(() => {
      textarea.focus();
      if (text) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + content.length;
      } else {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + (placeholder?.length || 0);
      }
      // 恢复滚动位置
      const scrollContainer = textarea.parentElement?.parentElement;
      if (scrollContainer) scrollContainer.scrollTop = scrollTop;
    }, 0);
  }, [textareaRef, markdown, setMarkdown, getSelection, pushUndo]);

  // 通用：行首插入前缀（保持滚动位置不变）
  const insertLinePrefix = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();

    const { start, end } = getSelection();
    const scrollTop = textarea.parentElement?.parentElement?.scrollTop ?? 0;
    // 找到当前行的开头
    const lineStart = markdown.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = markdown.indexOf('\n', end);
    const actualLineEnd = lineEnd === -1 ? markdown.length : lineEnd;

    // 选中的行范围
    const selectedLines = markdown.slice(lineStart, actualLineEnd);
    const newLines = selectedLines.split('\n').map(line => prefix + line).join('\n');

    const newText = markdown.slice(0, lineStart) + newLines + markdown.slice(actualLineEnd);
    setMarkdown(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = end + prefix.length * selectedLines.split('\n').length;
      // 恢复滚动位置
      const scrollContainer = textarea.parentElement?.parentElement;
      if (scrollContainer) scrollContainer.scrollTop = scrollTop;
    }, 0);
  }, [textareaRef, markdown, setMarkdown, getSelection, pushUndo]);

  // 插入新行内容（保持滚动位置不变）
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();

    const { start, end } = getSelection();
    const scrollTop = textarea.parentElement?.parentElement?.scrollTop ?? 0;
    // 检查是否需要在前面加换行
    const before = markdown.slice(0, start);
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n') && !before.endsWith('\n\n');
    const insertText = (needNewlineBefore ? '\n' : '') + text;

    const newText = before + insertText + markdown.slice(end);
    setMarkdown(newText);

    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + insertText.length;
      textarea.selectionStart = cursorPos;
      textarea.selectionEnd = cursorPos;
      // 恢复滚动位置
      const scrollContainer = textarea.parentElement?.parentElement;
      if (scrollContainer) scrollContainer.scrollTop = scrollTop;
    }, 0);
  }, [textareaRef, markdown, setMarkdown, getSelection, pushUndo]);

  // 工具按钮定义
  const toolGroups: (ToolAction | 'divider')[][] = [
    // 第一组：撤回/重做
    [
      { icon: <Undo2 className="w-4 h-4" />, title: '撤回 (Ctrl+Z)', action: undo },
      { icon: <Redo2 className="w-4 h-4" />, title: '重做 (Ctrl+Y)', action: redo },
    ],
    // 第二组：文本格式
    [
      { icon: <Bold className="w-4 h-4" />, title: '加粗 (Ctrl+B)', action: () => wrapSelection('**', '**', '粗体文字') },
      { icon: <Italic className="w-4 h-4" />, title: '斜体 (Ctrl+I)', action: () => wrapSelection('*', '*', '斜体文字') },
      { icon: <Strikethrough className="w-4 h-4" />, title: '删除线', action: () => wrapSelection('~~', '~~', '删除线文字') },
    ],
    // 第三组：标题
    [
      { icon: <Heading1 className="w-4 h-4" />, title: '标题 1', action: () => insertLinePrefix('# ') },
      { icon: <Heading2 className="w-4 h-4" />, title: '标题 2', action: () => insertLinePrefix('## ') },
      { icon: <Heading3 className="w-4 h-4" />, title: '标题 3', action: () => insertLinePrefix('### ') },
    ],
    // 第四组：代码/引用
    [
      { icon: <Code className="w-4 h-4" />, title: '代码', action: () => {
        const { text } = getSelection();
        if (text.includes('\n')) {
          wrapSelection('```\n', '\n```', '代码块');
        } else {
          wrapSelection('`', '`', 'code');
        }
      }},
      { icon: <Quote className="w-4 h-4" />, title: '引用', action: () => insertLinePrefix('> ') },
    ],
    // 第五组：列表
    [
      { icon: <List className="w-4 h-4" />, title: '无序列表', action: () => insertLinePrefix('- ') },
      { icon: <ListOrdered className="w-4 h-4" />, title: '有序列表', action: () => insertLinePrefix('1. ') },
      { icon: <ListChecks className="w-4 h-4" />, title: '任务列表', action: () => insertLinePrefix('- [ ] ') },
    ],
    // 第六组：插入
    [
      { icon: <Link className="w-4 h-4" />, title: '超链接', action: () => {
        const { text } = getSelection();
        if (text) {
          wrapSelection('[', '](url)', '');
        } else {
          insertAtCursor('[链接文字](url)');
        }
      }},
      { icon: <Image className="w-4 h-4" />, title: '插入图片', action: () => insertAtCursor('![图片描述](图片URL)') },
      { icon: <Table className="w-4 h-4" />, title: '插入表格', action: () => insertAtCursor('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n') },
      { icon: <Minus className="w-4 h-4" />, title: '水平线', action: () => insertAtCursor('\n---\n') },
      { icon: <MessageCircle className="w-4 h-4" />, title: '插入留言', action: () => insertAtCursor('\n> [!NOTE]\n> 在此留言\n') },
    ],
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-[#2a2a3a] border-b border-gray-700 overflow-x-auto flex-nowrap">
      {toolGroups.map((group, gi) => (
        <div key={gi} className="flex items-center">
          {gi > 0 && <div className="w-px h-5 bg-gray-600 mx-1.5" />}
          {group.map((tool, ti) => {
            if (tool === 'divider') {
              return <div key={ti} className="w-px h-5 bg-gray-600 mx-1" />;
            }
            const t = tool as ToolAction;
            const isDisabled = (t.title.includes('撤回') && undoStack.length === 0) ||
                              (t.title.includes('重做') && redoStack.length === 0);
            return (
              <button
                key={ti}
                onClick={t.action}
                disabled={isDisabled}
                className={cn(
                  'p-1.5 rounded hover:bg-gray-600/50 transition-colors text-gray-300 hover:text-white',
                  isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-300'
                )}
                title={t.title}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
