// Componenti grafici condivisi.

import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { colors, radius, space } from './theme';

export const DISCLAIMER = 'Strumento di supporto, da validare con la nutrizionista.';

/** Avviso sempre visibile. */
export function Disclaimer() {
  return (
    <View style={styles.disclaimer} accessibilityRole="text">
      <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
    </View>
  );
}

/** Pagina con avviso in alto. Con scroll=false il contenuto gestisce da sé lo scorrimento (liste). */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) {
    return (
      <View style={styles.screen}>
        <View style={styles.padH}>
          <Disclaimer />
        </View>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Disclaimer />
      {children}
    </ScrollView>
  );
}

/** Riquadro "cosa fai qui e perché". */
export function Explain({ children }: { children: ReactNode }) {
  return (
    <View style={styles.explain}>
      <Text style={styles.explainText}>{children}</Text>
    </View>
  );
}

export function Notice({ tone, children }: { tone: 'warning' | 'danger' | 'info'; children: ReactNode }) {
  const bg = tone === 'danger' ? colors.dangerBg : tone === 'warning' ? colors.warningBg : colors.infoBg;
  const fg = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warningText : colors.infoText;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export function Card({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title || right ? (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ label, value, hint, muted }: { label: string; value: ReactNode; hint?: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space.s }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.rowValue, muted && { color: colors.grey }]}>{value}</Text>
    </View>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function Badge({ text, tone = 'grey' }: { text: string; tone?: 'warning' | 'info' | 'grey' | 'danger' }) {
  const bg = { warning: colors.warningBg, info: colors.infoBg, grey: colors.greyBg, danger: colors.dangerBg }[tone];
  const fg = { warning: colors.warningText, info: colors.infoText, grey: colors.muted, danger: colors.danger }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

/** Pulsantino "i" che apre una spiegazione. */
export function InfoButton({ topic, label }: { topic: string; label?: string }) {
  return (
    <Link href={{ pathname: '/info/[topic]', params: { topic } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={label ?? 'Spiegazione'} hitSlop={10} style={styles.info}>
        <Text style={styles.infoText}>i</Text>
      </Pressable>
    </Link>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.dangerBg : colors.card;
  const fg = kind === 'primary' ? colors.primaryText : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: colors.primary },
      ]}
    >
      <Text style={{ color: fg, fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function LinkRow({ href, title, subtitle }: { href: Href; title: string; subtitle?: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]} accessibilityRole="link">
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>{title}</Text>
          {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Link>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  keyboardType = 'default',
  info,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  info?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {info ? <InfoButton topic={info} /> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        keyboardType={keyboardType}
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }, error && { borderColor: colors.danger }]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  info,
  hint,
  error,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  info?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {info ? <InfoButton topic={info} /> : null}
        </View>
      ) : null}
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
        <Text style={[styles.fieldLabel, { flex: 1 }]}>{label}</Text>
        <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} accessibilityLabel={label} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.l, paddingBottom: 48, gap: space.m },
  padH: { paddingHorizontal: space.l, paddingTop: space.l },
  disclaimer: { backgroundColor: colors.warningBg, borderRadius: radius, paddingVertical: 8, paddingHorizontal: 12 },
  disclaimerText: { color: colors.warningText, fontSize: 13, textAlign: 'center' },
  explain: { backgroundColor: colors.infoBg, borderRadius: radius, padding: space.m },
  explainText: { color: colors.infoText, fontSize: 15, lineHeight: 21 },
  notice: { borderRadius: radius, padding: space.m },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: space.s,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 15, color: colors.text },
  rowValue: { fontSize: 15, color: colors.text, fontWeight: '600', textAlign: 'right', maxWidth: '55%' },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  info: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.infoText,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  infoText: { color: colors.infoText, fontWeight: '700', fontSize: 13, fontStyle: 'italic' },
  button: { borderRadius: radius, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkTitle: { fontSize: 16, color: colors.text },
  chevron: { fontSize: 24, color: colors.grey, marginLeft: space.s },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segment: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  segmentSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 15, color: colors.text },
  segmentTextSelected: { color: colors.primaryText, fontWeight: '600' },
});
