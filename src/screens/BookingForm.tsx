import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Avatar, Banner, Button, Chip, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { RuleError, isConfirmed, isInsured, needsApproval, saveBooking, validateBooking } from '../logic/bookings';
import { HOUR, MINUTE, endOfDay, formatDuration, formatRange, roundUpToMinutes } from '../logic/time';
import { colors, radius, space, tint } from '../theme';

export interface BookingFormInit {
  bookingId?: string;
  carId?: string;
  start?: number;
}

const QUICK_DURATIONS = [
  { label: '30m', ms: 30 * MINUTE },
  { label: '1h', ms: HOUR },
  { label: '2h', ms: 2 * HOUR },
  { label: '3h', ms: 3 * HOUR },
  { label: '5h', ms: 5 * HOUR },
];

export function BookingForm({ init, onDone }: { init: BookingFormInit; onDone: () => void }) {
  const { state, me, act } = useLoadedFamily();
  const existing = init.bookingId ? state.bookings.find((b) => b.id === init.bookingId) : undefined;

  const [memberId, setMemberId] = useState(existing?.memberId ?? me.id);
  const [carId, setCarId] = useState(
    existing?.carId ??
      init.carId ??
      state.cars.find((c) => isInsured(c, me.id, Date.now()))?.id ??
      state.cars[0]?.id,
  );
  const [start, setStart] = useState(existing?.start ?? init.start ?? roundUpToMinutes(Date.now(), 15));
  const [end, setEnd] = useState(existing?.end ?? start + HOUR);
  const [purpose, setPurpose] = useState(existing?.purpose ?? '');
  const [destination, setDestination] = useState(existing?.destination ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const draft = {
    id: existing?.id,
    carId: carId ?? '',
    memberId,
    start,
    end,
    purpose: purpose.trim() || undefined,
    destination: destination.trim() || undefined,
  };

  // Re-check the rules on every change so the user sees clashes before pressing Save.
  const check = useMemo(() => {
    try {
      validateBooking(state, draft);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof RuleError) return { ok: false as const, message: e.message, suggestion: e.suggestion };
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, carId, memberId, start, end, existing?.id]);

  const car = state.cars.find((c) => c.id === carId);
  const owner = state.members.find((m) => m.id === car?.ownerId);
  // Editing an approved booking keeps its approval unless the car, driver or times change.
  const timesChanged =
    !existing || existing.carId !== carId || existing.memberId !== memberId || existing.start !== start || existing.end !== end;
  const asksOwner =
    !!car && needsApproval(car, memberId) && (timesChanged || !isConfirmed(existing!));

  const changeStart = (t: number) => {
    // Moving the start keeps the same duration, like most calendar apps.
    setEnd(t + (end - start));
    setStart(t);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await act((s) => saveBooking(s, draft));
      onDone();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (state.cars.length === 0) {
    return (
      <View style={{ padding: space(5), gap: space(4) }}>
        <Banner tone="info">Add a car in the Family tab first.</Banner>
        <Button title="Close" variant="secondary" onPress={onDone} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{existing ? 'Edit booking' : 'Book a car'}</Text>

        <Label>Who's driving?</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowGap}>
          {state.members.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMemberId(m.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: m.id === memberId }}
              style={[s.person, m.id === memberId && { borderColor: m.color, backgroundColor: tint(m.color, 0.88) }]}
            >
              <Avatar member={m} size={28} />
              <Text style={s.personName}>{m.id === me.id ? `${m.name} (me)` : m.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Label>Which car?</Label>
        <View style={s.cars}>
          {state.cars.map((c) => {
            const insured = isInsured(c, memberId, start);
            const selected = c.id === carId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCarId(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[s.carOption, selected && { borderColor: c.color, backgroundColor: tint(c.color, 0.9) }]}
              >
                <Ionicons name="car-sport" size={26} color={c.color} />
                <Text style={s.carName}>{c.name}</Text>
                <Text style={[s.carInsured, { color: insured ? colors.success : colors.danger }]}>
                  {insured ? '✓ Insured' : '✕ Not insured'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <DateTimeField label="From" value={start} onChange={changeStart} minDay={existing ? undefined : Date.now()} />
        <DateTimeField label="Until" value={end} onChange={setEnd} minDay={start} />

        <View style={s.rowWrap}>
          {QUICK_DURATIONS.map((d) => (
            <Chip key={d.label} label={d.label} selected={end - start === d.ms} onPress={() => setEnd(start + d.ms)} />
          ))}
          <Chip label="Rest of day" selected={end === endOfDay(start)} onPress={() => setEnd(endOfDay(start))} />
        </View>
        <Text style={s.duration}>Duration: {end > start ? formatDuration(end - start) : '—'}</Text>

        <Field
          label="Where to? (optional)"
          placeholder="Address, city or place – e.g. Grandma's, Haifa"
          value={destination}
          onChangeText={setDestination}
          maxLength={120}
          textContentType="fullStreetAddress"
        />

        <Field label="What for? (optional)" placeholder="Work, groceries, driving lesson…" value={purpose} onChangeText={setPurpose} maxLength={80} />

        {check.ok ? (
          <View style={{ gap: space(2) }}>
            {asksOwner && (
              <Banner tone="info" icon="key-outline">
                {car?.name} belongs to {owner?.name}. It goes on the calendar once {owner?.name} approves.
              </Banner>
            )}
            <Banner tone="success">{car?.name} is free then.</Banner>
          </View>
        ) : (
          <View style={{ gap: space(2) }}>
            <Banner tone="danger">{check.message}</Banner>
            {check.suggestion && (
              <Button
                small
                variant="secondary"
                icon="flash-outline"
                title={`Next free: ${formatRange(check.suggestion.start, check.suggestion.end)}`}
                onPress={() => {
                  setStart(check.suggestion!.start);
                  setEnd(check.suggestion!.end);
                }}
              />
            )}
          </View>
        )}
        {saveError && <Banner tone="danger">{saveError}</Banner>}
      </ScrollView>

      <View style={s.footer}>
        <Button title="Cancel" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button
          title={asksOwner ? `Ask ${owner?.name}` : existing ? 'Save changes' : 'Book it'}
          icon={asksOwner ? 'paper-plane-outline' : 'checkmark'}
          disabled={!check.ok}
          loading={saving}
          onPress={save}
          style={{ flex: 2 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4), paddingBottom: space(10) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  rowGap: { gap: space(2) },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(1.5),
    paddingLeft: space(1.5),
    paddingRight: space(3),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  personName: { fontSize: 15, fontWeight: '600', color: colors.text },
  cars: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  carOption: {
    flexGrow: 1,
    flexBasis: '40%',
    alignItems: 'center',
    gap: space(1),
    padding: space(3),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  carName: { fontSize: 16, fontWeight: '700', color: colors.text },
  carInsured: { fontSize: 12, fontWeight: '600' },
  duration: { color: colors.muted, fontSize: 13, marginTop: -space(2) },
  footer: {
    flexDirection: 'row',
    gap: space(3),
    padding: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
