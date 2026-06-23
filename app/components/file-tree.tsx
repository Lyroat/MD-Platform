'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeItem {
  name: string;
  type: 'tree' | 'blob';
  path: string;
}

interface FileTreeProps {
  projectId: string;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
}

interface TreeNodeProps {
  item: TreeItem;
  projectId: string;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  level: number;
}

function TreeNode({ item, projectId, onSelectFile, selectedPath, level }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const isFolder = item.type === 'tree';
  const isSelected = item.path === selectedPath;

  const handleClick = useCallback(async () => {
    if (isFolder) {
      if (!expanded && children.length === 0) {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/gitlab/tree?projectId=${projectId}&path=${encodeURIComponent(item.path)}`
          );
          const data = await res.json();
          setChildren(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error('Failed to load tree:', err);
        } finally {
          setLoading(false);
        }
      }
      setExpanded(!expanded);
    } else {
      onSelectFile(item.path);
    }
  }, [isFolder, expanded, children.length, projectId, item.path, onSelectFile]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors text-left',
          isSelected
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {isFolder ? (
          <>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <Folder className="w-4 h-4 text-yellow-500" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className="w-4 h-4 text-blue-500" />
          </>
        )}
        <span className="truncate">{item.name}</span>
      </button>

      {isFolder && expanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              item={child}
              projectId={projectId}
              onSelectFile={onSelectFile}
              selectedPath={selectedPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ projectId, onSelectFile, selectedPath }: FileTreeProps) {
  const [items, setItems] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gitlab/tree?projectId=${projectId}&path=`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load root tree:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 自动加载 - 使用 useEffect 避免在渲染中触发副作用
  useEffect(() => {
    if (!loaded && !loading) {
      loadRoot();
    }
  }, [loaded, loading, loadRoot]);

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        加载文件列表...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无文件
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <TreeNode
          key={item.path}
          item={item}
          projectId={projectId}
          onSelectFile={onSelectFile}
          selectedPath={selectedPath}
          level={0}
        />
      ))}
    </div>
  );
}
