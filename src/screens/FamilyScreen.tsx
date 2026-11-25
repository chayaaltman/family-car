import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Card, Field, ListRow, Segmented } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { isCloudConfigured } from '../data/firebaseStore';
import { adminIdOf, pinOf, setMemberPin } from '../logic/admin';
import { insuranceWarning, isOwner, ownerNames, ownersOf } from '../logic/bookings';
import { useSheets } from '../navigation';
import { colors, onColor, space } from '../theme';
import { confirm } from './BookingDetails';
import { L } from '../i18n';

type Section = 'members' | 'cars' | 'phone';

export function FamilyScreen() {
  const { state, me, storeKind, settings, setMe, resetDemo, leaveFamily, canManage, act } = useLoadedFamily();
  const sheets = useSheets();
  const [section, setSection] = useState<Section>('members');
  const admin = state.members.find((m) => m.id === adminIdOf(state));
  const onlyAdminNote = admin && !canManage && (
    <Text style={s.muted}>{L(`Only ${admin.name} can add or change people and cars.`, `רק ${admin.name} יכול/ה להוסיף או לשנות אנשים ורכבים.`)}</Text>
  );

  const inviteFamily = () =>
    Share.share({
      message: L(
        `Join our family car schedule 🚗\nOpen the Family Car app → “Join with a code” → enter code: ${settings.familyCode}`,
        `הצטרפו ליומן הרכבים של המשפחה 🚗\nפותחים את Family Car ← ״הצטרפות עם קוד״ ← מזינים את הקוד: ${settings.familyCode}`,
      ),
    }).catch(() => undefined);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.title}>{state.familyName}</Text>
        <Segmented
          value={section}
          onChange={setSection}
          options={[
            { key: 'members', label: L(`Members (${state.members.length})`, `אנשים (${state.members.length})`) },
            { key: 'cars', label: L(`Cars (${state.cars.length})`, `רכבים (${state.cars.length})`) },
            { key: 'phone', label: L('This phone', 'הטלפון הזה') },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {section === 'members' && (
          <>
            {state.members.map((m) => {
              const cars = state.cars.filter((c) => c.insuredMemberIds.includes(m.id)).map((c) => c.name);
              const owns = state.cars.filter((c) => isOwner(c, m.id)).map((c) => c.name);
              return (
                <ListRow
                  key={m.id}
                  // Everyone can edit their own name, phone and color; only the admin can edit other people.
                  onPress={canManage || m.id === me.id ? () => sheets.editMember(m.id) : undefined}
                  left={<Avatar member={m} size={40} />}
                  title={m.id === me.id ? L(`${m.name} (you)`, `${m.name} (אני)`) : m.name}
                  subtitle={[
                    storeKind === 'cloud' && m.id === admin?.id ? L('Admin', 'מנהל/ת') : null,
                    owns.length ? L(`Owns ${owns.join(', ')}`, `בעלים של ${owns.join(', ')}`) : null,
                    cars.length ? L(`Insured on ${cars.join(', ')}`, `ביטוח על ${cars.join(', ')}`) : L('Not insured on any car', 'אין ביטוח על אף רכב'),
                    m.phone ? `📞 ${m.phone}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              );
            })}
            {canManage ? (
              <Button title={L('Add person', 'הוספת אדם')} icon="person-add-outline" variant="secondary" onPress={() => sheets.editMember()} />
            ) : (
              onlyAdminNote
            )}
          </>
        )}

        {section === 'cars' && (
          <>
            {state.cars.length === 0 && <Text style={s.muted}>{L('No cars yet.', 'אין עדיין רכבים.')}</Text>}
            {state.cars.map((c) => {
              const warning = insuranceWarning(c);
              const owners = ownerNames(state, c, 'and');
              return (
                <ListRow
                  key={c.id}
                  onPress={() => sheets.showCar(c.id)}
                  left={
                    <View style={[s.carIcon, { backgroundColor: c.color }]}>
                      <Ionicons name="car-sport" size={22} color={onColor(c.color)} />
                    </View>
                  }
                  title={c.name}
                  subtitle={[
                    owners ? `${ownersOf(c).length > 1 ? L('Owners', 'בעלים') : L('Owner', 'בעלים')}: ${owners}` : L('No owner', 'אין בעלים'),
                    L(`${c.insuredMemberIds.length} insured`, `${c.insuredMemberIds.length} עם ביטוח`),
                    warning,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              );
            })}
            {canManage ? (
              <Button title={L('Add car', 'הוספת רכב')} icon="add" variant="secondary" onPress={() => sheets.editCar()} />
            ) : (
              onlyAdminNote
            )}
          </>
        )}

        {section === 'phone' && (
          <>
            {storeKind === 'cloud' ? (
              <Card style={{ gap: space(3) }}>
                <Text style={s.label}>{L('Family code', 'קוד משפחה')}</Text>
                <Text style={s.code}>{settings.familyCode}</Text>
                <Text style={s.muted}>{L('Everyone who enters this code sees the same cars and bookings, live.', 'כל מי שמזין את הקוד הזה רואה את אותם רכבים והזמנות, בזמן אמת.')}</Text>
                <Button title={L('Invite family', 'הזמנת המשפחה')} icon="share-social-outline" variant="secondary" onPress={inviteFamily} />
              </Card>
            ) : (
              <Banner tone="info">
                {L(
                  'Demo mode: data is saved on this device only. Connect Firebase (see README) to share it between phones.',
                  'מצב הדגמה: הנתונים נשמרים רק במכשיר הזה. כדי לשתף בין טלפונים צריך לחבר את Firebase (ראו README).',
                )}
              </Banner>
            )}
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Avatar member={me} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{L('Using this phone', 'משתמש/ת בטלפון הזה')}</Text>
                <Text style={s.name}>{me.name}</Text>
              </View>
            </Card>
            <Button title={L('Edit my details (name, phone, color)', 'עריכת הפרטים שלי (שם, טלפון, צבע)')} icon="create-outline" variant="secondary" onPress={() => sheets.editMember(me.id)} />
            {storeKind === 'cloud' && <PinCard hasPin={!!pinOf(state, me)} onSave={(pin) => act((st) => setMemberPin(st, me.id, pin))} />}
            {/* In a real family, people can't switch to someone else; only the demo allows it. */}
            {storeKind === 'local' && (
              <Button title={L(`Not ${me.name}? Switch person`, `לא ${me.name}? החלפת אדם`)} icon="swap-horizontal-outline" variant="secondary" onPress={() => setMe(null)} />
            )}
            {storeKind === 'local' && (
              <Button
                title={L('Reset demo data', 'איפוס נתוני ההדגמה')}
                icon="refresh-outline"
                variant="ghost"
                onPress={async () => {
                  if (await confirm(L('Reset demo?', 'לאפס את ההדגמה?'), L('All changes on this device will be replaced with the demo family.', 'כל השינויים במכשיר הזה יוחלפו במשפחת ההדגמה.'))) {
                    await resetDemo();
                  }
                }}
              />
            )}
            {storeKind === 'local' && isCloudConfigured && (
              <Button
                title={L('Exit demo · create or join your family', 'יציאה מההדגמה · יצירת משפחה או הצטרפות')}
                icon="exit-outline"
                variant="secondary"
                onPress={leaveFamily}
              />
            )}
            {storeKind === 'cloud' && (
              <Button
                title={L('Leave this family on this phone', 'עזיבת המשפחה בטלפון הזה')}
                icon="exit-outline"
                variant="danger"
                onPress={async () => {
                  if (await confirm(L('Leave family?', 'לעזוב את המשפחה?'), L('You can join again with the family code.', 'אפשר להצטרף שוב עם קוד המשפחה.'))) await leaveFamily();
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Your own PIN: needed to choose you on another phone, so nobody can pretend to be you. */
function PinCard({ hasPin, onSave }: { hasPin: boolean; onSave: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const save = async (next: string) => {
    try {
      await onSave(next);
      setPin('');
      setMsg({ tone: 'success', text: L('PIN saved.', 'הקוד נשמר.') });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <Card style={{ gap: space(3) }}>
      <Text style={s.label}>{L('Your PIN', 'הקוד שלי')}</Text>
      <Text style={s.muted}>
        {hasPin
          ? L('Your PIN is set. You\'ll need it to open the app as you on another phone.', 'הקוד שלך מוגדר. צריך אותו כדי לפתוח את האפליקציה בשמך בטלפון אחר.')
          : L('Set a PIN so nobody else can choose your name on their phone.', 'כדאי להגדיר קוד כדי שאף אחד אחר לא יוכל לבחור בשם שלך בטלפון שלו.')}
      </Text>
      <Field
        label={hasPin ? L('New PIN (4–6 digits)', 'קוד חדש (4–6 ספרות)') : L('PIN (4–6 digits)', 'קוד (4–6 ספרות)')}
        placeholder="••••"
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
      />
      <Button title={hasPin ? L('Change PIN', 'שינוי קוד') : L('Set PIN', 'הגדרת קוד')} icon="lock-closed-outline" disabled={pin.length < 4} onPress={() => save(pin)} />
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
    </Card>
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
