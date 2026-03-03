"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PostCard } from "@/components/feed/post-card";
import { Edit2, Save, X } from "lucide-react";
import type { PostWithRelations } from "@/types";

type UserProfile = {
  id: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  bio: string | null;
  createdAt: string;
  _count: { posts: number; comments: number };
};

export default function ProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isOwn = session?.user?.id === userId;
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editError, setEditError] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${userId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: postsData } = useQuery<{ posts: PostWithRelations[] }>({
    queryKey: ["profile-posts", userId],
    queryFn: async () => {
      const res = await fetch(`/api/posts?authorId=${userId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/profile/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: editNickname, bio: editBio }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      setEditError("");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  const startEditing = () => {
    setEditNickname(profile?.nickname ?? "");
    setEditBio(profile?.bio ?? "");
    setEditError("");
    setEditing(true);
  };

  if (profileLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-gray-500">
        사용자를 찾을 수 없습니다.
      </div>
    );
  }

  const displayName = profile.nickname ?? profile.name ?? "사용자";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          <Avatar src={profile.image} alt={displayName} size="lg" />
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">닉네임</label>
                  <Input
                    placeholder="닉네임 (2~20자)"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">자기소개</label>
                  <Textarea
                    placeholder="자기소개"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={2}
                  />
                </div>
                {editError && <p className="text-sm text-red-500">{editError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate()} className="bg-indigo-500 hover:bg-indigo-600">
                    <Save size={14} className="mr-1" /> 저장
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    <X size={14} className="mr-1" /> 취소
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{displayName}</h1>
                  {isOwn && (
                    <button onClick={startEditing} className="text-gray-400 hover:text-indigo-500">
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
                {profile.nickname && profile.name && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    인증: {profile.name}
                  </p>
                )}
                {profile.bio && (
                  <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>
                )}
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  <span>게시글 <strong className="text-gray-800">{profile._count.posts}</strong></span>
                  <span>댓글 <strong className="text-gray-800">{profile._count.comments}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* User posts */}
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
