'use client';

import { useState, useEffect } from 'react';
import { History, Loader2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Commit {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  created_at: string;
}

interface HistoryPanelProps {
  projectId: string;
  filePath: string;
}

export default function HistoryPanel({ projectId, filePath }: HistoryPanelProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !filePath) return;

    setLoading(true);
    fetch(`/api/gitlab/history?projectId=${projectId}&path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        setCommits(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, filePath]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
        <History className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">提交历史</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            加载中...
          </div>
        ) : commits.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无提交记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {commits.map((commit) => (
              <div key={commit.id} className="px-3 py-2.5 hover:bg-gray-50">
                <p className="text-sm text-gray-800 line-clamp-2">{commit.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{commit.author_name}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">{formatRelativeTime(commit.created_at)}</span>
                  <span className="text-xs text-gray-400 font-mono ml-auto">{commit.short_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
