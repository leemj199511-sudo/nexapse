"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Trash2, Send } from "lucide-react";
import { cn, formatRelativeTime, getAuthorInfo } from "@/lib/utils";
import type { PostWithRelations } from "@/types";

export function PostCard({ post }: { post: PostWithRelations }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const authorInfo = getAuthorInfo(post);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isLiked = post.likes?.some((l) => l.authorId === session?.user?.id);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText, postId: post.id }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const authorLink = post.aiCharacterId
    ? `/ai-characters/${post.aiCharacterId}`
    : `/profile/${post.authorId}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={authorLink}>
          <Avatar
            src={authorInfo.image}
            alt={authorInfo.name}
            size="md"
            isAi={authorInfo.isAi}
            isSystem={authorInfo.isSystem}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={authorLink} className="font-semibold text-sm hover:underline">
              {authorInfo.name}
            </Link>
            {authorInfo.isAi && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                authorInfo.isSystem
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              )}>
                {authorInfo.isSystem ? "시스템 AI" : "유저 AI"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatRelativeTime(new Date(post.createdAt))}
          </p>
        </div>
        {post.authorId === session?.user?.id && (
          <button
            onClick={() => {
              if (confirm("정말 삭제하시겠습니까?")) deleteMutation.mutate();
            }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <Link href={`/post/${post.id}`}>
        <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>
      </Link>

      {/* Images */}
      {post.images.length > 0 && (
        <div className={cn(
          "mt-3 gap-1 rounded-lg overflow-hidden",
          post.images.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2"
        )}>
          {post.images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt=""
              className="w-full h-48 object-cover"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => likeMutation.mutate()}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500"
          )}
        >
          <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          <span>{post.likeCount}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-500 transition-colors"
        >
          <MessageCircle size={18} />
          <span>{post.commentCount}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {/* Existing comments */}
          <div className="space-y-3 mb-3">
            {post.comments.map((comment) => {
              const cAuthor = getAuthorInfo(comment);
              return (
                <div key={comment.id} className="flex gap-2">
                  <Avatar src={cAuthor.image} alt={cAuthor.name} size="sm" isAi={cAuthor.isAi} isSystem={cAuthor.isSystem} />
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{cAuthor.name}</span>
                      {cAuthor.isAi && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">AI</span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {formatRelativeTime(new Date(comment.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{comment.content}</p>
                  </div>
                </div>
              );
            })}
            {post.commentCount > 3 && (
              <Link
                href={`/post/${post.id}`}
                className="text-sm text-amber-600 hover:text-amber-700 ml-10"
              >
                댓글 {post.commentCount}개 모두 보기
              </Link>
            )}
          </div>

          {/* Comment input */}
          {session?.user && (
            <div className="flex gap-2 items-end">
              <Textarea
                placeholder="댓글을 입력하세요..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={1}
                className="text-sm"
              />
              <Button
                size="icon"
                onClick={() => commentMutation.mutate()}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="shrink-0"
              >
                <Send size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
