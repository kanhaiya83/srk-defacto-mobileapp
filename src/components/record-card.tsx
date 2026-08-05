import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from './ui/button';
import { Badge, type BadgeTone } from './ui/badge';
import { Card } from './ui/card';
import { Text } from './ui/text';
import { EM_DASH } from '@/lib/format';
import { useTheme } from '@/theme';

export interface RecordField {
  label: string;
  value?: string | number | null;
  /** Renders in the accent colour — for the number that matters most. */
  emphasis?: boolean;
}

/**
 * The list row for every record in the app.
 *
 * A phone cannot show a twelve-column table, so each row becomes a card: title
 * and status on the first line, then up to four label/value pairs in a grid.
 * Which four is a per-screen decision — the ones an operator scans for.
 */
export function RecordCard({
  title,
  subtitle,
  badge,
  fields = [],
  icon,
  onPress,
  onMenu,
  footer,
  accent,
}: {
  title: string;
  subtitle?: string;
  badge?: { label: string; tone?: BadgeTone };
  fields?: RecordField[];
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onMenu?: () => void;
  footer?: ReactNode;
  /** Left edge stripe — draws the eye to rows needing attention. */
  accent?: BadgeTone;
}) {
  const theme = useTheme();

  const accentColor = accent
    ? {
        neutral: theme.colors.border,
        primary: theme.colors.primary,
        success: theme.colors.success,
        warning: theme.colors.warning,
        danger: theme.colors.danger,
        info: theme.colors.info,
      }[accent]
    : undefined;

  return (
    <Card onPress={onPress} padded={false}>
      <View style={{ flexDirection: 'row' }}>
        {accentColor && <View style={{ width: 3, backgroundColor: accentColor }} />}
        <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
            {icon && (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: theme.radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <Ionicons name={icon} size={18} color={theme.colors.mutedText} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {title}
              </Text>
              {!!subtitle && (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            {badge && <Badge label={badge.label} tone={badge.tone} />}
            {onMenu && <IconButton icon="ellipsis-horizontal" accessibilityLabel="Row actions" onPress={onMenu} size={32} />}
          </View>

          {fields.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.md }}>
              {fields.map((field) => (
                <View key={field.label} style={{ width: '50%', paddingRight: theme.spacing.md, gap: 1 }}>
                  <Text variant="micro" tone="faint" numberOfLines={1}>
                    {field.label.toUpperCase()}
                  </Text>
                  <Text
                    variant={field.emphasis ? 'bodyStrong' : 'body'}
                    tone={field.emphasis ? 'primary' : 'default'}
                    numeric
                    numberOfLines={1}
                  >
                    {field.value === null || field.value === undefined || field.value === '' ? EM_DASH : String(field.value)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {footer}
        </View>
      </View>
    </Card>
  );
}
