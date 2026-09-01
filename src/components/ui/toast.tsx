import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutUp, LinearTransition, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/**
 * Toasts.
 *
 * Deliberately a tiny bespoke implementation rather than a dependency: the API
 * mirrors the web client's `sonner` calls one-for-one (`toast.success(title,
 * { description })`), so ported screens read identically, and it can be called
 * from the axios interceptor — outside React — via the module-level `toast`.
 */

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  description?: string;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  title: string;
  variant: ToastVariant;
}

let counter = 0;
let enqueue: ((item: Omit<ToastItem, 'id'>) => void) | null = null;

const push = (variant: ToastVariant) => (title: string, options?: ToastOptions) => {
  enqueue?.({ title, variant, ...options });
};

export const toast = {
  success: push('success'),
  error: push('error'),
  info: push('info'),
  warning: push('warning'),
  /** Bare call, matching `toast("…")`. */
  message: push('info'),
};

const ToastContext = createContext<null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    enqueue = (item) => {
      const id = ++counter;
      // Three at a time is the most that stays scannable; older ones drop off.
      setItems((current) => [...current.slice(-2), { ...item, id }]);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(
          item.variant === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : item.variant === 'warning'
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success
        );
      }
      const timer = setTimeout(() => dismiss(id), item.duration ?? (item.variant === 'error' ? 5000 : 3200));
      timers.current.set(id, timer);
    };
    const pending = timers.current;
    return () => {
      enqueue = null;
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [dismiss]);

  const visuals = useMemo(
    () => ({
      success: { icon: 'checkmark-circle' as const, tint: theme.colors.success, soft: theme.colors.successSoft },
      error: { icon: 'alert-circle' as const, tint: theme.colors.danger, soft: theme.colors.dangerSoft },
      warning: { icon: 'warning' as const, tint: theme.colors.warning, soft: theme.colors.warningSoft },
      info: { icon: 'information-circle' as const, tint: theme.colors.info, soft: theme.colors.infoSoft },
    }),
    [theme]
  );

  return (
    <ToastContext.Provider value={null}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { top: insets.top + 8, paddingHorizontal: theme.spacing.lg }]}
      >
        {items.map((item) => {
          const visual = visuals[item.variant];
          return (
            <Animated.View
              key={item.id}
              entering={SlideInUp.duration(200)}
              exiting={FadeOutUp.duration(160)}
              layout={LinearTransition.duration(160)}
            >
              <Pressable
                onPress={() => dismiss(item.id)}
                accessibilityRole="alert"
                accessibilityLabel={`${item.title}${item.description ? `. ${item.description}` : ''}`}
                style={[
                  styles.toast,
                  theme.shadow(2),
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.md,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: visual.soft }]}>
                  <Ionicons name={visual.icon} size={18} color={visual.tint} />
                </View>
                <View style={styles.body}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!!item.description && (
                    <Text style={[theme.typography.caption, { color: theme.colors.mutedText }]} numberOfLines={3}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  useContext(ToastContext);
  return toast;
};

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, zIndex: 999, gap: 8 },
  toast: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
