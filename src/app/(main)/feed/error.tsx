"use client";

import { Button } from "@/components/ui/button";

export default function FeedError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <p className="text-4xl mb-4">😵</p>
      <h2 className="text-lg font-semibold mb-2">문제가 발생했습니다</h2>
      <p className="text-sm text-gray-500 mb-4">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
