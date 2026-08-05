import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from './button';
import { Text } from './text';
import { useTheme } from '@/theme';

/**
 * Bottom sheet.
 *
 * Everything modal in this app is a sheet: it keeps the thumb near the controls,
 * it can be dismissed by tapping the dimmed area above it, and it never covers
 * the whole screen so the user keeps their place in the list behind it.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  /** Fraction of screen height the body may grow to before it scrolls. */
  maxHeightRatio = 0.88,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeightRatio?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            exiting={SlideOutDown.duration(200)}
            style={[
              theme.shadow(3),
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                maxHeight: height * maxHeightRatio,
                paddingBottom: insets.bottom || theme.spacing.lg,
                borderTopWidth: theme.dark ? StyleSheet.hairlineWidth : 0,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
            </View>

            {!!title && (
              <View
                style={[
                  styles.header,
                  { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: theme.spacing.md },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title">{title}</Text>
                  {!!subtitle && (
                    <Text variant="caption" tone="muted">
                      {subtitle}
                    </Text>
                  )}
                </View>
                <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
              </View>
            )}

            {children}

            {!!footer && (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.colors.border,
                    paddingHorizontal: theme.spacing.lg,
                    paddingTop: theme.spacing.md,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                {footer}
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Destructive/confirmation prompt. Never used for anything reversible. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading = false,
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  tone?: 'danger' | 'primary';
}) {
  const theme = useTheme();

  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tone === 'danger' ? theme.colors.dangerSoft : theme.colors.primarySoft,
            }}
          >
            <Ionicons
              name={tone === 'danger' ? 'trash-outline' : 'help-circle-outline'}
              size={24}
              color={tone === 'danger' ? theme.colors.danger : theme.colors.primary}
            />
          </View>
          <Text variant="title" style={{ textAlign: 'center' }}>
            {title}
          </Text>
          {!!description && (
            <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
              {description}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  keyboardWrap: { justifyContent: 'flex-end' },
  grabberWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  grabber: { width: 38, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
});
