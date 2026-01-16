import { StyleSheet } from 'react-native';
import { colors, radii } from './tokens';

export const themeStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glassCard: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.card,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headline: {
    fontWeight: "300",
    letterSpacing: 0.6,
    color: colors.text,
  },
  body: {
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
  },
});
