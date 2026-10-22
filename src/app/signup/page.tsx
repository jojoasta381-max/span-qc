"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Rocket, Mail, Lock, User, Building, ArrowRight, ShieldCheck } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your work email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim() || "User",
        organization_name: company.trim() || undefined,
      });
      router.push("/app");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col justify-center items-center p-4 bg-cosmic-mesh">
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Create Organization Account</h1>
          <p className="text-xs text-slate-400 mt-1">
            Start automating wiring diagram quality checks for your organization.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-2xl shadow-black/80 space-y-5">
          {/* Brand-compliant Official Google Sign-In */}
          <GoogleSignInButton
            text="signup_with"
            redirectUrl="/app"
            onError={(err) => setError(err)}
          />

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-[#1b253b] w-full" />
            <span className="bg-[#0c101a] px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider relative shrink-0">
              or register with organization email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}
            <Input
              label="Full Name"
              required
              leftIcon={<User className="w-4 h-4 text-slate-500" />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
            />

            <Input
              label="Company / Organization Name"
              required
              leftIcon={<Building className="w-4 h-4 text-slate-500" />}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Apex Avionics Pvt. Ltd."
            />

            <Input
              label="Work Email"
              type="email"
              required
              leftIcon={<Mail className="w-4 h-4 text-slate-500" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rajesh@apexavionics.com"
            />

            <Input
              label="Password"
              type="password"
              required
              leftIcon={<Lock className="w-4 h-4 text-slate-500" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />

            <div className="text-[11px] text-slate-400 leading-relaxed">
              By creating an account, you agree to the{" "}
              <Link href="/security" className="text-cyan-400 hover:underline">
                Security Policy
              </Link>{" "}
              and Tenant Data Agreement.
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Get Started
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1b253b] flex items-center justify-between text-xs text-slate-400">
            <span>Already have an account?</span>
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted with TLS 1.3 & AES-256 • Tenant Partitioned</span>
        </div>
      </div>
    </div>
  );
}
