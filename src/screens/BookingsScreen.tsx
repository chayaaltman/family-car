import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Card, Chip, EmptyState, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { effectiveEnd, requestsFor, statusOf } from '../logic/bookings';
import { RequestCard } from '../components/RequestCard';
import { formatDayLabel, startOfDay } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import type { Booking } from '../types';
import { useNow } from './HomeScreen';

/** Agenda view: every upcoming booking grouped by day. */
export function BookingsScreen() {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const now = useNow();
  const [who, setWho] = useState<'everyone' | 'me'>('everyone');
  const [showPast, setShowPast] = useState(false);

  const requests = requestsFor(state, me.id, now);
  const requestIds = new Set(requests.map((b) => b.id));
  // Approved bookings are public. Requests are only shown to the person asking
  // (the owner sees them in "Waiting for your OK" above). Declined ones only to the requester.
  const visible = state.bookings.filter((b) => {
    if (who === 'me' && b.memberId !== me.id) return false;
    const status = statusOf(b);
    if (status === 'approved') return true;
    if (status === 'pending') return b.memberId === me.id && !requestIds.has(b.id);
    return false;
  });
  const declined = state.bookings
    .filter((b) => statusOf(b) === 'declined' && b.memberId === me.id && b.end > now)
    .sort((a, b) => a.start - b.start);
  const upcoming = visible.filter((b) => effectiveEnd(b) > now).sort((a, b) => a.start - b.start);
  const past = visible
    .filter((b) => effectiveEnd(b) <= now && statusOf(b) === 'approved')
    .sort((a, b) => b.start - a.start)
    .slice(0, 20);

  const groups = new Map<number, Booking[]>();
  for (const b of upcoming) {
    // Bookings already in progress are listed under today.
    const key = Math.max(startOfDay(b.start), startOfDay(now));
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>Bookings</Text>
      <View style={s.tabs}>
        <Chip label="Everyone" icon="people-outline" selected={who === 'everyone'} onPress={() => setWho('everyone')} />
        <Chip label="Just me" icon="person-outline" selected={who === 'me'} onPress={() => setWho('me')} />
      </View>

      {requests.length > 0 && (
        <View>
          <SectionTitle>Waiting for your OK</SectionTitle>
          <View style={{ gap: space(3) }}>
            {requests.map((b) => (
              <RequestCard key={b.id} booking={b} onOpen={() => sheets.showBooking(b.id)} />
            ))}
          </View>
        </View>
      )}

      {declined.length > 0 && (
        <View>
          <SectionTitle>Declined</SectionTitle>
          <View style={{ gap: space(2) }}>
            {declined.map((b) => (
              <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
            ))}
          </View>
        </View>
      )}

      {upcoming.length === 0 && (
        <Card style={{ marginTop: space(4) }}>
          <EmptyState icon="calendar-clear-outline" title="No upcoming bookings" text="Tap “Book” to reserve a car." />
        </Card>
      )}

      {[...groups.entries()].map(([day, list]) => (
        <View key={day}>
          <SectionTitle>{formatDayLabel(day, now)}</SectionTitle>
          <View style={{ gap: space(2) }}>
            {list.map((b) => (
              <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
            ))}
          </View>
        </View>
      ))}

      {past.length > 0 && (
        <View>
          <SectionTitle right={<Chip label={showPast ? 'Hide' : 'Show'} onPress={() => setShowPast((v) => !v)} color={colors.muted} />}>
            Recent history
          </SectionTitle>
          {showPast && (
            <View style={{ gap: space(2), opacity: 0.75 }}>
              {past.map((b) => (
                <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(12) },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
});
