"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Bot, Sparkles, MessageCircle } from "lucide-react";
import { useState } from "react";
import { RegisterAiModal } from "@/components/ai/register-ai-modal";
import type { AiCharacterPublic } from "@/types";

type FreeTrialUsage = {
  used: number;
  remaining: number;
  limit: number;
};

export default function AiCharactersPage() {
  const [showRegister, setShowRegister] = useState(false);

  const { data } = useQuery<{ characters: AiCharacterPublic[] }>({
    queryKey: ["ai-characters"],
    queryFn: async () => {
      const res = await fetch("/api/ai-characters");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Free trial usage
  const { data: freeTrialData } = useQuery<FreeTrialUsage>({
    queryKey: ["free-trial"],
    queryFn: async () => {
      const res = await fetch("/api/free-trial");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const characters = data?.characters ?? [];
  const systemChars = characters.filter((c) => c.isSystem);
  const userChars = characters.filter((c) => !c.isSystem);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot size={24} /> AI 캐릭터
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            AI 캐릭터들과 소통하고, 나만의 AI를 등록하세요
          </p>
        </div>
        <Button size="sm" onClick={() => setShowRegister(true)}>
          <Plus size={16} className="mr-1" /> 내 AI 등록
        </Button>
      </div>

      {/* Free trial banner */}
      {freeTrialData && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-800">무료 체험</h3>
          </div>
          <p className="text-xs text-amber-700">
            API 키 없이도 시스템 AI 캐릭터들과 대화할 수 있습니다.
            매일 <strong>{freeTrialData.limit}회</strong> 무료 메시지가 제공됩니다.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-amber-200 rounded-full h-1.5">
              <div
                className="bg-amber-500 rounded-full h-1.5 transition-all"
                style={{ width: `${(freeTrialData.remaining / freeTrialData.limit) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${freeTrialData.remaining <= 3 ? "text-red-500" : "text-amber-600"}`}>
              {freeTrialData.remaining}/{freeTrialData.limit}
            </span>
          </div>
        </div>
      )}

      {/* Showcase AI — featured demo characters */}
      {systemChars.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">AI 쇼케이스 - 바로 대화해보세요</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            시스템 AI 캐릭터들과 무료로 대화할 수 있습니다. DM 버튼을 눌러 바로 시작하세요!
          </p>
          <div className="grid gap-3">
            {systemChars.map((char) => (
              <CharacterCard key={char.id} character={char} showFreeBadge />
            ))}
          </div>
        </div>
      )}

      {/* User AI */}
      {userChars.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">유저 등록 AI</h2>
          <div className="grid gap-3">
            {userChars.map((char) => (
              <CharacterCard key={char.id} character={char} />
            ))}
          </div>
        </div>
      )}

      {characters.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Bot size={48} className="mx-auto mb-3 opacity-50" />
          <p>아직 등록된 AI 캐릭터가 없습니다.</p>
          <p className="text-sm mt-1">첫 번째 AI를 등록해보세요!</p>
        </div>
      )}

      {showRegister && (
        <RegisterAiModal onClose={() => setShowRegister(false)} />
      )}
    </div>
  );
}

function CharacterCard({ character, showFreeBadge }: { character: AiCharacterPublic; showFreeBadge?: boolean }) {
  return (
    <Link
      href={`/ai-characters/${character.id}`}
      className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 transition-colors"
    >
      <Avatar
        src={character.avatar}
        alt={character.name}
        size="lg"
        isAi
        isSystem={character.isSystem}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{character.name}</h3>
          <span className="text-xs text-gray-400">@{character.username}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {character.aiProvider}
          </span>
          {showFreeBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-0.5">
              <Sparkles size={8} /> 무료 체험
            </span>
          )}
        </div>
        {character.bio && (
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">{character.bio}</p>
        )}
        <div className="flex gap-1.5 mt-1.5">
          {character.expertise.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
