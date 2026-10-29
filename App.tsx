import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, type IconName } from './src/components/ui';
import { FamilyProvider, useFamily, useLoadedFamily } from './src/data/FamilyContext';
import { requestsFor } from './src/logic/bookings';
import { SheetProvider, useSheets } from './src/navigation';
import { BookingsScreen, type BookingsSection } from './src/screens/BookingsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { FamilyScreen } from './src/screens/FamilyScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { WelcomeScreen, WhoAreYouScreen } from './src/screens/Onboarding';
import { colors, shadow, space } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <FamilyProvider>
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
          <Root />
        </SafeAreaView>
      </FamilyProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready, settings, state, me, error, leaveFamily } = useFamily();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!settings.mode) return <WelcomeScreen />;
  if (error && !state) {
    return (
      <View style={[styles.center, { padding: space(6), gap: space(4) }]}>
        <Banner tone="danger">{error}</Banner>
        <Button title="Back to start" variant="secondary" onPress={leaveFamily} />
      </View>
    );
  }
  if (!me) return <WhoAreYouScreen />;
  return (
    <SheetProvider>
      <MainTabs />
    </SheetProvider>
  );
}

type Tab = 'home' | 'calendar' | 'bookings' | 'family';
const TABS: { key: Tab; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'home', label: 'Cars', icon: 'car-sport-outline', iconActive: 'car-sport' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'bookings', label: 'Bookings', icon: 'list-outline', iconActive: 'list' },
  { key: 'family', label: 'Family', icon: 'people-outline', iconActive: 'people' },
];

function MainTabs() {
  const [tab, setTab] = useState<Tab>('home');
  const [bookingsSection, setBookingsSection] = useState<BookingsSection>('upcoming');
  const sheets = useSheets();
  const { state, me } = useLoadedFamily();
  const waiting = requestsFor(state, me.id).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.page}>
        {tab === 'home' && (
          <HomeScreen
            onOpenRequests={() => {
              setBookingsSection('requests');
              setTab('bookings');
            }}
          />
        )}
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'bookings' && <BookingsScreen section={bookingsSection} onSection={setBookingsSection} />}
        {tab === 'family' && <FamilyScreen />}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.tabBar}>
        <View style={styles.tabRow}>
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Book a car" onPress={() => sheets.newBooking()} style={styles.fab}>
            <Ionicons name="add" size={32} color="#fff" />
          </Pressable>
          {TABS.slice(2).map((t) => (
            <TabButton
              key={t.key}
              tab={t}
              active={tab === t.key}
              badge={t.key === 'bookings' ? waiting : 0}
              onPress={() => setTab(t.key)}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

function TabButton({
  tab,
  active,
  badge = 0,
  onPress,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge ? `${tab.label}, ${badge} waiting for your approval` : tab.label}
      onPress={onPress}
      style={styles.tab}
    >
      <View>
        <Ionicons name={active ? tab.iconActive : tab.icon} size={24} color={active ? colors.primary : colors.faint} />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.faint }]}>{tab.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Keeps the layout phone-shaped when opened in a wide desktop browser.
  page: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  tabBar: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  tabRow: { flexDirection: 'row', alignItems: 'center', maxWidth: 720, width: '100%', alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space(2), gap: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -space(6),
    marginHorizontal: space(2),
    ...shadow,
  },
});
