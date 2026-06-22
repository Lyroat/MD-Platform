'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { FileText, ShieldAlert } from 'lucide-react';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">MD-Platform</h1>
          <p className="text-sm text-gray-500 mt-1">教研协作平台</p>
        </div>

        {error === 'AccessDenied' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">访问被拒绝</p>
              <p className="text-xs text-red-600 mt-1">
                您不是 bk-teachers 组的成员，无法使用此平台。请联系管理员将您添加到组中。
              </p>
            </div>
          </div>
        )}

        {error && error !== 'AccessDenied' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">登录出现问题，请重试。</p>
          </div>
        )}

        <button
          onClick={() => signIn('gitlab', { callbackUrl: '/' })}
          className="w-full flex items-center justify-center gap-3 bg-[#FC6D26] hover:bg-[#E24329] text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
          </svg>
          使用 GitLab 登录
        </button>

        <p className="text-xs text-gray-400 text-center mt-6">
          仅限 bk-teachers 组成员使用
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-500">加载中...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
