import { MEMBER_COLORS } from '../data/seed';
import type { FamilyState, Id, Member } from '../types';
import { newId, RuleError } from './bookings';
import { L } from '../i18n';

/** The family admin. Families created before admins existed fall back to the first member (the founder). */
export function adminIdOf(state: FamilyState): Id | undefined {
  return state.adminId ?? state.members[0]?.id;
}

export function isAdmin(state: FamilyState, memberId: Id): boolean {
  return adminIdOf(state) === memberId;
}

function checkPin(pin: string): string {
  const clean = pin.trim();
  if (!/^\d{4,6}$/.test(clean)) throw new RuleError(L('The PIN must be 4 to 6 digits.', 'הקוד צריך להיות בין 4 ל-6 ספרות.'));
  return clean;
}

/** A member's PIN. The admin may still have one from the older family-wide admin PIN. */
export function pinOf(state: FamilyState, member: Member): string | undefined {
  return member.pin ?? (member.id === adminIdOf(state) ? state.adminPin : undefined);
}

export function checkMemberPin(state: FamilyState, member: Member, pin: string): boolean {
  const saved = pinOf(state, member);
  return !!saved && saved === pin.trim();
}

/** Sets (or changes) a member's own PIN. */
export function setMemberPin(state: FamilyState, memberId: Id, pin: string): FamilyState {
  const clean = checkPin(pin);
  const { adminPin: _old, ...rest } = state;
  return {
    ...(memberId === adminIdOf(state) ? { ...rest, adminId: adminIdOf(state) } : state),
    members: state.members.map((m) => (m.id === memberId ? { ...m, pin: clean } : m)),
  };
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Someone new joins the family by adding their own name and PIN. */
export function addSelf(state: FamilyState, name: string, pin: string, id: Id = newId()): { state: FamilyState; member: Member } {
  const clean = name.trim();
  if (!clean) throw new RuleError(L('Enter your name.', 'צריך להזין את השם שלך.'));
  if (state.members.some((m) => sameName(m.name, clean))) {
    throw new RuleError(
      L(`${clean} is already in the family. If that's you, tap "I've joined before".`, `${clean} כבר במשפחה. אם זה את/ה, יש ללחוץ על "כבר הצטרפתי בעבר".`),
    );
  }
  const member: Member = {
    id,
    name: clean,
    color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length],
    pin: checkPin(pin),
  };
  return { state: { ...state, members: [...state.members, member] }, member };
}
