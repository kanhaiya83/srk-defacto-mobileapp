import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './text';
import { useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Skip the tap haptic — for buttons fired in rapid succession. */
  silent?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
  silent = false,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const height = { sm: 36, md: 46, lg: 54 }[size];
  const paddingHorizontal = { sm: theme.spacing.md, md: theme.spacing.lg, lg: theme.spacing.xl }[size];
  const iconSize = { sm: 15, md: 17, lg: 19 }[size];
  const textVariant = size === 'sm' ? ('label' as const) : ('bodyStrong' as const);

  const surface: Record<Variant, { bg: string; border: string; fg: string }> = {
    primary: { bg: theme.colors.primary, border: 'transparent', fg: theme.colors.primaryText },
    secondary: { bg: theme.colors.surfaceAlt, border: 'transparent', fg: theme.colors.text },
    outline: { bg: 'transparent', border: theme.colors.borderStrong, fg: theme.colors.text },
    ghost: { bg: 'transparent', border: 'transparent', fg: theme.colors.primary },
    danger: { bg: theme.colors.danger, border: 'transparent', fg: '#FFFFFF' },
  };
  const { bg, border, fg } = surface[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        if (!silent && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      // A press shrink, driven by Pressable's own state rather than a shared
      // value — no worklet, and nothing for the React Compiler to object to.
      style={({ pressed }) => [
        styles.base,
        pressed && { transform: [{ scale: 0.97 }] },
        variant === 'primary' || variant === 'danger' ? theme.shadow(1) : null,
        {
          height,
          paddingHorizontal,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderRadius: theme.radius.md,
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={[styles.content, { gap: theme.spacing.sm }]}>
          {icon && iconPosition === 'left' && <Ionicons name={icon} size={iconSize} color={fg} />}
          {!!label && (
            <Text variant={textVariant} style={{ color: fg }} numberOfLines={1}>
              {label}
            </Text>
          )}
          {icon && iconPosition === 'right' && <Ionicons name={icon} size={iconSize} color={fg} />}
        </View>
      )}
    </Pressable>
  );
}

/** Square icon-only button — list row actions, header actions. */
export function IconButton({
  icon,
  onPress,
  tone = 'default',
  size = 38,
  disabled,
  accessibilityLabel,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'danger';
  size?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const color =
    tone === 'danger' ? theme.colors.danger : tone === 'primary' ? theme.colors.primary : theme.colors.mutedText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: theme.radius.sm,
          backgroundColor: pressed ? theme.colors.surfaceActive : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
});
