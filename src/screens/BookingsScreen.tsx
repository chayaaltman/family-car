import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { MyPickupCard, PickupCard } from '../components/PickupCard';
import { RequestCard } from '../components/RequestCard';
import { myPickupRequests, openPickupsFor } from '../logic/pickups';
import { Card, Chip, EmptyState, Segmented, SectionTitle } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { effectiveEnd, requestsFor, statusOf, involves } from '../logic/bookings';
import { formatDayLabel, startOfDay } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import type { Booking } from '../types';
import { useNow } from './HomeScreen';
import { L } from '../i18n';

export type BookingsSection = 'upcoming' | 'requests' | 'history';

/**
 * Upcoming – approved bookings by day (everyone or just me).
 * Requests – ones waiting for your OK, pick-ups you could do, plus your own requests and pick-up requests.
 * History  – past bookings.
 */
export function BookingsScreen({
  section,
  onSection,
}: {
  section: BookingsSection;
  onSection: (s: BookingsSection) => void;
}) {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const now = useNow();
  const [who, setWho] = useState<'everyone' | 'me'>('everyone');

  const toApprove = requestsFor(state, me.id, now);
  const pickupsToTake = openPickupsFor(state, me.id, now);
  const myPickups = myPickupRequests(state, me.id, now);
  const myRequests = state.bookings
    .filter((b) => involves(b, me.id) && statusOf(b) !== 'approved' && b.end > now)
    .sort((a, b) => a.start - b.start);

  const approved = state.bookings.filter((b) => statusOf(b) === 'approved' && (who === 'everyone' || involves(b, me.id)));
  const upcoming = approved.filter((b) => effectiveEnd(b) > now).sort((a, b) => a.start - b.start);
  const past = approved
    .filter((b) => effectiveEnd(b) <= now)
    .sort((a, b) => b.start - a.start)
    .slice(0, 30);

  const groups = new Map<number, Booking[]>();
  for (const b of upcoming) {
    // Bookings already in progress are listed under today.
    const key = Math.max(startOfDay(b.start), startOfDay(now));
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  const row = (b: Booking) => (
    <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.title}>{L('Bookings', 'הזמנות')}</Text>
        <Segmented
          value={section}
          onChange={onSection}
          options={[
            { key: 'upcoming', label: L('Upcoming', 'קרובות') },
            { key: 'requests', label: L('Requests', 'בקשות'), badge: toApprove.length + pickupsToTake.length },
            { key: 'history', label: L('History', 'היסטוריה') },
          ]}
        />
        {section !== 'requests' && (
          <View style={s.filters}>
            <Chip label={L('Everyone', 'כולם')} icon="people-outline" selected={who === 'everyone'} onPress={() => setWho('everyone')} />
            <Chip label={L('Just me', 'רק אני')} icon="person-outline" selected={who === 'me'} onPress={() => setWho('me')} />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {section === 'upcoming' &&
          (upcoming.length === 0 ? (
            <Card>
              <EmptyState icon="calendar-clear-outline" title={L('No upcoming bookings', 'אין הזמנות קרובות')} text={L('Tap + to book a car.', 'לוחצים על + כדי להזמין רכב.')} />
            </Card>
          ) : (
            [...groups.entries()].map(([day, list]) => (
              <View key={day}>
                <SectionTitle>{formatDayLabel(day, now)}</SectionTitle>
                <View style={{ gap: space(2) }}>{list.map(row)}</View>
              </View>
            ))
          ))}

        {section === 'requests' && (
          <>
            {toApprove.length > 0 && (
              <View>
                <SectionTitle>{L('Waiting for your OK', 'מחכות לאישור שלי')}</SectionTitle>
                <View style={{ gap: space(3) }}>
                  {toApprove.map((b) => (
                    <RequestCard key={b.id} booking={b} onOpen={() => sheets.showBooking(b.id)} />
                  ))}
                </View>
              </View>
            )}
            {pickupsToTake.length > 0 && (
              <View>
                <SectionTitle>{L('Can you pick someone up?', 'אפשר לאסוף מישהו?')}</SectionTitle>
                <View style={{ gap: space(3) }}>
                  {pickupsToTake.map((r) => (
                    <PickupCard key={r.id} requestId={r.id} />
                  ))}
                </View>
              </View>
            )}
            {myPickups.length > 0 && (
              <View>
                <SectionTitle>{L('Your pick-up requests', 'בקשות האיסוף שלי')}</SectionTitle>
                <View style={{ gap: space(3) }}>
                  {myPickups.map((r) => (
                    <MyPickupCard key={r.id} requestId={r.id} />
                  ))}
                </View>
              </View>
            )}
            {myRequests.length > 0 && (
              <View>
                <SectionTitle>{L('Your requests', 'הבקשות שלי')}</SectionTitle>
                <View style={{ gap: space(2) }}>{myRequests.map(row)}</View>
              </View>
            )}
            {toApprove.length === 0 && myRequests.length === 0 && pickupsToTake.length === 0 && myPickups.length === 0 && (
              <Card style={{ marginTop: space(4) }}>
                <EmptyState
                  icon="checkmark-done-outline"
                  title={L('No requests', 'אין בקשות')}
                  text={L('Car requests and pick-up requests show up here.', 'בקשות לרכב ובקשות איסוף יופיעו כאן.')}
                />
              </Card>
            )}
          </>
        )}

        {section === 'history' &&
          (past.length === 0 ? (
            <Card style={{ marginTop: space(4) }}>
              <EmptyState icon="time-outline" title={L('No past bookings yet', 'אין עדיין הזמנות קודמות')} />
            </Card>
          ) : (
            <View style={{ gap: space(2), marginTop: space(2) }}>{past.map(row)}</View>
          ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { padding: space(5), paddingBottom: space(1), gap: space(3) },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  filters: { flexDirection: 'row', gap: space(2) },
  content: { paddingHorizontal: space(5), paddingBottom: space(12) },
});
