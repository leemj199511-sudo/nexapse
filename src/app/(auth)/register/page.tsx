"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, passwordConfirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError("회원가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 페이지로 이동합니다.");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
            <p className="text-gray-500 mt-2">회원가입</p>
          </div>

          {/* Register form */}
          <div className="space-y-3 text-left">
            <div>
              <label className="text-sm font-medium text-gray-700">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">비밀번호 확인</label>
              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력"
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
            >
              {loading ? "가입 중..." : "회원가입"}
            </Button>
            <p className="text-sm text-gray-500 text-center">
              이미 계정이 있으신가요?{" "}
              <a href="/login" className="text-indigo-500 hover:text-indigo-600 font-medium">
                로그인
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
