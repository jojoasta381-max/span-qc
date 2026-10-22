"use client";

import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DemoRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoRequestModal({ isOpen, onClose }: DemoRequestModalProps) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setEmail("");
    setCompany("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md p-6 sm:p-8 glass-panel text-[#eaf1ff] border border-[rgba(80,130,220,0.3)] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-xl font-semibold text-[#eaf1ff] tracking-tight">
            Request a Demo
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-[#a9b8d3] hover:text-[#eaf1ff] rounded-md hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-[#a9b8d3] leading-relaxed">
              Experience automated quality control of wiring diagrams against engineering standards.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="modal-email" className="text-xs font-semibold uppercase tracking-wider text-[#7f93b8]">
                Work Email
              </label>
              <input
                id="modal-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@company.com"
                className="h-11 px-3.5 bg-[rgba(5,10,23,0.8)] border border-[rgba(80,130,220,0.3)] rounded-lg text-sm text-[#eaf1ff] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="modal-org" className="text-xs font-semibold uppercase tracking-wider text-[#7f93b8]">
                Company / Organization
              </label>
              <input
                id="modal-org"
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Industrial Equipment Manufacturing"
                className="h-11 px-3.5 bg-[rgba(5,10,23,0.8)] border border-[rgba(80,130,220,0.3)] rounded-lg text-sm text-[#eaf1ff] focus:outline-none focus:ring-2 focus:ring-[#2f8cff]"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" className="w-full h-11 bg-[#2f8cff] text-[#05101f] hover:bg-[#4ba0ff] font-semibold">
                Submit Request
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-4 animate-in fade-in">
            <CheckCircle2 className="w-10 h-10 text-[#1ed6a0]" />
            <h3 className="text-base font-semibold text-[#eaf1ff]">Demo Request Received</h3>
            <p className="text-sm text-[#a9b8d3] leading-relaxed">
              Our engineering team will reach out to <span className="text-[#eaf1ff] font-medium">{email}</span> with access details.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={handleClose}
              className="mt-3 h-10 px-6 bg-[#2f8cff] text-[#05101f] hover:bg-[#4ba0ff]"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
