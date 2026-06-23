'use client';

import { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ySyncPlugin, yCursorPlugin } from '@tiptap/y-tiptap';
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

function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

// Custom Collaboration extension using ySyncPlugin directly (bypasses yUndoPlugin bug)
function createCollabExtension(fragment: Y.XmlFragment) {
  return Extension.create({
    name: 'customCollaboration',
    priority: 1000,
    addProseMirrorPlugins() {
      return [ySyncPlugin(fragment)];
    },
  });
}

// Custom Cursor extension using yCursorPlugin directly
function createCursorExtension(provider: HocuspocusProvider) {
  return Extension.create({
    name: 'customCollaborationCursor',
    addProseMirrorPlugins() {
      return [
        yCursorPlugin(
          provider.awareness!,
          {
            cursorBuilder: (user: { name?: string; color?: string }) => {
              const cursor = document.createElement('span');
              cursor.classList.add('collaboration-cursor__caret');
              cursor.style.borderColor = user.color || '#999';

              const label = document.createElement('div');
              label.classList.add('collaboration-cursor__label');
              label.style.backgroundColor = user.color || '#999';
              label.textContent = user.name || '匿名';
              cursor.appendChild(label);

              return cursor;
            },
          }
        ),
      ];
    },
  });
}

// 外层组件：管理 WebSocket/Yjs 生命周期
export default function TiptapCollabEditor(props: TiptapCollabEditorProps) {
  const { documentId, currentUser } = props;
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [connectedUsers, setConnectedUsers] = useState<CollabUser[]>([]);
  const [isReady, setIsReady] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  const wsUrl = typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/collab/ws`
    : '';

  useEffect(() => {
    if (!wsUrl) return;

    const doc = new Y.Doc();
    const userName = currentUser?.name || '匿名用户';
    const userColor = getUserColor(userName);

    const prov = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: doc,
      onStatus: ({ status: s }) => {
        queueMicrotask(() => setStatus(s as 'connecting' | 'connected' | 'disconnected'));
      },
      onSynced: () => {
        queueMicrotask(() => setIsReady(true));
      },
      onAwarenessUpdate: ({ states }) => {
        const users: CollabUser[] = [];
        states.forEach((state) => {
          if (state.user) {
            users.push(state.user as CollabUser);
          }
        });
        queueMicrotask(() => setConnectedUsers(users));
      },
    });

    prov.setAwarenessField('user', {
      name: userName,
      color: userColor,
      avatar: currentUser?.avatar || '',
    });

    ydocRef.current = doc;
    providerRef.current = prov;

    const readyTimeout = setTimeout(() => {
      setIsReady(true);
    }, 2000);

    return () => {
      clearTimeout(readyTimeout);
      prov.destroy();
      doc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setIsReady(false);
    };
  }, [wsUrl, documentId, currentUser?.name, currentUser?.avatar]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 加载状态 */}
      {!isReady ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-sm">正在连接协作服务器...</div>
          </div>
        </div>
      ) : (
        <CollabEditorCore
          ydoc={ydocRef.current!}
          provider={providerRef.current!}
          editable={props.editable ?? true}
          initialContent={props.initialContent || ''}
          onChange={props.onChange}
          onMarkdownChange={props.onMarkdownChange}
          status={status}
          connectedUsers={connectedUsers}
        />
      )}
    </div>
  );
}

// 核心编辑器组件 - 飞书/石墨风格的全屏富文本编辑器
function CollabEditorCore({
  ydoc,
  provider,
  editable,
  initialContent,
  onChange,
  onMarkdownChange,
  status,
  connectedUsers,
}: {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  editable: boolean;
  initialContent: string;
  onChange?: (html: string) => void;
  onMarkdownChange?: (markdown: string) => void;
  status: 'connecting' | 'connected' | 'disconnected';
  connectedUsers: CollabUser[];
}) {
  const fragment = ydoc.getXmlFragment('default');
  const collabExtension = createCollabExtension(fragment);
  const cursorExtension = createCursorExtension(provider);

  const editor = useEditor({
    editable,
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        link: { openOnClick: false },
      }),
      Highlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '在这里开始编辑...' }),
      collabExtension,
      cursorExtension,
    ],
    onCreate: ({ editor: e }) => {
      if (fragment.length === 0 && initialContent) {
        e.commands.setContent(initialContent);
      }
    },
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getHTML());
      if (onMarkdownChange) {
        onMarkdownChange(e.getText());
      }
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 - 固定在顶部 */}
      <div className="shrink-0 border-b border-gray-100">
        {/* 在线用户 + 连接状态 */}
        <div className="flex items-center justify-between px-4 py-2">
          {/* 左侧：工具按钮 */}
          {editable && editor && (
            <div className="flex items-center gap-0.5 flex-wrap">
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
                <span className="font-bold">B</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')}
                title="斜体 (Ctrl+I)"
              >
                <span className="italic">I</span>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive('strike')}
                title="删除线"
              >
                <span className="line-through">S</span>
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

          {/* 右侧：在线用户 */}
          <div className="flex items-center gap-2 ml-auto">
            {connectedUsers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {connectedUsers.slice(0, 8).map((user, i) => (
                    <div key={`${user.name}-${i}`} className="relative group">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white cursor-default shadow-sm"
                        style={{ backgroundColor: user.color }}
                        title={user.name}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {user.name}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {connectedUsers.length}人
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  status === 'connected' ? 'bg-green-400' :
                  status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                  'bg-red-400'
                )}
              />
              <span className="text-[11px] text-gray-400">
                {status === 'connected' ? '已连接' :
                 status === 'connecting' ? '连接中' :
                 '已断开'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑器主体 - 居中文档区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/50">
        <div className="max-w-3xl mx-auto py-8 px-4">
          <EditorContent
            editor={editor}
            className={cn(
              'bg-white rounded-lg shadow-sm border border-gray-100 min-h-[600px]',
              '[&_.tiptap]:outline-none [&_.tiptap]:px-10 [&_.tiptap]:py-8',
              '[&_.tiptap]:prose [&_.tiptap]:prose-base [&_.tiptap]:max-w-none',
              // 标题样式
              '[&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:mt-8 [&_.tiptap_h1]:mb-4 [&_.tiptap_h1]:pb-2 [&_.tiptap_h1]:border-b [&_.tiptap_h1]:border-gray-100',
              '[&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-6 [&_.tiptap_h2]:mb-3',
              '[&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-medium [&_.tiptap_h3]:mt-4 [&_.tiptap_h3]:mb-2',
              // 段落间距
              '[&_.tiptap_p]:leading-7 [&_.tiptap_p]:my-2',
              // 列表
              '[&_.tiptap_ul]:my-2 [&_.tiptap_ol]:my-2',
              '[&_.tiptap_li]:my-0.5',
              // 引用
              '[&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-blue-200 [&_.tiptap_blockquote]:bg-blue-50/50 [&_.tiptap_blockquote]:px-4 [&_.tiptap_blockquote]:py-2 [&_.tiptap_blockquote]:my-4 [&_.tiptap_blockquote]:rounded-r',
              // 代码
              '[&_.tiptap_pre]:bg-gray-900 [&_.tiptap_pre]:text-gray-100 [&_.tiptap_pre]:rounded-lg [&_.tiptap_pre]:p-4 [&_.tiptap_pre]:my-4 [&_.tiptap_pre]:text-sm [&_.tiptap_pre]:overflow-x-auto',
              '[&_.tiptap_code]:bg-gray-100 [&_.tiptap_code]:text-red-600 [&_.tiptap_code]:px-1.5 [&_.tiptap_code]:py-0.5 [&_.tiptap_code]:rounded [&_.tiptap_code]:text-sm',
              // 分割线
              '[&_.tiptap_hr]:my-6 [&_.tiptap_hr]:border-gray-200',
              // 任务列表
              '[&_.tiptap_ul[data-type=taskList]]:list-none [&_.tiptap_ul[data-type=taskList]]:pl-0',
              '[&_.tiptap_li[data-type=taskItem]]:flex [&_.tiptap_li[data-type=taskItem]]:items-start [&_.tiptap_li[data-type=taskItem]]:gap-2',
            )}
          />
        </div>
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
        'px-2 py-1.5 text-xs rounded-md transition-colors min-w-[30px] font-medium',
        active
          ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-gray-200 mx-1.5" />;
}
