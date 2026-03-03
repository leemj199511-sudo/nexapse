"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { PostCard } from "@/components/feed/post-card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PostWithRelations, AiCharacterPublic } from "@/types";

type SearchTab = "all" | "posts" | "users" | "ai";

type UserResult = { id: string; name: string | null; nickname: string | null; image: string | null; bio: string | null };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearch = () => {
    setDebouncedQuery(query.trim());
  };

  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery, tab],
    queryFn: async () => {
      if (!debouncedQuery) return { posts: [], users: [], aiCharacters: [] };
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&type=${tab}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        posts?: PostWithRelations[];
        users?: UserResult[];
        aiCharacters?: AiCharacterPublic[];
      }>;
    },
    enabled: debouncedQuery.length > 0,
  });

  const tabs: { key: SearchTab; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "posts", label: "게시글" },
    { key: "users", label: "유저" },
    { key: "ai", label: "AI" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">검색</h1>

      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="검색어를 입력하세요..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          검색
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!debouncedQuery && (
        <p className="text-center text-gray-400 py-12">검색어를 입력해주세요</p>
      )}

      {isLoading && debouncedQuery && (
        <div className="text-center py-8 text-gray-400">검색 중...</div>
      )}

      {debouncedQuery && !isLoading && (
        <div className="space-y-6">
          {/* Users */}
          {(tab === "all" || tab === "users") && data?.users && data.users.length > 0 && (
            <div>
              {tab === "all" && <h2 className="text-sm font-semibold text-gray-500 mb-2">유저</h2>}
              <div className="space-y-2">
                {data.users.map((user) => (
                  <Link
                    key={user.id}
                    href={`/profile/${user.id}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                  >
                    <Avatar src={user.image} alt={user.nickname ?? user.name ?? "User"} size="md" />
                    <div>
                      <p className="font-medium text-sm">{user.nickname ?? user.name}</p>
                      {user.bio && <p className="text-xs text-gray-500 line-clamp-1">{user.bio}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* AI Characters */}
          {(tab === "all" || tab === "ai") && data?.aiCharacters && data.aiCharacters.length > 0 && (
            <div>
              {tab === "all" && <h2 className="text-sm font-semibold text-gray-500 mb-2">AI 캐릭터</h2>}
              <div className="space-y-2">
                {data.aiCharacters.map((char) => (
                  <Link
                    key={char.id}
                    href={`/ai-characters/${char.id}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                  >
                    <Avatar src={char.avatar} alt={char.name} size="md" isAi isSystem={char.isSystem} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{char.name}</p>
                        <span className="text-xs text-gray-400">@{char.username}</span>
                      </div>
                      {char.bio && <p className="text-xs text-gray-500 line-clamp-1">{char.bio}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {(tab === "all" || tab === "posts") && data?.posts && data.posts.length > 0 && (
            <div>
              {tab === "all" && <h2 className="text-sm font-semibold text-gray-500 mb-2">게시글</h2>}
              {data.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* No results */}
          {!data?.posts?.length && !data?.users?.length && !data?.aiCharacters?.length && (
            <p className="text-center text-gray-400 py-8">검색 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
