import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './text';
import { useTheme } from '@/theme';

/** App canvas. Every screen's outermost element. */
export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom')[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Screen header.
 *
 * The back affordance is part of the header rather than a native nav bar so it
 * can sit alongside a title, subtitle and actions without three different
 * platform behaviours.
 */
export function Header({
  title,
  subtitle,
  onBack,
  right,
  large,
}: {
  title: string;
  subtitle?: string;
  /** Pass `null` to suppress the automatic back button. */
  onBack?: (() => void) | null;
  right?: ReactNode;
  large?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();

  const back = onBack === null ? null : (onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/'))));

  return (
    <View
      style={[
        styles.header,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={back}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.colors.surfaceActive : theme.colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
          })}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
      )}

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant={large ? 'display' : 'title'} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {right}
    </View>
  );
}

/** Scrolling body with keyboard handling and consistent gutters. */
export function Body({
  children,
  contentContainerStyle,
  gap,
  ...rest
}: ScrollViewProps & { children: ReactNode; gap?: number }) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          {
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xxxl,
            gap: gap ?? theme.spacing.lg,
          },
          contentContainerStyle,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Sticky action bar pinned to the bottom of a form.
 *
 * Long ERP forms scroll well past a screen; keeping Save reachable without
 * scrolling back is the difference between one tap and ten.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: Math.max(insets.bottom, theme.spacing.md),
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
});
