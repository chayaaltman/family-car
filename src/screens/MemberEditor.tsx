import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { MEMBER_COLORS } from '../data/seed';
import { pinOf, setMemberPin } from '../logic/admin';
import { deleteMember, newId, upsertMember } from '../logic/bookings';
import { colors, space } from '../theme';
import type { Member } from '../types';
import { confirm } from './BookingDetails';
import { L } from '../i18n';

export function MemberEditor({ memberId, onDone }: { memberId?: string; onDone: () => void }) {
  const { state, me, act, canManage, storeKind } = useLoadedFamily();
  const existing = state.members.find((m) => m.id === memberId);
  const [member, setMember] = useState<Member>(
    existing ?? { id: newId(), name: '', color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length] },
  );
  const [error, setError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const set = (patch: Partial<Member>) => setMember((m) => ({ ...m, ...patch }));

  const run = async (fn: Parameters<typeof act>[0]) => {
    try {
      await act(fn);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Avatar member={{ name: member.name || '?', color: member.color }} size={56} />
          <Text style={s.title}>{existing ? L(`Edit ${existing.name}`, `עריכת ${existing.name}`) : L('Add a family member', 'הוספת בן/בת משפחה')}</Text>
        </View>
        <Field label={L('Name', 'שם')} placeholder={L('Name', 'שם')} value={member.name} onChangeText={(name) => set({ name })} maxLength={20} autoFocus={!existing} />
        <Field label={L('Phone (optional)', 'טלפון (לא חובה)')} placeholder="050-000-0000" keyboardType="phone-pad" value={member.phone ?? ''} onChangeText={(phone) => set({ phone })} />
        {/* The admin can give someone a PIN (or a new one if they forgot it). People change their own in Family → This phone. */}
        {canManage && storeKind === 'cloud' && member.id !== me.id && (
          <Field
            label={existing && pinOf(state, existing) ? L('PIN (type a new one to reset it)', 'קוד (להקליד חדש כדי לאפס)') : L('PIN (4–6 digits, to open the app on their phone)', 'קוד (4–6 ספרות, לפתיחת האפליקציה בטלפון שלהם)')}
            placeholder={existing && pinOf(state, existing) ? L('Unchanged', 'ללא שינוי') : '••••'}
            keyboardType="number-pad"
            maxLength={6}
            value={newPin}
            onChangeText={(t) => setNewPin(t.replace(/\D/g, ''))}
          />
        )}
        <Label>{L('Color', 'צבע')}</Label>
        <View style={s.row}>
          {MEMBER_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`${L('Color', 'צבע')} ${c}`}
              accessibilityState={{ selected: member.color === c }}
              onPress={() => set({ color: c })}
              style={[s.swatch, { backgroundColor: c }, member.color === c && s.swatchSelected]}
            />
          ))}
        </View>
        {!existing && (
          <Banner tone="info">{L('Remember to mark which cars they\'re insured on (Family → tap a car).', 'לא לשכוח לסמן על אילו רכבים יש להם ביטוח (משפחה ← לוחצים על רכב).')}</Banner>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
        {/* You can't remove yourself while signed in as yourself; switch profile first. */}
        {existing && existing.id !== me.id && (
          <Button
            title={L(`Remove ${existing.name}`, `הסרת ${existing.name}`)}
            icon="person-remove-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm(L(`Remove ${existing.name}?`, `להסיר את ${existing.name}?`), L('Their bookings will be deleted too.', 'גם ההזמנות שלהם יימחקו.'))) {
                run((st) => deleteMember(st, existing.id));
              }
            }}
          />
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button title={L('Cancel', 'ביטול')} variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button title={L('Save', 'שמירה')} icon="checkmark" onPress={() =>
            run((st) => {
              const saved = upsertMember(st, { ...member, name: member.name.trim() });
              return newPin ? setMemberPin(saved, member.id, newPin) : saved;
            })
          } style={{ flex: 2 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4) },
  header: { alignItems: 'center', gap: space(3) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: space(3), flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchSelected: { borderWidth: 3, borderColor: colors.text },
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), borderTopWidth: 1, borderTopColor: colors.border },
});
