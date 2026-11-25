import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Segmented } from '../components/ui';
import { usePreferences, type Preferences } from '../data/preferences';
import { L, isRTL } from '../i18n';
import { colors, shadow, space } from '../theme';

/** The round gear button in the top corner, and the settings sheet it opens. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={L('Settings', 'הגדרות')}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [s.button, isRTL() ? { left: space(4) } : { right: space(4) }, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="settings-outline" size={22} color={colors.text} />
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.sheet} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
          <SettingsScreen onClose={() => setOpen(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { prefs, setPrefs } = usePreferences();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>{L('Settings', 'הגדרות')}</Text>

        <Card style={s.section}>
          <View style={s.heading}>
            <Ionicons name="language-outline" size={20} color={colors.primary} />
            <Text style={s.label}>{L('Language', 'שפה')}</Text>
          </View>
          <Segmented<Preferences['language']>
            value={prefs.language}
            onChange={(language) => setPrefs({ language })}
            options={[
              { key: 'en', label: 'English' },
              { key: 'he', label: 'עברית' },
            ]}
          />
        </Card>

        <Card style={s.section}>
          <View style={s.heading}>
            <Ionicons name="contrast-outline" size={20} color={colors.primary} />
            <Text style={s.label}>{L('Appearance', 'מראה')}</Text>
          </View>
          <Segmented<Preferences['theme']>
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            options={[
              { key: 'system', label: L('System', 'לפי המכשיר') },
              { key: 'light', label: L('Light', 'בהיר') },
              { key: 'dark', label: L('Dark', 'כהה') },
            ]}
          />
        </Card>
      </ScrollView>
      <View style={s.footer}>
        <Button title={L('Done', 'סיום')} onPress={onClose} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  button: {
    position: 'absolute',
    top: space(3),
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadow,
  },
  sheet: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), gap: space(4), width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  section: { gap: space(3) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  footer: { flexDirection: 'row', padding: space(4), borderTopWidth: 1, borderTopColor: colors.border, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
