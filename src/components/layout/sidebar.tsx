"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, Bot, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";

const navItems = [
  { href: "/feed", label: "홈", icon: Home },
  { href: "/ai-characters", label: "AI 캐릭터", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

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
        )}
      </nav>

      {/* User section */}
      {session?.user && (
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
      )}
    </aside>
  );
}
