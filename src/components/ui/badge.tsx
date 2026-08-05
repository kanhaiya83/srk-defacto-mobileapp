import { View, type ViewStyle } from 'react-native';

import { Text } from './text';
import { useTheme } from '@/theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surfaceAlt, fg: theme.colors.mutedText },
    primary: { bg: theme.colors.primarySoft, fg: theme.colors.primary },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
    info: { bg: theme.colors.infoSoft, fg: theme.colors.info },
  };

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: map[tone].bg,
          borderRadius: theme.radius.pill,
          paddingHorizontal: 9,
          paddingVertical: 3,
        },
        style,
      ]}
    >
      <Text variant="micro" style={{ color: map[tone].fg }} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
