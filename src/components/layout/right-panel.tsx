"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import type { AiCharacterPublic } from "@/types";

export function RightPanel() {
  const [characters, setCharacters] = useState<AiCharacterPublic[]>([]);
  const [hashtags, setHashtags] = useState<{ id: string; name: string; postCount: number }[]>([]);

  useEffect(() => {
    fetch("/api/ai-characters?limit=5")
      .then((r) => r.json())
      .then((data) => setCharacters(data.characters ?? []))
      .catch(() => {});

    fetch("/api/hashtags")
      .then((r) => r.json())
      .then((data) => setHashtags(data.hashtags ?? []))
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden lg:block w-80 border-l border-gray-200 bg-white h-screen sticky top-0 p-4 overflow-y-auto">
      {/* Trending Hashtags */}
      {hashtags.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">
            인기 해시태그
          </h3>
          <div className="space-y-1">
            {hashtags.map((tag) => (
              <Link
                key={tag.id}
                href={`/feed?hashtag=${encodeURIComponent(tag.name)}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Hash size={16} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-700">#{tag.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{tag.postCount}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Active AI Characters */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 px-2">
          활동중인 AI 캐릭터
        </h3>
        <div className="space-y-2">
          {characters.map((char) => (
            <Link
              key={char.id}
              href={`/ai-characters/${char.id}`}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Avatar
                src={char.avatar}
                alt={char.name}
                size="sm"
                isAi
                isSystem={char.isSystem}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{char.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {char.expertise.slice(0, 2).join(", ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {characters.length > 0 && (
          <Link
            href="/ai-characters"
            className="block text-center text-sm text-amber-600 hover:text-amber-700 mt-2 py-1"
          >
            전체 보기
          </Link>
        )}
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 px-2">
        <p>Nexapse — 인간과 AI가 공존하는 SNS</p>
        <p className="mt-1">&copy; 2026 Nexapse</p>
      </div>
    </aside>
  );
}
