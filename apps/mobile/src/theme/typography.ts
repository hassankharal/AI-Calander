import { Platform } from 'react-native';

export const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto'; // Fallback as requested

export const headline = {
  fontWeight: '300' as const,
  letterSpacing: 0.6,
};

export const body = {
  fontWeight: '400' as const,
};

export const caption = {
  fontWeight: '500' as const,
  opacity: 0.75,
};

export const typography = {
  fontFamily,
  headline,
  body,
  caption,
};
