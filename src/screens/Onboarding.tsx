import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Card, Field } from '../components/ui';
import { useFamily } from '../data/FamilyContext';
import { colors, space } from '../theme';

/** First launch with cloud sync configured: start a new family or join one. */
export function WelcomeScreen() {
  const { createFamily, joinFamily, startDemo } = useFamily();
  const [mode, setMode] = useState<'pick' | 'create' | 'join'>('pick');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={s.title}>Family Car</Text>
        <Text style={s.tagline}>One calendar for the family cars.{'\n'}No more “who took the car?!”</Text>

        {mode === 'pick' && (
          <View style={s.actions}>
            <Button title="Create a family" icon="home-outline" onPress={() => setMode('create')} />
            <Button title="Join with a code" icon="key-outline" variant="secondary" onPress={() => setMode('join')} />
            <Button title="Just try the demo" variant="ghost" onPress={startDemo} />
          </View>
        )}

        {mode === 'create' && (
          <Card style={s.form}>
            <Field label="Your name" placeholder="e.g. Noa" value={name} onChangeText={setName} autoFocus />
            <Button title="Create family" loading={busy} disabled={!name.trim()} onPress={() => go(() => createFamily(name))} />
            <Button title="Back" variant="ghost" onPress={() => setMode('pick')} />
          </Card>
        )}

        {mode === 'join' && (
          <Card style={s.form}>
            <Field
              label="Family code"
              placeholder="ABCD-23"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
              autoFocus
              style={{ fontSize: 22, letterSpacing: 3, fontWeight: '700' }}
            />
            <Button title="Join" loading={busy} disabled={code.trim().length < 4} onPress={() => go(() => joinFamily(code))} />
            <Button title="Back" variant="ghost" onPress={() => setMode('pick')} />
          </Card>
        )}

        {error && <Banner tone="danger">{error}</Banner>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "Who are you?" — picks which family member is using this phone. */
export function WhoAreYouScreen() {
  const { state, setMe } = useFamily();
  if (!state) return null;
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Logo />
      <Text style={s.title}>Who's using this phone?</Text>
      <Text style={s.tagline}>{state.familyName}</Text>
      <View style={s.grid}>
        {state.members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMe(m.id)}
            style={({ pressed }) => [s.person, pressed && { transform: [{ scale: 0.97 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`I'm ${m.name}`}
          >
            <Avatar member={m} size={64} />
            <Text style={s.personName}>{m.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Logo() {
  return (
    <View style={s.logo}>
      <Ionicons name="car-sport" size={44} color="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(3), width: '100%', maxWidth: 520, alignSelf: 'center' },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: space(3) },
  tagline: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  actions: { gap: space(3), marginTop: space(6) },
  form: { gap: space(4), marginTop: space(6) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(4), marginTop: space(6) },
  person: { alignItems: 'center', gap: space(2), width: 100, paddingVertical: space(4), backgroundColor: colors.card, borderRadius: 18 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text },
});
