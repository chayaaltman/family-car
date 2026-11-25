import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLoadedFamily } from '../data/FamilyContext';
import { needsApproval, ownerNames, ownersOf } from '../logic/bookings';
import { pickupRequestMessage, pickupTakenMessage, requestMessage } from '../logic/messages';
import { cancelPickupRequest, carsForDriver, driversFor, takePickup } from '../logic/pickups';
import { formatRange } from '../logic/time';
import { useSheets } from '../navigation';
import { confirm } from '../screens/BookingDetails';
import { colors, deepen, radius, space, tint } from '../theme';
import { newId } from '../logic/bookings';
import { Avatar, Banner, Button, Card } from './ui';
import { L } from '../i18n';

/**
 * Shown to people who could drive: "Eli needs a pick-up from the train station, Wed 19:00".
 * They choose one of the cars they're insured on (and that's free), then say yes.
 */
export function PickupCard({ requestId }: { requestId: string }) {
  const { state, me, act } = useLoadedFamily();
  const sheets = useSheets();
  const req = state.pickups?.find((r) => r.id === requestId);
  const cars = req ? carsForDriver(state, req, me.id) : [];
  const [carId, setCarId] = useState(cars[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!req) return null;

  const rider = state.members.find((m) => m.id === req.memberId);
  const car = cars.find((c) => c.id === carId) ?? cars[0];
  const askOwner = !!car && needsApproval(car, me.id);

  const take = async () => {
    if (!car) return;
    setBusy(true);
    setError(null);
    const bookingId = newId();
    try {
      await act((s) => takePickup(s, req.id, me.id, car.id, Date.now(), bookingId));
      const booking = { ...req, id: bookingId, carId: car.id, pickup: { place: req.place, driverId: me.id } };
      if (askOwner) {
        // The car isn't theirs: ask an owner first.
        sheets.message({
          to: ownersOf(car),
          title: L(`Ask ${ownerNames(state, car)} for the ${car.name}`, `לבקש את ${car.name} מ${ownerNames(state, car)}`),
          text: requestMessage(state, booking),
          textFor: (names) => requestMessage(state, booking, names),
        });
      } else {
        sheets.message({
          to: req.memberId,
          title: L(`Tell ${rider?.name ?? 'them'} you're coming`, `לעדכן את ${rider?.name ?? ''} שבדרך`),
          text: pickupTakenMessage(state, booking, me.id),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={s.card}>
      <View style={s.row}>
        {rider && <Avatar member={rider} size={40} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.title}>
            {L(`${rider?.name ?? 'Someone'} needs a pick-up`, `${rider?.name ?? 'מישהו'} צריך/ה איסוף`)}
          </Text>
          <Text style={s.line}>
            <Ionicons name="location-outline" size={14} color={colors.muted} /> {req.place}
          </Text>
          <Text style={s.line}>{formatRange(req.start, req.end)}</Text>
        </View>
      </View>

      <Text style={s.label}>{cars.length > 1 ? L('Which car will you take?', 'באיזה רכב לנסוע?') : L('Car', 'רכב')}</Text>
      <View style={s.cars}>
        {cars.map((c) => {
          const on = c.id === car?.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCarId(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[s.car, on && { borderColor: deepen(c.color, 0.3), backgroundColor: tint(c.color, 0.85) }]}
            >
              <Ionicons name="car-sport" size={20} color={deepen(c.color)} />
              <Text style={s.carName}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {askOwner && car && (
        <Text style={s.note}>
          {L(
            `The ${car.name} belongs to ${ownerNames(state, car)}, so they'll need to OK it.`,
            `${car.name} שייך ל${ownerNames(state, car)}, אז צריך גם את האישור שלהם.`,
          )}
        </Text>
      )}

      <View style={s.actions}>
        <Button
          title={car ? L(`I'll pick you up · ${car.name}`, `אני אאסוף · ${car.name}`) : L('I\'ll pick you up', 'אני אאסוף')}
          icon="car-outline"
          loading={busy}
          disabled={!car}
          onPress={take}
          style={{ flex: 1 }}
        />
      </View>
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}

/** Your own open request: who's been asked, and buttons to ask again or cancel. */
export function MyPickupCard({ requestId }: { requestId: string }) {
  const { state, act } = useLoadedFamily();
  const sheets = useSheets();
  const [error, setError] = useState<string | null>(null);
  const req = state.pickups?.find((r) => r.id === requestId);
  if (!req) return null;

  const drivers = driversFor(state, req);
  const cars = req.carIds.map((id) => state.cars.find((c) => c.id === id)?.name).filter(Boolean).join(', ');

  const askAgain = () =>
    sheets.message({
      to: drivers.map((m) => m.id),
      group: true,
      title: L('Ask for a pick-up', 'בקשת איסוף'),
      text: pickupRequestMessage(state, req),
      textFor: (names) => pickupRequestMessage(state, req, names),
    });

  const cancel = async () => {
    if (!(await confirm(L('Cancel pick-up request?', 'לבטל את בקשת האיסוף?'), L('Nobody will be asked anymore.', 'הבקשה לא תישלח יותר לאף אחד.')))) return;
    try {
      await act((s) => cancelPickupRequest(s, req.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card style={s.card}>
      <View style={s.row}>
        <View style={s.waitIcon}>
          <Ionicons name="hand-left-outline" size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.title}>{L(`Pick-up from ${req.place}`, `איסוף מ${req.place}`)}</Text>
          <Text style={s.line}>{formatRange(req.start, req.end)}</Text>
          <Text style={s.line}>{cars}</Text>
          <Text style={[s.line, { color: colors.warning, fontWeight: '600' }]}>
            {drivers.length
              ? L(`Waiting for a driver · can drive: ${drivers.map((m) => m.name).join(', ')}`, `מחכה לנהג/ת · יכולים לנהוג: ${drivers.map((m) => m.name).join(', ')}`)
              : L('Nobody can drive these cars then', 'אין מי שיכול לנהוג ברכבים האלה בזמן הזה')}
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        <Button small title={L('Ask again', 'לבקש שוב')} icon="logo-whatsapp" variant="secondary" onPress={askAgain} style={{ flex: 1 }} />
        <Button small title={L('Cancel', 'ביטול')} icon="trash-outline" variant="danger" onPress={cancel} style={{ flex: 1 }} />
      </View>
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: space(3) },
  sheet: { padding: space(5), gap: space(4) },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  line: { fontSize: 14, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: -space(1) },
  cars: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  car: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2),
    paddingHorizontal: space(3),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  carName: { fontSize: 15, fontWeight: '700', color: colors.text },
  note: { fontSize: 13, color: colors.muted },
  actions: { flexDirection: 'row', gap: space(2) },
  waitIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Opened from a link in a pick-up message: shows the request to someone who could drive,
 * the asker's own controls, or what happened to it (taken by someone / cancelled).
 */
export function PickupSheet({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const req = state.pickups?.find((r) => r.id === requestId);
  const taken = state.bookings.find((b) => b.pickup?.requestId === requestId);
  const driver = state.members.find((m) => m.id === taken?.pickup?.driverId);
  const canDrive = !!req && carsForDriver(state, req, me.id).length > 0;

  return (
    <ScrollView contentContainerStyle={s.sheet}>
      <Text style={s.sheetTitle}>{L('Pick-up request', 'בקשת איסוף')}</Text>
      {req && req.memberId === me.id && <MyPickupCard requestId={req.id} />}
      {req && req.memberId !== me.id && canDrive && <PickupCard requestId={req.id} />}
      {req && req.memberId !== me.id && !canDrive && (
        <Banner tone="info">
          {L(
            "You can't take this one: you're not insured on any of the cars it asks for, or they're booked then.",
            'אי אפשר לקחת את זה: אין לי ביטוח על אף אחד מהרכבים שביקשו, או שהם תפוסים בזמן הזה.',
          )}
        </Banner>
      )}
      {!req && taken && (
        <>
          <Banner tone="success" icon="car-outline">
            {driver?.id === me.id
              ? L("You're already doing this pick-up.", 'כבר לקחתי את האיסוף הזה.')
              : L(`${driver?.name ?? 'Someone'} is already doing this pick-up.`, `${driver?.name ?? 'מישהו'} כבר לקח/ה את האיסוף הזה.`)}
          </Banner>
          <Button title={L('Open the booking', 'לפתיחת ההזמנה')} variant="secondary" onPress={() => sheets.showBooking(taken.id)} />
        </>
      )}
      {!req && !taken && <Banner tone="info">{L('This pick-up request was cancelled or has passed.', 'בקשת האיסוף הזאת בוטלה או שהזמן שלה עבר.')}</Banner>}
      <Button title={L('Close', 'סגירה')} variant="ghost" onPress={onClose} />
    </ScrollView>
  );
}
