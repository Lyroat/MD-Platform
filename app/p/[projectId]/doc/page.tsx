'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit3, ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import Navbar from '@/app/components/navbar';
import FileTree from '@/app/components/file-tree';

interface GitLabProject {
  id: number;
  name: string;
  description: string | null;
  namespace: { full_path: string };
}

export default function DocIndexPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [showProjectList, setShowProjectList] = useState(false);

  // 获取项目列表
  useEffect(() => {
    fetch('/api/gitlab/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data);
        }
      })
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, []);

  const currentProject = projects.find((p) => String(p.id) === projectId);

  const handleSelectFile = (path: string) => {
    const encodedPath = path.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    router.push(`/p/${projectId}/doc/${encodedPath}`);
  };

  const handleSwitchProject = (id: number) => {
    setShowProjectList(false);
    router.push(`/p/${id}/doc`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex h-[calc(100vh-56px)]">
        {/* 左侧面板 */}
        <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
          {/* 项目切换器 */}
          <div className="border-b border-gray-200 p-3">
            <button
              onClick={() => setShowProjectList(!showProjectList)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">
                  {currentProject ? currentProject.name : '选择项目'}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                  showProjectList ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 项目下拉列表 */}
            {showProjectList && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-4 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    暂无项目
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSwitchProject(project.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                        String(project.id) === projectId
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 文件树 */}
          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              文件列表
            </h3>
            <FileTree projectId={projectId} onSelectFile={handleSelectFile} />
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Edit3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">请从左侧选择一个 Markdown 文件</p>
            <p className="text-sm mt-2">支持查看、编辑、批注和协作</p>
          </div>
        </div>
      </div>
    </div>
  );
}
