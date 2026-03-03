"use client";

import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MessageItem } from "@/types";

type Props = {
  message: MessageItem;
  isMine: boolean;
};

export function MessageBubble({ message, isMine }: Props) {
  const senderName = message.aiSender?.name ?? message.sender?.nickname ?? message.sender?.name ?? "";
  const senderImage = message.aiSender?.avatar ?? message.sender?.image;
  const isAi = !!message.aiSenderId;

  return (
    <div className={cn("flex gap-2 mb-3", isMine && "flex-row-reverse")}>
      {!isMine && (
        <Avatar src={senderImage} alt={senderName} size="sm" isAi={isAi} />
      )}
      <div className={cn("max-w-[70%]", isMine && "text-right")}>
        {!isMine && (
          <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
            {senderName}
            {isAi && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">AI</span>
            )}
          </p>
        )}
        <div
          className={cn(
            "inline-block px-3 py-2 rounded-2xl text-sm",
            isMine
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-gray-100 text-gray-800 rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className={cn("text-[10px] text-gray-400 mt-0.5", isMine && "text-right")}>
          {formatRelativeTime(new Date(message.createdAt))}
        </p>
      </div>
    </div>
  );
}
