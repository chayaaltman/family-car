import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Avatar, Banner, Button, Card, Chip } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { bookingsForCar, carStatus, effectiveEnd, insuranceWarning, isInsured, needsApproval, isOwner, ownerNames, ownersOf } from '../logic/bookings';
import { formatDate, formatDayLabel, formatDuration, formatTime } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, onColor, space } from '../theme';
import { fuelLabel } from './BookingDetails';
import { timeAgo, useNow } from './HomeScreen';
import { joinNames, whoLabel } from '../logic/labels';
import { L, forwardIcon } from '../i18n';

/** Everything about one car: status, where it is, owner, insurance, next bookings. */
export function CarDetails({ carId, onClose }: { carId: string; onClose: () => void }) {
  const { state, me, canManage } = useLoadedFamily();
  // The admin and the car's own owners can edit it.
  const sheets = useSheets();
  const now = useNow();
  const car = state.cars.find((c) => c.id === carId);

  if (!car) {
    return (
      <View style={{ padding: space(5), gap: space(4) }}>
        <Banner tone="info">{L('This car was removed.', 'הרכב הזה הוסר.')}</Banner>
        <Button title={L('Close', 'סגירה')} variant="secondary" onPress={onClose} />
      </View>
    );
  }

  const status = carStatus(state, car.id, now);
  const nameOf = (id: string) => (id === me.id ? L('You', 'אני') : state.members.find((m) => m.id === id)?.name ?? L('Someone', 'מישהו'));
  const owners = ownersOf(car);
  const ownersText = ownerNames(state, car);
  const insured = state.members.filter((m) => car.insuredMemberIds.includes(m.id));
  const warning = insuranceWarning(car, now);
  const upcoming = bookingsForCar(state, car.id).filter((b) => effectiveEnd(b) > now).slice(0, 5);
  const report = car.lastReport;
  const asks = needsApproval(car, me.id);
  const canDrive = isInsured(car, me.id, now);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.topBar}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={L('Back', 'חזרה')} style={s.back}>
          <Ionicons name={forwardIcon('chevron-back', 'chevron-forward')} size={24} color={colors.primary} />
          <Text style={s.backText}>{L('Cars', 'רכבים')}</Text>
        </Pressable>
        {(canManage || isOwner(car, me.id)) && (
          <Pressable onPress={() => sheets.editCar(car.id)} hitSlop={12} accessibilityLabel={L(`Edit ${car.name}`, `עריכת ${car.name}`)} style={s.back}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={s.backText}>{L('Edit', 'עריכה')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={[s.carIcon, { backgroundColor: car.color }]}>
            <Ionicons name="car-sport" size={34} color={onColor(car.color)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{car.name}</Text>
            <Text style={s.muted}>{[car.model, car.plate, car.seats ? L(`${car.seats} seats`, `${car.seats} מושבים`) : null].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        {status.kind === 'in-use' ? (
          <Pressable onPress={() => sheets.showBooking(status.booking.id)}>
            <Banner tone="danger" icon="time-outline">
              {`${whoLabel(state, status.booking, me.id)} · ${L('until', 'עד')} ${formatTime(effectiveEnd(status.booking))}`}
              {status.booking.destination ? L(` · going to ${status.booking.destination}`, ` · יעד: ${status.booking.destination}`) : ''}
            </Banner>
          </Pressable>
        ) : (
          <Banner tone="success" icon="checkmark-circle">
            {status.next
              ? L(
                  `Free for ${formatDuration(status.next.start - now)} · next: ${whoLabel(state, status.next, me.id)} ${formatDayLabel(status.next.start, now).toLowerCase()} at ${formatTime(status.next.start)}`,
                  `פנוי עוד ${formatDuration(status.next.start - now)} · הבא: ${whoLabel(state, status.next, me.id)} ${formatDayLabel(status.next.start, now)} ב־${formatTime(status.next.start)}`,
                )
              : L('Free – no upcoming bookings', 'פנוי – אין הזמנות קרובות')}
          </Banner>
        )}

        <Card style={{ gap: space(3) }}>
          <InfoRow icon="location-outline" label={L('Last seen', 'נראה לאחרונה')}>
            {report
              ? `${report.parkedAt ?? L('Location not noted', 'לא צוין מיקום')}${report.fuel ? ` · ${L('Fuel', 'דלק')} ${fuelLabel(report.fuel)}` : ''} — ${nameOf(report.memberId)}, ${timeAgo(report.at, now)}`
              : L('No notes yet', 'אין עדיין הערות')}
          </InfoRow>
          {report?.note && <InfoRow icon="alert-circle-outline" label={L('Note', 'הערה')}>{`“${report.note}”`}</InfoRow>}
          <InfoRow icon="key-outline" label={L('Owner', 'בעלים')}>
            {owners.length === 0
              ? L('No owner – anyone insured can book', 'אין בעלים – כל מי שיש לו ביטוח יכול להזמין')
              : owners.length === 1
                ? owners[0] === me.id
                  ? L(`${nameOf(owners[0])} – you approve other people's bookings`, 'אני – מאשר/ת הזמנות של אחרים')
                  : L(`${nameOf(owners[0])} – approves other people's bookings`, `${nameOf(owners[0])} – מאשר/ת הזמנות של אחרים`)
                : L(
                    `${joinNames(owners.map(nameOf))} – any of them can approve other people's bookings`,
                    `${joinNames(owners.map(nameOf))} – כל אחד מהם יכול לאשר הזמנות של אחרים`,
                  )}
          </InfoRow>
          <InfoRow icon="shield-checkmark-outline" label={L('Insurance', 'ביטוח')}>
            {[car.insuranceCompany, car.insuranceExpires ? L(`valid until ${formatDate(car.insuranceExpires)} ${new Date(car.insuranceExpires).getFullYear()}`, `בתוקף עד ${formatDate(car.insuranceExpires)} ${new Date(car.insuranceExpires).getFullYear()}`) : null]
              .filter(Boolean)
              .join(' · ') || L('Not set', 'לא הוגדר')}
          </InfoRow>
          {warning && <Banner tone={(car.insuranceExpires ?? Infinity) < now ? 'danger' : 'warning'}>{warning}</Banner>}
          <View style={s.wrap}>
            {insured.length === 0 && <Text style={s.muted}>{L('No insured drivers yet.', 'אין עדיין נהגים עם ביטוח.')}</Text>}
            {insured.map((m) => (
              <View key={m.id} style={s.driver}>
                <Avatar member={m} size={22} />
                <Text style={s.driverName}>{m.id === me.id ? L('You', 'אני') : m.name}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={s.section}>{L('Coming up', 'בקרוב')}</Text>
        {upcoming.length === 0 ? (
          <Text style={s.muted}>{L('Nothing booked.', 'אין הזמנות.')}</Text>
        ) : (
          <View style={{ gap: space(2) }}>
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} state={state} meId={me.id} onPress={() => sheets.showBooking(b.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {canDrive ? (
          <Button
            title={asks ? L(`Ask ${ownersText} for ${car.name}`, `לבקש את ${car.name} מ${ownersText}`) : L(`Book ${car.name}`, `להזמין את ${car.name}`)}
            icon={asks ? 'paper-plane-outline' : 'calendar-outline'}
            onPress={() => sheets.newBooking({ carId: car.id })}
            style={{ flex: 1 }}
          />
        ) : (
          <Chip label={L('You\'re not insured on this car', 'אין לי ביטוח על הרכב הזה')} color={colors.muted} icon="lock-closed-outline" />
        )}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; children: React.ReactNode }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoText}>{children}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(3), paddingVertical: space(3) },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  content: { paddingHorizontal: space(5), paddingBottom: space(6), gap: space(4) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  carIcon: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space(1) },
  infoRow: { flexDirection: 'row', gap: space(3) },
  infoLabel: { fontSize: 12, fontWeight: '700', color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoText: { fontSize: 15, color: colors.text, marginTop: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 999, paddingRight: 10, padding: 2 },
  driverName: { fontSize: 13, fontWeight: '600', color: colors.text },
  footer: { flexDirection: 'row', justifyContent: 'center', padding: space(4), borderTopWidth: 1, borderTopColor: colors.border },
});
