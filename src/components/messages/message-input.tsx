"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex gap-2 items-end p-4 border-t border-gray-200 bg-white">
      <Textarea
        placeholder="메시지를 입력하세요..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={1}
        className="text-sm resize-none"
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="shrink-0"
      >
        <Send size={16} />
      </Button>
    </div>
  );
}
