import { I18nManager, Platform } from 'react-native';

// The app speaks English or Hebrew. Every user-facing string is written as L('English', 'עברית'),
// so both languages sit side by side in the code and nothing can be forgotten in one of them.
// The language is a module-level setting (not React state) so pure logic like rule errors and
// date formatting can use it too. Changing it remounts the app (see PreferencesProvider).

export type Language = 'en' | 'he';

let current: Language = 'en';

export function getLanguage(): Language {
  return current;
}

export function isRTL(): boolean {
  return current === 'he';
}

export function setLanguage(lang: Language): void {
  current = lang;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // The browser lays the page out right-to-left, so rows, text and alignment flip for Hebrew.
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  } else {
    // Native apps apply this after a restart.
    I18nManager.allowRTL(lang === 'he');
    I18nManager.forceRTL(lang === 'he');
  }
}

/** Pick the string for the current language. */
export function L(en: string, he: string): string {
  return current === 'he' ? he : en;
}

/** "chevron-forward" points the way you read: right in English, left in Hebrew. */
export function forwardIcon<T extends string>(ltr: T, rtl: T): T {
  return current === 'he' ? rtl : ltr;
}
