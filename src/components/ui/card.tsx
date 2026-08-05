import { Platform, Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from './text';
import { useTheme } from '@/theme';

export interface CardProps extends ViewProps {
  /** Turns the card into a tappable row; adds the press affordance. */
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, padded = true, elevated = true, style, ...rest }: CardProps) {
  const theme = useTheme();

  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
    overflow: 'hidden',
  };

  if (!onPress) {
    return (
      <View style={[base, elevated ? theme.shadow(1) : null, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        base,
        elevated ? theme.shadow(1) : null,
        pressed && { backgroundColor: theme.colors.surfaceAlt, transform: [{ scale: 0.995 }] },
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

/** Section heading used above a group of cards or fields. */
export function SectionHeader({
  title,
  action,
  caption,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {!!caption && (
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
        )}
      </View>
      {action}
    </View>
  );
}
