import { Platform } from 'react-native';

// Soft pastels taken from the app icon: teal fading into deep blue, with coral and butter-yellow accents.
// Strong colors (primary, danger, …) are dark enough for white text and for text on white.
const lightColors = {
  bg: '#F1F7F7',
  card: '#FFFFFF',
  text: '#1F2A4D',
  muted: '#62708A',
  faint: '#9AA7B8',
  border: '#DCE8EB',
  primary: '#2A7090',
  primarySoft: '#DFF1F1',
  danger: '#C2503F',
  dangerSoft: '#FBE7E2',
  success: '#2A8268',
  successSoft: '#DDF2EA',
  warning: '#9A6614',
  warningSoft: '#FDF3D3',
  /** Text on a `warning` background. */
  onWarning: '#FFFFFF',
  /** A raised surface on top of a card (the selected segment of a Segmented control). */
  raised: '#FFFFFF',
};

type Palette = { [K in keyof typeof lightColors]: string };

// The same app at night: deep navy surfaces, soft light text, the icon's teal-blue accent.
const darkColors: Palette = {
  bg: '#111A2C',
  card: '#1B263B',
  text: '#E6ECF5',
  muted: '#A0ADC3',
  faint: '#6E7D96',
  border: '#2B3953',
  primary: '#4796B5',
  primarySoft: '#1E3B4B',
  danger: '#E27866',
  dangerSoft: '#3D2529',
  success: '#4DB592',
  successSoft: '#19362F',
  warning: '#E2B05A',
  warningSoft: '#3A3121',
  onWarning: '#2A2110',
  raised: '#3A4A68',
};

/** Ink used on light pastel backgrounds in both themes (pastels stay light in dark mode too). */
const INK = '#1F2A4D';

const isWeb = Platform.OS === 'web';
const cssName = (key: string) => `--c-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/**
 * Theme colors. On the web they are CSS custom properties (`var(--c-bg)` …) so the whole
 * app switches between light and dark without re-creating any StyleSheet; the values
 * live in a <style> tag (see `applyTheme`). Native apps use the light hex values.
 */
export const colors: Palette = isWeb
  ? (Object.fromEntries(Object.keys(lightColors).map((k) => [k, `var(${cssName(k)})`])) as Palette)
  : { ...lightColors };

/** The device setting from Preferences; 'system' follows the phone's light/dark setting. */
export type ThemeSetting = 'system' | 'light' | 'dark';

const BG = { light: lightColors.bg, dark: darkColors.bg };

function cssVars(p: Palette, extra: Record<string, string>): string {
  const vars = Object.entries(p).map(([k, v]) => `${cssName(k)}:${v};`);
  return [...vars, ...Object.entries(extra).map(([k, v]) => `${k}:${v};`)].join('');
}

// --c-tint: what pastel tints fade toward (white by day, the card color at night).
// --c-deep: what pastels deepen toward for icons/text (navy ink by day, near-white at night).
const LIGHT_CSS = cssVars(lightColors, {
  '--c-tint': '#FFFFFF',
  '--c-deep': INK,
  '--c-shadow': '0 3px 12px rgba(31,42,77,0.07)',
  'color-scheme': 'light',
});
const DARK_CSS = cssVars(darkColors, {
  '--c-tint': darkColors.card,
  '--c-deep': '#F4F7FC',
  '--c-shadow': '0 3px 12px rgba(0,0,0,0.28)',
  'color-scheme': 'dark',
});

function installThemeStyles() {
  if (!isWeb || typeof document === 'undefined' || document.getElementById('theme-vars')) return;
  const style = document.createElement('style');
  style.id = 'theme-vars';
  style.textContent =
    `:root{${LIGHT_CSS}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${DARK_CSS}}}` +
    `:root[data-theme="dark"]{${DARK_CSS}}` +
    `html,body{background-color:var(--c-bg);}`;
  document.head.appendChild(style);
}
installThemeStyles();

/**
 * Applies the appearance setting on the web (no-op on native). 'system' follows
 * `prefers-color-scheme`, including live changes, through the CSS above.
 */
export function applyTheme(setting: ThemeSetting) {
  if (!isWeb || typeof document === 'undefined') return;
  installThemeStyles();
  const root = document.documentElement;
  if (setting === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', setting);

  // Browser / home-screen bar color.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const addMeta = (content: string, media?: string) => {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = content;
    if (media) m.media = media;
    document.head.appendChild(m);
  };
  if (setting === 'system') {
    addMeta(BG.light, '(prefers-color-scheme: light)');
    addMeta(BG.dark, '(prefers-color-scheme: dark)');
  } else {
    addMeta(BG[setting]);
  }
}

/** The icon's teal-to-deep-blue fade, used on main buttons. */
export const brand = {
  teal: '#287F8C',
  navy: '#3A4D9E',
  soft: colors.primarySoft,
  ink: colors.primary,
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  ios: { shadowColor: '#1F2A4D', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 2 },
  default: { boxShadow: isWeb ? 'var(--c-shadow)' : '0 3px 12px rgba(31,42,77,0.07)' },
}) as object;

const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/**
 * On the web, mixes `color` with a theme CSS variable using `color-mix`, so it follows
 * light/dark live. Wrapped in `var(--none, …)` because react-native-web only passes
 * color strings through untouched when they start with `var(`.
 */
const cssMix = (color: string, toward: string, amount: number) =>
  `var(--none, color-mix(in srgb, ${color}, var(${toward}) ${Math.round(amount * 1000) / 10}%))`;

/** Text color that stays readable on top of `hex`. */
export function onColor(hex: string): string {
  if (!isHex(hex)) return '#FFFFFF'; // a theme color (CSS variable): strong colors take white text
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? INK : '#FFFFFF';
}

/**
 * A deeper shade of a (pastel) color, for icons and text drawn on a card.
 * In dark mode (web) it lightens instead, so it stays readable on dark cards.
 */
export function deepen(hex: string, amount = 0.5): string {
  if (isWeb || !isHex(hex)) return cssMix(hex, '--c-deep', amount);
  const n = parseInt(hex.replace('#', ''), 16);
  const ink = [0x1f, 0x2a, 0x4d];
  const mix = (c: number, i: number) => Math.round(c + (ink[i] - c) * amount);
  const r = mix((n >> 16) & 255, 0);
  const g = mix((n >> 8) & 255, 1);
  const b = mix(n & 255, 2);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Mixes `hex` with white; `amount` 0 = original, 1 = white. Used for soft backgrounds.
 * In dark mode (web) it mixes toward the card color instead, so tints don't glare.
 */
export function tint(hex: string, amount: number): string {
  if (isWeb || !isHex(hex)) return cssMix(hex, '--c-tint', amount);
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
