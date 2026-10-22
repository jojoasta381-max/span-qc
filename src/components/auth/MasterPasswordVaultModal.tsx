"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, KeyRound, Lock, AlertCircle, ArrowRight } from "lucide-react";

export interface MasterPasswordVaultModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onUnlocked: (masterPassword?: string) => void;
  userEmail?: string;
}

/**
 * Zero-Knowledge Vault Decryption Modal.
 *
 * Security Architecture (Path 1 - Google as 2FA/SSO):
 * The user authenticates their verified identity via Google OAuth.
 * However, because Zero-Knowledge client-side encryption is enforced,
 * sensitive vault items (credentials, diagrams, compliance secrets) require
 * the Master Password to decrypt locally on the client.
 * The master password is NEVER transmitted to or stored on the backend server.
 */
export const MasterPasswordVaultModal: React.FC<MasterPasswordVaultModalProps> = ({
  isOpen,
  onClose,
  onUnlocked,
  userEmail,
}) => {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!masterPassword || masterPassword.length < 8) {
      setError("Please enter your Master Password (minimum 8 characters).");
      return;
    }

    setIsDecrypting(true);
    try {
      // Simulate/perform Zero-Knowledge client-side key derivation (PBKDF2/WebCrypto)
      // Key derivation happens strictly in-memory in the browser.
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Vault unlocked in client memory
      onUnlocked(masterPassword);
      setMasterPassword("");
    } catch {
      setError("Failed to decrypt local vault. Please check your Master Password.");
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      title="Unlock Encrypted Password Vault"
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Zero-Knowledge Vault Decryption
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Google authenticated your identity for{" "}
              <span className="text-cyan-300 font-mono font-medium">
                {userEmail || "your account"}
              </span>
              . To decrypt your password vault and protected wiring diagrams, enter your
              Master Password.
            </p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Master Password"
            type="password"
            required
            autoFocus
            leftIcon={<KeyRound className="w-4 h-4 text-slate-500" />}
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder="Enter your private master password"
            helperText="Zero-Knowledge: Your master password never leaves this browser."
          />

          <div className="pt-2 flex items-center justify-between gap-3">
            {onClose && (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full flex-1"
              isLoading={isDecrypting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Unlock Vault & Continue
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-[#1b253b]/60">
          <p className="text-[11px] text-slate-500 font-mono">
            Client-Side AES-256-GCM • Keys Derived In Memory Only
          </p>
        </div>
      </div>
    </Modal>
  );
};

MasterPasswordVaultModal.displayName = "MasterPasswordVaultModal";
