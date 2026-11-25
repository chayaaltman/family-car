import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthGrid } from '../components/MonthGrid';
import { Avatar, Banner, Button, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { CAR_COLORS } from '../data/seed';
import { deleteCar, newId, ownerNames, ownersOf, upsertCar } from '../logic/bookings';
import { DAY, endOfDay, formatDate } from '../logic/time';
import { colors, radius, space, tint } from '../theme';
import type { Car } from '../types';
import { confirm } from './BookingDetails';
import { L } from '../i18n';

export function CarEditor({ carId, onDone }: { carId?: string; onDone: () => void }) {
  const { state, act, canManage } = useLoadedFamily();
  const existing = state.cars.find((c) => c.id === carId);

  const [car, setCar] = useState<Car>(
    existing ?? {
      id: newId(),
      name: '',
      color: CAR_COLORS[state.cars.length % CAR_COLORS.length],
      insuredMemberIds: state.members.map((m) => m.id),
      insuranceExpires: endOfDay(Date.now() + 365 * DAY) - 1,
    },
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [month, setMonth] = useState(car.insuranceExpires ?? Date.now());
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Car>) => setCar((c) => ({ ...c, ...patch }));

  const owners = ownersOf(car);
  const toggleOwner = (memberId: string) =>
    set({ ownerId: undefined, ownerIds: owners.includes(memberId) ? owners.filter((id) => id !== memberId) : [...owners, memberId] });

  const toggleInsured = (memberId: string) =>
    set({
      insuredMemberIds: car.insuredMemberIds.includes(memberId)
        ? car.insuredMemberIds.filter((id) => id !== memberId)
        : [...car.insuredMemberIds, memberId],
    });

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
        <Text style={s.title}>{existing ? L(`Edit ${existing.name}`, `עריכת ${existing.name}`) : L('Add a car', 'הוספת רכב')}</Text>

        <Field label={L('Nickname', 'כינוי')} placeholder={L('Corolla, the white one…', 'הקורולה, הלבנה…')} value={car.name} onChangeText={(name) => set({ name })} maxLength={24} />
        <Field label={L('Make & model', 'יצרן ודגם')} placeholder={L('Toyota Corolla 2019', 'טויוטה קורולה 2019')} value={car.model ?? ''} onChangeText={(model) => set({ model })} />
        <View style={s.row}>
          <View style={{ flex: 2 }}>
            <Field label={L('License plate', 'מספר רישוי')} placeholder="12-345-67" value={car.plate ?? ''} onChangeText={(plate) => set({ plate })} autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={L('Seats', 'מושבים')}
              keyboardType="number-pad"
              value={car.seats ? String(car.seats) : ''}
              onChangeText={(t) => set({ seats: parseInt(t, 10) || undefined })}
            />
          </View>
        </View>

        <Label>{L('Color in the calendar', 'צבע ביומן')}</Label>
        <View style={s.row}>
          {CAR_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`${L('Color', 'צבע')} ${c}`}
              accessibilityState={{ selected: car.color === c }}
              onPress={() => set({ color: c })}
              style={[s.swatch, { backgroundColor: c }, car.color === c && s.swatchSelected]}
            />
          ))}
        </View>

        <Text style={s.section}>{L('Owners', 'בעלים')}</Text>
        {canManage ? (
          <>
            <Label>{L('Who approves bookings for this car? Pick one or more.', 'מי מאשר הזמנות לרכב הזה? אפשר לבחור כמה.')}</Label>
            <View style={s.row}>
              <Pressable
                onPress={() => set({ ownerIds: [], ownerId: undefined })}
                accessibilityRole="button"
                accessibilityState={{ selected: owners.length === 0 }}
                style={[s.ownerChip, owners.length === 0 && s.ownerChipOn]}
              >
                <Ionicons name="lock-open-outline" size={18} color={owners.length === 0 ? colors.primary : colors.muted} />
                <Text style={[s.ownerText, owners.length === 0 && { color: colors.primary }]}>{L('No one – anyone can book', 'אף אחד – כולם יכולים להזמין')}</Text>
              </Pressable>
              {state.members.map((m) => {
                const on = owners.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => toggleOwner(m.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[s.ownerChip, on && s.ownerChipOn]}
                  >
                    <Avatar member={m} size={22} />
                    <Text style={[s.ownerText, on && { color: colors.primary }]}>{m.name}</Text>
                    {on && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={s.hint}>{L('Only the family admin can change who owns this car.', 'רק מנהל/ת המשפחה יכול/ה לשנות מי הבעלים של הרכב.')}</Text>
        )}
        {owners.length > 0 && (
          <Text style={s.hint}>
            {L(
              `When someone else books ${car.name || 'this car'}, it waits for ${owners.length > 1 ? `one of ${ownerNames(state, car, 'and')}` : ownerNames(state, car)} to approve before it goes on the calendar.`,
              `כשמישהו אחר מזמין את ${car.name || 'הרכב הזה'}, ההזמנה מחכה לאישור של ${owners.length > 1 ? `אחד מ: ${ownerNames(state, car, 'and')}` : ownerNames(state, car)} לפני שהיא נכנסת ליומן.`,
            )}
          </Text>
        )}

        <Text style={s.section}>{L('Insurance', 'ביטוח')}</Text>
        <Label>{L('Who is insured to drive it?', 'למי יש ביטוח לנהוג בו?')}</Label>
        <View style={{ gap: space(2) }}>
          {state.members.map((m) => {
            const on = car.insuredMemberIds.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleInsured(m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[s.memberRow, on && { borderColor: colors.success, backgroundColor: colors.successSoft }]}
              >
                <Avatar member={m} size={30} />
                <Text style={s.memberName}>{m.name}</Text>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.success : colors.faint} />
              </Pressable>
            );
          })}
        </View>
        <Field label={L('Insurance company', 'חברת ביטוח')} placeholder={L('Optional', 'לא חובה')} value={car.insuranceCompany ?? ''} onChangeText={(insuranceCompany) => set({ insuranceCompany })} />

        <Label>{L('Insurance valid until', 'הביטוח בתוקף עד')}</Label>
        <Pressable style={s.dateField} onPress={() => setShowCalendar((v) => !v)}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={s.dateText}>{car.insuranceExpires ? formatDate(car.insuranceExpires) + ' ' + new Date(car.insuranceExpires).getFullYear() : L('Not set', 'לא הוגדר')}</Text>
          <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {showCalendar && (
          <View style={s.calendar}>
            <MonthGrid
              month={month}
              onChangeMonth={setMonth}
              selected={car.insuranceExpires ?? Date.now()}
              onSelect={(day) => {
                // Valid through the end of the chosen day.
                set({ insuranceExpires: endOfDay(day) - 1 });
                setShowCalendar(false);
              }}
            />
          </View>
        )}

        {error && <Banner tone="danger">{error}</Banner>}

        {existing && canManage && (
          <Button
            title={L('Delete car', 'מחיקת הרכב')}
            icon="trash-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm(L(`Delete ${existing.name}?`, `למחוק את ${existing.name}?`), L('All of its bookings will be deleted too.', 'גם כל ההזמנות שלו יימחקו.'))) {
                run((st) => deleteCar(st, existing.id));
              }
            }}
          />
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button title={L('Cancel', 'ביטול')} variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button
          title={L('Save', 'שמירה')}
          icon="checkmark"
          onPress={() => run((st) => upsertCar(st, { ...car, name: car.name.trim() }))}
          style={{ flex: 2 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4), paddingBottom: space(10) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: space(2) },
  row: { flexDirection: 'row', gap: space(3), flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchSelected: { borderWidth: 3, borderColor: colors.text },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(2.5),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ownerChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  ownerText: { fontSize: 15, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: -space(2) },
  memberName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(3),
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  calendar: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(3) },
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), borderTopWidth: 1, borderTopColor: colors.border },
});
