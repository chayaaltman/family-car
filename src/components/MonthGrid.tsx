import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMonths, isSameDay, monthGrid, monthNames, startOfDay, weekdaysShort } from '../logic/time';
import { colors, space } from '../theme';
import { L, forwardIcon } from '../i18n';

interface Props {
  month: number; // any timestamp inside the month to show
  selected: number;
  onSelect: (day: number) => void;
  onChangeMonth: (month: number) => void;
  /** Colored dots to draw under a day (e.g. one per booked car). */
  dotsForDay?: (day: number) => string[];
  /** Days before this can't be picked. */
  minDay?: number;
}

export function MonthGrid({ month, selected, onSelect, onChangeMonth, dotsForDay, minDay }: Props) {
  const days = monthGrid(month);
  const monthIndex = new Date(month).getMonth();
  const today = startOfDay(Date.now());

  return (
    <View>
      <View style={s.header}>
        <Pressable accessibilityLabel={L('Previous month', 'החודש הקודם')} hitSlop={10} onPress={() => onChangeMonth(addMonths(month, -1))}>
          <Ionicons name={forwardIcon('chevron-back', 'chevron-forward')} size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>
          {monthNames()[monthIndex]} {new Date(month).getFullYear()}
        </Text>
        <Pressable accessibilityLabel={L('Next month', 'החודש הבא')} hitSlop={10} onPress={() => onChangeMonth(addMonths(month, 1))}>
          <Ionicons name={forwardIcon('chevron-forward', 'chevron-back')} size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={s.row}>
        {weekdaysShort().map((d) => (
          <Text key={d} style={s.weekday}>
            {d.charAt(0)}
          </Text>
        ))}
      </View>

      {[0, 1, 2, 3, 4, 5].map((week) => (
        <View key={week} style={s.row}>
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const inMonth = new Date(day).getMonth() === monthIndex;
            const isSelected = isSameDay(day, selected);
            const isToday = day === today;
            const disabled = minDay !== undefined && day < startOfDay(minDay);
            const dots = dotsForDay?.(day) ?? [];
            return (
              <Pressable
                key={day}
                disabled={disabled}
                onPress={() => onSelect(day)}
                accessibilityLabel={new Date(day).toDateString()}
                accessibilityState={{ selected: isSelected, disabled }}
                style={s.cell}
              >
                <View style={[s.dayCircle, isSelected && s.selected, !isSelected && isToday && s.today]}>
                  <Text
                    style={[
                      s.dayText,
                      !inMonth && { color: colors.faint },
                      disabled && { color: colors.border },
                      isToday && !isSelected && { color: colors.primary, fontWeight: '700' },
                      isSelected && { color: '#fff', fontWeight: '700' },
                    ]}
                  >
                    {new Date(day).getDate()}
                  </Text>
                </View>
                <View style={s.dots}>
                  {dots.slice(0, 4).map((c, i) => (
                    <View key={i} style={[s.dot, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(3), paddingHorizontal: space(1) },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: space(1) },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.primary },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
