import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Card, EmptyState, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { carStatus, effectiveEnd, insuranceWarning, requestsFor, statusOf } from '../logic/bookings';
import { HOUR, MINUTE, formatDayLabel, formatTime } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, radius, shadow, space } from '../theme';
import type { Car, FamilyState } from '../types';

/** Re-render every 30s so "free until 17:00" stays accurate. */
export function useNow(intervalMs = 30 * 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function timeAgo(t: number, now: number): string {
  const diff = now - t;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))} min ago`;
  if (diff < 24 * HOUR) return `${Math.round(diff / HOUR)}h ago`;
  return formatDayLabel(t, now);
}

/** Cars tab: one compact row per car (tap for the full car page) + your next bookings. */
export function HomeScreen({ onOpenRequests }: { onOpenRequests: () => void }) {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const now = useNow();

  const myUpcoming = state.bookings
    .filter((b) => b.memberId === me.id && effectiveEnd(b) > now && statusOf(b) !== 'declined')
    .sort((a, b) => a.start - b.start);
  const requests = requestsFor(state, me.id, now);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.hello}>Hi {me.name} 👋</Text>

      {requests.length > 0 && (
        <Pressable onPress={onOpenRequests} style={({ pressed }) => [s.requests, pressed && { opacity: 0.8 }]}>
          <View style={s.requestsCount}>
            <Text style={s.requestsCountText}>{requests.length}</Text>
          </View>
          <Text style={s.requestsText}>
            {requests.length === 1 ? 'request is' : 'requests are'} waiting for your OK
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </Pressable>
      )}

      <SectionTitle>Cars</SectionTitle>
      {state.cars.length === 0 ? (
        <Card>
          <EmptyState icon="car-outline" title="No cars yet" text="Add your family's cars in the Family tab." />
        </Card>
      ) : (
        <View style={{ gap: space(2.5) }}>
          {state.cars.map((car) => (
            <CarRow key={car.id} car={car} state={state} meId={me.id} now={now} onPress={() => sheets.showCar(car.id)} />
          ))}
        </View>
      )}

      <SectionTitle>Your next</SectionTitle>
      {myUpcoming.length === 0 ? (
        <Text style={s.muted}>Nothing booked. Tap + to book a car.</Text>
      ) : (
        <View style={{ gap: space(2) }}>
          {myUpcoming.slice(0, 2).map((b) => (
            <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function CarRow({ car, state, meId, now, onPress }: { car: Car; state: FamilyState; meId: string; now: number; onPress: () => void }) {
  const status = carStatus(state, car.id, now);
  const nameOf = (id: string) => (id === meId ? 'You' : state.members.find((m) => m.id === id)?.name ?? 'Someone');
  const warning = insuranceWarning(car, now);
  const inUse = status.kind === 'in-use';
  const nextDay = status.kind === 'free' && status.next ? formatDayLabel(status.next.start, now) : '';
  const line = inUse
    ? `${nameOf(status.booking.memberId)} until ${formatTime(effectiveEnd(status.booking))}${status.booking.destination ? ` · ${status.booking.destination}` : ''}`
    : status.next
      ? `Free until ${nextDay === 'Today' ? '' : nextDay.toLowerCase() + ' '}${formatTime(status.next.start)}`
      : 'Free';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.name}. ${line}. Open details.`}
      onPress={onPress}
      style={({ pressed }) => [s.carRow, pressed && { opacity: 0.75 }]}
    >
      <View style={[s.carIcon, { backgroundColor: car.color }]}>
        <Ionicons name="car-sport" size={26} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.nameRow}>
          <Text style={s.carName} numberOfLines={1}>
            {car.name}
          </Text>
          {warning && <Ionicons name="alert-circle" size={16} color={warning.includes('expired') ? colors.danger : colors.warning} />}
        </View>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: inUse ? colors.danger : colors.success }]} />
          <Text style={[s.status, { color: inUse ? colors.danger : colors.success }]} numberOfLines={1}>
            {line}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(12) },
  hello: { fontSize: 28, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    marginTop: space(4),
    padding: space(3),
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  requestsCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestsCountText: { color: '#fff', fontWeight: '800' },
  requestsText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.warning },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...shadow,
  },
  carIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  carName: { fontSize: 18, fontWeight: '800', color: colors.text, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { flex: 1, fontSize: 14, fontWeight: '600' },
});
