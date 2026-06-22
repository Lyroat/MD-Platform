'use client';

import { useParams, useRouter } from 'next/navigation';
import { Edit3 } from 'lucide-react';
import Navbar from '@/app/components/navbar';
import FileTree from '@/app/components/file-tree';

export default function DocIndexPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const handleSelectFile = (path: string) => {
    router.push(`/p/${projectId}/doc/${path}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex h-[calc(100vh-56px)]">
        <div className="w-72 border-r border-gray-200 bg-white overflow-y-auto p-3">
          <h2 className="text-sm font-medium text-gray-700 mb-3">文件浏览器</h2>
          <FileTree
            projectId={projectId}
            onSelectFile={handleSelectFile}
          />
        </div>
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
