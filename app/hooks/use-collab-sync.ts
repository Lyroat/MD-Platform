'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

// Assign a deterministic color based on the user's name
function getUserColor(name: string): string {
  const colors = [
    '#f87171', // red
    '#fb923c', // orange
    '#fbbf24', // amber
    '#a3e635', // lime
    '#34d399', // emerald
    '#22d3ee', // cyan
    '#60a5fa', // blue
    '#a78bfa', // violet
    '#f472b6', // pink
    '#c084fc', // purple
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export interface RemoteCursor {
  clientId: number;
  name: string;
  color: string;
  line: number; // 1-based line number
}

export interface ConnectedUser {
  clientId: number;
  name: string;
  color: string;
}

interface UseCollabSyncOptions {
  /** Project ID */
  projectId: string;
  /** File path within the project */
  filePath: string;
  /** Current user display name */
  userName: string;
  /** Current user unique ID (e.g., gitlabId) */
  userId: string;
  /** Current markdown content in the textarea */
  markdown: string;
  /** Setter for the markdown state */
  setMarkdown: (value: string) => void;
  /** Current cursor line (1-based) */
  cursorLine: number;
}

interface UseCollabSyncReturn {
  /** Whether the provider is connected to the server */
  isConnected: boolean;
  /** List of currently connected users (excluding self) */
  connectedUsers: ConnectedUser[];
  /** Remote cursor positions to render in the line number gutter */
  remoteCursors: RemoteCursor[];
}

export function useCollabSync({
  projectId,
  filePath,
  userName,
  userId,
  markdown,
  setMarkdown,
  cursorLine,
}: UseCollabSyncOptions): UseCollabSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  // Refs to avoid stale closures
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;

  const setMarkdownRef = useRef(setMarkdown);
  setMarkdownRef.current = setMarkdown;

  // Track whether a remote change is being applied to avoid echo loops
  const isRemoteUpdate = useRef(false);

  // Track the provider instance
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);

  // Document name used for the Hocuspocus room
  const documentName = `${projectId}:${filePath}`;

  // Initialize connection
  useEffect(() => {
    if (!projectId || !filePath || !userName) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');

    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    // Determine WebSocket URL based on current page location
    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';

    const provider = new HocuspocusProvider({
      url: `${wsProtocol}//${wsHost}/api/collab/ws`,
      name: documentName,
      document: ydoc,
      onConnect: () => {
        setIsConnected(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onSynced: () => {
        // When synced, if Y.Text is empty and we have local content, initialize it
        const currentYText = ytext.toString();
        if (currentYText.length === 0 && markdownRef.current.length > 0) {
          ydoc.transact(() => {
            ytext.insert(0, markdownRef.current);
          });
        } else if (currentYText.length > 0) {
          // Server has content - adopt it
          isRemoteUpdate.current = true;
          setMarkdownRef.current(currentYText);
          isRemoteUpdate.current = false;
        }
      },
    });

    providerRef.current = provider;

    // Set awareness local state
    provider.setAwarenessField('user', {
      name: userName,
      id: userId,
      color: getUserColor(userName),
      cursor: { line: 1 },
    });

    // Listen for Y.Text changes (remote edits)
    const observeHandler = (event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (transaction.local) return; // ignore our own changes
      isRemoteUpdate.current = true;
      setMarkdownRef.current(ytext.toString());
      isRemoteUpdate.current = false;
    };
    ytext.observe(observeHandler);

    // Listen for awareness changes (remote cursors and user list)
    const awarenessHandler = () => {
      const awareness = provider.awareness;
      if (!awareness) return;

      const states = awareness.getStates();
      const users: ConnectedUser[] = [];
      const cursors: RemoteCursor[] = [];

      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return; // skip self
        const user = state.user as { name: string; id: string; color: string; cursor?: { line: number } } | undefined;
        if (!user || !user.name) return;

        users.push({
          clientId,
          name: user.name,
          color: user.color,
        });

        if (user.cursor && typeof user.cursor.line === 'number') {
          cursors.push({
            clientId,
            name: user.name,
            color: user.color,
            line: user.cursor.line,
          });
        }
      });

      setConnectedUsers(users);
      setRemoteCursors(cursors);
    };

    provider.on('awarenessUpdate', awarenessHandler);
    // Also call once to get initial state
    awarenessHandler();

    return () => {
      ytext.unobserve(observeHandler);
      provider.off('awarenessUpdate', awarenessHandler);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      ytextRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filePath, userName, userId, documentName]);

  // When local markdown changes (user typing), apply diff to Y.Text
  useEffect(() => {
    if (isRemoteUpdate.current) return;
    const ytext = ytextRef.current;
    const ydoc = ydocRef.current;
    if (!ytext || !ydoc) return;

    const currentYText = ytext.toString();
    if (currentYText === markdown) return;

    // Compute a simple diff and apply minimal operations
    // For efficiency, find common prefix and suffix
    const oldStr = currentYText;
    const newStr = markdown;

    let prefixLen = 0;
    const minLen = Math.min(oldStr.length, newStr.length);
    while (prefixLen < minLen && oldStr[prefixLen] === newStr[prefixLen]) {
      prefixLen++;
    }

    let suffixLen = 0;
    while (
      suffixLen < (minLen - prefixLen) &&
      oldStr[oldStr.length - 1 - suffixLen] === newStr[newStr.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    const deleteCount = oldStr.length - prefixLen - suffixLen;
    const insertStr = newStr.slice(prefixLen, newStr.length - suffixLen);

    if (deleteCount === 0 && insertStr.length === 0) return;

    ydoc.transact(() => {
      if (deleteCount > 0) {
        ytext.delete(prefixLen, deleteCount);
      }
      if (insertStr.length > 0) {
        ytext.insert(prefixLen, insertStr);
      }
    });
  }, [markdown]);

  // Broadcast cursor line changes via awareness
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.setAwarenessField('user', {
      name: userName,
      id: userId,
      color: getUserColor(userName),
      cursor: { line: cursorLine },
    });
  }, [cursorLine, userName, userId]);

  return {
    isConnected,
    connectedUsers,
    remoteCursors,
  };
}
