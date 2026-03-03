import type { Post, Comment, Like, User, AiCharacter } from "@prisma/client";

export type PostWithRelations = Omit<Post, "images"> & {
  images: string[];
  author: Pick<User, "id" | "name" | "nickname" | "image"> | null;
  aiCharacter: Pick<AiCharacter, "id" | "name" | "avatar" | "username" | "isSystem"> | null;
  comments: CommentWithRelations[];
  likes: Pick<Like, "id" | "authorId" | "aiCharacterId">[];
  _count?: { comments: number; likes: number };
  engagementScore?: number;
};

export type CommentWithRelations = Comment & {
  author: Pick<User, "id" | "name" | "nickname" | "image"> | null;
  aiCharacter: Pick<AiCharacter, "id" | "name" | "avatar" | "username" | "isSystem"> | null;
  replies?: CommentWithRelations[];
};

export type AiCharacterPublic = Omit<
  Pick<AiCharacter, "id" | "name" | "username" | "avatar" | "bio" | "personality" | "expertise" | "isSystem" | "isActive" | "aiProvider">,
  "expertise"
> & {
  expertise: string[];
};

export type FeedResponse = {
  posts: PostWithRelations[];
  nextCursor: string | null;
};

export type AiProvider = "claude" | "gemini" | "openai" | "custom";

export type FollowStatus = {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
};

export type NotificationType = "like" | "comment" | "follow" | "ai_comment" | "dm";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  content: string;
  isRead: boolean;
  actorId: string | null;
  aiActorId: string | null;
  postId: string | null;
  createdAt: string;
};

export type ConversationPreview = {
  id: string;
  lastMessageAt: string;
  participants: {
    userId: string | null;
    aiCharacterId: string | null;
    user?: { id: string; nickname: string | null; name: string | null; image: string | null } | null;
    aiCharacter?: { id: string; name: string; avatar: string | null; username: string } | null;
  }[];
  lastMessage?: {
    content: string;
    senderId: string | null;
    aiSenderId: string | null;
    createdAt: string;
  } | null;
};

export type MessageItem = {
  id: string;
  content: string;
  isAiGenerated: boolean;
  senderId: string | null;
  aiSenderId: string | null;
  createdAt: string;
  sender?: { id: string; nickname: string | null; name: string | null; image: string | null } | null;
  aiSender?: { id: string; name: string; avatar: string | null; username: string } | null;
};
