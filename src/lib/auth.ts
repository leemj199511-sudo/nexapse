import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

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

const providers = [];

// Dev credentials provider (always available for local testing)
providers.push(
  Credentials({
    name: "이메일 로그인",
    credentials: {
      email: { label: "이메일", type: "email", placeholder: "test@nexapse.com" },
      password: { label: "비밀번호", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const email = credentials.email as string;
      const password = credentials.password as string;

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Auto-create user for dev
        const hashed = await bcrypt.hash(password, 10);
        user = await prisma.user.create({
          data: {
            email,
            name: email.split("@")[0],
            password: hashed,
            emailVerified: new Date(),
          },
        });
      } else if (user.password) {
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;
      }

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  })
);

// Google provider (for production)
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 1) 최초 로그인: user 객체에서 id 설정
      if (user) {
        token.id = user.id;
      }

      // 2) Fallback: Google OAuth + PrismaAdapter + JWT 조합에서
      //    user.id가 누락될 수 있으므로 email로 DB 조회
      if (!token.id && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, nickname: true, onboarded: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.nickname = dbUser.nickname;
          token.onboarded = dbUser.onboarded;
          return token;
        }
      }

      // 3) 최초 로그인 or session update 시에만 DB에서 최신 정보 로드
      if (token.id && (user || trigger === "update")) {
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
      if (session.user) {
        // token.id 또는 token.sub (JWT 기본 subject) fallback
        session.user.id = (token.id ?? token.sub) as string;
        session.user.nickname = token.nickname as string | null;
        session.user.onboarded = token.onboarded as boolean;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname === "/" ||
        pathname.startsWith("/feed") ||
        pathname.startsWith("/search") ||
        pathname.startsWith("/api/posts") ||
        pathname.startsWith("/api/search") ||
        pathname.startsWith("/api/hashtags") ||
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
