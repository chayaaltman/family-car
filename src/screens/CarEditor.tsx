import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MonthGrid } from '../components/MonthGrid';
import { Avatar, Banner, Button, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { CAR_COLORS } from '../data/seed';
import { deleteCar, newId, upsertCar } from '../logic/bookings';
import { DAY, endOfDay, formatDate } from '../logic/time';
import { colors, radius, space, tint } from '../theme';
import type { Car } from '../types';
import { confirm } from './BookingDetails';

export function CarEditor({ carId, onDone }: { carId?: string; onDone: () => void }) {
  const { state, act } = useLoadedFamily();
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
        <Text style={s.title}>{existing ? `Edit ${existing.name}` : 'Add a car'}</Text>

        <Field label="Nickname" placeholder="Corolla, the white one…" value={car.name} onChangeText={(name) => set({ name })} maxLength={24} />
        <Field label="Make & model" placeholder="Toyota Corolla 2019" value={car.model ?? ''} onChangeText={(model) => set({ model })} />
        <View style={s.row}>
          <View style={{ flex: 2 }}>
            <Field label="License plate" placeholder="12-345-67" value={car.plate ?? ''} onChangeText={(plate) => set({ plate })} autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Seats"
              keyboardType="number-pad"
              value={car.seats ? String(car.seats) : ''}
              onChangeText={(t) => set({ seats: parseInt(t, 10) || undefined })}
            />
          </View>
        </View>

        <Label>Color in the calendar</Label>
        <View style={s.row}>
          {CAR_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`Color ${c}`}
              accessibilityState={{ selected: car.color === c }}
              onPress={() => set({ color: c })}
              style={[s.swatch, { backgroundColor: c }, car.color === c && s.swatchSelected]}
            />
          ))}
        </View>

        <Text style={s.section}>Insurance</Text>
        <Label>Who is insured to drive it?</Label>
        <View style={{ gap: space(2) }}>
          {state.members.map((m) => {
            const on = car.insuredMemberIds.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleInsured(m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[s.memberRow, on && { borderColor: colors.success, backgroundColor: tint('#1F9D55', 0.92) }]}
              >
                <Avatar member={m} size={30} />
                <Text style={s.memberName}>{m.name}</Text>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.success : colors.faint} />
              </Pressable>
            );
          })}
        </View>
        <Field label="Insurance company" placeholder="Optional" value={car.insuranceCompany ?? ''} onChangeText={(insuranceCompany) => set({ insuranceCompany })} />

        <Label>Insurance valid until</Label>
        <Pressable style={s.dateField} onPress={() => setShowCalendar((v) => !v)}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={s.dateText}>{car.insuranceExpires ? formatDate(car.insuranceExpires) + ' ' + new Date(car.insuranceExpires).getFullYear() : 'Not set'}</Text>
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

        {existing && (
          <Button
            title="Delete car"
            icon="trash-outline"
            variant="danger"
            onPress={async () => {
              if (await confirm(`Delete ${existing.name}?`, 'All of its bookings will be deleted too.')) {
                run((st) => deleteCar(st, existing.id));
              }
            }}
          />
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button title="Cancel" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button
          title="Save"
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
