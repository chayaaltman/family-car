import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { effectiveEnd, isConfirmed, statusOf } from '../logic/bookings';
import { formatRange } from '../logic/time';
import { colors, radius, space } from '../theme';
import type { Booking, FamilyState } from '../types';
import { Avatar, Chip } from './ui';

export function BookingRow({
  booking,
  state,
  meId,
  onPress,
}: {
  booking: Booking;
  state: FamilyState;
  meId: string;
  onPress: () => void;
}) {
  const car = state.cars.find((c) => c.id === booking.carId);
  const member = state.members.find((m) => m.id === booking.memberId);
  const now = Date.now();
  const end = effectiveEnd(booking);
  const active = isConfirmed(booking) && booking.start <= now && now < end;
  const status = statusOf(booking);
  const owner = state.members.find((m) => m.id === car?.ownerId);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, status !== 'approved' && s.unconfirmed, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.stripe, { backgroundColor: car?.color ?? colors.border }]} />
      {member && <Avatar member={member} size={36} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.title} numberOfLines={1}>
          {booking.memberId === meId ? 'You' : member?.name ?? 'Someone'} · {car?.name ?? 'Deleted car'}
        </Text>
        <Text style={s.time}>{formatRange(booking.start, end, now)}</Text>
        {booking.destination || booking.purpose ? (
          <Text style={s.purpose} numberOfLines={1}>
            {[booking.destination && `📍 ${booking.destination}`, booking.purpose].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {status === 'pending' ? (
        <Chip label={`Waiting for ${owner?.name ?? 'owner'}`} color={colors.warning} icon="time-outline" />
      ) : status === 'declined' ? (
        <Chip label="Declined" color={colors.danger} icon="close-circle-outline" />
      ) : active ? (
        <Chip label="Now" color={colors.success} selected />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    paddingLeft: space(4),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  // Requests get a dashed outline so they don't look like confirmed bookings.
  unconfirmed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  time: { fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  purpose: { fontSize: 13, color: colors.faint },
});
