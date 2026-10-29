import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Card, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { insuranceWarning } from '../logic/bookings';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import { confirm } from './BookingDetails';

export function FamilyScreen() {
  const { state, me, storeKind, settings, setMe, resetDemo, leaveFamily } = useLoadedFamily();
  const sheets = useSheets();

  const inviteFamily = () =>
    Share.share({
      message: `Join our family car schedule 🚗\nOpen the Family Car app → “Join a family” → enter code: ${settings.familyCode}`,
    }).catch(() => undefined);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>{state.familyName}</Text>

      {storeKind === 'cloud' ? (
        <Card style={{ gap: space(3), marginTop: space(4) }}>
          <Text style={s.label}>Family code</Text>
          <Text style={s.code}>{settings.familyCode}</Text>
          <Text style={s.muted}>Everyone who enters this code sees the same cars and bookings, live.</Text>
          <Button title="Invite family" icon="share-social-outline" variant="secondary" onPress={inviteFamily} />
        </Card>
      ) : (
        <View style={{ marginTop: space(4) }}>
          <Banner tone="info">
            Demo mode: data is saved on this device only. Connect Firebase (see README) to share it between phones.
          </Banner>
        </View>
      )}

      <SectionTitle right={<AddLink label="Add person" onPress={() => sheets.editMember()} />}>Family members</SectionTitle>
      <Card style={{ paddingVertical: space(1) }}>
        {state.members.map((m, i) => {
          const cars = state.cars.filter((c) => c.insuredMemberIds.includes(m.id)).map((c) => c.name);
          return (
            <Pressable key={m.id} onPress={() => sheets.editMember(m.id)} style={[s.item, i > 0 && s.divider]}>
              <Avatar member={m} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>
                  {m.name} {m.id === me.id && <Text style={s.muted}>(you)</Text>}
                </Text>
                <Text style={s.muted}>{cars.length ? `Insured on ${cars.join(', ')}` : 'Not insured on any car'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle right={<AddLink label="Add car" onPress={() => sheets.editCar()} />}>Cars & insurance</SectionTitle>
      <Card style={{ paddingVertical: space(1) }}>
        {state.cars.length === 0 && <Text style={[s.muted, { padding: space(3) }]}>No cars yet.</Text>}
        {state.cars.map((c, i) => {
          const warning = insuranceWarning(c);
          return (
            <Pressable key={c.id} onPress={() => sheets.editCar(c.id)} style={[s.item, i > 0 && s.divider]}>
              <Ionicons name="car-sport" size={30} color={c.color} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{c.name}</Text>
                <Text style={s.muted}>
                  {c.insuredMemberIds.length} insured driver{c.insuredMemberIds.length === 1 ? '' : 's'}
                  {c.insuranceCompany ? ` · ${c.insuranceCompany}` : ''}
                </Text>
                {warning && <Text style={[s.muted, { color: colors.warning, fontWeight: '600' }]}>{warning}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>This device</SectionTitle>
      <View style={{ gap: space(3) }}>
        <Button title={`Not ${me.name}? Switch person`} icon="swap-horizontal-outline" variant="secondary" onPress={() => setMe(null)} />
        {storeKind === 'local' && (
          <Button
            title="Reset demo data"
            icon="refresh-outline"
            variant="ghost"
            onPress={async () => {
              if (await confirm('Reset demo?', 'All changes on this device will be replaced with the demo family.')) {
                await resetDemo();
              }
            }}
          />
        )}
        {storeKind === 'cloud' && (
          <Button
            title="Leave this family on this phone"
            icon="exit-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm('Leave family?', 'You can join again with the family code.')) await leaveFamily();
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.add}>
      <Ionicons name="add" size={16} color={colors.primary} />
      <Text style={s.addText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(12) },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primary, fontVariant: ['tabular-nums'] },
  muted: { fontSize: 13, color: colors.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  add: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
