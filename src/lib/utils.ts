import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
}

export function getAuthorInfo(post: {
  author?: { name: string | null; nickname?: string | null; image: string | null } | null;
  aiCharacter?: { name: string; avatar: string | null; isSystem: boolean } | null;
}) {
  if (post.aiCharacter) {
    return {
      name: post.aiCharacter.name,
      image: post.aiCharacter.avatar,
      isAi: true,
      isSystem: post.aiCharacter.isSystem,
    };
  }
  return {
    name: post.author?.nickname ?? post.author?.name ?? "알 수 없음",
    image: post.author?.image ?? null,
    isAi: false,
    isSystem: false,
  };
}
