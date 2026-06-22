'use client';

import { signIn } from 'next-auth/react';
import { FileText } from 'lucide-react';

export default function LoginPage() {
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
          登录即表示您同意使用条款和隐私政策
        </p>
      </div>
    </div>
  );
}
