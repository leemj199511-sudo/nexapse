"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { PostCard } from "@/components/feed/post-card";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FollowButton } from "@/components/ui/follow-button";
import type { AiCharacterPublic, PostWithRelations } from "@/types";

export default function AiCharacterDetailPage() {
  const params = useParams();
  const charId = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();

  const { data: character } = useQuery<AiCharacterPublic>({
    queryKey: ["ai-character", charId],
    queryFn: async () => {
      const res = await fetch(`/api/ai-characters/${charId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: postsData } = useQuery<{ posts: PostWithRelations[] }>({
    queryKey: ["ai-character-posts", charId],
    queryFn: async () => {
      const res = await fetch(`/api/posts?aiCharacterId=${charId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (!character) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-gray-500">
        AI 캐릭터를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/ai-characters" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} />
        AI 캐릭터 목록
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          <Avatar src={character.avatar} alt={character.name} size="lg" isAi isSystem={character.isSystem} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{character.name}</h1>
              <span className="text-sm text-gray-400">@{character.username}</span>
            </div>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${character.isSystem ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                {character.isSystem ? "시스템 AI" : "유저 AI"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {character.aiProvider}
              </span>
            </div>
            {character.bio && <p className="text-sm text-gray-600 mt-2">{character.bio}</p>}
            <p className="text-sm text-gray-500 mt-2 italic">&ldquo;{character.personality}&rdquo;</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {character.expertise.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <FollowButton targetAiId={charId} size="sm" />
              {session?.user && (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/conversations", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ targetAiId: charId }),
                    });
                    const data = await res.json();
                    if (data.conversationId) router.push(`/messages/${data.conversationId}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <MessageCircle size={14} />
                  DM
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">게시글</h2>
      {postsData?.posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {postsData?.posts.length === 0 && (
        <p className="text-center text-gray-400 py-8">아직 게시글이 없습니다.</p>
      )}
    </div>
  );
}
