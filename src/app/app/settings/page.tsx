"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import {
  User,
  Shield,
  Building,
  Bell,
  CheckCircle2,
  Lock,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const { user, organization } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile state
  const [name, setName] = useState(user?.full_name || "Pravin Sundaram");
  const [email] = useState(user?.email || "pravin@spandsons.com");
  const [profileSaved, setProfileSaved] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Organization state
  const [orgName, setOrgName] = useState(organization?.name || "Spandsons Horizon Engineering Pvt. Ltd.");
  const [orgSlug] = useState(organization?.slug || "spandsons-horizon");

  // Notification toggles
  const [notifyReportComplete, setNotifyReportComplete] = useState(true);
  const [notifyCriticalDefects, setNotifyCriticalDefects] = useState(true);
  const [notifyQuotaWarning, setNotifyQuotaWarning] = useState(true);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handlePasswordSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-3.5 h-3.5" /> },
    { id: "security", label: "Security & Passwords", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "organization", label: "Organization Details", icon: <Building className="w-3.5 h-3.5" /> },
    { id: "notifications", label: "Notification Preferences", icon: <Bell className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#1b253b] pb-5">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Account & Organization Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage your engineering identity, security credentials, and organization preferences.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-xl">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono pb-2 border-b border-[#1b253b]">
              Personal Engineering Profile
            </h3>

            <div className="flex items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-300 font-bold text-lg">
                {name ? name[0] : "P"}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{name}</p>
                <p className="text-xs text-cyan-400 font-mono">Role: {user?.role || "ADMIN"}</p>
              </div>
            </div>

            <Input
              label="Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Work Email"
              type="email"
              disabled
              value={email}
              helperText="Email changes require organization administrator verification."
            />

            <div className="pt-2 flex items-center justify-between">
              <Button type="submit" variant="primary" size="sm">
                Save Profile Changes
              </Button>
              {profileSaved && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved successfully
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-xl space-y-6">
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono pb-2 border-b border-[#1b253b]">
              Change Password
            </h3>

            <Input
              label="Current Password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <Input
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />

            <div className="pt-2 flex items-center justify-between">
              <Button type="submit" variant="primary" size="sm">
                Update Password
              </Button>
              {passwordSaved && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Password updated
                </span>
              )}
            </div>
          </form>

          <div className="pt-6 border-t border-[#1b253b] space-y-3">
            <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Two-Factor Authentication (2FA)
            </h4>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#070b14] border border-[#1b253b]">
              <div>
                <p className="text-xs font-semibold text-white">Authenticator App (TOTP)</p>
                <p className="text-[11px] text-slate-400">Secure drawing access with 6-digit verification codes.</p>
              </div>
              <Button variant="outline" size="xs">
                Configure 2FA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Organization Tab */}
      {activeTab === "organization" && (
        <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono pb-2 border-b border-[#1b253b]">
            Organization Profile
          </h3>

          <Input
            label="Legal Entity Name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />

          <Input
            label="Organization Workspace Slug"
            disabled
            value={orgSlug}
            helperText="Used for tenant-isolated URLs and cryptographic report signatures."
          />

          <div className="p-4 rounded-2xl bg-[#070b14] border border-[#1b253b] text-xs space-y-1">
            <span className="font-mono text-cyan-400 block font-bold">ORGANIZATION IDENTIFIER</span>
            <span className="font-mono text-slate-300">org-spandsons-horizon-001</span>
          </div>

          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => alert("Organization details updated.")}>
              Save Organization
            </Button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono pb-2 border-b border-[#1b253b]">
            Email & In-App Notification Rules
          </h3>

          <div className="space-y-4 text-xs">
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#070b14] border border-[#1b253b] cursor-pointer">
              <div>
                <p className="font-semibold text-white">Automated QC Run Complete</p>
                <p className="text-slate-400 text-[11px]">Receive an email when schematic ingestion and rule execution finishes.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyReportComplete}
                onChange={(e) => setNotifyReportComplete(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#070b14] border border-[#1b253b] cursor-pointer">
              <div>
                <p className="font-semibold text-white">Critical Defect Alerts</p>
                <p className="text-slate-400 text-[11px]">Immediate notification when IPC/WHMA-A-620 Class 3 critical violations are detected.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyCriticalDefects}
                onChange={(e) => setNotifyCriticalDefects(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#070b14] border border-[#1b253b] cursor-pointer">
              <div>
                <p className="font-semibold text-white">Monthly Quota Warnings</p>
                <p className="text-slate-400 text-[11px]">Alert when remaining monthly diagram checks fall below 15%.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyQuotaWarning}
                onChange={(e) => setNotifyQuotaWarning(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </label>
          </div>

          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={() => alert("Notification preferences saved.")}>
              Save Preferences
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
