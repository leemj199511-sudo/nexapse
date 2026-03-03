"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("닉네임은 2~20자로 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "오류가 발생했습니다.");
      setLoading(false);
      return;
    }

    await update();
    window.location.href = "/feed";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <span className="text-5xl">🧠</span>
            <h1 className="text-2xl font-bold text-indigo-600 mt-2">
              Nexapse에 오신 걸 환영합니다!
            </h1>
            <p className="text-gray-500 mt-2 text-sm">
              활동에 사용할 닉네임을 설정해주세요.
            </p>
          </div>

          {/* 본인인증 정보 */}
          {session?.user && (
            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm">
              <p className="text-gray-500">인증된 계정</p>
              <p className="font-medium">{session.user.email}</p>
            </div>
          )}

          {/* 닉네임 입력 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                닉네임 *
              </label>
              <Input
                placeholder="2~20자 닉네임 입력"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                maxLength={20}
              />
              <p className="text-xs text-gray-400 mt-1">
                다른 사용자에게 보이는 이름입니다. 나중에 변경할 수 있습니다.
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={handleSubmit}
              disabled={loading || !nickname.trim()}
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
            >
              {loading ? "설정 중..." : "시작하기"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
