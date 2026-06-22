/**
 * NextAuth 配置
 * 使用 GitLab OAuth Provider
 */

import type { NextAuthOptions } from 'next-auth';
import { upsert } from '@/app/api/supabase/lib/db-helpers';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'gitlab',
      name: 'GitLab',
      type: 'oauth',
      authorization: {
        url: `${process.env.GITLAB_URL || ''}/oauth/authorize`,
        params: { scope: 'read_user api' },
      },
      token: `${process.env.GITLAB_URL || ''}/oauth/token`,
      userinfo: `${process.env.GITLAB_URL || ''}/api/v4/user`,
      clientId: process.env.GITLAB_CLIENT_ID || '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name || profile.username,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    },
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      // 检查用户是否是 bk-teachers 组的成员
      if (account?.access_token) {
        try {
          const groupPath = process.env.GITLAB_GROUP_PATH || 'bk-teachers';
          const gitlabUrl = process.env.GITLAB_URL || '';

          // 使用用户的 access_token 检查是否是组成员
          const res = await fetch(
            `${gitlabUrl}/api/v4/groups/${encodeURIComponent(groupPath)}/members/all/${user.id}`,
            {
              headers: { Authorization: `Bearer ${account.access_token}` },
            }
          );

          if (res.status === 404) {
            // 用户不是组成员，也尝试用管理 token 检查（某些情况下用户 token 权限不够）
            const adminToken = process.env.GITLAB_TOKEN;
            if (adminToken) {
              const adminRes = await fetch(
                `${gitlabUrl}/api/v4/groups/${encodeURIComponent(groupPath)}/members/all/${user.id}`,
                {
                  headers: { 'PRIVATE-TOKEN': adminToken },
                }
              );
              if (adminRes.status === 404) {
                console.log(`Access denied: user ${user.name} (${user.id}) is not a member of ${groupPath}`);
                return false; // 拒绝登录
              }
            } else {
              console.log(`Access denied: user ${user.name} (${user.id}) is not a member of ${groupPath}`);
              return false; // 拒绝登录
            }
          }
        } catch (err) {
          console.error('Failed to check group membership:', err);
          // 检查失败时允许登录（避免因网络错误完全阻止登录）
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        token.gitlabId = Number(user.id);
        token.accessToken = account.access_token;

        // Upsert user in database
        try {
          await upsert(
            'a1ej74pytnlr_users',
            {
              gitlab_id: Number(user.id),
              name: user.name || '',
              email: user.email || '',
              avatar_url: user.image || null,
            },
            ['gitlab_id'],
            {
              name: user.name || '',
              email: user.email || '',
              avatar_url: user.image || null,
            }
          );
        } catch (err) {
          console.error('Failed to upsert user:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).gitlabId = token.gitlabId;
        (session.user as Record<string, unknown>).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
};
