"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Rocket, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl =
    searchParams.get("redirect") || searchParams.get("callbackUrl") || "/app";
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter both your work email and password.");
      return;
    }
    try {
      await login(email.trim(), password);
      router.push(redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <div className="p-8 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-2xl shadow-black/80 space-y-5">
      {/* Brand-compliant Official Google Sign-In */}
      <GoogleSignInButton
        text="signin_with"
        redirectUrl={redirectUrl}
        onError={(err) => setError(err)}
      />

      <div className="relative flex items-center justify-center my-2">
        <div className="border-t border-[#1b253b] w-full" />
        <span className="bg-[#0c101a] px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider relative shrink-0">
          or sign in with credentials
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <Input
          label="Work Email"
          type="email"
          required
          leftIcon={<Mail className="w-4 h-4 text-slate-500" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            required
            leftIcon={<Lock className="w-4 h-4 text-slate-500" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full mt-2"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In to Workspace
        </Button>
      </form>


      <div className="mt-6 pt-5 border-t border-[#1b253b] flex items-center justify-between text-xs text-slate-400">
        <span>Don&apos;t have an account?</span>
        <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-center items-center p-4 bg-cosmic-mesh"
      suppressHydrationWarning
    >
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 via-blue-600/30 to-purple-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10 group-hover:scale-105 transition-all">
              <Rocket className="w-5 h-5 -rotate-45 text-cyan-400" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white font-mono tracking-tight">SPANQC</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold uppercase">
                  BY SPANDSONS
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight">AI-Assisted Wiring Diagram QC</span>
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sign in to Launchpad™</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access organization wiring diagrams, reports, and compliance rules.
          </p>
        </div>

        <Suspense fallback={<div className="p-8 h-64 rounded-3xl bg-[#0c101a] border border-[#1b253b] animate-pulse" />}>
          <LoginForm />
        </Suspense>

        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted with TLS 1.3 & AES-256 • Tenant Partitioned</span>
        </div>
      </div>
    </div>
  );
}
