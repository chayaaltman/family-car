import { Platform } from 'react-native';

export const colors = {
  bg: '#F4F5F9',
  card: '#FFFFFF',
  text: '#1B1D29',
  muted: '#6B6F80',
  faint: '#A3A7B7',
  border: '#E3E5EE',
  primary: '#3D5AFE',
  primarySoft: '#E8ECFF',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  success: '#1F9D55',
  successSoft: '#E3F6EB',
  warning: '#B7791F',
  warningSoft: '#FFF5DD',
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  ios: { shadowColor: '#1B1D29', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 3px 12px rgba(27,29,41,0.06)' },
}) as object;

/** Text color that stays readable on top of `hex`. */
export function onColor(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#1B1D29' : '#FFFFFF';
}

/** Mixes `hex` with white; `amount` 0 = original, 1 = white. Used for soft backgrounds. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
