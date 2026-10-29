import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Avatar, Banner, Button, Card, Chip, EmptyState, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { carStatus, effectiveEnd, insuranceWarning } from '../logic/bookings';
import { HOUR, MINUTE, formatDayLabel, formatDuration, formatTime } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import type { Car, FamilyState } from '../types';
import { FUEL_LABELS } from './BookingDetails';

/** Re-render every minute so "free for 2h 10m" stays accurate. */
export function useNow(intervalMs = 30 * 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function timeAgo(t: number, now: number): string {
  const diff = now - t;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))} min ago`;
  if (diff < 24 * HOUR) return `${Math.round(diff / HOUR)}h ago`;
  return formatDayLabel(t, now);
}

export function HomeScreen() {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const now = useNow();

  const myUpcoming = state.bookings
    .filter((b) => b.memberId === me.id && effectiveEnd(b) > now)
    .sort((a, b) => a.start - b.start);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.hello}>Hi {me.name} 👋</Text>
      <Text style={s.sub}>{state.familyName}</Text>

      <Button title="Book a car" icon="add-circle-outline" onPress={() => sheets.newBooking()} style={{ marginTop: space(4) }} />

      <SectionTitle>Cars right now</SectionTitle>
      {state.cars.length === 0 && (
        <Card>
          <EmptyState icon="car-outline" title="No cars yet" text="Add your family's cars in the Family tab." />
        </Card>
      )}
      <View style={{ gap: space(3) }}>
        {state.cars.map((car) => (
          <CarCard key={car.id} car={car} state={state} meId={me.id} now={now} onBook={() => sheets.newBooking({ carId: car.id })} onOpenBooking={sheets.showBooking} onEdit={() => sheets.editCar(car.id)} />
        ))}
      </View>

      <SectionTitle>Your next bookings</SectionTitle>
      {myUpcoming.length === 0 ? (
        <Card>
          <EmptyState icon="calendar-clear-outline" title="Nothing booked" text="When you book a car it shows up here." />
        </Card>
      ) : (
        <View style={{ gap: space(2) }}>
          {myUpcoming.slice(0, 3).map((b) => (
            <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function CarCard({
  car,
  state,
  meId,
  now,
  onBook,
  onOpenBooking,
  onEdit,
}: {
  car: Car;
  state: FamilyState;
  meId: string;
  now: number;
  onBook: () => void;
  onOpenBooking: (id: string) => void;
  onEdit: () => void;
}) {
  const status = carStatus(state, car.id, now);
  const nameOf = (id: string) => (id === meId ? 'You' : state.members.find((m) => m.id === id)?.name ?? 'Someone');
  const warning = insuranceWarning(car, now);
  const insured = state.members.filter((m) => car.insuredMemberIds.includes(m.id));
  const report = car.lastReport;

  return (
    <Card style={{ gap: space(3), borderTopWidth: 4, borderTopColor: car.color }}>
      <View style={s.carHeader}>
        <Ionicons name="car-sport" size={30} color={car.color} />
        <View style={{ flex: 1 }}>
          <Text style={s.carName}>{car.name}</Text>
          <Text style={s.muted}>
            {[car.model, car.plate, car.seats ? `${car.seats} seats` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Ionicons name="create-outline" size={20} color={colors.faint} onPress={onEdit} accessibilityLabel={`Edit ${car.name}`} />
      </View>

      {status.kind === 'in-use' ? (
        <View style={[s.status, { backgroundColor: colors.dangerSoft }]}>
          <View style={[s.dot, { backgroundColor: colors.danger }]} />
          <Text style={[s.statusText, { color: colors.danger }]} onPress={() => onOpenBooking(status.booking.id)}>
            {nameOf(status.booking.memberId)} {status.booking.memberId === meId ? 'have' : 'has'} it until {formatTime(effectiveEnd(status.booking))}
            {status.booking.destination ? ` · going to ${status.booking.destination}` : ''}
          </Text>
        </View>
      ) : (
        <View style={[s.status, { backgroundColor: colors.successSoft }]}>
          <View style={[s.dot, { backgroundColor: colors.success }]} />
          <Text style={[s.statusText, { color: colors.success }]}>
            {status.next
              ? `Free for ${formatDuration(status.next.start - now)} · next: ${nameOf(status.next.memberId)} ${formatDayLabel(status.next.start, now).toLowerCase()} at ${formatTime(status.next.start)}`
              : 'Free — no upcoming bookings'}
          </Text>
        </View>
      )}

      {report && (
        <View style={s.report}>
          <Ionicons name="location-outline" size={16} color={colors.muted} />
          <Text style={s.reportText}>
            {report.parkedAt ?? 'Location not noted'}
            {report.fuel ? ` · Fuel ${FUEL_LABELS[report.fuel]}` : ''}
            {report.note ? ` · “${report.note}”` : ''}
            <Text style={{ color: colors.faint }}>  — {nameOf(report.memberId)}, {timeAgo(report.at, now)}</Text>
          </Text>
        </View>
      )}

      <View style={{ gap: space(2) }}>
        <Text style={s.label}>
          <Ionicons name="shield-checkmark-outline" size={13} /> Insured drivers{car.insuranceCompany ? ` · ${car.insuranceCompany}` : ''}
        </Text>
        <View style={s.wrap}>
          {insured.length === 0 && <Text style={s.muted}>No one yet — edit the car to add drivers.</Text>}
          {insured.map((m) => (
            <View key={m.id} style={s.driver}>
              <Avatar member={m} size={22} />
              <Text style={s.driverName}>{m.id === meId ? 'You' : m.name}</Text>
            </View>
          ))}
        </View>
        {warning && <Banner tone={warning.includes('expired') ? 'danger' : 'warning'}>{warning}</Banner>}
      </View>

      {car.insuredMemberIds.includes(meId) ? (
        <Button small variant="secondary" icon="calendar-outline" title={`Book ${car.name}`} onPress={onBook} />
      ) : (
        <Chip label="You're not insured on this car" color={colors.muted} icon="lock-closed-outline" />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(12) },
  hello: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 2 },
  carHeader: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  carName: { fontSize: 19, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(2.5), borderRadius: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600' },
  report: { flexDirection: 'row', gap: space(1.5) },
  reportText: { flex: 1, fontSize: 13, color: colors.muted },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 999, paddingRight: 10, padding: 2 },
  driverName: { fontSize: 13, fontWeight: '600', color: colors.text },
});
