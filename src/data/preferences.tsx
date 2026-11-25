import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setLanguage, type Language } from '../i18n';
import { applyTheme } from '../theme';

// Settings for this device (not shared with the family): language and appearance.

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  language: Language;
  theme: ThemePreference;
}

const KEY = 'familycar:prefs:v1';
const DEFAULTS: Preferences = { language: 'en', theme: 'system' };

interface PreferencesValue {
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/**
 * Loads the saved preferences before showing the app, and remounts the app when the
 * language changes so every screen re-renders in the new language and direction.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Preferences | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => ({ ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Preferences>) : {}) }))
      .catch(() => DEFAULTS)
      .then((p) => {
        setLanguage(p.language);
        applyTheme(p.theme);
        setState(p);
      });
  }, []);

  const setPrefs = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...(prefs ?? DEFAULTS), ...patch };
      if (patch.language) setLanguage(patch.language);
      if (patch.theme) applyTheme(patch.theme);
      setState(next);
      await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
    },
    [prefs],
  );

  const value = useMemo(() => (prefs ? { prefs, setPrefs } : null), [prefs, setPrefs]);
  if (!value) return null; // a few milliseconds while reading storage

  return (
    <PreferencesContext.Provider value={value}>
      {/* key: a language change rebuilds every screen with the new strings and direction */}
      <React.Fragment key={value.prefs.language}>{children}</React.Fragment>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
