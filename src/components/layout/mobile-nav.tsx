"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Bot, User, PlusCircle } from "lucide-react";
import { useSession } from "next-auth/react";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const items = [
    { href: "/feed", label: "홈", icon: Home },
    { href: "/ai-characters", label: "AI", icon: Bot },
    { href: "/feed?compose=true", label: "글쓰기", icon: PlusCircle },
    { href: `/profile/${session?.user?.id ?? ""}`, label: "프로필", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href.split("?")[0]);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1",
                active ? "text-amber-600" : "text-gray-400"
              )}
            >
              <Icon size={22} />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
