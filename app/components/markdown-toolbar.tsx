'use client';

import { RefObject, useCallback, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 图片上传处理
  const handleImageUpload = useCallback(async (file: File) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const scrollTop = textarea.parentElement?.parentElement?.scrollTop ?? 0;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '上传失败');
      }

      const { url, fileName } = await response.json();

      // 上传成功后插入图片链接
      const { start, end } = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      pushUndo();
      const before = markdown.slice(0, start);
      const needNewline = before.length > 0 && !before.endsWith('\n');
      const imageText = `![${fileName}](${url})`;
      const insertText = (needNewline ? '\n' : '') + imageText;
      const newText = before + insertText + markdown.slice(end);
      setMarkdown(newText);

      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + insertText.length;
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos;
        const scrollContainer = textarea.parentElement?.parentElement;
        if (scrollContainer) scrollContainer.scrollTop = scrollTop;
      }, 0);
    } catch (error) {
      alert(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [textareaRef, markdown, setMarkdown, pushUndo]);

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
  // 只影响光标所在行或选中的行，不影响上下相邻行
  const insertLinePrefix = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    pushUndo();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.parentElement?.parentElement?.scrollTop ?? 0;

    // 将 markdown 按 \n 拆分为行数组
    const allLines = markdown.split('\n');

    // 根据字符偏移量计算光标在第几行（0-indexed）
    let charPos = 0;
    let startLineIdx = 0;
    let endLineIdx = 0;
    for (let i = 0; i < allLines.length; i++) {
      const lineEndPos = charPos + allLines[i].length; // \n 之前的位置
      if (charPos <= start && start <= lineEndPos) {
        startLineIdx = i;
      }
      if (charPos <= end && end <= lineEndPos) {
        endLineIdx = i;
        break;
      }
      charPos = lineEndPos + 1; // +1 跳过 \n
    }

    // 如果选区结束正好在行首（end > start 且 end 正好在某行的 charPos），
    // 且结束位置的行不是起始行，则不包含该行
    if (end > start && endLineIdx > startLineIdx) {
      let checkPos = 0;
      for (let i = 0; i < endLineIdx; i++) {
        checkPos += allLines[i].length + 1;
      }
      if (end === checkPos) {
        endLineIdx = endLineIdx - 1;
      }
    }

    // 对 startLineIdx 到 endLineIdx 的行添加前缀
    const newLines = allLines.map((line, idx) => {
      if (idx >= startLineIdx && idx <= endLineIdx) {
        return prefix + line;
      }
      return line;
    });

    const newText = newLines.join('\n');
    setMarkdown(newText);

    const affectedCount = endLineIdx - startLineIdx + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + prefix.length;
      textarea.selectionEnd = end + prefix.length * affectedCount;
      // 恢复滚动位置
      const scrollContainer = textarea.parentElement?.parentElement;
      if (scrollContainer) scrollContainer.scrollTop = scrollTop;
    }, 0);
  }, [textareaRef, markdown, setMarkdown, pushUndo]);

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
      { icon: <Image className="w-4 h-4" />, title: '插入图片（从本地上传）', action: () => fileInputRef.current?.click() },
      { icon: <Table className="w-4 h-4" />, title: '插入表格', action: () => insertAtCursor('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n') },
      { icon: <Minus className="w-4 h-4" />, title: '水平线', action: () => insertAtCursor('\n---\n') },
      { icon: <MessageCircle className="w-4 h-4" />, title: '插入留言', action: () => insertAtCursor('\n> [!NOTE]\n> 在此留言\n') },
    ],
  ];

  return (
    <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          handleImageUpload(file);
          e.target.value = ''; // 重置以允许重复选择相同文件
        }
      }}
    />
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
    </>
  );
}
