import { Platform } from 'react-native';
import { colors } from './tokens';

export const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

export const headline = {
  fontFamily,
  fontWeight: '300' as const,
  letterSpacing: 0.6,
  color: colors.textPrimary,
  fontSize: 24, // Default headline size?
};

export const body = {
  fontFamily,
  fontWeight: '400' as const,
  color: colors.textPrimary,
  fontSize: 16,
};

export const muted = {
  fontFamily,
  fontWeight: '400' as const,
  color: colors.textSecondary,
  fontSize: 14,
};

export const typography = {
  fontFamily,
  headline,
  body,
  muted,
};
