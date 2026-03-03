"use client";

import { ConversationList } from "@/components/messages/conversation-list";

export default function MessagesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">메시지</h1>
      <ConversationList />
    </div>
  );
}
