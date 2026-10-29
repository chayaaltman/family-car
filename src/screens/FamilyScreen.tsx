import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Card, ListRow, Segmented } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { insuranceWarning } from '../logic/bookings';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import { confirm } from './BookingDetails';

type Section = 'members' | 'cars' | 'phone';

export function FamilyScreen() {
  const { state, me, storeKind, settings, setMe, resetDemo, leaveFamily } = useLoadedFamily();
  const sheets = useSheets();
  const [section, setSection] = useState<Section>('members');

  const inviteFamily = () =>
    Share.share({
      message: `Join our family car schedule 🚗\nOpen the Family Car app → “Join a family” → enter code: ${settings.familyCode}`,
    }).catch(() => undefined);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.title}>{state.familyName}</Text>
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { key: 'members', label: `Members (${state.members.length})` },
            { key: 'cars', label: `Cars (${state.cars.length})` },
            { key: 'phone', label: 'This phone' },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {section === 'members' && (
          <>
            {state.members.map((m) => {
              const cars = state.cars.filter((c) => c.insuredMemberIds.includes(m.id)).map((c) => c.name);
              const owns = state.cars.filter((c) => c.ownerId === m.id).map((c) => c.name);
              return (
                <ListRow
                  key={m.id}
                  onPress={() => sheets.editMember(m.id)}
                  left={<Avatar member={m} size={40} />}
                  title={m.id === me.id ? `${m.name} (you)` : m.name}
                  subtitle={[
                    owns.length ? `Owns ${owns.join(', ')}` : null,
                    cars.length ? `Insured on ${cars.join(', ')}` : 'Not insured on any car',
                    m.phone ? `📞 ${m.phone}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              );
            })}
            <Button title="Add person" icon="person-add-outline" variant="secondary" onPress={() => sheets.editMember()} />
          </>
        )}

        {section === 'cars' && (
          <>
            {state.cars.length === 0 && <Text style={s.muted}>No cars yet.</Text>}
            {state.cars.map((c) => {
              const warning = insuranceWarning(c);
              const owner = state.members.find((m) => m.id === c.ownerId);
              return (
                <ListRow
                  key={c.id}
                  onPress={() => sheets.showCar(c.id)}
                  left={
                    <View style={[s.carIcon, { backgroundColor: c.color }]}>
                      <Ionicons name="car-sport" size={22} color="#fff" />
                    </View>
                  }
                  title={c.name}
                  subtitle={[
                    owner ? `Owner: ${owner.name}` : 'No owner',
                    `${c.insuredMemberIds.length} insured`,
                    warning,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              );
            })}
            <Button title="Add car" icon="add" variant="secondary" onPress={() => sheets.editCar()} />
          </>
        )}

        {section === 'phone' && (
          <>
            {storeKind === 'cloud' ? (
              <Card style={{ gap: space(3) }}>
                <Text style={s.label}>Family code</Text>
                <Text style={s.code}>{settings.familyCode}</Text>
                <Text style={s.muted}>Everyone who enters this code sees the same cars and bookings, live.</Text>
                <Button title="Invite family" icon="share-social-outline" variant="secondary" onPress={inviteFamily} />
              </Card>
            ) : (
              <Banner tone="info">
                Demo mode: data is saved on this device only. Connect Firebase (see README) to share it between phones.
              </Banner>
            )}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Avatar member={me} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Using this phone</Text>
                <Text style={s.name}>{me.name}</Text>
              </View>
            </Card>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { padding: space(5), paddingBottom: space(3), gap: space(3) },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  content: { paddingHorizontal: space(5), paddingBottom: space(12), gap: space(2.5) },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primary, fontVariant: ['tabular-nums'] },
  muted: { fontSize: 13, color: colors.muted },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  carIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
