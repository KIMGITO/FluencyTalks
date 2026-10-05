/**
 * FluencyTalks design tokens — THE single source of truth.
 * Nothing in components may hard-code a color, font, size, spacing or gradient.
 * tokens.ts -> (a) CSS variables injected at runtime (inject.ts)
 *           -> (b) Tailwind theme (tailwind.config.ts)
 * Colors are "R G B" triplets so Tailwind opacity modifiers (bg-brand/20) work.
 */

export const fonts = {
  sans: "'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  display: "'Bricolage Grotesque', 'Figtree', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
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
  xs: ['0.75rem', { lineHeight: '1.1rem', letterSpacing: '-0.01em' }],
  sm: ['0.875rem', { lineHeight: '1.35rem', letterSpacing: '-0.01em' }],
  base: ['1rem', { lineHeight: '1.55rem', letterSpacing: '-0.011em' }],
  lg: ['1.125rem', { lineHeight: '1.7rem', letterSpacing: '-0.015em' }],
  xl: ['1.375rem', { lineHeight: '1.9rem', letterSpacing: '-0.02em' }],
  '2xl': ['1.75rem', { lineHeight: '2.2rem', letterSpacing: '-0.025em' }],
  '3xl': ['2.25rem', { lineHeight: '2.6rem', letterSpacing: '-0.03em' }],
  '4xl': ['3rem', { lineHeight: '3.2rem', letterSpacing: '-0.035em' }],
  '5xl': ['4rem', { lineHeight: '4.1rem', letterSpacing: '-0.04em' }],
} as const;

/**
 * Spacing scale. This REPLACES Tailwind's default scale (it is assigned to
 * `theme.spacing`, not `theme.extend.spacing`), so every step we want to use
 * must exist here. The half steps and `px` below are the ones the UI relies on
 * for tight chips, dividers and icon buttons — without them those classes
 * silently generate no CSS at all.
 */
export const spacing = {
  0: '0', px: '1px', 0.5: '0.125rem', 1: '0.25rem', 1.5: '0.375rem', 2: '0.5rem', 2.5: '0.625rem',
  3: '0.75rem', 3.5: '0.875rem', 4: '1rem', 4.5: '1.125rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem',
  8: '2rem', 9: '2.25rem', 10: '2.5rem', 12: '3rem', 14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
} as const;

export const radii = { sm: '0.5rem', md: '0.875rem', lg: '1.25rem', xl: '1.75rem', full: '9999px' } as const;

export const shadows = {
  card: '0 1px 2px rgb(var(--c-ink) / 0.06), 0 4px 16px rgb(var(--c-ink) / 0.06)',
  pop: '0 12px 40px rgb(var(--c-deep) / 0.25)',
} as const;

/** Breakpoints drive Tailwind AND the useBreakpoint hook. Facebook-style: 3 / 2 / 1 columns. */
export const breakpoints = { sm: 640, md: 768, lg: 1100, xl: 1400 } as const;

/** Layout dimensions used by AppShell (exposed as --layout-* variables). */
export const layout = {
  topbarH: '3.25rem', bottomNavH: '3.5rem',
  sidebarW: '15.5rem', sidebarCompactW: '4rem', railW: '18.5rem', feedMaxW: '40rem',
  // Density knobs so cards stay compact on phones and roomy on laptops/tablets.
  cardPad: '0.75rem', cardPadLg: '1rem',
} as const;

/** Language-learning level palette (CEFR). */
export const levelColors = { A1: 'lvl-a', A2: 'lvl-a', B1: 'lvl-b', B2: 'lvl-b', C1: 'lvl-c', C2: 'lvl-c', Native: 'lvl-n' } as const;

type Palette = Record<string, string>;
export const themes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '247 248 253', surface: '255 255 255', 'surface-2': '236 242 252', border: '221 227 243',
    ink: '23 22 58', muted: '91 90 126', 'on-brand': '255 255 255',
    brand: '43 42 122', 'brand-soft': '230 244 255', accent: '255 106 77', aqua: '18 181 166',
    sun: '255 200 61', deep: '27 26 85',
    success: '22 163 98', danger: '229 57 74',
    'lvl-a': '14 165 150', 'lvl-b': '43 42 122', 'lvl-c': '255 106 77', 'lvl-n': '240 170 20',
  },
  dark: {
    bg: '14 13 40', surface: '24 23 68', 'surface-2': '36 35 94', border: '56 55 120',
    ink: '240 240 255', muted: '160 160 205', 'on-brand': '255 255 255',
    brand: '124 122 240', 'brand-soft': '40 39 108', accent: '255 129 102', aqua: '45 212 198',
    sun: '255 211 94', deep: '27 26 85',
    success: '52 211 140', danger: '255 99 114',
    'lvl-a': '45 212 198', 'lvl-b': '124 122 240', 'lvl-c': '255 129 102', 'lvl-n': '255 211 94',
  },
};

/** Gradients reference theme variables, so they follow light/dark automatically. */
export const gradients = {
  brand: 'linear-gradient(135deg, rgb(var(--c-brand)) 0%, rgb(var(--c-aqua)) 100%)',
  spark: 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-sun)) 100%)',
  hero: 'radial-gradient(60rem 30rem at 15% -10%, rgb(var(--c-brand) / 0.25), transparent), radial-gradient(40rem 25rem at 90% 0%, rgb(var(--c-aqua) / 0.2), transparent), radial-gradient(35rem 20rem at 60% 110%, rgb(var(--c-accent) / 0.15), transparent)',
  ring: 'conic-gradient(from 180deg, rgb(var(--c-aqua)), rgb(var(--c-brand)), rgb(var(--c-accent)), rgb(var(--c-sun)), rgb(var(--c-aqua)))',
} as const;

export const motion = { fast: '120ms', base: '200ms', slow: '320ms', ease: 'cubic-bezier(.2,.8,.2,1)' } as const;