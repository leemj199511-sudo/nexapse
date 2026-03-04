"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // 타이머 카운트다운
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Step 1: 인증번호 발송
  const handleSendCode = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setStep(2);
      setTimer(300); // 5분
    } catch {
      setError("인증번호 발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  // Step 2: 인증번호 확인
  const handleVerifyCode = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setStep(3);
    } catch {
      setError("인증번호 확인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [email, code]);

  // Step 3: 회원가입
  const handleRegister = useCallback(async () => {
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
        setError(data.error);
        return;
      }

      // 자동 로그인
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError(
          "회원가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 페이지로 이동합니다."
        );
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
  }, [email, password, passwordConfirm, router]);

  // 재발송
  const handleResend = async () => {
    setCode("");
    await handleSendCode();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <span className="text-6xl">&#x1f9e0;</span>
            <h1 className="text-3xl font-bold text-indigo-600 mt-2">
              Nexapse
            </h1>
            <p className="text-gray-500 mt-2">회원가입</p>
          </div>

          {/* 단계 표시 */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === step
                    ? "bg-indigo-500 text-white"
                    : s < step
                      ? "bg-indigo-200 text-indigo-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {s}
              </div>
            ))}
          </div>

          <div className="space-y-3 text-left">
            {/* Step 1: 이메일 */}
            {step === 1 && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    이메일
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  onClick={handleSendCode}
                  disabled={loading || !email}
                  className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
                >
                  {loading ? "발송 중..." : "인증번호 발송"}
                </Button>
              </>
            )}

            {/* Step 2: 인증번호 입력 */}
            {step === 2 && (
              <>
                <p className="text-sm text-gray-600 text-center">
                  <strong>{email}</strong>으로 인증번호를 발송했습니다.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    인증번호 (6자리)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.3em]"
                    onKeyDown={(e) =>
                      e.key === "Enter" && code.length === 6 && handleVerifyCode()
                    }
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={timer <= 60 ? "text-red-500" : "text-gray-500"}>
                    남은 시간: {formatTime(timer)}
                  </span>
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-indigo-500 hover:text-indigo-600 font-medium"
                  >
                    재발송
                  </button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  onClick={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                  className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
                >
                  {loading ? "확인 중..." : "확인"}
                </Button>
              </>
            )}

            {/* Step 3: 비밀번호 */}
            {step === 3 && (
              <>
                <p className="text-sm text-green-600 text-center font-medium">
                  이메일 인증이 완료되었습니다.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    비밀번호
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6자 이상"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    비밀번호 확인
                  </label>
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
                  disabled={loading || !password || !passwordConfirm}
                  className="w-full h-11 bg-indigo-500 hover:bg-indigo-600"
                >
                  {loading ? "가입 중..." : "회원가입"}
                </Button>
              </>
            )}

            <p className="text-sm text-gray-500 text-center">
              이미 계정이 있으신가요?{" "}
              <a
                href="/login"
                className="text-indigo-500 hover:text-indigo-600 font-medium"
              >
                로그인
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
