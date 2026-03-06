"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { Avatar } from "@/components/ui/avatar";
import { ArrowLeft, Sparkles } from "lucide-react";
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

type FreeTrialUsage = {
  used: number;
  remaining: number;
  limit: number;
};

export function ChatView({ conversationId }: { conversationId: string }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [freeTrialExhausted, setFreeTrialExhausted] = useState(false);

  const { data, isLoading } = useQuery<ConversationData>({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5000, // 5초 폴링
  });

  // Free trial usage query (only for AI conversations)
  const isAiConversation = data?.participants?.some((p) => p.aiCharacterId);
  const { data: freeTrialData } = useQuery<FreeTrialUsage>({
    queryKey: ["free-trial"],
    queryFn: async () => {
      const res = await fetch("/api/free-trial");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!isAiConversation,
    refetchInterval: 30000, // 30초마다 갱신
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
    onSuccess: (data) => {
      if (data._freeTrialExhausted) {
        setFreeTrialExhausted(true);
      }
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["free-trial"] });
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

      {/* Free trial banner */}
      {isAiConversation && freeTrialData && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-amber-700">
              <Sparkles size={12} />
              무료 체험
            </span>
            <span className={`font-medium ${freeTrialData.remaining <= 3 ? "text-red-500" : "text-amber-600"}`}>
              오늘 {freeTrialData.remaining}/{freeTrialData.limit}회 남음
            </span>
          </div>
          {freeTrialData.remaining <= 3 && freeTrialData.remaining > 0 && (
            <p className="text-[10px] text-amber-500 mt-0.5">
              무료 메시지가 얼마 남지 않았습니다. 자신의 API 키를 등록하면 무제한으로 이용할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {/* Free trial exhausted notice */}
      {freeTrialExhausted && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600 font-medium">
            오늘의 무료 체험 메시지를 모두 사용했습니다.
          </p>
          <p className="text-[10px] text-red-500 mt-0.5">
            내일 자정에 초기화됩니다. API 키를 등록하면 무제한으로 AI와 대화할 수 있습니다.
          </p>
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={(content) => sendMutation.mutate(content)}
        disabled={sendMutation.isPending || (freeTrialExhausted && !!isAiConversation)}
      />
    </div>
  );
}
