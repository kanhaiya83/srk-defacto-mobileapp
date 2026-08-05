import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from './button';
import { Text } from './text';
import { useTheme } from '@/theme';

/**
 * Skeleton block.
 *
 * Lists render skeletons shaped like the rows they are about to show, not a
 * spinner: the layout does not jump when data lands, which is what makes a slow
 * network feel like a fast app.
 */
export function Skeleton({ height = 16, width, radius, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: ViewStyle }) {
  const theme = useTheme();
  const progress = useSharedValue(0.4);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [progress]);

  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[
        animated,
        {
          height,
          width: width ?? '100%',
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.skeleton,
        },
        style,
      ]}
    />
  );
}

/** Placeholder shaped like a `RecordCard`. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
            <Skeleton width="45%" height={17} />
            <Skeleton width={62} height={17} radius={999} />
          </View>
          <Skeleton width="70%" height={13} />
          <Skeleton width="35%" height={13} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  actionIcon = 'add',
  onAction,
  compact,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingVertical: compact ? theme.spacing.xl : theme.spacing.xxxl,
        paddingHorizontal: theme.spacing.xl,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        <Ionicons name={icon} size={27} color={theme.colors.faintText} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {!!description && (
        <Text variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && <Button label={actionLabel} icon={actionIcon} onPress={onAction} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl, paddingHorizontal: theme.spacing.xl }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.dangerSoft,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={27} color={theme.colors.danger} />
      </View>
      <Text variant="heading">Could not load this</Text>
      <Text variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
        {message ?? 'Check your connection and try again.'}
      </Text>
      {onRetry && <Button label="Try again" icon="refresh" variant="outline" onPress={onRetry} />}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}>
      <ActivityIndicator color={theme.colors.primary} />
      {!!label && (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      )}
    </View>
  );
}
