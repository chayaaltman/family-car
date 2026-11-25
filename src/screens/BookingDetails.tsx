import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Chip, Field, Label } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { cancelBooking, effectiveEnd, isConfirmed, returnCar, statusOf, isOwner, ownerNames, ownersOf } from '../logic/bookings';
import { releasePickup } from '../logic/pickups';
import { RequestActions } from '../components/RequestCard';
import { askAboutBookingMessage, requestMessage } from '../logic/messages';
import { useSheets } from '../navigation';
import { formatDuration, formatRange } from '../logic/time';
import { colors, space } from '../theme';
import type { FuelLevel } from '../types';
import { L } from '../i18n';

/** Fuel levels for the "I'm back" note, in the current language. */
export function fuelLabel(f: FuelLevel): string {
  return {
    empty: L('Empty', 'ריק'),
    quarter: '¼',
    half: '½',
    'three-quarters': '¾',
    full: L('Full', 'מלא'),
  }[f];
}
export const FUEL_LEVELS: FuelLevel[] = ['empty', 'quarter', 'half', 'three-quarters', 'full'];

/** Cross-platform "are you sure?" (Alert.alert has no buttons on web). */
export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: L('No', 'לא'), style: 'cancel', onPress: () => resolve(false) },
      { text: L('Yes', 'כן'), style: 'destructive', onPress: () => resolve(true) },
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
  const sheets = useSheets();
  const [returning, setReturning] = useState(false);
  const [parkedAt, setParkedAt] = useState('');
  const [fuel, setFuel] = useState<FuelLevel | undefined>();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return (
      <View style={s.content}>
        <Banner tone="info">{L('This booking was cancelled.', 'ההזמנה הזאת בוטלה.')}</Banner>
        <Button title={L('Close', 'סגירה')} variant="secondary" onPress={onClose} />
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
  const owners = car ? ownerNames(state, car) : '';
  const decider = state.members.find((m) => m.id === booking.decidedBy);
  const iAmOwner = !!car && isOwner(car, me.id);

  // Pick-ups: `member` is the person who needs a ride; the driver is whoever said yes.
  const pickup = booking.pickup;
  const driver = state.members.find((m) => m.id === pickup?.driverId);
  const isDriver = !!pickup && pickup.driverId === me.id;
  const drivesIt = pickup ? isDriver : mine;

  const run = async (fn: Parameters<typeof act>[0]) => {
    try {
      await act(fn);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remindOwner = () =>
    car &&
    owners &&
    sheets.message({
      to: ownersOf(car),
      title: L(`Remind ${owners}`, `תזכורת ל${owners}`),
      text: requestMessage(state, booking),
      textFor: (names) => requestMessage(state, booking, names),
    });

  const askForCar = () =>
    sheets.message({
      to: booking.memberId,
      title: L(`Message ${member?.name ?? ''}`, `הודעה ל${member?.name ?? ''}`),
      text: askAboutBookingMessage(state, booking, me.name),
    });

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}>
        <Ionicons name="car-sport" size={34} color={car?.color ?? colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{car?.name ?? L('Deleted car', 'רכב שנמחק')}</Text>
          <Text style={s.subtitle}>{formatRange(booking.start, end)}</Text>
        </View>
        {active && <Chip label={L('Now', 'עכשיו')} color={colors.success} selected />}
      </View>

      {status === 'pending' && (
        <Banner tone="warning" icon="time-outline">
          {iAmOwner
            ? pickup
              ? L(
                  `${driver?.name ?? 'Someone'} wants it to pick up ${member?.name}. It goes on the calendar only if you approve.`,
                  `${driver?.name ?? 'מישהו'} מבקש/ת את הרכב כדי לאסוף את ${member?.name}. זה ייכנס ליומן רק אחרי אישור.`,
                )
              : L(
                  `${member?.name} is asking for your ${car?.name}. It goes on the calendar only if you approve.`,
                  `${member?.name} מבקש/ת את ${car?.name}. זה ייכנס ליומן רק אחרי אישור.`,
                )
            : L(
                `Waiting for ${owners || 'the owner'} to approve. It's not on the calendar yet.`,
                `מחכה לאישור של ${owners || 'הבעלים'}. עדיין לא ביומן.`,
              )}
        </Banner>
      )}
      {status === 'declined' && (
        <Banner tone="danger">
          {L(`Declined by ${decider?.name ?? 'the owner'}`, `נדחה על ידי ${decider?.name ?? 'הבעלים'}`)}
          {booking.declineReason ? `: “${booking.declineReason}”` : '.'}
        </Banner>
      )}
      {status === 'approved' && booking.decidedBy && (
        <Banner tone="success">{L(`Approved by ${decider?.name ?? 'the owner'}`, `אושר על ידי ${decider?.name ?? 'הבעלים'}`)}</Banner>
      )}
      {pickup && status !== 'declined' && (
        driver ? (
          <Banner tone="success" icon="car-outline">
            {isDriver
              ? L(`You are picking ${mine ? 'you' : member?.name ?? 'them'} up.`, `אני אוסף/ת את ${member?.name ?? ''}.`)
              : L(
                  `${driver.name} is picking ${mine ? 'you' : member?.name ?? 'them'} up.`,
                  mine ? `${driver.name} בדרך לאסוף אותי.` : `${driver.name} בדרך לאסוף את ${member?.name ?? ''}.`,
                )}
          </Banner>
        ) : (
          <Banner tone="info" icon="hand-left-outline">
            {L('No driver yet.', 'עדיין אין נהג/ת.')}
          </Banner>
        )
      )}

      <View style={s.row}>
        {member && <Avatar member={member} size={40} />}
        <View>
          <Text style={s.name}>
            {pickup
              ? mine
                ? L('You need a ride', 'אני צריך/ה הסעה')
                : L(`${member?.name} needs a ride`, `${member?.name} צריך/ה הסעה`)
              : mine
                ? L(`${member?.name} (you)`, `${member?.name} (אני)`)
                : member?.name}
          </Text>
          <Text style={s.muted}>{formatDuration(end - booking.start)}{booking.returnedAt ? L(' · returned early', ' · הוחזר מוקדם') : ''}</Text>
        </View>
      </View>

      {pickup && (
        <View style={s.row}>
          <Ionicons name="hand-left-outline" size={20} color={colors.muted} />
          <Text style={[s.body, { fontWeight: '600' }]}>Pick up from {pickup.place}</Text>
          {isDriver && (
            <Button
              small
              variant="secondary"
              icon="navigate-outline"
              title={'Waze'}
              onPress={() => Linking.openURL(`https://waze.com/ul?q=${encodeURIComponent(pickup.place)}&navigate=yes`)}
            />
          )}
        </View>
      )}

      {booking.destination && (
        <View style={s.row}>
          <Ionicons name="location-outline" size={20} color={colors.muted} />
          <Text style={[s.body, { fontWeight: '600' }]}>{booking.destination}</Text>
          <Button
            small
            variant="secondary"
            icon="navigate-outline"
            title={'Waze'}
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
          <Text style={s.section}>{L('Leave a note for the next driver', 'הערה לנהג/ת הבא/ה')}</Text>
          <Field label={L('Where did you park?', 'איפה הרכב חונה?')} placeholder={L('Driveway, street, mall parking level 2…', 'בחנייה, ברחוב, בחניון הקניון קומה 2…')} value={parkedAt} onChangeText={setParkedAt} />
          <Label>{L('Fuel left', 'כמה דלק נשאר')}</Label>
          <View style={s.wrap}>
            {FUEL_LEVELS.map((f) => (
              <Chip key={f} label={fuelLabel(f)} selected={fuel === f} onPress={() => setFuel(f)} icon="speedometer-outline" />
            ))}
          </View>
          <Field label={L('Anything else?', 'עוד משהו?')} placeholder={L('Needs a wash, warning light…', 'צריך שטיפה, נורת אזהרה…')} value={note} onChangeText={setNote} />
          <Button
            title={L('Return car', 'החזרת הרכב')}
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
          <Button title={L('Back', 'חזרה')} variant="ghost" onPress={() => setReturning(false)} />
        </View>
      ) : (
        <View style={{ gap: space(3), marginTop: space(2) }}>
          {iAmOwner && status === 'pending' && !past && <RequestActions booking={booking} />}
          {drivesIt && status === 'pending' && !iAmOwner && !past && (
            <Button title={L(`Remind ${owners || 'the owner'}`, `תזכורת ל${owners || 'בעלים'}`)} icon="logo-whatsapp" variant="secondary" onPress={remindOwner} />
          )}
          {isDriver && !past && (
            <Button
              title={L('I can\'t make it anymore', 'לא אוכל להגיע')}
              icon="close-outline"
              variant="secondary"
              onPress={async () => {
                if (await confirm(L('Can\'t make it?', 'לא מסתדר?'), L(`The ${car?.name ?? 'car'} is freed and the request goes back to everyone who can drive.`, `${car?.name ?? 'הרכב'} מתפנה והבקשה חוזרת לכל מי שיכול לנהוג.`))) {
                  run((st) => releasePickup(st, booking.id, me.id));
                }
              }}
            />
          )}
          {drivesIt && active && <Button title={L('I\'m back – return the car', 'חזרתי – החזרת הרכב')} icon="key-outline" onPress={() => setReturning(true)} />}
          {mine && !pickup && !past && (
            <Button
              title={status === 'declined' ? L('Change it & ask again', 'לשנות ולבקש שוב') : L('Edit time or car', 'עריכת זמן או רכב')}
              icon="create-outline"
              variant="secondary"
              onPress={onEdit}
            />
          )}
          {mine && !past && (
            <Button
              title={status === 'approved' ? L('Cancel booking', 'ביטול ההזמנה') : status === 'pending' ? L('Cancel request', 'ביטול הבקשה') : L('Remove', 'הסרה')}
              icon="trash-outline"
              variant="danger"
              onPress={async () => {
                if (status === 'declined' || (await confirm(L('Cancel?', 'לבטל?'), status === 'pending' ? L('Your request will be withdrawn.', 'הבקשה תבוטל.') : L(`${car?.name} will be free for others.`, `${car?.name} יתפנה לאחרים.`)))) {
                  run((st) => cancelBooking(st, booking.id));
                }
              }}
            />
          )}
          {!mine && !pickup && !past && status === 'approved' && (
            <Button title={L(`Message ${member?.name ?? 'them'} about it`, `הודעה ל${member?.name ?? ''} על זה`)} icon="logo-whatsapp" variant="secondary" onPress={askForCar} />
          )}
          <Button title={L('Close', 'סגירה')} variant="ghost" onPress={onClose} />
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
