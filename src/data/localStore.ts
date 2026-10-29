import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FamilyState } from '../types';
import { demoFamily } from './seed';
import type { FamilyStore, Mutation } from './store';

const KEY = 'familycar:state:v1';

/** Keeps everything on this device. Used for the demo and when no cloud is configured. */
export class LocalStore implements FamilyStore {
  readonly kind = 'local' as const;
  private state: FamilyState | null = null;
  private listeners = new Set<(s: FamilyState) => void>();
  private queue: Promise<void> = Promise.resolve();

  private async load(): Promise<FamilyState> {
    if (this.state) return this.state;
    const raw = await AsyncStorage.getItem(KEY);
    this.state = raw ? (JSON.parse(raw) as FamilyState) : demoFamily();
    if (!raw) await AsyncStorage.setItem(KEY, JSON.stringify(this.state));
    return this.state;
  }

  subscribe(listener: (s: FamilyState) => void, onError?: (e: Error) => void) {
    this.listeners.add(listener);
    this.load().then(listener, (e) => onError?.(e));
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(mutation: Mutation): Promise<void> {
    // Chain updates so two quick taps can't both read the same old state.
    const run = this.queue.then(async () => {
      const current = await this.load();
      const next = { ...mutation(current), updatedAt: Date.now() };
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      this.state = next;
      this.listeners.forEach((l) => l(next));
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async reset(): Promise<void> {
    await this.update(() => demoFamily());
  }
}
