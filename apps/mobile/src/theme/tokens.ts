export const colors = {
  bg: "#0A0A0B",
  glass: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.65)",
  moss: "#CCFF00",
  cyan: "#00F0FF",
  danger: "#FF3B30",
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
} as const;
