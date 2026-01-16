import { colors, radii } from './tokens';

export const glass = {
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.borderGlass,
    borderWidth: 1,
    borderRadius: radii.card,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  container: {
    backgroundColor: colors.glass,
    borderColor: colors.borderGlass,
    borderWidth: 1,
    borderRadius: radii.card,
  },
  interactive: {
    backgroundColor: "rgba(255,255,255,0.09)", // slightly brighter for press states
    borderColor: colors.borderGlass,
    borderWidth: 1,
    borderRadius: radii.card,
  },
} as const;
