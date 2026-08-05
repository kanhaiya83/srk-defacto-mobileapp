import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, shadow, spacing, typography, type ThemeColors } from './tokens';

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  dark: boolean;
  shadow: (level: 1 | 2 | 3) => object;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      colors: dark ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      dark,
      shadow: (level) => shadow(level, dark),
    }),
    [dark]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

/**
 * Builds a StyleSheet-shaped object that depends on the theme, memoised per
 * theme instance. Keeps screens free of `useMemo(() => StyleSheet.create(...))`
 * boilerplate while still avoiding a rebuild on every render.
 */
export function useStyles<T extends Record<string, unknown>>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

export * from './tokens';
