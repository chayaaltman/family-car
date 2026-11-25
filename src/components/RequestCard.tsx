import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLoadedFamily } from '../data/FamilyContext';
import { approveBooking, declineBooking, driverOf } from '../logic/bookings';
import { decisionMessage } from '../logic/messages';
import { useSheets } from '../navigation';
import { formatDuration, formatRange } from '../logic/time';
import { colors, radius, space } from '../theme';
import type { Booking } from '../types';
import { Avatar, Banner, Button, Card } from './ui';
import { L } from '../i18n';

/** Approve / decline buttons for a request on a car you own. */
export function RequestActions({ booking }: { booking: Booking }) {
  const { state, me, act } = useLoadedFamily();
  const sheets = useSheets();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'approve' | 'decline') => {
    setBusy(kind);
    setError(null);
    try {
      await act((s) =>
        kind === 'approve' ? approveBooking(s, booking.id, me.id) : declineBooking(s, booking.id, me.id, reason),
      );
      // Offer to tell the person who asked.
      const approved = kind === 'approve';
      // For a pick-up, the one who asked for the car is the driver.
      const askerId = driverOf(booking) ?? booking.memberId;
      const name = state.members.find((m) => m.id === askerId)?.name ?? '';
      sheets.message({
        to: askerId,
        title: approved ? L(`Approved! Tell ${name}`, `אושר! לעדכן את ${name}`) : L(`Declined. Tell ${name}`, `נדחה. לעדכן את ${name}`),
        text: decisionMessage(state, booking, approved, reason, me.id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space(2) }}>
      {declining ? (
        <>
          <TextInput
            style={s.input}
            placeholder={L('Reason (optional) – e.g. I need it for work', 'סיבה (לא חובה) – למשל: צריך אותו לעבודה')}
            placeholderTextColor={colors.faint}
            value={reason}
            onChangeText={setReason}
            maxLength={100}
            autoFocus
          />
          <View style={s.row}>
            <Button small title={L('Back', 'חזרה')} variant="ghost" onPress={() => setDeclining(false)} style={{ flex: 1 }} />
            <Button small title={L('Decline', 'דחייה')} icon="close" variant="danger" loading={busy === 'decline'} onPress={() => run('decline')} style={{ flex: 2 }} />
          </View>
        </>
      ) : (
        <View style={s.row}>
          <Button small title={L('Decline', 'דחייה')} icon="close" variant="danger" onPress={() => setDeclining(true)} style={{ flex: 1 }} />
          <Button small title={L('Approve', 'אישור')} icon="checkmark" loading={busy === 'approve'} onPress={() => run('approve')} style={{ flex: 2 }} />
        </View>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </View>
  );
}

/** "Eli wants the Corolla" card shown to the car's owner. */
export function RequestCard({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  const { state } = useLoadedFamily();
  const member = state.members.find((m) => m.id === (driverOf(booking) ?? booking.memberId));
  const rider = booking.pickup ? state.members.find((m) => m.id === booking.memberId) : undefined;
  const car = state.cars.find((c) => c.id === booking.carId);
  return (
    <Card style={{ gap: space(3), borderLeftWidth: 5, borderLeftColor: car?.color ?? colors.border }}>
      <View style={s.row}>
        {member && <Avatar member={member} size={40} />}
        <View style={{ flex: 1 }}>
          <Text style={s.title} onPress={onOpen}>
            {rider
              ? L(
                  `${member?.name ?? 'Someone'} wants ${car?.name ?? 'a car'} to pick up ${rider.name}`,
                  `${member?.name ?? 'מישהו'} מבקש/ת את ${car?.name ?? 'הרכב'} כדי לאסוף את ${rider.name}`,
                )
              : L(`${member?.name ?? 'Someone'} wants ${car?.name ?? 'a car'}`, `${member?.name ?? 'מישהו'} מבקש/ת את ${car?.name ?? 'הרכב'}`)}
          </Text>
          <Text style={s.time}>
            {formatRange(booking.start, booking.end)} · {formatDuration(booking.end - booking.start)}
          </Text>
          {booking.destination ? <Text style={s.note}>📍 {booking.destination}</Text> : null}
          {booking.purpose ? <Text style={s.note}>{booking.purpose}</Text> : null}
        </View>
      </View>
      <RequestActions booking={booking} />
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  time: { fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'], marginTop: 2 },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    fontSize: 15,
    color: colors.text,
  },
});
