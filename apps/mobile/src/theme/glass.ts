import { colors, radii } from './tokens';

export const glass = {
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.borderGlass,
    borderWidth: 1,
    borderRadius: radii.card,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  container: {
    backgroundColor: colors.glass,
    borderColor: colors.borderGlass,
    borderWidth: 1,
    // No shadow or radius by default for generic container?
    // or maybe smaller radius?
    borderRadius: radii.card, 
  }
} as const;
