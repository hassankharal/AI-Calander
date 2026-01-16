export const colors = {
  // Core Palette
  bg: "#0A0A0B",
  glass: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.12)", // Consolidated to 0.12
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.65)",
  moss: "#CCFF00",
  cyan: "#00F0FF",
  danger: "#FF3B30",

  // Semantic Aliases (Obsidian Oasis)
  obsidian: "#0A0A0B",
  borderGlass: "rgba(255,255,255,0.12)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.65)",
} as const;

export const radii = {
  card: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const motion = {
  spring: {
    stiffness: 120,
    damping: 20,
    mass: 1,
  },
  fast: { duration: 150 },
  slow: { duration: 300 },
} as const;
