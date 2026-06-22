'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { FileText, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between shadow-sm">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-800">
        <FileText className="w-5 h-5 text-blue-600" />
        <span>MD-Platform</span>
      </Link>

      <div className="flex items-center gap-3">
        {session?.user ? (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || ''}
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
              <span>{session.user.name}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
          >
            登录
          </Link>
        )}
      </div>
    </nav>
  );
}
