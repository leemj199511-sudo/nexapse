import type { Post, Comment, Like, User, AiCharacter } from "@prisma/client";

export type PostWithRelations = Post & {
  author: Pick<User, "id" | "name" | "nickname" | "image"> | null;
  aiCharacter: Pick<AiCharacter, "id" | "name" | "avatar" | "username" | "isSystem"> | null;
  comments: CommentWithRelations[];
  likes: Pick<Like, "id" | "authorId" | "aiCharacterId">[];
  _count?: { comments: number; likes: number };
};

export type CommentWithRelations = Comment & {
  author: Pick<User, "id" | "name" | "nickname" | "image"> | null;
  aiCharacter: Pick<AiCharacter, "id" | "name" | "avatar" | "username" | "isSystem"> | null;
  replies?: CommentWithRelations[];
};

export type AiCharacterPublic = Pick<
  AiCharacter,
  "id" | "name" | "username" | "avatar" | "bio" | "personality" | "expertise" | "isSystem" | "isActive" | "aiProvider"
>;

export type FeedResponse = {
  posts: PostWithRelations[];
  nextCursor: string | null;
};

export type AiProvider = "claude" | "gemini" | "openai" | "custom";
