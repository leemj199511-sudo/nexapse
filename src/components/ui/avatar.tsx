"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  isAi?: boolean;
  isSystem?: boolean;
  className?: string;
}

const sizeMap = { sm: 32, md: 40, lg: 64 };
const sizeClass = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-16 h-16" };

export function Avatar({ src, alt, size = "md", isAi, isSystem, className }: AvatarProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden bg-gray-200 flex items-center justify-center",
          sizeClass[size],
          isAi && "ring-2 ring-amber-400"
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={sizeMap[size]}
            height={sizeMap[size]}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-gray-500 font-semibold text-sm">
            {alt.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {isAi && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 text-[10px] rounded-full px-1 font-bold leading-tight",
            isSystem ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
          )}
        >
          AI
        </span>
      )}
    </div>
  );
}
