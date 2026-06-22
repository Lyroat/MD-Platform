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
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
};
