import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { brand, colors, deepen, onColor, radius, shadow, space, tint } from '../theme';
import type { Member } from '../types';
import { forwardIcon } from '../i18n';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brand' | 'brandSoft';

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const palette = {
    primary: { bg: brand.navy, fg: '#fff' },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: 'transparent', fg: colors.muted },
    brand: { bg: brand.navy, fg: '#fff' },
    brandSoft: { bg: brand.soft, fg: brand.ink },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        (variant === 'brand' || variant === 'primary') && { overflow: 'hidden' },
        style,
      ]}
    >
      {(variant === 'brand' || variant === 'primary') && (
        // Same teal-to-deep-blue fade as the app icon.
        <LinearGradient colors={[brand.teal, brand.navy]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Avatar({ member, size = 32 }: { member: Pick<Member, 'name' | 'color'>; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: member.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: onColor(member.color), fontWeight: '700', fontSize: size * 0.42 }}>
        {member.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  color = colors.primary,
  selected,
  onPress,
  icon,
}: {
  label: string;
  color?: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const content = (
    <View
      style={[
        styles.chip,
        selected
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: tint(color, 0.88), borderColor: tint(color, 0.88) },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? onColor(color) : deepen(color, 0.25)} />}
      <Text style={[styles.chipText, { color: selected ? onColor(color) : deepen(color, 0.25) }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      {content}
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Banner({ tone, icon, children }: { tone: 'warning' | 'danger' | 'success' | 'info'; icon?: IconName; children: React.ReactNode }) {
  const t = {
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-circle' as IconName },
    danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle' as IconName },
    success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' as IconName },
    info: { bg: colors.primarySoft, fg: colors.primary, icon: 'information-circle' as IconName },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Ionicons name={icon ?? t.icon} size={18} color={t.fg} />
      <Text style={[styles.bannerText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** iOS-style segmented tabs, used inside a screen (e.g. Members | Cars). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && { color: colors.text }]}>{o.label}</Text>
            {!!o.badge && (
              <View style={styles.segmentBadge}>
                <Text style={styles.segmentBadgeText}>{o.badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable list row with a chevron, for lists that open a details page. */
export function ListRow({
  left,
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
}: {
  left?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  /** Leave out to show a read-only row (no chevron, not tappable). */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && <Ionicons name={forwardIcon('chevron-forward', 'chevron-back')} size={18} color={colors.faint} />}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space(4),
    ...shadow,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingVertical: space(3.5),
    paddingHorizontal: space(5),
    borderRadius: radius.md,
    minHeight: 48,
  },
  buttonSmall: { paddingVertical: space(2), paddingHorizontal: space(3), minHeight: 36 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space(5),
    marginBottom: space(2.5),
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    padding: space(3),
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    fontSize: 16,
    color: colors.text,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space(2),
    borderRadius: radius.sm + 1,
  },
  segmentOn: { backgroundColor: colors.raised, ...shadow },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    ...shadow,
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  listSubtitle: { fontSize: 13, color: colors.muted },
  empty: { alignItems: 'center', padding: space(8), gap: space(2) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.muted },
  emptyText: { fontSize: 14, color: colors.faint, textAlign: 'center' },
});
