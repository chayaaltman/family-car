import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Banner, Button, Card, Field } from '../components/ui';
import { useFamily } from '../data/FamilyContext';
import { adminIdOf, pinOf } from '../logic/admin';
import type { Member } from '../types';
import { colors, space } from '../theme';
import { L } from '../i18n';
import { incomingLink } from '../links';

/** First launch with cloud sync configured: start a new family or join one. */
export function WelcomeScreen() {
  const { createFamily, joinFamily, startDemo } = useFamily();
  const linkedCode = incomingLink()?.familyCode;
  const [mode, setMode] = useState<'pick' | 'create' | 'join'>(linkedCode ? 'join' : 'pick');
  const [name, setName] = useState('');
  const [code, setCode] = useState(linkedCode ?? '');
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
        <Text style={s.title}>{'Family Car'}</Text>
        <Text style={s.tagline}>
          {L('One calendar for the family cars.\nNo more “who took the car?!”', 'יומן אחד לכל רכבי המשפחה.\nבלי ״מי לקח את הרכב?!״')}
        </Text>

        {mode === 'pick' && (
          <View style={s.actions}>
            <Button title={L('Create a family', 'יצירת משפחה')} icon="home-outline" variant="brand" onPress={() => setMode('create')} />
            <Button title={L('Join with a code', 'הצטרפות עם קוד')} icon="key-outline" variant="brandSoft" onPress={() => setMode('join')} />
            <Button title={L('Just try the demo', 'רק לנסות את ההדגמה')} variant="ghost" onPress={startDemo} />
          </View>
        )}

        {mode === 'create' && (
          <Card style={s.form}>
            <Field label={L('Your name', 'השם שלי')} placeholder={L('e.g. Noa', 'למשל: נועה')} value={name} onChangeText={setName} autoFocus />
            <Button title={L('Create family', 'יצירת המשפחה')} variant="brand" loading={busy} disabled={!name.trim()} onPress={() => go(() => createFamily(name))} />
            <Button title={L('Back', 'חזרה')} variant="ghost" onPress={() => setMode('pick')} />
          </Card>
        )}

        {mode === 'join' && (
          <Card style={s.form}>
            <Field
              label={L('Family code', 'קוד משפחה')}
              placeholder={'ABCD-23'}
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
              autoFocus
              style={{ fontSize: 22, letterSpacing: 3, fontWeight: '700' }}
            />
            <Button title={L('Join', 'הצטרפות')} variant="brand" loading={busy} disabled={code.trim().length < 4} onPress={() => go(() => joinFamily(code))} />
            <Button title={L('Back', 'חזרה')} variant="ghost" onPress={() => setMode('pick')} />
          </Card>
        )}

        {error && <Banner tone="danger">{error}</Banner>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * "Who are you?" — runs once per phone.
 * In a shared family, new people add themselves with their own PIN, and returning people
 * need their PIN to choose their name, so nobody can pretend to be someone else.
 * The demo just lets you pick anyone.
 */
export function WhoAreYouScreen() {
  const { state, storeKind, setMe, joinAsNew, signInAs } = useFamily();
  const [mode, setMode] = useState<'new' | 'returning'>('new');
  const [chosen, setChosen] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state) return null;

  const digits = (t: string) => {
    setPin(t.replace(/\D/g, ''));
    setError(null);
  };
  const run = async (fn: () => Promise<void>) => {
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
  const pinField = (label: string, onSubmit: () => void, autoFocus = false) => (
    <Field
      label={label}
      placeholder="••••"
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      value={pin}
      onChangeText={digits}
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
      style={{ fontSize: 22, letterSpacing: 6, fontWeight: '700' }}
    />
  );

  const people = (onPick: (m: Member) => void) => (
    <View style={s.grid}>
      {state.members.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onPick(m)}
          style={({ pressed }) => [s.person, pressed && { transform: [{ scale: 0.97 }] }]}
          accessibilityRole="button"
          accessibilityLabel={L(`I'm ${m.name}`, `אני ${m.name}`)}
        >
          <Avatar member={m} size={64} />
          <Text style={s.personName}>{m.name}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (storeKind === 'local') {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Logo />
        <Text style={s.title}>{L('Who\'s using this phone?', 'מי משתמש בטלפון הזה?')}</Text>
        <Text style={s.tagline}>{state.familyName}</Text>
        {people((m) => setMe(m.id))}
      </ScrollView>
    );
  }

  // Returning person: their PIN proves it's them.
  if (chosen) {
    const signIn = () =>
      run(async () => {
        if (!(await signInAs(chosen.id, pin))) throw new Error(L('Wrong PIN.', 'קוד שגוי.'));
      });
    const hasPin = !!pinOf(state, chosen);
    const admin = state.members.find((m) => m.id === adminIdOf(state));
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: 'center' }}>
            <Avatar member={chosen} size={72} />
          </View>
          <Text style={s.title}>{L(`Hi ${chosen.name}`, `היי ${chosen.name}`)}</Text>
          {hasPin ? (
            <>
              <Text style={s.tagline}>{L('Enter your PIN', 'הקלדת הקוד שלי')}</Text>
              <Card style={s.form}>
                {pinField(L('PIN', 'קוד'), signIn, true)}
                <Button title={L('Continue', 'המשך')} icon="lock-open-outline" variant="brand" loading={busy} disabled={pin.length < 4} onPress={signIn} />
                <Button title={L('Back', 'חזרה')} variant="ghost" onPress={() => setChosen(null)} />
              </Card>
              <Text style={s.hint}>
                {L(
                  `Forgot it? ${admin ? `Ask ${admin.name} to set a new one for you.` : ''}`,
                  `שכחת? ${admin ? `אפשר לבקש מ${admin.name} להגדיר קוד חדש.` : ''}`,
                )}
              </Text>
            </>
          ) : (
            <Card style={s.form}>
              <Text style={s.tagline}>
                {L(
                  `${chosen.name} doesn't have a PIN yet. ${admin ? `Ask ${admin.name} to set one for you` : 'Ask the family admin to set one'} (Family → tap your name), then come back here.`,
                  `ל${chosen.name} עדיין אין קוד. ${admin ? `אפשר לבקש מ${admin.name} להגדיר קוד` : 'אפשר לבקש ממנהל/ת המשפחה להגדיר קוד'} (משפחה ← לוחצים על השם), ואז לחזור לכאן.`,
                )}
              </Text>
              <Button title={L('Back', 'חזרה')} variant="ghost" onPress={() => setChosen(null)} />
            </Card>
          )}
          {error && <Banner tone="danger">{error}</Banner>}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (mode === 'returning') {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Logo />
        <Text style={s.title}>{L('Welcome back', 'ברוכים השבים')}</Text>
        <Text style={s.tagline}>{L('Tap your name. You\'ll need your PIN.', 'לוחצים על השם שלך. צריך את הקוד.')}</Text>
        {people((m) => {
          setChosen(m);
          setPin('');
          setError(null);
        })}
        <Button title={L('I\'m new here', 'אני חדש/ה כאן')} variant="ghost" onPress={() => setMode('new')} />
      </ScrollView>
    );
  }

  // New person: add yourself to the family.
  const join = () => run(() => joinAsNew(name, pin));
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Logo />
        <Text style={s.title}>{L(`Join ${state.familyName}`, `הצטרפות ל${state.familyName}`)}</Text>
        <Text style={s.tagline}>{L('Add yourself to the family', 'הוספה של עצמך למשפחה')}</Text>
        <Card style={s.form}>
          <Field label={L('Your name', 'השם שלי')} placeholder={L('e.g. Noa', 'למשל: נועה')} value={name} onChangeText={(t) => { setName(t); setError(null); }} maxLength={20} autoFocus />
          {pinField(L('Choose a PIN (4–6 digits)', 'בחירת קוד (4–6 ספרות)'), join)}
          <Text style={s.hint}>{L('You\'ll need this PIN if you open the app on another phone.', 'הקוד הזה יידרש אם פותחים את האפליקציה בטלפון אחר.')}</Text>
          <Button title={L('Join the family', 'הצטרפות למשפחה')} icon="person-add-outline" variant="brand" loading={busy} disabled={!name.trim() || pin.length < 4} onPress={join} />
        </Card>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button title={L('I\'ve joined before', 'כבר הצטרפתי בעבר')} variant="ghost" onPress={() => setMode('returning')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Logo() {
  return <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors />;
}

const s = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: space(6), gap: space(3), width: '100%', maxWidth: 520, alignSelf: 'center' },
  logo: { width: 96, height: 96, borderRadius: 24, alignSelf: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: space(3) },
  tagline: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  actions: { gap: space(3), marginTop: space(6) },
  form: { gap: space(4), marginTop: space(6) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(4), marginTop: space(6) },
  person: { alignItems: 'center', gap: space(2), width: 100, paddingVertical: space(4), backgroundColor: colors.card, borderRadius: 18 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
