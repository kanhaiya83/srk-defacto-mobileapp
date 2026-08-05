import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from './text';
import { useTheme } from '@/theme';

/**
 * A labelled form row.
 *
 * Label, hint and error all live here rather than in each input, so every field
 * on every screen has the same vertical rhythm and the same error placement —
 * the error slot is animated in below the control, never pushing the label.
 */
export function Field({
  label,
  required,
  error,
  hint,
  children,
  style,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <View style={[{ gap: theme.spacing.xs }, style]}>
      {!!label && (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <Text variant="label" tone="muted">
            {label}
          </Text>
          {required && (
            <Text variant="label" tone="danger">
              *
            </Text>
          )}
        </View>
      )}
      {children}
      {!!error && (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </Animated.View>
      )}
      {!error && !!hint && (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      )}
    </View>
  );
}

export interface InputProps extends Omit<TextInputProps, 'style'> {
  error?: boolean;
  /** Non-editable display value — styled distinctly from a disabled control. */
  readOnly?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightSlot?: ReactNode;
  style?: ViewStyle;
  /** Unit shown inside the control's trailing edge, e.g. "kg". */
  suffix?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { error, readOnly, leftIcon, rightSlot, suffix, style, multiline, ...rest },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: readOnly ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor,
          borderWidth: focused || error ? 1.5 : 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          minHeight: multiline ? 90 : 48,
          alignItems: multiline ? 'flex-start' : 'center',
          paddingVertical: multiline ? theme.spacing.md : 0,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      {leftIcon && <Ionicons name={leftIcon} size={17} color={theme.colors.faintText} />}
      <TextInput
        ref={ref}
        editable={!readOnly}
        multiline={multiline}
        placeholderTextColor={theme.colors.faintText}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          theme.typography.body,
          {
            flex: 1,
            color: readOnly ? theme.colors.mutedText : theme.colors.text,
            paddingVertical: multiline ? 0 : 12,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
        {...rest}
      />
      {!!suffix && (
        <Text variant="caption" tone="faint">
          {suffix}
        </Text>
      )}
      {rightSlot}
    </View>
  );
});

/** Numeric input that keeps `''` distinct from `0`, as the web forms do. */
export function NumberInput({
  value,
  onChangeValue,
  ...rest
}: Omit<InputProps, 'value' | 'onChangeText'> & {
  value: number | string | undefined | null;
  onChangeValue: (value: number | '') => void;
}) {
  return (
    <Input
      keyboardType="decimal-pad"
      inputMode="decimal"
      value={value === undefined || value === null ? '' : String(value)}
      onChangeText={(text) => {
        const cleaned = text.replace(/[^0-9.\-]/g, '');
        onChangeValue(cleaned === '' ? '' : Number(cleaned));
      }}
      {...rest}
    />
  );
}

/** Password input with a reveal toggle. */
export const PasswordInput = forwardRef<TextInput, InputProps>(function PasswordInput(props, ref) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      rightSlot={
        <Pressable
          hitSlop={10}
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={19} color={theme.colors.faintText} />
        </Pressable>
      }
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
});
