'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Assign a deterministic color based on the user's name
function getUserColor(name: string): string {
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
    '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#c084fc',
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
  line: number;
}

export interface ConnectedUser {
  clientId: number;
  name: string;
  color: string;
}

interface UseCollabSyncOptions {
  projectId: string;
  filePath: string;
  userName: string;
  userId: string;
  markdown: string;
  setMarkdown: (value: string) => void;
  cursorLine: number;
}

interface UseCollabSyncReturn {
  isConnected: boolean;
  connectedUsers: ConnectedUser[];
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

  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;

  const setMarkdownRef = useRef(setMarkdown);
  setMarkdownRef.current = setMarkdown;

  const versionRef = useRef(0);
  const isRemoteUpdate = useRef(false);
  const pendingUpdateRef = useRef<string | null>(null);
  const documentName = `${projectId}:${filePath}`;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Send local changes to server
  const pushChanges = useCallback(async (content: string) => {
    try {
      const res = await fetch('/api/collab/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName,
          content,
          version: versionRef.current,
          userName,
          userId,
          userColor: getUserColor(userName),
          cursorLine,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'ok') {
        versionRef.current = data.version;
      } else if (data.status === 'conflict') {
        // Someone else edited — adopt their version
        versionRef.current = data.version;
        if (data.content !== markdownRef.current) {
          isRemoteUpdate.current = true;
          setMarkdownRef.current(data.content);
          isRemoteUpdate.current = false;
        }
      }
    } catch {
      // Network error, will retry on next poll
    }
  }, [documentName, userName, userId, cursorLine]);

  // Poll for changes
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/collab/sync?doc=${encodeURIComponent(documentName)}`);
      if (!res.ok) {
        setIsConnected(false);
        return;
      }

      setIsConnected(true);
      const data = await res.json();

      // Update version and content if newer
      if (data.version > versionRef.current) {
        versionRef.current = data.version;
        if (data.content !== markdownRef.current) {
          isRemoteUpdate.current = true;
          setMarkdownRef.current(data.content);
          isRemoteUpdate.current = false;
        }
      }

      // Update users list
      const users: ConnectedUser[] = [];
      const cursors: RemoteCursor[] = [];

      (data.users || []).forEach((u: { userId: string; name: string; color: string; cursorLine: number }, idx: number) => {
        if (u.userId === userId) return; // skip self
        users.push({ clientId: idx, name: u.name, color: u.color });
        if (u.cursorLine) {
          cursors.push({ clientId: idx, name: u.name, color: u.color, line: u.cursorLine });
        }
      });

      setConnectedUsers(users);
      setRemoteCursors(cursors);
    } catch {
      setIsConnected(false);
    }
  }, [documentName, userId]);

  // Initialize: fetch initial state
  useEffect(() => {
    if (!projectId || !filePath || !userName) return;

    // Initial fetch
    poll();

    // Start polling every 2 seconds
    pollIntervalRef.current = setInterval(poll, 2000);

    // Heartbeat (presence update) every 5 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await fetch('/api/collab/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentName,
            userName,
            userId,
            userColor: getUserColor(userName),
            cursorLine,
          }),
        });
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearInterval(heartbeatInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filePath, userName, userId, documentName]);

  // When local markdown changes (user typing), push to server
  useEffect(() => {
    if (isRemoteUpdate.current) return;
    if (!projectId || !filePath) return;

    // Debounce: wait 500ms after last keystroke before pushing
    pendingUpdateRef.current = markdown;
    const timer = setTimeout(() => {
      if (pendingUpdateRef.current !== null) {
        pushChanges(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [markdown, projectId, filePath, pushChanges]);

  return {
    isConnected,
    connectedUsers,
    remoteCursors,
  };
}
