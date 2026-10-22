"use client";

import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={twMerge(
              clsx(
                "w-full bg-[#0c101a] text-slate-100 placeholder:text-slate-500",
                "border border-[#1b253b] rounded-xl text-sm px-3.5 py-2.5 transition-all duration-200",
                "focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                leftIcon ? "pl-10" : "",
                rightIcon ? "pr-10" : "",
                error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/25" : "",
                className
              )
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-slate-400 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-400 mt-1.5">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
