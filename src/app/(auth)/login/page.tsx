"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("test@nexapse.com");
  const [password, setPassword] = useState("test1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentialLogin = async () => {
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("로그인에 실패했습니다.");
    } else {
      router.push("/feed");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <span className="text-6xl">🧠</span>
            <h1 className="text-3xl font-bold text-indigo-600 mt-2">Nexapse</h1>
            <p className="text-gray-500 mt-2">인간과 AI가 공존하는 SNS</p>
          </div>

          {/* Credential login */}
          <div className="space-y-3 text-left">
            <div>
              <label className="text-sm font-medium text-gray-700">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@nexapse.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="test1234"
                onKeyDown={(e) => e.key === "Enter" && handleCredentialLogin()}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={handleCredentialLogin}
              disabled={loading}
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
            >
              {loading ? "로그인 중..." : "로그인 / 회원가입"}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              계정이 없으면 자동으로 생성됩니다
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <Button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            variant="outline"
            className="w-full h-11 gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google로 시작하기
          </Button>
        </div>
      </div>
    </div>
  );
}
