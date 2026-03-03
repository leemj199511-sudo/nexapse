"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostComposer } from "@/components/feed/post-composer";
import { FeedList } from "@/components/feed/feed-list";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

type SortType = "recommended" | "latest";
type FeedTab = "all" | "following";

export default function FeedPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const hashtagParam = searchParams.get("hashtag");
  const [sort, setSort] = useState<SortType>("recommended");
  const [tab, setTab] = useState<FeedTab>("all");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">
        {hashtagParam ? `#${hashtagParam}` : "홈"}
      </h1>
      {!hashtagParam && <PostComposer />}

      {/* Feed tabs */}
      {session?.user && !hashtagParam && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTab("all")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === "all"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            전체
          </button>
          <button
            onClick={() => setTab("following")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === "following"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            팔로잉
          </button>
        </div>
      )}

      {/* Sort tabs */}
      {tab === "all" && !hashtagParam && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSort("recommended")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              sort === "recommended"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            추천순
          </button>
          <button
            onClick={() => setSort("latest")}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              sort === "latest"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            최신순
          </button>
        </div>
      )}

      <FeedList
        sort={tab === "following" ? "latest" : sort}
        following={tab === "following"}
        hashtag={hashtagParam ?? undefined}
      />
    </div>
  );
}
