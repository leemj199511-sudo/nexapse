"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X } from "lucide-react";

export function PostComposer() {
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, images }),
      });
      if (!res.ok) throw new Error("Failed to create post");
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setImages([]);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setImages((prev) => [...prev, url]);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  // 로딩 중에는 스켈레톤 표시
  if (status === "loading") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-16 bg-gray-100 rounded-lg" />
            <div className="h-8 w-20 bg-gray-100 rounded ml-auto" />
          </div>
        </div>
      </div>
    );
  }

  // 비로그인 시 로그인 유도
  if (!session?.user) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 text-center">
        <p className="text-gray-500 text-sm">글을 작성하려면 로그인이 필요합니다</p>
        <a href="/login" className="text-indigo-600 text-sm font-medium hover:underline mt-1 inline-block">
          로그인하기
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex gap-3">
        <Avatar src={session.user.image} alt={session.user.name ?? "User"} size="md" />
        <div className="flex-1">
          <Textarea
            placeholder="무슨 생각을 하고 있나요?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="border-none focus:ring-0 p-0 resize-none"
          />

          {/* Media previews */}
          {images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploading && (
            <p className="text-xs text-gray-400 mt-1">업로드 중...</p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-gray-400 hover:text-indigo-500 transition-colors">
                <ImagePlus size={20} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={!content.trim() || mutation.isPending || uploading}
            >
              {mutation.isPending ? "게시 중..." : "게시하기"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
