import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DayTimeline } from '../components/DayTimeline';
import { MonthGrid } from '../components/MonthGrid';
import { Avatar, Chip } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { bookingsOnDay } from '../logic/bookings';
import { HOUR, addDays, formatDate, formatDayLabel, roundUpToMinutes, startOfDay } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, radius, shadow, space } from '../theme';

export function CalendarScreen() {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const [day, setDay] = useState(startOfDay(Date.now()));
  const [month, setMonth] = useState(day);
  const [showMonth, setShowMonth] = useState(false);
  const [carFilter, setCarFilter] = useState<string | null>(null);

  const cars = carFilter ? state.cars.filter((c) => c.id === carFilter) : state.cars;
  const carIds = new Set(cars.map((c) => c.id));
  const bookings = state.bookings.filter((b) => carIds.has(b.carId));

  const goTo = (d: number) => {
    setDay(startOfDay(d));
    setMonth(d);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <View style={s.dayNav}>
          <Pressable accessibilityLabel="Previous day" hitSlop={10} onPress={() => goTo(addDays(day, -1))}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Pressable style={s.dayTitle} onPress={() => setShowMonth((v) => !v)} accessibilityLabel="Show month">
            <Text style={s.dayTitleText}>{formatDayLabel(day)}</Text>
            {formatDayLabel(day) !== formatDate(day) && <Text style={s.daySub}>{formatDate(day)}</Text>}
            <Ionicons name={showMonth ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </Pressable>
          <Pressable accessibilityLabel="Next day" hitSlop={10} onPress={() => goTo(addDays(day, 1))}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </Pressable>
        </View>

        {showMonth && (
          <View style={{ marginTop: space(3) }}>
            <MonthGrid
              month={month}
              selected={day}
              onChangeMonth={setMonth}
              onSelect={(d) => {
                goTo(d);
                setShowMonth(false);
              }}
              dotsForDay={(d) => {
                // One dot per member who has a car that day, in their color.
                const ids = [...new Set(bookingsOnDay(bookings, d).map((b) => b.memberId))];
                return ids.map((id) => state.members.find((m) => m.id === id)?.color ?? colors.muted);
              }}
            />
          </View>
        )}

        <View style={s.filters}>
          <Chip label="All cars" selected={carFilter === null} onPress={() => setCarFilter(null)} />
          {state.cars.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} icon="car-sport" selected={carFilter === c.id} onPress={() => setCarFilter(c.id)} />
          ))}
          {startOfDay(Date.now()) !== day && <Chip label="Today" icon="today-outline" onPress={() => goTo(Date.now())} color={colors.muted} />}
        </View>

        <View style={s.legend}>
          {state.members.map((m) => (
            <View key={m.id} style={s.legendItem}>
              <Avatar member={m} size={14} />
              <Text style={s.legendText}>{m.id === me.id ? 'You' : m.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.timelineCard}>
        <DayTimeline
          day={day}
          cars={cars}
          bookings={bookings}
          members={state.members}
          meId={me.id}
          onPressBooking={(b) => sheets.showBooking(b.id)}
          onPressEmpty={(carId, time) => {
            // Tapping the current hour starts the booking at the next quarter-hour, not in the past.
            const now = Date.now();
            const start = time <= now && now < time + HOUR ? roundUpToMinutes(now, 15) : time;
            sheets.newBooking({ carId, start });
          }}
        />
      </View>
      <Text style={s.hint}>Tap an empty hour to book it</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: space(4), paddingTop: space(3) },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  dayTitleText: { fontSize: 22, fontWeight: '800', color: colors.text },
  daySub: { fontSize: 14, color: colors.muted },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(3) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  timelineCard: {
    flex: 1,
    margin: space(3),
    marginBottom: 0,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow,
  },
  hint: { textAlign: 'center', fontSize: 12, color: colors.faint, paddingVertical: space(1.5) },
});
