import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch as RNSwitch, View, type ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Input } from './field';
import { Text } from './text';
import { EM_DASH } from '@/lib/format';
import { useTheme } from '@/theme';

/** Debounced-free search box; filtering happens client-side on already-loaded data. */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  right,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
      <Input
        leftIcon="search"
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1 }}
        rightSlot={
          value ? (
            <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.faintText} />
            </Pressable>
          ) : undefined
        }
      />
      {right}
    </View>
  );
}

/** Horizontal filter/segment control. Scrolls when the options overflow. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.lg }}
      style={style}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 8,
              borderRadius: theme.radius.pill,
              backgroundColor: active ? theme.colors.primary : theme.colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? theme.colors.primary : theme.colors.border,
            }}
          >
            <Text variant="label" style={{ color: active ? theme.colors.primaryText : theme.colors.mutedText }}>
              {option.label}
            </Text>
            {option.count !== undefined && (
              <View
                style={{
                  minWidth: 20,
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: theme.radius.pill,
                  alignItems: 'center',
                  backgroundColor: active ? 'rgba(255,255,255,0.22)' : theme.colors.surfaceAlt,
                }}
              >
                <Text variant="micro" style={{ color: active ? theme.colors.primaryText : theme.colors.faintText }}>
                  {option.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Label/value pair. The unit of every detail screen. */
export function DetailRow({
  label,
  value,
  tone = 'default',
  emphasis,
  children,
}: {
  label: string;
  value?: string | number | null;
  tone?: 'default' | 'muted' | 'success' | 'danger' | 'warning';
  emphasis?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const display = value === null || value === undefined || value === '' ? EM_DASH : String(value);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: 7,
      }}
    >
      <Text variant="caption" tone="muted" style={{ flexShrink: 0, maxWidth: '46%' }}>
        {label}
      </Text>
      {children ?? (
        <Text
          variant={emphasis ? 'bodyStrong' : 'body'}
          tone={tone === 'default' ? 'default' : tone}
          numeric
          style={{ flex: 1, textAlign: 'right' }}
        >
          {display}
        </Text>
      )}
    </View>
  );
}

/** Compact metric tile for dashboards and list summaries. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  onPress,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const map = {
    primary: { fg: theme.colors.primary, bg: theme.colors.primarySoft },
    success: { fg: theme.colors.success, bg: theme.colors.successSoft },
    warning: { fg: theme.colors.warning, bg: theme.colors.warningSoft },
    danger: { fg: theme.colors.danger, bg: theme.colors.dangerSoft },
    info: { fg: theme.colors.info, bg: theme.colors.infoSoft },
    neutral: { fg: theme.colors.mutedText, bg: theme.colors.surfaceAlt },
  }[tone];

  const content = (
    <>
      {icon && (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: map.bg,
          }}
        >
          <Ionicons name={icon} size={17} color={map.fg} />
        </View>
      )}
      <View style={{ gap: 1 }}>
        <Text variant="title" numeric numberOfLines={1}>
          {value}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Text>
        {!!hint && (
          <Text variant="micro" style={{ color: map.fg }} numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
    </>
  );

  const base: ViewStyle = {
    flex: 1,
    minWidth: 150,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  };

  if (!onPress) return <View style={[base, theme.shadow(1), style]}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [base, theme.shadow(1), pressed && { backgroundColor: theme.colors.surfaceAlt }, style]}
    >
      {content}
    </Pressable>
  );
}

/** Labelled toggle row. */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {!!description && (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        )}
      </View>
      <RNSwitch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onValueChange(next);
        }}
        trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
        thumbColor={Platform.OS === 'android' ? theme.colors.surface : undefined}
      />
    </View>
  );
}

/** Tappable checkbox row, used where a switch would overstate the action. */
export function CheckboxRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: checked ? 0 : 1.5,
          borderColor: theme.colors.borderStrong,
          backgroundColor: checked ? theme.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Ionicons name="checkmark" size={15} color={theme.colors.primaryText} />}
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Inline banner for form-level warnings and blocking conditions. */
export function Callout({
  tone = 'info',
  title,
  description,
  icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  const map = {
    info: { fg: theme.colors.info, bg: theme.colors.infoSoft, icon: 'information-circle' as const },
    warning: { fg: theme.colors.warning, bg: theme.colors.warningSoft, icon: 'warning' as const },
    danger: { fg: theme.colors.danger, bg: theme.colors.dangerSoft, icon: 'alert-circle' as const },
    success: { fg: theme.colors.success, bg: theme.colors.successSoft, icon: 'checkmark-circle' as const },
  }[tone];

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: map.bg,
      }}
    >
      <Ionicons name={icon ?? map.icon} size={18} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ color: map.fg }}>
          {title}
        </Text>
        {!!description && (
          <Text variant="caption" style={{ color: map.fg, opacity: 0.9 }}>
            {description}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/** Collapsible section — keeps long detail screens scannable. */
export function Accordion({
  title,
  caption,
  children,
  defaultOpen = false,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Animated.View layout={LinearTransition.duration(180)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}
      >
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="heading">{title}</Text>
          {!!caption && (
            <Text variant="caption" tone="muted">
              {caption}
            </Text>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.faintText} />
      </Pressable>
      {open && <View style={{ paddingBottom: theme.spacing.sm }}>{children}</View>}
    </Animated.View>
  );
}
