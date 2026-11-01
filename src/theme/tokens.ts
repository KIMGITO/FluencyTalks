export const fonts = {
  sans: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "'Newsreader', Georgia, 'Times New Roman', serif",
  serif: "'Newsreader', Georgia, 'Times New Roman', serif",
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
  light: {
    bg: '250 246 238', surface: '255 255 255', 'surface-2': '241 234 220', border: '222 214 199',
    ink: '23 22 58', muted: '91 90 126', 'on-brand': '255 255 255',
    brand: '27 26 85', 'brand-soft': '232 229 242', accent: '255 106 77', aqua: '18 181 166',
    sun: '255 200 61', deep: '27 26 85', 'on-deep': '250 246 238',
    success: '22 120 76', danger: '200 36 58', warning: '150 92 8',
    'lvl-a': '14 165 150', 'lvl-b': '27 26 85', 'lvl-c': '255 106 77', 'lvl-n': '240 170 20',
  },
  dark: {
    bg: '14 13 40', surface: '24 23 68', 'surface-2': '36 35 94', border: '56 55 120',
    ink: '240 240 255', muted: '160 160 205', 'on-brand': '14 13 40',
    brand: '124 122 240', 'brand-soft': '40 39 108', accent: '255 129 102', aqua: '45 212 198',
    sun: '255 211 94', deep: '27 26 85',
    success: '52 211 140', danger: '255 99 114', warning: '255 196 80',
    'lvl-a': '45 212 198', 'lvl-b': '124 122 240', 'lvl-c': '255 129 102', 'lvl-n': '255 211 94',
    'on-deep': '250 246 238',
  },
};

// Flat on purpose: gradients read as template styling. The keys stay so existing var(--grad-*) references keep working.
export const gradients = {
  brand: 'linear-gradient(rgb(var(--c-deep)), rgb(var(--c-deep)))',
  spark: 'linear-gradient(rgb(var(--c-accent)), rgb(var(--c-accent)))',
  hero: 'none',
  ring: 'linear-gradient(rgb(var(--c-deep)), rgb(var(--c-deep)))',
} as const;

export const motion = { fast: '120ms', base: '200ms', slow: '320ms', ease: 'cubic-bezier(.2,.8,.2,1)' } as const;