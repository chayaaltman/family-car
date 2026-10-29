import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Chip, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { cancelBooking, effectiveEnd, isConfirmed, returnCar, statusOf } from '../logic/bookings';
import { RequestActions } from '../components/RequestCard';
import { formatDuration, formatRange } from '../logic/time';
import { colors, space } from '../theme';
import type { FuelLevel } from '../types';

export const FUEL_LABELS: Record<FuelLevel, string> = {
  empty: 'Empty',
  quarter: '¼',
  half: '½',
  'three-quarters': '¾',
  full: 'Full',
};

/** Cross-platform "are you sure?" (Alert.alert has no buttons on web). */
export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Yes', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export function BookingDetails({
  bookingId,
  onClose,
  onEdit,
}: {
  bookingId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { state, me, act } = useLoadedFamily();
  const [returning, setReturning] = useState(false);
  const [parkedAt, setParkedAt] = useState('');
  const [fuel, setFuel] = useState<FuelLevel | undefined>();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return (
      <View style={s.content}>
        <Banner tone="info">This booking was cancelled.</Banner>
        <Button title="Close" variant="secondary" onPress={onClose} />
      </View>
    );
  }
  const car = state.cars.find((c) => c.id === booking.carId);
  const member = state.members.find((m) => m.id === booking.memberId);
  const now = Date.now();
  const end = effectiveEnd(booking);
  const mine = booking.memberId === me.id;
  const status = statusOf(booking);
  const active = isConfirmed(booking) && booking.start <= now && now < end;
  const past = end <= now;
  const owner = state.members.find((m) => m.id === car?.ownerId);
  const decider = state.members.find((m) => m.id === booking.decidedBy);
  const iAmOwner = !!car && car.ownerId === me.id;

  const run = async (fn: Parameters<typeof act>[0]) => {
    try {
      await act(fn);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remindOwner = () =>
    Share.share({
      message: `Hi ${owner?.name}! I asked for ${car?.name} ${formatRange(booking.start, booking.end)}${booking.destination ? ` to go to ${booking.destination}` : ''}. Can you approve it in Family Car? 🙏 – ${me.name}`,
    }).catch(() => undefined);

  const askForCar = () =>
    Share.share({
      message: `Hi ${member?.name}! I saw you have ${car?.name} ${formatRange(booking.start, end)}. Any chance we can work something out? 🚗 – ${me.name}`,
    }).catch(() => undefined);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}>
        <Ionicons name="car-sport" size={34} color={car?.color ?? colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{car?.name ?? 'Deleted car'}</Text>
          <Text style={s.subtitle}>{formatRange(booking.start, end)}</Text>
        </View>
        {active && <Chip label="Now" color={colors.success} selected />}
      </View>

      {status === 'pending' && (
        <Banner tone="warning" icon="time-outline">
          {iAmOwner
            ? `${member?.name} is asking for your ${car?.name}. It goes on the calendar only if you approve.`
            : `Waiting for ${owner?.name ?? 'the owner'} to approve. It's not on the calendar yet.`}
        </Banner>
      )}
      {status === 'declined' && (
        <Banner tone="danger">
          {`Declined by ${decider?.name ?? 'the owner'}`}
          {booking.declineReason ? `: “${booking.declineReason}”` : '.'}
        </Banner>
      )}
      {status === 'approved' && booking.decidedBy && (
        <Banner tone="success">{`Approved by ${decider?.name ?? 'the owner'}`}</Banner>
      )}

      <View style={s.row}>
        {member && <Avatar member={member} size={40} />}
        <View>
          <Text style={s.name}>{mine ? `${member?.name} (you)` : member?.name}</Text>
          <Text style={s.muted}>{formatDuration(end - booking.start)}{booking.returnedAt ? ' · returned early' : ''}</Text>
        </View>
      </View>

      {booking.destination && (
        <View style={s.row}>
          <Ionicons name="location-outline" size={20} color={colors.muted} />
          <Text style={[s.body, { fontWeight: '600' }]}>{booking.destination}</Text>
          <Button
            small
            variant="secondary"
            icon="navigate-outline"
            title="Waze"
            onPress={() => Linking.openURL(`https://waze.com/ul?q=${encodeURIComponent(booking.destination!)}&navigate=yes`)}
          />
        </View>
      )}

      {booking.purpose && (
        <View style={s.row}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.muted} />
          <Text style={s.body}>{booking.purpose}</Text>
        </View>
      )}

      {error && <Banner tone="danger">{error}</Banner>}

      {returning ? (
        <View style={{ gap: space(4) }}>
          <Text style={s.section}>Leave a note for the next driver</Text>
          <Field label="Where did you park?" placeholder="Driveway, street, mall parking level 2…" value={parkedAt} onChangeText={setParkedAt} />
          <Label>Fuel left</Label>
          <View style={s.wrap}>
            {(Object.keys(FUEL_LABELS) as FuelLevel[]).map((f) => (
              <Chip key={f} label={FUEL_LABELS[f]} selected={fuel === f} onPress={() => setFuel(f)} icon="speedometer-outline" />
            ))}
          </View>
          <Field label="Anything else?" placeholder="Needs a wash, warning light…" value={note} onChangeText={setNote} />
          <Button
            title="Return car"
            icon="key-outline"
            onPress={() =>
              run((st) =>
                returnCar(st, booking.id, {
                  parkedAt: parkedAt.trim() || undefined,
                  fuel,
                  note: note.trim() || undefined,
                }),
              )
            }
          />
          <Button title="Back" variant="ghost" onPress={() => setReturning(false)} />
        </View>
      ) : (
        <View style={{ gap: space(3), marginTop: space(2) }}>
          {iAmOwner && status === 'pending' && !past && <RequestActions booking={booking} onDone={onClose} />}
          {mine && status === 'pending' && !iAmOwner && !past && (
            <Button title={`Remind ${owner?.name ?? 'the owner'}`} icon="notifications-outline" variant="secondary" onPress={remindOwner} />
          )}
          {mine && active && <Button title="I'm back – return the car" icon="key-outline" onPress={() => setReturning(true)} />}
          {mine && !past && (
            <Button
              title={status === 'declined' ? 'Change it & ask again' : 'Edit time or car'}
              icon="create-outline"
              variant="secondary"
              onPress={onEdit}
            />
          )}
          {mine && !past && (
            <Button
              title={status === 'approved' ? 'Cancel booking' : status === 'pending' ? 'Cancel request' : 'Remove'}
              icon="trash-outline"
              variant="danger"
              onPress={async () => {
                if (status === 'declined' || (await confirm('Cancel?', status === 'pending' ? 'Your request will be withdrawn.' : `${car?.name} will be free for others.`))) {
                  run((st) => cancelBooking(st, booking.id));
                }
              }}
            />
          )}
          {!mine && !past && status === 'approved' && (
            <Button title={`Message ${member?.name ?? 'them'} about it`} icon="chatbubbles-outline" variant="secondary" onPress={askForCar} />
          )}
          <Button title="Close" variant="ghost" onPress={onClose} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  body: { fontSize: 15, color: colors.text, flex: 1 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
