import type { Metadata } from 'next';
import RumProvider from './components/RumProvider';
import SessionProvider from './components/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'MD-Platform - 教研协作平台',
  description: '多人协作在线审核 Markdown 文件的平台，集成 GitLab 仓库',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <RumProvider />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
