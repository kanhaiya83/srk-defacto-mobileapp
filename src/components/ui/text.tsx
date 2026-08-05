import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';

type Variant = keyof Theme['typography'];
type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'danger' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  /** Tabular figures — keeps digits from jittering in tables and counters. */
  numeric?: boolean;
}

export function Text({ variant = 'body', tone = 'default', numeric, style, ...rest }: TextProps) {
  const theme = useTheme();

  const color: Record<Tone, string> = {
    default: theme.colors.text,
    muted: theme.colors.mutedText,
    faint: theme.colors.faintText,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    inverse: theme.colors.primaryText,
  };

  const numericStyle: TextStyle | undefined = numeric
    ? { fontVariant: ['tabular-nums'] }
    : undefined;

  return <RNText style={[theme.typography[variant], { color: color[tone] }, numericStyle, style]} {...rest} />;
}
