"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationPreview } from "@/types";

export function ConversationList() {
  const { data: session } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ conversations: ConversationPreview[] }>;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">대화가 없습니다.</p>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => {
        const other = conv.participants.find(
          (p) => p.userId !== session?.user?.id || p.aiCharacterId
        );
        const otherName = other?.aiCharacter?.name ?? other?.user?.nickname ?? other?.user?.name ?? "알 수 없음";
        const otherImage = other?.aiCharacter?.avatar ?? other?.user?.image;
        const isAi = !!other?.aiCharacterId;

        return (
          <Link
            key={conv.id}
            href={`/messages/${conv.id}`}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Avatar src={otherImage} alt={otherName} size="md" isAi={isAi} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm truncate">{otherName}</p>
                {conv.lastMessage && (
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                    {formatRelativeTime(new Date(conv.lastMessage.createdAt))}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="text-xs text-gray-500 truncate">{conv.lastMessage.content}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
