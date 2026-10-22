"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Check, ShieldAlert, CreditCard, Loader2, Sparkles, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  amountINR: number;
  checksIncluded: number;
  overageRateINR: number;
  isSelfServe: boolean;
  features: string[];
}

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  billingStatus: string;
  isBillingEnabled: boolean;
}

export function RazorpayCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  billingStatus,
  isBillingEnabled,
}: RazorpayCheckoutModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>("production");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInitiateCheckout = async () => {
    setError(null);
    setVerificationSuccess(null);

    if (!isBillingEnabled) {
      setError("Billing is currently NOT_LIVE. Live transactions and charges are disabled.");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create order on server
      const res = await fetch("/api/v1/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create order");
      }

      // 2. In TEST mode or when Razorpay script is unavailable, simulate secure verified test callback
      const options = {
        ...data.checkout,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyRes = await fetch("/api/v1/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: data.order.id,
                providerOrderId: response.razorpay_order_id,
                providerPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.detail || "Payment verification failed.");
            }
            setVerificationSuccess(verifyData.message);
            onSuccess();
          } catch (err: any) {
            setError(err.message);
          }
        },
      };

      // Load Razorpay if present in window, otherwise run test-mode direct verification
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback for test mode without external script
        setError("Razorpay hosted checkout script is not loaded in this environment. Test mode order created.");
      }
    } catch (err: any) {
      setError(err.message || "Checkout error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#0c101a] border border-[#1b253b] p-7 shadow-2xl shadow-cyan-950/20 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <h3 className="text-lg font-extrabold text-white">Upgrade Inspection Plan</h3>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Mode: {billingStatus}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Select an authoritative quality-check quota tier. Transactions are verified cryptographically server-side.
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {verificationSuccess && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{verificationSuccess}</span>
          </div>
        )}

        {/* Plan Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div
            onClick={() => setSelectedPlan("starter")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              selectedPlan === "starter"
                ? "bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Starter</span>
              <span className="text-xs font-mono font-bold text-cyan-400">₹9,999 / mo</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">35 diagram checks included monthly</p>
            <div className="text-[10px] font-mono text-slate-400">₹280 / overage check</div>
          </div>

          <div
            onClick={() => setSelectedPlan("production")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all relative ${
              selectedPlan === "production"
                ? "bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="absolute -top-2.5 right-3 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500 text-black">
              Recommended
            </span>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white">Production Line</span>
              <span className="text-xs font-mono font-bold text-cyan-400">₹24,999 / mo</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">120 diagram checks included monthly</p>
            <div className="text-[10px] font-mono text-slate-400">₹200 / overage check</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1b253b]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleInitiateCheckout}
            disabled={isLoading || !isBillingEnabled}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Proceed to Checkout
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
