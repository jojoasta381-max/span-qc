/**
 * SpanQC Centralized Design System Tokens
 * Modeled after Spaceship's modular design system (SDS):
 * Cosmic obsidian surfaces, luminous electric cyan & cobalt blue accents,
 * geometric card structures, floating glass navigation, and deterministic engineering QC severity scale.
 */

export const TOKENS = {
  colors: {
    // Spaceship Cosmic Obsidian Base Surfaces
    surface: {
      deepObsidian: "#06070a",
      cosmicNavy: "#090d1a",
      cardBase: "#0c101a",
      cardElevated: "#111726",
      cardBorder: "#1b253b",
      cardBorderHover: "#2d3d60",
      glowBorder: "rgba(0, 240, 255, 0.4)",
      floatingNav: "rgba(9, 12, 21, 0.88)",
      glassBackdrop: "rgba(6, 7, 10, 0.75)",
    },
    // Spaceship Electric Accents
    accent: {
      cyan: "#00f0ff",
      cyanGlow: "rgba(0, 240, 255, 0.25)",
      cobalt: "#0066ff",
      cobaltLight: "#388bff",
      purplePlasma: "#7928ca",
      cosmicViolet: "#8b5cf6",
    },
    // Neutrals
    slate: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1b253b",
      900: "#0c101a",
      950: "#06070a",
    },
    // Semantic Status Colors
    status: {
      pass: {
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.4)",
        solid: "#10b981",
        text: "#34d399",
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        label: "PASS",
      },
      fail: {
        bg: "rgba(255, 51, 102, 0.12)",
        border: "rgba(255, 51, 102, 0.4)",
        solid: "#ff3366",
        text: "#ff4d79",
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        label: "FAIL",
      },
      warning: {
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.4)",
        solid: "#f59e0b",
        text: "#fbbf24",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        label: "WARNING",
      },
      info: {
        bg: "rgba(0, 240, 255, 0.1)",
        border: "rgba(0, 240, 255, 0.3)",
        solid: "#00f0ff",
        text: "#00f0ff",
        badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
        label: "INFO",
      },
    },
    // Deterministic QC Severity Scale (Real Findings)
    severity: {
      CRITICAL: {
        color: "#ff3366",
        bg: "rgba(255, 51, 102, 0.14)",
        border: "rgba(255, 51, 102, 0.5)",
        badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/40",
        label: "CRITICAL",
        rank: 1,
      },
      MAJOR: {
        color: "#f97316",
        bg: "rgba(249, 115, 22, 0.14)",
        border: "rgba(249, 115, 22, 0.5)",
        badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/40",
        label: "MAJOR",
        rank: 2,
      },
      MINOR: {
        color: "#eab308",
        bg: "rgba(234, 179, 8, 0.14)",
        border: "rgba(234, 179, 8, 0.5)",
        badgeClass: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
        label: "MINOR",
        rank: 3,
      },
      WARNING: {
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.14)",
        border: "rgba(245, 158, 11, 0.5)",
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40",
        label: "WARNING",
        rank: 4,
      },
      INFO: {
        color: "#00f0ff",
        bg: "rgba(0, 240, 255, 0.12)",
        border: "rgba(0, 240, 255, 0.4)",
        badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
        label: "INFO",
        rank: 5,
      },
    },
  },
  typography: {
    fontSans: '"Pixelify Sans", system-ui, -apple-system, sans-serif',
    fontMono: '"Pixelify Sans", monospace',
    scale: {
      display: "clamp(2.5rem, 5vw, 4.5rem)",
      h1: "clamp(2rem, 3.5vw, 3rem)",
      h2: "clamp(1.5rem, 2.5vw, 2.25rem)",
      h3: "1.25rem",
      h4: "1rem",
      body: "0.875rem",
      small: "0.75rem",
      micro: "0.6875rem",
    },
  },
  radius: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "22px",
    full: "9999px",
  },
  motion: {
    easing: {
      organic: [0.16, 1, 0.3, 1], // Spaceship organic easing
      sharp: [0.4, 0, 0.2, 1],   // Instant feedback
      bounce: [0.34, 1.56, 0.64, 1],
    },
    duration: {
      instant: 0.1,
      quick: 0.2,
      medium: 0.35,
      deliberate: 0.6,
    },
  },
  spacing: {
    gutter: "1.5rem",
    maxContent: "80rem", // 1280px
  },
} as const;
