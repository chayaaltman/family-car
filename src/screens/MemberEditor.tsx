import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { MEMBER_COLORS } from '../data/seed';
import { deleteMember, newId, upsertMember } from '../logic/bookings';
import { colors, space } from '../theme';
import type { Member } from '../types';
import { confirm } from './BookingDetails';

export function MemberEditor({ memberId, onDone }: { memberId?: string; onDone: () => void }) {
  const { state, me, act } = useLoadedFamily();
  const existing = state.members.find((m) => m.id === memberId);
  const [member, setMember] = useState<Member>(
    existing ?? { id: newId(), name: '', color: MEMBER_COLORS[state.members.length % MEMBER_COLORS.length] },
  );
  const [error, setError] = useState<string | null>(null);
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
          <Text style={s.title}>{existing ? `Edit ${existing.name}` : 'Add a family member'}</Text>
        </View>
        <Field label="Name" placeholder="Name" value={member.name} onChangeText={(name) => set({ name })} maxLength={20} autoFocus={!existing} />
        <Field label="Phone (optional)" placeholder="050-000-0000" keyboardType="phone-pad" value={member.phone ?? ''} onChangeText={(phone) => set({ phone })} />
        <Label>Color</Label>
        <View style={s.row}>
          {MEMBER_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: member.color === c }}
              onPress={() => set({ color: c })}
              style={[s.swatch, { backgroundColor: c }, member.color === c && s.swatchSelected]}
            />
          ))}
        </View>
        {!existing && (
          <Banner tone="info">Remember to mark which cars they're insured on (Family → tap a car).</Banner>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
        {/* You can't remove yourself while signed in as yourself; switch profile first. */}
        {existing && existing.id !== me.id && (
          <Button
            title={`Remove ${existing.name}`}
            icon="person-remove-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm(`Remove ${existing.name}?`, 'Their bookings will be deleted too.')) {
                run((st) => deleteMember(st, existing.id));
              }
            }}
          />
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button title="Cancel" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button title="Save" icon="checkmark" onPress={() => run((st) => upsertMember(st, { ...member, name: member.name.trim() }))} style={{ flex: 2 }} />
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
