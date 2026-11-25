import { emptyFamily } from '../../data/seed';
import { addSelf, adminIdOf, checkMemberPin, isAdmin, pinOf, setMemberPin } from '../admin';

describe('family admin', () => {
  it('makes the founder the admin of a new family', () => {
    const f = emptyFamily('Chaya', 1000);
    expect(isAdmin(f, f.members[0].id)).toBe(true);
    expect(isAdmin(f, 'someone-else')).toBe(false);
  });

  it('falls back to the first member for families without an admin', () => {
    const { adminId: _a, ...old } = emptyFamily('Chaya', 1000);
    expect(adminIdOf(old)).toBe(old.members[0].id);
  });
});

describe('joining and PINs', () => {
  it('lets a new person add themselves with their own PIN', () => {
    const { state, member } = addSelf(emptyFamily('Chaya', 1000), 'Gabi', '4321', 'gabi');
    expect(state.members.map((m) => m.name)).toEqual(['Chaya', 'Gabi']);
    expect(member.id).toBe('gabi');
    expect(checkMemberPin(state, member, '4321')).toBe(true);
    expect(checkMemberPin(state, member, '1111')).toBe(false);
    expect(isAdmin(state, 'gabi')).toBe(false);
  });

  it("won't let someone join under a name that's already taken", () => {
    const f = addSelf(emptyFamily('Chaya', 1000), 'Keren', '1234').state;
    expect(() => addSelf(f, ' keren ', '9999')).toThrow(/already in the family/);
  });

  it('needs a name and a 4-6 digit PIN', () => {
    expect(() => addSelf(emptyFamily('Chaya'), '  ', '1234')).toThrow();
    expect(() => addSelf(emptyFamily('Chaya'), 'Gabi', '12')).toThrow();
    expect(() => addSelf(emptyFamily('Chaya'), 'Gabi', 'abcd')).toThrow();
  });

  it('never lets someone without a PIN be chosen', () => {
    const f = emptyFamily('Chaya', 1000);
    expect(checkMemberPin(f, f.members[0], '')).toBe(false);
  });

  it("keeps the admin's old family-wide PIN working, and replaces it when they set their own", () => {
    const f = { ...emptyFamily('Chaya', 1000), adminPin: '2468' };
    const admin = f.members[0];
    expect(pinOf(f, admin)).toBe('2468');
    const next = setMemberPin(f, admin.id, '1357');
    expect(next.adminPin).toBeUndefined();
    expect(checkMemberPin(next, next.members[0], '1357')).toBe(true);
  });
});
