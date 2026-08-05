/**
 * Design tokens.
 *
 * One palette, two modes. Every colour a screen can reach for is named by role
 * (`surface`, `danger`, `mutedText`) rather than by hue, so a screen never has
 * to know which mode it is rendering in — and a mode change is a one-file edit.
 */

export const palette = {
  brand50: '#EEF2FF',
  brand100: '#E0E7FF',
  brand500: '#4F46E5',
  brand600: '#4338CA',
  brand400: '#818CF8',
  brand300: '#A5B4FC',
} as const;

export interface ThemeColors {
  /** App canvas. */
  background: string;
  /** Raised surface: cards, sheets, headers. */
  surface: string;
  /** Surface one step above `surface` (inputs, chips on cards). */
  surfaceAlt: string;
  /** Pressed / selected surface. */
  surfaceActive: string;
  border: string;
  borderStrong: string;
  text: string;
  mutedText: string;
  faintText: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  skeleton: string;
}

export const lightColors: ThemeColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F6',
  surfaceActive: '#E7EAF0',
  border: '#E3E6EC',
  borderStrong: '#CBD1DC',
  text: '#0F172A',
  mutedText: '#5A6478',
  faintText: '#8A94A6',
  primary: palette.brand500,
  primaryPressed: palette.brand600,
  primaryText: '#FFFFFF',
  primarySoft: palette.brand50,
  success: '#0F8A5F',
  successSoft: '#E4F6EE',
  warning: '#B45309',
  warningSoft: '#FDF2E2',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  info: '#0369A1',
  infoSoft: '#E4F2FB',
  overlay: 'rgba(9, 12, 20, 0.45)',
  skeleton: '#E7EAF0',
};

export const darkColors: ThemeColors = {
  background: '#0B0F17',
  surface: '#141A25',
  surfaceAlt: '#1C2430',
  surfaceActive: '#25303F',
  border: '#232C3A',
  borderStrong: '#334155',
  text: '#F1F5F9',
  mutedText: '#98A3B5',
  faintText: '#6E7A8E',
  primary: palette.brand400,
  primaryPressed: palette.brand300,
  primaryText: '#0B0F17',
  primarySoft: '#1E2340',
  success: '#34D399',
  successSoft: '#12291F',
  warning: '#FBBF24',
  warningSoft: '#2C2210',
  danger: '#F87171',
  dangerSoft: '#2E1618',
  info: '#38BDF8',
  infoSoft: '#0F2434',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1C2430',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12.5, lineHeight: 17, fontWeight: '400' as const },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.3 },
  mono: { fontSize: 13, lineHeight: 19, fontWeight: '500' as const },
} as const;

/** Elevation that reads correctly on both platforms and in dark mode. */
export const shadow = (level: 1 | 2 | 3, dark: boolean) => {
  if (dark) {
    // Shadows are invisible on near-black. A hairline border does the lifting
    // instead — see `Card`, which pairs this with `borderWidth: 1`.
    return { elevation: 0 } as const;
  }
  const spec = {
    1: { height: 1, radius: 3, opacity: 0.05, elevation: 1 },
    2: { height: 4, radius: 12, opacity: 0.08, elevation: 3 },
    3: { height: 12, radius: 28, opacity: 0.14, elevation: 10 },
  }[level];
  return {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: spec.height },
    shadowRadius: spec.radius,
    shadowOpacity: spec.opacity,
    elevation: spec.elevation,
  };
};
