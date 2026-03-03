import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      nickname?: string | null;
      email?: string | null;
      image?: string | null;
      onboarded?: boolean;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        // Fetch onboarded status and nickname
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { nickname: true, onboarded: true },
        });
        token.nickname = dbUser?.nickname;
        token.onboarded = dbUser?.onboarded ?? false;
      }
      // Refresh on update() call
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { nickname: true, onboarded: true },
        });
        token.nickname = dbUser?.nickname;
        token.onboarded = dbUser?.onboarded ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.nickname = token.nickname as string | null;
        session.user.onboarded = token.onboarded as boolean;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      // Public paths
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/cron") ||
        pathname.startsWith("/api/onboarding")
      ) {
        return true;
      }

      return !!session?.user;
    },
  },
});
