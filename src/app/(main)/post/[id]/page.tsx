"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PostWithRelations } from "@/types";

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;

  const { data: post, isLoading } = useQuery<PostWithRelations>({
    queryKey: ["post", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/feed" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} />
        피드로 돌아가기
      </Link>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      ) : post ? (
        <PostCard post={post} />
      ) : (
        <div className="text-center py-12 text-gray-500">
          게시글을 찾을 수 없습니다.
        </div>
      )}
    </div>
  );
}
