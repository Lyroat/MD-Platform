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
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { cn } from '@/lib/utils';

interface CollabUser {
  name: string;
  color: string;
  avatar?: string;
}

interface TiptapCollabEditorProps {
  documentId: string;
  initialContent?: string;
  editable?: boolean;
  currentUser?: { name: string; avatar?: string };
  onChange?: (html: string) => void;
  onMarkdownChange?: (markdown: string) => void;
}

const COLLAB_COLORS = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594',
  '#70CFF8', '#94FADB', '#B9F18D', '#C4B5FD',
  '#E879F9', '#67E8F9', '#A3E635', '#FB923C',
];

// 根据用户名生成稳定颜色
function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

export default function TiptapCollabEditor({
  documentId,
  initialContent = '',
  editable = true,
  currentUser,
  onChange,
  onMarkdownChange,
}: TiptapCollabEditorProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 使用相对路径连接 WebSocket（同一端口）
  const wsUrl = typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab/ws`
    : '';

  useEffect(() => {
    if (!wsUrl) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const userName = currentUser?.name || '匿名用户';
    const userColor = getUserColor(userName);

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      onStatus: ({ status: s }) => {
        setStatus(s as 'connecting' | 'connected' | 'disconnected');
      },
      onAwarenessUpdate: ({ states }) => {
        // 将 awareness states 转换为用户列表
        const users: CollabUser[] = [];
        states.forEach((state) => {
          if (state.user) {
            users.push(state.user as CollabUser);
          }
        });
        setConnectedUsers(users);
      },
    });

    // 设置当前用户的 awareness 信息
    provider.setAwarenessField('user', {
      name: userName,
      color: userColor,
      avatar: currentUser?.avatar || '',
    });

    providerRef.current = provider;
    setIsReady(true);

    return () => {
      provider.destroy();
      setIsReady(false);
    };
  }, [wsUrl, documentId, currentUser?.name, currentUser?.avatar]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      Highlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '开始协作编辑...' }),
      ...(ydocRef.current
        ? [Collaboration.configure({ document: ydocRef.current })]
        : []),
      ...(providerRef.current
        ? [CollaborationCursor.configure({
            provider: providerRef.current,
          })]
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
      // 也可以输出 Markdown（用于同步到 markdown 模式）
      if (onMarkdownChange) {
        // 简单的 HTML to text 转换用于状态栏统计等
        const text = e.getText();
        onMarkdownChange(text);
      }
    },
  }, [isReady]);

  return (
    <div className="flex flex-col h-full">
      {/* 状态栏 - 显示连接状态和在线用户 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
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
        {/* 在线用户列表 - 显示名字和颜色 */}
        {connectedUsers.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {connectedUsers.slice(0, 8).map((user, i) => (
                <div
                  key={`${user.name}-${i}`}
                  className="relative group"
                >
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white cursor-default"
                    style={{ backgroundColor: user.color }}
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {user.name}
                  </div>
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">
              {connectedUsers.length} 人在线
            </span>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      {editable && editor && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 flex-wrap shrink-0">
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
            title="粗体 (Ctrl+B)"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="斜体 (Ctrl+I)"
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
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="代码块"
          >
            {'{ }'}
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
      <div className="flex-1 overflow-y-auto min-h-0">
        {status === 'connecting' ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
              正在连接协作服务器...
            </div>
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
