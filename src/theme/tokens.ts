export const fonts = {
  // Editorial poster type: a heavy condensed italic for headlines, a plain grotesque for reading.
  sans: "'Barlow', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "'Barlow Condensed', 'Arial Narrow', Impact, system-ui, sans-serif",
  serif: "'Barlow Condensed', 'Arial Narrow', Impact, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const fontSizes = {
  '2xs': ['0.65rem', { lineHeight: '1rem', letterSpacing: '-0.01em' }],
  xs: ['0.75rem', { lineHeight: '1.2rem', letterSpacing: '-0.005em' }],
  sm: ['0.875rem', { lineHeight: '1.4rem', letterSpacing: '-0.005em' }],
  base: ['1rem', { lineHeight: '1.6rem', letterSpacing: '-0.005em' }],
  lg: ['1.125rem', { lineHeight: '1.8rem', letterSpacing: '-0.01em' }],
  xl: ['1.375rem', { lineHeight: '1.9rem', letterSpacing: '-0.02em' }],
  '2xl': ['1.75rem', { lineHeight: '2.2rem', letterSpacing: '-0.025em' }],
  '3xl': ['2.25rem', { lineHeight: '2.6rem', letterSpacing: '-0.03em' }],
  '4xl': ['3rem', { lineHeight: '3.2rem', letterSpacing: '-0.035em' }],
  '5xl': ['4rem', { lineHeight: '4.1rem', letterSpacing: '-0.04em' }],
} as const;

export const spacing = {
  0: '0', px: '1px', 0.5: '0.125rem', 1: '0.25rem', 1.5: '0.375rem', 2: '0.5rem', 2.5: '0.625rem',
  3: '0.75rem', 3.5: '0.875rem', 4: '1rem', 4.5: '1.125rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem',
  8: '2rem', 9: '2.25rem', 10: '2.5rem', 12: '3rem', 14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
} as const;

export const radii = { sm: '0.1875rem', md: '0.25rem', lg: '0.25rem', xl: '0.375rem', full: '9999px' } as const;   // square-ish, like the public pages

export const shadows = {
  card: '0 1px 0 rgb(var(--c-ink) / 0.04)',
  pop: '0 18px 34px -18px rgb(var(--c-ink) / 0.34), 0 4px 10px -4px rgb(var(--c-ink) / 0.12)',
} as const;


export const breakpoints = { sm: 640, md: 768, lg: 1100, xl: 1400 } as const;


export const layout = {
  topbarH: '3.5rem', bottomNavH: '3.75rem',
  sidebarW: '15.5rem', sidebarCompactW: '4rem', railW: '18.5rem', feedMaxW: '40rem',
  cardPad: '0.75rem', cardPadLg: '1rem',
} as const;

export const levelColors = { A1: 'lvl-a', A2: 'lvl-a', B1: 'lvl-b', B2: 'lvl-b', C1: 'lvl-c', C2: 'lvl-c', Native: 'lvl-n' } as const;

type Palette = Record<string, string>;
export const themes: Record<'light' | 'dark', Palette> = {
  // Off-white ground, royal-blue headlines, navy text. Flat colour only. No purple, violet or maroon.
  // Each colour means one thing: blue = act / highlight (accent is the brand blue), green (go, success) = call,
  // answer, online, done; amber (warning, sun) = pending, busy, attention; red (danger) = destructive or failed, only.
  light: {
    bg: '238 240 244', surface: '250 251 252', 'surface-2': '226 231 238', border: '206 213 224',
    ink: '14 32 72', muted: '74 86 106', 'on-brand': '255 255 255',
    brand: '23 78 210', 'brand-soft': '221 233 252', accent: '23 78 210', aqua: '23 78 210',
    sun: '214 150 0', deep: '14 32 72', 'on-deep': '238 240 244',
    success: '18 104 66', danger: '200 30 30', warning: '150 92 8',
    // Answer and start a call. White on it is 5:1, in both themes.
    go: '21 128 61',
    'lvl-a': '74 86 106', 'lvl-b': '23 78 210', 'lvl-c': '13 116 128', 'lvl-n': '14 32 72',
  },
  dark: {
    bg: '9 17 36', surface: '16 28 54', 'surface-2': '25 41 74', border: '42 61 98',
    ink: '238 240 244', muted: '160 172 192', 'on-brand': '255 255 255',
    brand: '84 150 245', 'brand-soft': '22 44 90', accent: '84 150 245', aqua: '84 150 245',
    sun: '250 196 50', deep: '14 32 72',
    success: '52 211 140', danger: '255 112 112', warning: '255 196 80',
    go: '21 128 61',
    'lvl-a': '160 172 192', 'lvl-b': '84 150 245', 'lvl-c': '45 190 200', 'lvl-n': '238 240 244',
    'on-deep': '238 240 244',
  },
};

// No gradients anywhere, by design: every surface is one flat colour.

export const motion = { fast: '120ms', base: '200ms', slow: '320ms', ease: 'cubic-bezier(.2,.8,.2,1)' } as const;