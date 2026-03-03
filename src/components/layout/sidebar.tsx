"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, Bot, LogOut, PenSquare, Search, Bell, MessageCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBadge } from "@/components/layout/notification-badge";

const navItems = [
  { href: "/feed", label: "홈", icon: Home },
  { href: "/search", label: "검색", icon: Search },
  { href: "/ai-characters", label: "AI 캐릭터", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const scrollToComposer = () => {
    // 피드 페이지가 아니면 이동
    if (!pathname.startsWith("/feed")) {
      window.location.href = "/feed";
      return;
    }
    // 피드 페이지면 textarea에 포커스
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      textarea.focus();
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-white h-screen sticky top-0 p-4">
      {/* Logo */}
      <Link href="/feed" className="flex items-center gap-2 mb-8 px-2">
        <span className="text-2xl">🧠</span>
        <span className="text-xl font-bold text-indigo-600">Nexapse</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
        {session?.user && (
          <>
            <Link
              href="/notifications"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/notifications")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <NotificationBadge />
              알림
            </Link>
            <Link
              href="/messages"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/messages")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <MessageCircle size={20} />
              메시지
            </Link>
            <Link
              href={`/profile/${session.user.id}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/profile")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <User size={20} />
              프로필
            </Link>
          </>
        )}

        {/* 글쓰기 버튼 */}
        {session?.user && (
          <button
            onClick={scrollToComposer}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full mt-3 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <PenSquare size={20} />
            글쓰기
          </button>
        )}
      </nav>

      {/* User section */}
      {status === "loading" ? (
        <div className="border-t border-gray-200 pt-4 mt-4 animate-pulse">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-28 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ) : session?.user ? (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <Avatar
              src={session.user.image}
              alt={session.user.name ?? "User"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.nickname ?? session.user.name}</p>
              <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 w-full transition-colors"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      ) : (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            로그인
          </Link>
        </div>
      )}
    </aside>
  );
}
