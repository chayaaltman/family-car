import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Card, Chip, EmptyState, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { effectiveEnd } from '../logic/bookings';
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

  const visible = state.bookings.filter((b) => who === 'everyone' || b.memberId === me.id);
  const upcoming = visible.filter((b) => effectiveEnd(b) > now).sort((a, b) => a.start - b.start);
  const past = visible
    .filter((b) => effectiveEnd(b) <= now)
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
