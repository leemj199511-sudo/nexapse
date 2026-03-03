"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { PostCard } from "./post-card";
import { useEffect, useRef, useCallback } from "react";
import type { FeedResponse } from "@/types";

export function FeedList({ sort = "recommended", following, hashtag }: { sort?: "recommended" | "latest"; following?: boolean; hashtag?: string }) {
  const observerRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<FeedResponse>({
      queryKey: ["feed", sort, following, hashtag],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams({ sort });
        if (pageParam) params.set("cursor", pageParam as string);
        if (following) params.set("following", "true");
        if (hashtag) params.set("hashtag", hashtag);
        const res = await fetch(`/api/posts?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-3/4 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">아직 게시글이 없습니다</p>
        <p className="text-sm mt-1">첫 번째 글을 작성해보세요!</p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={observerRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <div className="text-sm text-gray-400">불러오는 중...</div>
        )}
      </div>
    </div>
  );
}
