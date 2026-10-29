import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { bookingsOnDay, effectiveEnd } from '../logic/bookings';
import { HOUR, MINUTE, endOfDay, formatTime, isSameDay, startOfDay } from '../logic/time';
import { colors, onColor, radius, space, tint } from '../theme';
import type { Booking, Car, Member } from '../types';

const HOUR_HEIGHT = 56;
const GUTTER = 48;

interface Props {
  day: number;
  cars: Car[];
  bookings: Booking[];
  members: Member[];
  meId: string;
  onPressBooking: (b: Booking) => void;
  /** Tapping an empty spot starts a booking for that car at that time. */
  onPressEmpty: (carId: string, time: number) => void;
}

/**
 * One column per car, one row per hour. Each booking is a block colored by the
 * person who booked it, so "who has which car when" is readable at a glance.
 */
export function DayTimeline({ day, cars, bookings, members, meId, onPressBooking, onPressEmpty }: Props) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [now, setNow] = useState(Date.now());
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const isToday = isSameDay(day, now);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(t);
  }, []);

  // Open on the current hour for today, otherwise at 7:00.
  useEffect(() => {
    const hour = isToday ? Math.max(0, new Date().getHours() - 1) : 7;
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y: hour * HOUR_HEIGHT, animated: false }), 0);
    return () => clearTimeout(id);
  }, [dayStart, isToday]);

  const y = (t: number) => ((Math.min(Math.max(t, dayStart), dayEnd) - dayStart) / HOUR) * HOUR_HEIGHT;
  const memberById = new Map(members.map((m) => [m.id, m]));
  // On daylight-saving days a "day" is 23 or 25 hours long.
  const hours = Math.round((dayEnd - dayStart) / HOUR);

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.headerRow, { paddingLeft: GUTTER }]}>
        {cars.map((car) => (
          <View key={car.id} style={s.headerCell}>
            <Ionicons name="car-sport" size={16} color={car.color} />
            <Text numberOfLines={1} style={[s.headerText, { color: car.color }]}>
              {car.name}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space(24) }}>
        <View style={{ height: hours * HOUR_HEIGHT + 12, flexDirection: 'row', marginTop: 6 }}>
          {/* Hour labels */}
          <View style={{ width: GUTTER }}>
            {Array.from({ length: hours + 1 }, (_, h) => (
              <Text key={h} style={[s.hourLabel, { top: h * HOUR_HEIGHT - 7 }]}>
                {String(h % 24).padStart(2, '0')}:00
              </Text>
            ))}
          </View>

          {cars.map((car) => (
            <View key={car.id} style={s.column}>
              {Array.from({ length: hours }, (_, h) => (
                <Pressable
                  key={h}
                  accessibilityLabel={`Book ${car.name} at ${h}:00`}
                  onPress={() => onPressEmpty(car.id, dayStart + h * HOUR)}
                  style={({ pressed }) => [
                    s.hourSlot,
                    { top: h * HOUR_HEIGHT },
                    pressed && { backgroundColor: tint(car.color, 0.9) },
                  ]}
                />
              ))}

              {bookingsOnDay(bookings.filter((b) => b.carId === car.id), day).map((b) => {
                const member = memberById.get(b.memberId);
                const color = member?.color ?? colors.muted;
                const top = y(b.start);
                const height = Math.max(y(effectiveEnd(b)) - top, 26);
                const mine = b.memberId === meId;
                const compact = height < 48;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => onPressBooking(b)}
                    accessibilityLabel={`${member?.name ?? 'Someone'} has ${car.name} ${formatTime(b.start)} to ${formatTime(effectiveEnd(b))}`}
                    style={[
                      s.block,
                      {
                        top,
                        height,
                        backgroundColor: mine ? color : tint(color, 0.8),
                        borderLeftColor: color,
                      },
                    ]}
                  >
                    <Text numberOfLines={1} style={[s.blockName, { color: mine ? onColor(color) : colors.text }]}>
                      {mine ? 'You' : member?.name ?? 'Someone'}
                      {compact ? `  ${formatTime(b.start)}` : ''}
                    </Text>
                    {!compact && (
                      <Text numberOfLines={1} style={[s.blockTime, { color: mine ? onColor(color) : colors.muted }]}>
                        {formatTime(b.start)}–{formatTime(effectiveEnd(b))}
                        {b.start < dayStart ? ' (from earlier)' : ''}
                      </Text>
                    )}
                    {height > 70 && b.purpose ? (
                      <Text numberOfLines={2} style={[s.blockTime, { color: mine ? onColor(color) : colors.muted }]}>
                        {b.purpose}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {isToday && (
            <View pointerEvents="none" style={[s.nowLine, { top: y(now), left: GUTTER - 4 }]}>
              <View style={s.nowDot} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  headerText: { fontWeight: '700', fontSize: 14 },
  hourLabel: { position: 'absolute', right: 8, fontSize: 11, color: colors.faint, fontVariant: ['tabular-nums'] },
  column: { flex: 1, borderLeftWidth: 1, borderLeftColor: colors.border, marginRight: 2 },
  hourSlot: { position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: colors.border },
  block: {
    position: 'absolute',
    left: 3,
    right: 3,
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  blockName: { fontWeight: '700', fontSize: 13 },
  blockTime: { fontSize: 12, fontVariant: ['tabular-nums'] },
  nowLine: { position: 'absolute', right: 0, height: 2, backgroundColor: colors.danger },
  nowDot: { position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
});
