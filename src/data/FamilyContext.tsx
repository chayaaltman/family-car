import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addSelf, checkMemberPin, isAdmin } from '../logic/admin';
import { newId } from '../logic/bookings';
import type { FamilyState, Member } from '../types';
import { FirebaseStore, generateFamilyCode, isCloudConfigured } from './firebaseStore';
import { LocalStore } from './localStore';
import { emptyFamily, localizeDemo, withPastelColors } from './seed';
import type { FamilyStore, Mutation } from './store';
import { L } from '../i18n';

const SETTINGS_KEY = 'familycar:settings:v1';

interface Settings {
  mode?: 'demo' | 'cloud';
  familyCode?: string;
  meId?: string;
}

interface FamilyContextValue {
  ready: boolean;
  settings: Settings;
  state: FamilyState | null;
  storeKind: 'local' | 'cloud' | null;
  error: string | null;
  me: Member | null;
  /** True if `me` may add, edit or remove people and cars (the family admin, or anyone in the demo). */
  canManage: boolean;
  /** Runs a state transition. Rejects with a RuleError if a family rule is broken. */
  act: (mutation: Mutation) => Promise<void>;
  setMe: (memberId: string | null) => Promise<void>;
  /** First time on this phone: add yourself to the family with your own PIN. */
  joinAsNew: (name: string, pin: string) => Promise<void>;
  /** Back on a new phone: choose yourself, proven by your PIN. Returns false if the PIN is wrong. */
  signInAs: (memberId: string, pin: string) => Promise<boolean>;
  startDemo: () => Promise<void>;
  createFamily: (yourName: string) => Promise<string>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  resetDemo: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [state, setState] = useState<FamilyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        const saved: Settings = raw ? JSON.parse(raw) : {};
        // Without cloud credentials there is nothing to join, so go straight to the demo.
        if (!isCloudConfigured) saved.mode = 'demo';
        setSettings(saved);
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const store: FamilyStore | null = useMemo(() => {
    if (settings.mode === 'demo') return new LocalStore();
    if (settings.mode === 'cloud' && settings.familyCode) return new FirebaseStore(settings.familyCode);
    return null;
  }, [settings.mode, settings.familyCode]);

  useEffect(() => {
    setState(null);
    setError(null);
    if (!store) return;
    return store.subscribe(
      (s) => {
        // The demo's sample text follows the app language; a real family's data is shown as typed.
        setState(withPastelColors(store.kind === 'local' ? localizeDemo(s) : s));
        setError(null);
      },
      (e) => setError(e.message),
    );
  }, [store]);

  const value = useMemo<FamilyContextValue>(() => {
    const me = state?.members.find((m) => m.id === settings.meId) ?? null;
    return {
      ready: settingsLoaded && (!store || state !== null || error !== null),
      settings,
      state,
      storeKind: store?.kind ?? null,
      error,
      me,
      canManage: !!me && (store?.kind === 'local' || isAdmin(state!, me.id)),
      act: async (mutation) => {
        if (!store) throw new Error(L('Not connected to a family yet.', 'עדיין לא מחובר למשפחה.'));
        await store.update(mutation);
      },
      setMe: (memberId) => saveSettings({ ...settings, meId: memberId ?? undefined }),
      joinAsNew: async (name, pin) => {
        if (!store) throw new Error(L('Not connected to a family yet.', 'עדיין לא מחובר למשפחה.'));
        // Make the id up front: the update may retry, and it must add the same person each time.
        const id = newId();
        await store.update((st) => addSelf(st, name, pin, id).state);
        await saveSettings({ ...settings, meId: id });
      },
      signInAs: async (memberId, pin) => {
        const member = state?.members.find((m) => m.id === memberId);
        if (!state || !member || !checkMemberPin(state, member, pin)) return false;
        await saveSettings({ ...settings, meId: memberId });
        return true;
      },
      startDemo: () => saveSettings({ mode: 'demo' }),
      createFamily: async (yourName) => {
        const code = generateFamilyCode();
        const family = emptyFamily(yourName.trim());
        await FirebaseStore.create(code, family);
        await saveSettings({ mode: 'cloud', familyCode: code, meId: family.members[0].id });
        return code;
      },
      joinFamily: async (rawCode) => {
        const code = rawCode.trim().toUpperCase();
        if (!(await FirebaseStore.exists(code))) throw new Error(L(`No family found with code ${code}.`, `לא נמצאה משפחה עם הקוד ${code}.`));
        await saveSettings({ mode: 'cloud', familyCode: code });
      },
      leaveFamily: () => saveSettings(isCloudConfigured ? {} : { mode: 'demo' }),
      resetDemo: async () => {
        if (store instanceof LocalStore) await store.reset();
      },
    };
  }, [settings, settingsLoaded, state, store, error, saveSettings]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>');
  return ctx;
}

/** For screens that only render once a family is loaded and a member is picked. */
export function useLoadedFamily() {
  const ctx = useFamily();
  if (!ctx.state || !ctx.me) throw new Error('Family not loaded');
  return { ...ctx, state: ctx.state, me: ctx.me };
}
