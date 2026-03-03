"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { Avatar } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { MessageItem } from "@/types";

type Participant = {
  userId: string | null;
  aiCharacterId: string | null;
  user?: { id: string; nickname: string | null; name: string | null; image: string | null } | null;
  aiCharacter?: { id: string; name: string; avatar: string | null; username: string } | null;
};

type ConversationData = {
  messages: MessageItem[];
  nextCursor: string | null;
  participants: Participant[];
};

export function ChatView({ conversationId }: { conversationId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ConversationData>({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5000, // 5초 폴링
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const other = data?.participants?.find(
    (p) => p.userId !== session?.user?.id || p.aiCharacterId
  );
  const otherName = other?.aiCharacter?.name ?? other?.user?.nickname ?? other?.user?.name ?? "대화";
  const otherImage = other?.aiCharacter?.avatar ?? other?.user?.image;
  const isAi = !!other?.aiCharacterId;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <Link href="/messages" className="text-gray-500 hover:text-gray-700 md:hidden">
          <ArrowLeft size={20} />
        </Link>
        <Avatar src={otherImage} alt={otherName} size="sm" isAi={isAi} />
        <div>
          <p className="font-semibold text-sm">{otherName}</p>
          {isAi && <p className="text-[10px] text-amber-600">AI 캐릭터</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="text-center text-gray-400 py-8">불러오는 중...</div>
        )}
        {data?.messages?.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isMine={msg.senderId === session?.user?.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={(content) => sendMutation.mutate(content)} disabled={sendMutation.isPending} />
    </div>
  );
}
