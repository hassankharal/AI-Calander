import { glass, borderGlass } from './colors';

export const glassCard = {
  backgroundColor: glass,
  borderColor: borderGlass,
  borderWidth: 1,
  // Note: backdropFilter is web-only/ignored on native unless using specific libraries, 
  // but included for completeness or web-safe fallback if needed.
  backdropFilter: 'blur(10px)', 
};

export const surfaces = {
  glassCard,
};
