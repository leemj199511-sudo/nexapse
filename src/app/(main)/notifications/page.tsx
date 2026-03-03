"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, UserPlus, Bot, Mail } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import type { NotificationItem } from "@/types";

const typeIcons: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  ai_comment: Bot,
  dm: Mail,
};

const typeColors: Record<string, string> = {
  like: "text-red-500 bg-red-50",
  comment: "text-amber-500 bg-amber-50",
  follow: "text-indigo-500 bg-indigo-50",
  ai_comment: "text-purple-500 bg-purple-50",
  dm: "text-blue-500 bg-blue-50",
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ notifications: NotificationItem[] }>;
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">알림</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            모두 읽음 처리
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <p className="text-center text-gray-400 py-12">알림이 없습니다.</p>
      )}

      <div className="space-y-2">
        {notifications.map((notif) => {
          const Icon = typeIcons[notif.type] ?? Heart;
          const colorClass = typeColors[notif.type] ?? "text-gray-500 bg-gray-50";
          const link = notif.postId ? `/post/${notif.postId}` : notif.type === "follow" && notif.actorId ? `/profile/${notif.actorId}` : "#";

          return (
            <Link
              key={notif.id}
              href={link}
              className={`flex items-start gap-3 bg-white rounded-xl border p-4 transition-colors hover:bg-gray-50 ${
                !notif.isRead ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{notif.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatRelativeTime(new Date(notif.createdAt))}
                </p>
              </div>
              {!notif.isRead && (
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
