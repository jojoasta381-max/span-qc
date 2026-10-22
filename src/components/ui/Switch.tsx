"use client";

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SwitchProps {
  id?: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  id,
  name,
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = "md",
  className,
}) => {
  const switchId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const toggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  const trackSizes = {
    sm: "w-8 h-4.5 px-0.5",
    md: "w-11 h-6 px-0.5",
    lg: "w-14 h-7.5 px-1",
  };

  const thumbSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const thumbTranslates = {
    sm: checked ? "translate-x-3.5" : "translate-x-0",
    md: checked ? "translate-x-5" : "translate-x-0",
    lg: checked ? "translate-x-6.5" : "translate-x-0",
  };

  return (
    <div className={twMerge("flex items-start justify-between gap-4", className)}>
      {(label || description) && (
        <div className="flex flex-col cursor-pointer select-none" onClick={toggle}>
          {label && (
            <label
              htmlFor={switchId}
              className={clsx(
                "text-sm font-semibold tracking-tight transition-colors",
                disabled ? "text-slate-500" : "text-white hover:text-cyan-300"
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        id={switchId}
        name={name}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={clsx(
          "relative inline-flex shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-[#070b14]",
          trackSizes[size],
          checked
            ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20"
            : "bg-slate-800 border border-[#1b253b]",
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
            thumbSizes[size],
            thumbTranslates[size]
          )}
        />
      </button>
    </div>
  );
};

Switch.displayName = "Switch";
