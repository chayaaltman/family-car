import type { FamilyState } from '../types';

/** A pure function that turns the current state into the next one, or throws a RuleError. */
export type Mutation = (state: FamilyState) => FamilyState;

/**
 * Where the family's data lives. The UI only talks to this interface, so the
 * app can run fully offline (LocalStore) or shared between phones (FirebaseStore)
 * without any screen knowing the difference.
 */
export interface FamilyStore {
  readonly kind: 'local' | 'cloud';
  /** Calls `listener` with the current state now and after every change (including other phones' changes). */
  subscribe(listener: (state: FamilyState) => void, onError?: (e: Error) => void): () => void;
  /** Applies `mutation` atomically against the latest state. */
  update(mutation: Mutation): Promise<void>;
}
