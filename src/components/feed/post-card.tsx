"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Trash2, Send, Reply, CornerDownRight } from "lucide-react";
import { cn, formatRelativeTime, getAuthorInfo } from "@/lib/utils";
import { isVideoUrl } from "@/lib/media-utils";
import type { PostWithRelations, CommentWithRelations } from "@/types";

function renderContentWithHashtags(content: string) {
  const parts = content.split(/(#[a-zA-Z0-9가-힣_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#") && part.length > 1) {
      const tag = part.slice(1).toLowerCase();
      return (
        <Link
          key={i}
          href={`/feed?hashtag=${encodeURIComponent(tag)}`}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

// 댓글을 트리 구조로 변환 (parentId 기반)
function buildCommentTree(comments: CommentWithRelations[]): CommentWithRelations[] {
  const map = new Map<string, CommentWithRelations>();
  const roots: CommentWithRelations[] = [];

  // 모든 댓글에 replies 배열 초기화
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// 단일 댓글 컴포넌트
function CommentItem({
  comment,
  depth,
  onReply,
  replyingTo,
}: {
  comment: CommentWithRelations;
  depth: number;
  onReply: (commentId: string, authorName: string) => void;
  replyingTo: string | null;
}) {
  const cAuthor = getAuthorInfo(comment);
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div>
      <div className={cn("flex gap-2", depth > 0 && "ml-8")}>
        {depth > 0 && (
          <CornerDownRight size={14} className="text-gray-300 mt-2 shrink-0" />
        )}
        <Avatar src={cAuthor.image} alt={cAuthor.name} size="sm" isAi={cAuthor.isAi} isSystem={cAuthor.isSystem} />
        <div className={cn(
          "flex-1 rounded-lg px-3 py-2",
          replyingTo === comment.id ? "bg-amber-50 border border-amber-200" : "bg-gray-50"
        )}>
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
          <button
            onClick={() => onReply(comment.id, cAuthor.name)}
            className="text-[11px] text-gray-400 hover:text-amber-500 mt-1 flex items-center gap-1 transition-colors"
          >
            <Reply size={12} />
            답글
          </button>
        </div>
      </div>
      {/* 대댓글 재귀 렌더링 */}
      {hasReplies && (
        <div className="space-y-2 mt-2">
          {comment.replies!.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={Math.min(depth + 1, 2)}
              onReply={onReply}
              replyingTo={replyingTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PostCard({ post }: { post: PostWithRelations }) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authorInfo = getAuthorInfo(post);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  const [allComments, setAllComments] = useState<CommentWithRelations[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

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
        body: JSON.stringify({
          content: commentText,
          postId: post.id,
          parentId: replyingTo,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      setReplyingTo(null);
      setReplyingToName(null);
      // 전체 댓글이 로드된 상태면 다시 갱신
      if (allComments) loadAllComments();
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
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

  const handleReply = (commentId: string, authorName: string) => {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    setReplyingTo(commentId);
    setReplyingToName(authorName);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyingToName(null);
  };

  const authorLink = post.aiCharacterId
    ? `/ai-characters/${post.aiCharacterId}`
    : `/profile/${post.authorId}`;

  const loadAllComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`);
      if (res.ok) {
        const data = await res.json();
        setAllComments(data.comments || []);
      }
    } catch { /* ignore */ }
    setLoadingComments(false);
  };

  // 댓글을 트리 구조로 변환
  const displayComments = allComments ?? post.comments;
  const commentTree = buildCommentTree(displayComments);

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
          {renderContentWithHashtags(post.content)}
        </p>
      </Link>

      {/* Media */}
      {post.images.length > 0 && (
        <div className={cn(
          "mt-3 gap-1 rounded-lg overflow-hidden",
          post.images.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2"
        )}>
          {post.images.map((url, i) =>
            isVideoUrl(url) ? (
              <video
                key={i}
                src={url}
                controls
                preload="metadata"
                className="w-full h-48 object-cover bg-black"
              />
            ) : (
              <img
                key={i}
                src={url}
                alt=""
                className="w-full h-48 object-cover"
              />
            )
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!session?.user) {
              router.push("/login");
              return;
            }
            likeMutation.mutate();
          }}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500"
          )}
        >
          <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
          <span>{post.likeCount}</span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-500 transition-colors"
        >
          <MessageCircle size={18} />
          <span>{post.commentCount}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
          {/* 댓글 트리 */}
          <div className="space-y-2 mb-3">
            {commentTree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                onReply={handleReply}
                replyingTo={replyingTo}
              />
            ))}
            {post.commentCount > 3 && !allComments && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); loadAllComments(); }}
                disabled={loadingComments}
                className="text-sm text-amber-600 hover:text-amber-700 ml-10 disabled:opacity-50"
              >
                {loadingComments ? "불러오는 중..." : `댓글 ${post.commentCount}개 모두 보기`}
              </button>
            )}
          </div>

          {/* 댓글 입력 */}
          {session?.user && (
            <div onClick={(e) => e.stopPropagation()}>
              {/* 답글 대상 표시 */}
              {replyingTo && replyingToName && (
                <div className="flex items-center gap-2 mb-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <Reply size={12} />
                  <span>{replyingToName}에게 답글 작성 중</span>
                  <button onClick={cancelReply} className="ml-auto text-gray-400 hover:text-gray-600">
                    ✕
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <Textarea
                  placeholder={replyingTo ? `${replyingToName}에게 답글...` : "댓글을 입력하세요..."}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
