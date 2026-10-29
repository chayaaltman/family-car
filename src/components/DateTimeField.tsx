import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MINUTE, formatDayLabel, formatTime, withDate, withTime } from '../logic/time';
import { colors, radius, space } from '../theme';
import { MonthGrid } from './MonthGrid';
import { Button, Label } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Shows a date + time and opens a picker accurate to the minute. */
export function DateTimeField({
  label,
  value,
  onChange,
  minDay,
}: {
  label: string;
  value: number;
  onChange: (t: number) => void;
  minDay?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space(1.5) }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDayLabel(value)} at ${formatTime(value)}. Tap to change.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.field, pressed && { opacity: 0.7 }]}
      >
        <View style={s.fieldPart}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={s.fieldText}>{formatDayLabel(value)}</Text>
        </View>
        <View style={s.fieldPart}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={[s.fieldText, s.mono]}>{formatTime(value)}</Text>
        </View>
      </Pressable>
      {open && (
        <DateTimeSheet
          title={label}
          value={value}
          minDay={minDay}
          onCancel={() => setOpen(false)}
          onDone={(t) => {
            onChange(t);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

function DateTimeSheet({
  title,
  value,
  minDay,
  onCancel,
  onDone,
}: {
  title: string;
  value: number;
  minDay?: number;
  onCancel: () => void;
  onDone: (t: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(value);
  const d = new Date(draft);
  const hour = d.getHours();
  const minute = d.getMinutes();

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel} accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>{title}</Text>
          <Text style={[s.sheetTitle, s.mono, { color: colors.primary }]}>
            {formatDayLabel(draft)} · {formatTime(draft)}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: space(4) }}>
          <MonthGrid
            month={month}
            selected={draft}
            minDay={minDay}
            onChangeMonth={setMonth}
            onSelect={(day) => setDraft(withDate(draft, day))}
          />

          <Text style={s.groupLabel}>Hour</Text>
          <View style={s.grid}>
            {Array.from({ length: 24 }, (_, h) => (
              <Cell key={h} label={pad(h)} selected={h === hour} onPress={() => setDraft(withTime(draft, h, minute))} />
            ))}
          </View>

          <Text style={s.groupLabel}>Minute</Text>
          <View style={s.grid}>
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <Cell key={m} label={`:${pad(m)}`} selected={m === minute} onPress={() => setDraft(withTime(draft, hour, m))} />
            ))}
          </View>
          <View style={s.fineRow}>
            <Pressable accessibilityLabel="One minute earlier" style={s.fineBtn} onPress={() => setDraft(draft - MINUTE)}>
              <Ionicons name="remove" size={20} color={colors.primary} />
            </Pressable>
            <Text style={[s.fineText, s.mono]}>{formatTime(draft)}</Text>
            <Pressable accessibilityLabel="One minute later" style={s.fineBtn} onPress={() => setDraft(draft + MINUTE)}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={s.hint}>Use − / + for exact minutes</Text>
        </ScrollView>
        <View style={s.actions}>
          <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
          <Button title="Done" onPress={() => onDone(draft)} style={{ flex: 2 }} />
        </View>
      </View>
    </Modal>
  );
}

function Cell({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.cell, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[s.cellText, s.mono, selected && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
  },
  fieldPart: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  fieldText: { fontSize: 16, fontWeight: '600', color: colors.text },
  mono: { fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space(4),
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(3) },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  groupLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: space(4), marginBottom: space(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  cell: {
    width: '14.5%',
    flexGrow: 1,
    paddingVertical: space(2.5),
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cellText: { fontSize: 15, color: colors.text },
  fineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(5), marginTop: space(4) },
  fineBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fineText: { fontSize: 24, fontWeight: '700', color: colors.text, minWidth: 80, textAlign: 'center' },
  hint: { textAlign: 'center', color: colors.faint, fontSize: 12, marginTop: space(1) },
  actions: { flexDirection: 'row', gap: space(3), paddingTop: space(3) },
});
