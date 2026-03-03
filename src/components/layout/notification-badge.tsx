"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

export function NotificationBadge() {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session?.user) return;

    const fetchCount = () => {
      fetch("/api/notifications/count")
        .then((r) => r.json())
        .then((data) => setCount(data.count ?? 0))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000); // 30초 폴링
    return () => clearInterval(interval);
  }, [session?.user]);

  return (
    <div className="relative">
      <Bell size={20} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}
