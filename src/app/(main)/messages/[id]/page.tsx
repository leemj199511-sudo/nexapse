"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/messages/chat-view";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return <ChatView conversationId={conversationId} />;
}
