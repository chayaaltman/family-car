import { initializeApp, getApps } from 'firebase/app';
import { doc, getDoc, getFirestore, onSnapshot, runTransaction, type Firestore } from 'firebase/firestore';
import type { FamilyState } from '../types';
import type { FamilyStore, Mutation } from './store';
import { L } from '../i18n';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isCloudConfigured = Boolean(config.apiKey && config.projectId);

let db: Firestore | null = null;
function firestore(): Firestore {
  if (!db) {
    const app = getApps()[0] ?? initializeApp(config);
    db = getFirestore(app);
  }
  return db;
}

/**
 * Shares one family between every phone that knows the family code.
 *
 * The whole family is a single Firestore document (a family's cars and
 * bookings are small). That lets every change run in a transaction: if two
 * people try to book the same car at the same moment, Firestore retries the
 * second one against the fresh data, and our rules reject the clash.
 */
export class FirebaseStore implements FamilyStore {
  readonly kind = 'cloud' as const;
  constructor(private readonly familyCode: string) {}

  private ref() {
    return doc(firestore(), 'families', this.familyCode);
  }

  subscribe(listener: (s: FamilyState) => void, onError?: (e: Error) => void) {
    return onSnapshot(
      this.ref(),
      (snap) => {
        if (snap.exists()) listener(snap.data() as FamilyState);
        else onError?.(new Error(L(`No family found with code ${this.familyCode}.`, `לא נמצאה משפחה עם הקוד ${this.familyCode}.`)));
      },
      (e) => onError?.(e),
    );
  }

  async update(mutation: Mutation): Promise<void> {
    await runTransaction(firestore(), async (tx) => {
      const snap = await tx.get(this.ref());
      if (!snap.exists()) throw new Error(L('This family no longer exists.', 'המשפחה הזאת כבר לא קיימת.'));
      const next = { ...mutation(snap.data() as FamilyState), updatedAt: Date.now() };
      tx.set(this.ref(), stripUndefined(next));
    });
  }

  static async exists(code: string): Promise<boolean> {
    return (await getDoc(doc(firestore(), 'families', code))).exists();
  }

  static async create(code: string, state: FamilyState): Promise<void> {
    await runTransaction(firestore(), async (tx) => {
      const ref = doc(firestore(), 'families', code);
      if ((await tx.get(ref)).exists()) throw new Error(L('That code is taken, try again.', 'הקוד הזה תפוס, נסו שוב.'));
      tx.set(ref, stripUndefined(state));
    });
  }
}

/** Firestore rejects `undefined` field values; JSON round-trip drops them. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Short, easy-to-say code like "K7QP-2M". Avoids look-alike characters. */
export function generateFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}`;
}
