import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Banner, Button } from '../components/ui';
import { useLoadedFamily } from '../data/FamilyContext';
import { openFirst, smsUrl, whatsappUrls } from '../logic/contact';
import { colors, radius, space } from '../theme';

export interface MessageRequest {
  to: string; // member id
  text: string;
  title: string; // e.g. "Request sent!"
}

const WHATSAPP_GREEN = '#25D366';

/** "Let Dad know": a ready-to-send message with WhatsApp and SMS buttons. */
export function MessageSheet({ request, onDone }: { request: MessageRequest; onDone: () => void }) {
  const { state } = useLoadedFamily();
  const member = state.members.find((m) => m.id === request.to);
  const [text, setText] = useState(request.text);
  const [error, setError] = useState<string | null>(null);

  const send = async (urls: string[]) => {
    setError(null);
    if (await openFirst(urls)) onDone();
    else setError("Couldn't open that app on this device.");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{request.title}</Text>
        <View style={s.to}>
          {member && <Avatar member={member} size={44} />}
          <View style={{ flex: 1 }}>
            <Text style={s.toName}>Let {member?.name ?? 'them'} know</Text>
            <Text style={s.muted}>{member?.phone ? member.phone : 'No phone saved – you’ll pick the contact'}</Text>
          </View>
        </View>

        <TextInput
          style={s.message}
          multiline
          value={text}
          onChangeText={setText}
          accessibilityLabel="Message text"
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => send(whatsappUrls(text, member?.phone))}
          style={({ pressed }) => [s.whatsapp, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          <Text style={s.whatsappText}>Send on WhatsApp</Text>
        </Pressable>
        <Button title="Send as SMS" icon="chatbubble-outline" variant="secondary" onPress={() => send([smsUrl(text, member?.phone)])} />
        {error && <Banner tone="danger">{error}</Banner>}
        {!member?.phone && (
          <Text style={s.hint}>Tip: add {member?.name}'s phone number in Family → Members to send straight to them.</Text>
        )}
      </ScrollView>
      <View style={s.footer}>
        <Button title="Skip" variant="ghost" onPress={onDone} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: space(5), gap: space(4) },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  to: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
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
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  footer: { flexDirection: 'row', padding: space(4), borderTopWidth: 1, borderTopColor: colors.border },
});
