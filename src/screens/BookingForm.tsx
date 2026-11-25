import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateTimeField } from '../components/DateTimeField';
import { Avatar, Banner, Button, Chip, Field, Label, Segmented } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { RuleError, isConfirmed, isInsured, needsApproval, newId, possibleDrivers, saveBooking, validateBooking, ownerNames, ownersOf } from '../logic/bookings';
import { joinNames } from '../logic/labels';
import { createPickupRequest, driversFor, isCarFree, validatePickupRequest } from '../logic/pickups';
import { HOUR, MINUTE, endOfDay, formatDuration, formatRange, roundUpToMinutes } from '../logic/time';
import { colors, deepen, radius, space, tint } from '../theme';
import { pickupRequestMessage, requestMessage } from '../logic/messages';
import { useSheets } from '../navigation';
import { L } from '../i18n';

export interface BookingFormInit {
  bookingId?: string;
  carId?: string;
  start?: number;
  /** Open in L('Pick me up', 'שיאספו אותי') mode. */
  pickup?: boolean;
}

// Quick lengths; labels come from formatDuration so they follow the language ("1h" / "1 ש׳").
const QUICK_DURATIONS = [
  { ms: 30 * MINUTE },
  { ms: HOUR },
  { ms: 2 * HOUR },
  { ms: 3 * HOUR },
  { ms: 5 * HOUR },
];

export function BookingForm({ init, onDone }: { init: BookingFormInit; onDone: () => void }) {
  const { state, me, act } = useLoadedFamily();
  const sheets = useSheets();
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
  // L('Pick me up', 'שיאספו אותי'): ask everyone who could drive. No car is held until someone says yes and picks one.
  const [mode, setMode] = useState<'drive' | 'pickup'>(init.pickup ? 'pickup' : 'drive');
  const [place, setPlace] = useState('');
  const [pickCarIds, setPickCarIds] = useState<string[]>(() =>
    state.cars.filter((c) => c.insuredMemberIds.some((id) => id !== me.id)).map((c) => c.id),
  );
  const isPickup = mode === 'pickup' && !existing;
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
  const pickupDraft = { memberId, carIds: pickCarIds, start, end, place };

  // Re-check the rules on every change so the user sees clashes before pressing Save.
  const check = useMemo(() => {
    try {
      if (isPickup) validatePickupRequest(state, pickupDraft);
      else validateBooking(state, draft);
      return { ok: true as const };
    } catch (e) {
      if (e instanceof RuleError) return { ok: false as const, message: e.message, suggestion: e.suggestion };
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, carId, memberId, start, end, existing?.id, isPickup, place, pickCarIds]);

  const car = state.cars.find((c) => c.id === carId);
  const owners = car ? ownerNames(state, car) : '';
  const drivers = isPickup ? driversFor(state, pickupDraft) : [];
  const toggleCar = (id: string) =>
    setPickCarIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // Editing an approved booking keeps its approval unless the car, driver or times change.
  const timesChanged =
    !existing || existing.carId !== carId || existing.memberId !== memberId || existing.start !== start || existing.end !== end;
  const asksOwner =
    !isPickup && !!car && needsApproval(car, memberId) && (timesChanged || !isConfirmed(existing!));

  const changeStart = (t: number) => {
    // Moving the start keeps the same duration, like most calendar apps.
    setEnd(t + (end - start));
    setStart(t);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isPickup) {
        const id = newId();
        await act((s) => createPickupRequest(s, pickupDraft, Date.now(), id));
        const req = { ...pickupDraft, id, place: place.trim(), createdAt: Date.now() };
        // Ask the people who could drive, e.g. in the family WhatsApp group.
        sheets.message({
          to: drivers.map((m) => m.id),
          group: true,
          title: L('Pick-up requested!', 'בקשת האיסוף נשלחה!'),
          text: pickupRequestMessage(state, req),
          textFor: (names) => pickupRequestMessage(state, req, names),
        });
        return;
      }
      await act((s) => saveBooking(s, draft));
      const saved = { ...draft, id: draft.id ?? '', createdAt: Date.now() };
      if (asksOwner && car && owners) {
        // Offer to tell an owner on WhatsApp / SMS right away.
        sheets.message({
          to: ownersOf(car),
          title: L('Request sent!', 'הבקשה נשלחה!'),
          text: requestMessage(state, saved),
          textFor: (names) => requestMessage(state, saved, names),
        });
      } else {
        onDone();
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (state.cars.length === 0) {
    return (
      <View style={{ padding: space(5), gap: space(4) }}>
        <Banner tone="info">{L('Add a car in the Family tab first.', 'קודם צריך להוסיף רכב בלשונית משפחה.')}</Banner>
        <Button title={L('Close', 'סגירה')} variant="secondary" onPress={onDone} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{existing ? L('Edit booking', 'עריכת הזמנה') : isPickup ? L('Ask for a pick-up', 'בקשת איסוף') : L('Book a car', 'הזמנת רכב')}</Text>

        {!existing && (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { key: 'drive', label: L('I\'m driving', 'אני נוהג/ת') },
            { key: 'pickup', label: L('Pick me up', 'שיאספו אותי') },
          ]}
        />
        )}

        <Label>{isPickup ? L('Who needs a ride?', 'מי צריך הסעה?') : L('Who\'s driving?', 'מי נוהג?')}</Label>
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
              <Text style={s.personName}>{m.id === me.id ? L(`${m.name} (me)`, `${m.name} (אני)`) : m.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Label>{isPickup ? L('Which cars are OK? Pick one or more.', 'אילו רכבים מתאימים? אפשר לבחור כמה.') : L('Which car?', 'איזה רכב?')}</Label>
        <View style={s.cars}>
          {state.cars.map((c) => {
            const insured = isInsured(c, memberId, start);
            const canDrive = possibleDrivers(state, c, memberId).length;
            const free = isCarFree(state, c.id, start, end);
            const ok = isPickup ? canDrive > 0 && free : insured;
            const selected = isPickup ? pickCarIds.includes(c.id) : c.id === carId;
            return (
              <Pressable
                key={c.id}
                onPress={() => (isPickup ? toggleCar(c.id) : setCarId(c.id))}
                accessibilityRole={isPickup ? 'checkbox' : 'button'}
                accessibilityState={isPickup ? { checked: selected } : { selected }}
                style={[s.carOption, selected && { borderColor: c.color, backgroundColor: tint(c.color, 0.9) }]}
              >
                <Ionicons name={isPickup && selected ? 'checkbox' : 'car-sport'} size={24} color={deepen(c.color)} />
                <View>
                  <Text style={s.carName}>{c.name}</Text>
                  <Text style={[s.carInsured, { color: ok ? colors.success : colors.danger }]}>
                    {isPickup
                      ? !free
                        ? L('✕ Booked then', '✕ תפוס בזמן הזה')
                        : canDrive > 0
                          ? L(`✓ ${canDrive} can drive`, `✓ ${canDrive} יכולים לנהוג`)
                          : L('✕ Nobody to drive', '✕ אין מי שינהג')
                      : insured
                        ? L('✓ Insured', '✓ יש ביטוח')
                        : L('✕ Not insured', '✕ אין ביטוח')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.times}>
          <View style={{ flex: 1 }}>
            <DateTimeField label={L('From', 'מ־')} value={start} onChange={changeStart} minDay={existing ? undefined : Date.now()} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={end > start ? `${L('Until', 'עד')} · ${formatDuration(end - start)}` : L('Until', 'עד')}
              value={end}
              onChange={setEnd}
              minDay={start}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowGap}>
          {QUICK_DURATIONS.map((d) => (
            <Chip key={d.ms} label={formatDuration(d.ms)} selected={end - start === d.ms} onPress={() => setEnd(start + d.ms)} />
          ))}
          <Chip label={L('Rest of day', 'עד סוף היום')} selected={end === endOfDay(start)} onPress={() => setEnd(endOfDay(start))} />
        </ScrollView>

        {isPickup ? (
          <Field
            label={L('Pick me up from', 'מאיפה לאסוף אותי')}
            placeholder={L('e.g. the train station', 'למשל: תחנת הרכבת')}
            value={place}
            onChangeText={setPlace}
            maxLength={120}
            textContentType="fullStreetAddress"
          />
        ) : (
          <Field
            label={L('Where to? (optional)', 'לאן? (לא חובה)')}
            placeholder={L('e.g. Grandma\'s, Haifa', 'למשל: אצל סבתא, חיפה')}
            value={destination}
            onChangeText={setDestination}
            maxLength={120}
            textContentType="fullStreetAddress"
          />
        )}

        <Field label={L('What for? (optional)', 'בשביל מה? (לא חובה)')} placeholder={L('Work, groceries, driving lesson…', 'עבודה, קניות, שיעור נהיגה…')} value={purpose} onChangeText={setPurpose} maxLength={80} />

        {check.ok ? (
          <View style={{ gap: space(2) }}>
            {asksOwner && (
              <Banner tone="info" icon="key-outline">
                {car && ownersOf(car).length > 1
                  ? L(
                      `${car.name} belongs to ${ownerNames(state, car, 'and')}. It goes on the calendar once one of them approves.`,
                      `${car.name} שייך ל${ownerNames(state, car, 'and')}. זה ייכנס ליומן אחרי שאחד מהם יאשר.`,
                    )
                  : L(
                      `${car?.name} belongs to ${owners}. It goes on the calendar once ${owners} approves.`,
                      `${car?.name} שייך ל${owners}. זה ייכנס ליומן אחרי האישור של ${owners}.`,
                    )}
              </Banner>
            )}
            {isPickup ? (
              <Banner tone="info" icon="hand-left-outline">
                {L(
                  `We'll ask ${joinNames(drivers.map((m) => m.name))}. Whoever says yes picks the car, and only then is it reserved.`,
                  `הבקשה תישלח ל${joinNames(drivers.map((m) => m.name))}. מי שיענה כן יבחר רכב, ורק אז הוא יוזמן.`,
                )}
              </Banner>
            ) : (
              <Banner tone="success">{car?.name} is free then.</Banner>
            )}
          </View>
        ) : (
          <View style={{ gap: space(2) }}>
            <Banner tone="danger">{check.message}</Banner>
            {check.suggestion && (
              <Button
                small
                variant="secondary"
                icon="flash-outline"
                title={L(`Next free: ${formatRange(check.suggestion.start, check.suggestion.end)}`, `הזמן הפנוי הבא: ${formatRange(check.suggestion.start, check.suggestion.end)}`)}
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
        <Button title={L('Cancel', 'ביטול')} variant="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button
          title={asksOwner ? L(`Ask ${owners}`, `לבקש מ${owners}`) : existing ? L('Save changes', 'שמירת השינויים') : isPickup ? L('Request a pick-up', 'בקשת איסוף') : L('Book it', 'להזמין')}
          icon={asksOwner || isPickup ? 'paper-plane-outline' : 'checkmark'}
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
  content: { padding: space(5), gap: space(3.5), paddingBottom: space(8) },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  times: { flexDirection: 'row', gap: space(3) },
  rowGap: { gap: space(2) },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2.5),
    paddingVertical: space(2.5),
    paddingHorizontal: space(3),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  carName: { fontSize: 16, fontWeight: '700', color: colors.text },
  carInsured: { fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: space(3),
    padding: space(4),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
