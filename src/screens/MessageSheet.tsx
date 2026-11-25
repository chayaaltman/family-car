import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Banner, Button, Chip } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { openFirst, smsUrl, whatsappUrls } from '../logic/contact';
import { colors, radius, space } from '../theme';
import type { Member } from '../types';
import { L } from '../i18n';

export interface MessageRequest {
  to: string | string[]; // member id, or several to choose from (e.g. a car's owners)
  text: string;
  /** Rebuilds the text for the people chosen, so the greeting says "Hi Mom and Ezra!" only when both are picked. */
  textFor?: (names: string[]) => string;
  title: string; // e.g. L('Request sent!', 'הבקשה נשלחה!')
  /** Also offer sending to a group: WhatsApp then lets you pick the chat (e.g. the family group). */
  group?: boolean;
}

const WHATSAPP_GREEN = '#25D366';
const GROUP = '__group__';

/** "Let Dad know": a ready-to-send message. Pick one or more people (or a group chat), then send. */
export function MessageSheet({ request, onDone }: { request: MessageRequest; onDone: () => void }) {
  const { state } = useLoadedFamily();
  const options = state.members.filter((m) => (Array.isArray(request.to) ? request.to : [request.to]).includes(m.id));
  const [chosen, setChosen] = useState<string[]>(request.group ? [GROUP] : options.slice(0, 1).map((m) => m.id));
  const [edited, setEdited] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toGroup = chosen.includes(GROUP);
  const people = options.filter((m) => chosen.includes(m.id));
  // The text follows who's chosen, until the user types their own.
  const text = edited ?? (request.textFor ? request.textFor(toGroup ? [] : people.map((m) => m.name)) : request.text);

  const toggle = (id: string) => {
    setSent([]);
    if (id === GROUP) return setChosen([GROUP]);
    setChosen((c) => {
      const named = c.filter((x) => x !== GROUP);
      return named.includes(id) ? named.filter((x) => x !== id) : [...named, id];
    });
  };

  const open = async (urls: string[], key: string, closeAfter: boolean) => {
    setError(null);
    if (await openFirst(urls)) {
      if (closeAfter) onDone();
      else setSent((s) => [...s, key]);
    } else setError(L('Couldn\'t open that app on this device.', 'לא הצלחנו לפתוח את האפליקציה הזאת במכשיר.'));
  };

  const single: Member | undefined = !toGroup && people.length === 1 ? people[0] : undefined;
  const pickable = options.length > 1 || request.group;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{request.title}</Text>

        {pickable ? (
          <>
            <Text style={s.label}>{L('Send to', 'שליחה אל')}</Text>
            <View style={s.pick}>
              {request.group && (
                <Chip label={L('A group chat', 'קבוצה')} icon="people-outline" color={colors.primary} selected={toGroup} onPress={() => toggle(GROUP)} />
              )}
              {options.map((m) => (
                <Chip key={m.id} label={m.name} color={colors.primary} selected={chosen.includes(m.id)} onPress={() => toggle(m.id)} />
              ))}
            </View>
          </>
        ) : (
          single && (
            <View style={s.to}>
              <Avatar member={single} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.toName}>{L(`Let ${single.name} know`, `לעדכן את ${single.name}`)}</Text>
                <Text style={s.muted}>{single.phone ?? L('No phone saved – you’ll pick the contact', 'אין מספר שמור – בוחרים את איש הקשר')}</Text>
              </View>
            </View>
          )
        )}

        <TextInput style={s.message} multiline value={text} onChangeText={setEdited} accessibilityLabel={L('Message text', 'תוכן ההודעה')} />

        {toGroup || single ? (
          // One chat: big buttons, and the sheet closes once the app opens.
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => open(whatsappUrls(text, single?.phone), 'one', true)}
              style={({ pressed }) => [s.whatsapp, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              <Text style={s.whatsappText}>{toGroup ? L('Send on WhatsApp – choose the group', 'שליחה בוואטסאפ – בוחרים את הקבוצה') : L('Send on WhatsApp', 'שליחה בוואטסאפ')}</Text>
            </Pressable>
            {!toGroup && (
              <Button title={L('Send as SMS', 'שליחה ב־SMS')} icon="chatbubble-outline" variant="secondary" onPress={() => open([smsUrl(text, single?.phone)], 'one', true)} />
            )}
            {single && !single.phone && (
              <Text style={s.hint}>
                {L(
                  `Tip: add ${single.name}'s phone number in Family → Members to send straight to them.`,
                  `טיפ: אפשר להוסיף את הטלפון של ${single.name} במשפחה ← אנשים, כדי לשלוח ישר אליו/ה.`,
                )}
              </Text>
            )}
          </>
        ) : people.length > 1 ? (
          // Several people: WhatsApp opens one chat at a time, so one row per person.
          <View style={{ gap: space(2) }}>
            {people.map((m) => (
              <View key={m.id} style={s.personRow}>
                <Avatar member={m} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.personName}>{m.name}</Text>
                  <Text style={s.muted}>{sent.includes(m.id) ? L('Sent ✓', 'נשלח ✓') : m.phone ?? L('No phone saved', 'אין מספר שמור')}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`WhatsApp ${m.name}`}
                  onPress={() => open(whatsappUrls(text, m.phone), m.id, false)}
                  style={({ pressed }) => [s.smallWa, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                </Pressable>
                <Button small title={'SMS'} variant="secondary" onPress={() => open([smsUrl(text, m.phone)], m.id, false)} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.hint}>{L('Choose who to send it to.', 'בוחרים למי לשלוח.')}</Text>
        )}
        {error && <Banner tone="danger">{error}</Banner>}
      </ScrollView>
      <View style={s.footer}>
        <Button title={sent.length ? L('Done', 'סיום') : L('Skip', 'דילוג')} variant={sent.length ? 'primary' : 'ghost'} onPress={onDone} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: -space(2) },
  to: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  pick: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  toName: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  message: {
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(3.5),
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: WHATSAPP_GREEN,
  },
  whatsappText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(2.5),
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personName: { fontSize: 16, fontWeight: '700', color: colors.text },
  smallWa: { width: 40, height: 36, borderRadius: radius.md, backgroundColor: WHATSAPP_GREEN, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  footer: { flexDirection: 'row', padding: space(4), borderTopWidth: 1, borderTopColor: colors.border },
});
