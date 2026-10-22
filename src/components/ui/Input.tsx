"use client";

import React, { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      rightElement,
      showPasswordToggle,
      type = "text",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const isPasswordField = type === "password" || showPasswordToggle;
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const actualType = isPasswordField
      ? isPasswordVisible
        ? "text"
        : "password"
      : type;

    const shouldShowToggle =
      (type === "password" && showPasswordToggle !== false) || showPasswordToggle === true;

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
            type={actualType}
            className={twMerge(
              clsx(
                "w-full bg-[#0c101a] text-slate-100 placeholder:text-slate-500",
                "border border-[#1b253b] rounded-xl text-sm px-3.5 py-2.5 transition-all duration-200",
                "focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25",
                "disabled:opacity-50 disabled:cursor-not-allowed font-sans",
                leftIcon ? "pl-10" : "",
                rightIcon || rightElement || shouldShowToggle ? "pr-11" : "",
                error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/25" : "",
                className
              )
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-slate-400 flex items-center">
              {rightElement}
            </div>
          )}
          {!rightElement && rightIcon && !shouldShowToggle && (
            <div className="absolute right-3.5 text-slate-400 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
          {!rightElement && shouldShowToggle && (
            <button
              type="button"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400"
              aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {isPasswordVisible ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-400 mt-1.5">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
