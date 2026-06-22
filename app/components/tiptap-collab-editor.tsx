'use client';

import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { cn } from '@/lib/utils';

interface TiptapCollabEditorProps {
  documentId: string;
  initialContent?: string;
  editable?: boolean;
  onChange?: (html: string) => void;
}

const COLLAB_COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C4B5FD',
];

export default function TiptapCollabEditor({
  documentId,
  initialContent = '',
  editable = true,
  onChange,
}: TiptapCollabEditorProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [userCount, setUserCount] = useState(0);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  // 使用相对路径连接 WebSocket（同一端口）
  const wsUrl = typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab/ws`
    : '';

  useEffect(() => {
    if (!wsUrl) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      onStatus: ({ status: s }) => {
        setStatus(s as 'connecting' | 'connected' | 'disconnected');
      },
      onAwarenessUpdate: ({ states }) => {
        setUserCount(states.length);
      },
    });

    providerRef.current = provider;

    return () => {
      provider.destroy();
    };
  }, [wsUrl, documentId]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      Highlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '开始编辑...' }),
      ...(ydocRef.current
        ? [Collaboration.configure({ document: ydocRef.current })]
        : []),
    ],
    onCreate: ({ editor: e }) => {
      // 只有当 Yjs fragment 为空时才设置初始内容
      if (ydocRef.current) {
        const fragment = ydocRef.current.getXmlFragment('default');
        if (fragment.length === 0 && initialContent) {
          e.commands.setContent(initialContent);
        }
      }
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
  }, [ydocRef.current]);

  return (
    <div className="flex flex-col h-full">
      {/* 状态栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'connected' ? 'bg-green-500' :
              status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            )}
          />
          <span className="text-xs text-gray-500">
            {status === 'connected' ? '已连接' :
             status === 'connecting' ? '连接中...' :
             '已断开'}
          </span>
        </div>
        {userCount > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              {Array.from({ length: Math.min(userCount, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border-2 border-white"
                  style={{ backgroundColor: COLLAB_COLORS[i % COLLAB_COLORS.length] }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">{userCount} 人在线</span>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      {editable && editor && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="标题 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="标题 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="标题 3"
          >
            H3
          </ToolbarButton>
          <Separator />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="粗体"
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="斜体"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="删除线"
          >
            <s>S</s>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="行内代码"
          >
            {'</>'}
          </ToolbarButton>
          <Separator />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="无序列表"
          >
            •
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="有序列表"
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            title="任务列表"
          >
            ☑
          </ToolbarButton>
          <Separator />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="引用"
          >
            &ldquo;
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            active={false}
            title="分割线"
          >
            —
          </ToolbarButton>
        </div>
      )}

      {/* 编辑区 */}
      <div className="flex-1 overflow-y-auto">
        {status === 'connecting' ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            正在连接协作服务器...
          </div>
        ) : (
          <EditorContent
            editor={editor}
            className="h-full [&_.tiptap]:outline-none [&_.tiptap]:p-4 [&_.tiptap]:min-h-full [&_.tiptap]:prose [&_.tiptap]:prose-sm [&_.tiptap]:max-w-none"
          />
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'px-2 py-1 text-xs rounded transition-colors min-w-[28px]',
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}
