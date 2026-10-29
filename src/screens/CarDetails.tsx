import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingRow } from '../components/BookingRow';
import { Avatar, Banner, Button, Card, Chip } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { bookingsForCar, carStatus, effectiveEnd, insuranceWarning, isInsured, needsApproval } from '../logic/bookings';
import { formatDate, formatDayLabel, formatDuration, formatTime } from '../logic/time';
import { useSheets } from '../navigation';
import { colors, space } from '../theme';
import { FUEL_LABELS } from './BookingDetails';
import { timeAgo, useNow } from './HomeScreen';

/** Everything about one car: status, where it is, owner, insurance, next bookings. */
export function CarDetails({ carId, onClose }: { carId: string; onClose: () => void }) {
  const { state, me } = useLoadedFamily();
  const sheets = useSheets();
  const now = useNow();
  const car = state.cars.find((c) => c.id === carId);

  if (!car) {
    return (
      <View style={{ padding: space(5), gap: space(4) }}>
        <Banner tone="info">This car was removed.</Banner>
        <Button title="Close" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  const status = carStatus(state, car.id, now);
  const nameOf = (id: string) => (id === me.id ? 'You' : state.members.find((m) => m.id === id)?.name ?? 'Someone');
  const owner = state.members.find((m) => m.id === car.ownerId);
  const insured = state.members.filter((m) => car.insuredMemberIds.includes(m.id));
  const warning = insuranceWarning(car, now);
  const upcoming = bookingsForCar(state, car.id).filter((b) => effectiveEnd(b) > now).slice(0, 5);
  const report = car.lastReport;
  const asks = needsApproval(car, me.id);
  const canDrive = isInsured(car, me.id, now);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.topBar}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Back" style={s.back}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={s.backText}>Cars</Text>
        </Pressable>
        <Pressable onPress={() => sheets.editCar(car.id)} hitSlop={12} accessibilityLabel={`Edit ${car.name}`} style={s.back}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={s.backText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={[s.carIcon, { backgroundColor: car.color }]}>
            <Ionicons name="car-sport" size={34} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{car.name}</Text>
            <Text style={s.muted}>{[car.model, car.plate, car.seats ? `${car.seats} seats` : null].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        {status.kind === 'in-use' ? (
          <Pressable onPress={() => sheets.showBooking(status.booking.id)}>
            <Banner tone="danger" icon="time-outline">
              {`${nameOf(status.booking.memberId)} ${status.booking.memberId === me.id ? 'have' : 'has'} it until ${formatTime(effectiveEnd(status.booking))}`}
              {status.booking.destination ? ` · going to ${status.booking.destination}` : ''}
            </Banner>
          </Pressable>
        ) : (
          <Banner tone="success" icon="checkmark-circle">
            {status.next
              ? `Free for ${formatDuration(status.next.start - now)} · next: ${nameOf(status.next.memberId)} ${formatDayLabel(status.next.start, now).toLowerCase()} at ${formatTime(status.next.start)}`
              : 'Free – no upcoming bookings'}
          </Banner>
        )}

        <Card style={{ gap: space(3) }}>
          <InfoRow icon="location-outline" label="Last seen">
            {report
              ? `${report.parkedAt ?? 'Location not noted'}${report.fuel ? ` · Fuel ${FUEL_LABELS[report.fuel]}` : ''} — ${nameOf(report.memberId)}, ${timeAgo(report.at, now)}`
              : 'No notes yet'}
          </InfoRow>
          {report?.note && <InfoRow icon="alert-circle-outline" label="Note">{`“${report.note}”`}</InfoRow>}
          <InfoRow icon="key-outline" label="Owner">
            {owner ? `${nameOf(owner.id)} – ${owner.id === me.id ? 'you approve' : 'approves'} other people's bookings` : 'No owner – anyone insured can book'}
          </InfoRow>
          <InfoRow icon="shield-checkmark-outline" label="Insurance">
            {[car.insuranceCompany, car.insuranceExpires ? `valid until ${formatDate(car.insuranceExpires)} ${new Date(car.insuranceExpires).getFullYear()}` : null]
              .filter(Boolean)
              .join(' · ') || 'Not set'}
          </InfoRow>
          {warning && <Banner tone={warning.includes('expired') ? 'danger' : 'warning'}>{warning}</Banner>}
          <View style={s.wrap}>
            {insured.length === 0 && <Text style={s.muted}>No insured drivers yet.</Text>}
            {insured.map((m) => (
              <View key={m.id} style={s.driver}>
                <Avatar member={m} size={22} />
                <Text style={s.driverName}>{m.id === me.id ? 'You' : m.name}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={s.section}>Coming up</Text>
        {upcoming.length === 0 ? (
          <Text style={s.muted}>Nothing booked.</Text>
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
            title={asks ? `Ask ${owner?.name} for ${car.name}` : `Book ${car.name}`}
            icon={asks ? 'paper-plane-outline' : 'calendar-outline'}
            onPress={() => sheets.newBooking({ carId: car.id })}
            style={{ flex: 1 }}
          />
        ) : (
          <Chip label="You're not insured on this car" color={colors.muted} icon="lock-closed-outline" />
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
