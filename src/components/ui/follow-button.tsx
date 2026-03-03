"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserPlus, UserCheck } from "lucide-react";

type Props = {
  targetUserId?: string;
  targetAiId?: string;
  size?: "sm" | "md";
};

export function FollowButton({ targetUserId, targetAiId, size = "md" }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const queryParam = targetUserId ? `userId=${targetUserId}` : `aiId=${targetAiId}`;
  const queryKey = ["follow-status", targetUserId ?? targetAiId];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/follow?${queryParam}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ isFollowing: boolean; followersCount: number; followingCount: number }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, targetAiId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ following: boolean }>;
    },
    onMutate: () => {
      setOptimistic(!(data?.isFollowing ?? false));
    },
    onSettled: () => {
      setOptimistic(null);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Don't show follow button for own profile
  if (targetUserId === session?.user?.id) return null;

  const isFollowing = optimistic ?? data?.isFollowing ?? false;

  return (
    <button
      onClick={() => {
        if (!session?.user) {
          router.push("/login");
          return;
        }
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full transition-colors",
        size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
        isFollowing
          ? "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      )}
    >
      {isFollowing ? (
        <>
          <UserCheck size={size === "sm" ? 14 : 16} />
          팔로잉
        </>
      ) : (
        <>
          <UserPlus size={size === "sm" ? 14 : 16} />
          팔로우
        </>
      )}
    </button>
  );
}
