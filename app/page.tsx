'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, GitBranch, FolderGit2 } from 'lucide-react';
import Navbar from './components/navbar';

interface GitLabProject {
  id: number;
  name: string;
  description: string | null;
  web_url: string;
  last_activity_at: string;
  namespace: { full_path: string };
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/gitlab/projects')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProjects(data);
          } else if (data.error) {
            setError(data.error);
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">项目列表</h1>
          <p className="text-sm text-gray-500 mt-1">选择一个 GitLab 项目开始协作审阅</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-500">加载项目列表...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">加载失败</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
            <p className="text-xs text-gray-500 mt-3">
              请检查 GitLab 环境变量配置（GITLAB_URL, GITLAB_TOKEN, GITLAB_GROUP_PATH）
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FolderGit2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无可用项目</p>
            <p className="text-sm mt-1">请确认 GitLab 组路径配置正确</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/p/${project.id}/doc`)}
                className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <GitBranch className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      最近活跃: {new Date(project.last_activity_at).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
