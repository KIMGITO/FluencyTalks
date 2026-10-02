/**
 * FluencyTalks design tokens — THE single source of truth.
 * Nothing in components may hard-code a color, font, size, spacing or gradient.
 * tokens.ts -> (a) CSS variables injected at runtime (inject.ts)
 *           -> (b) Tailwind theme (tailwind.config.ts)
 * Colors are "R G B" triplets so Tailwind opacity modifiers (bg-brand/20) work.
 */
export const fonts = {
  sans: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "'Bricolage Grotesque', 'Figtree', system-ui, sans-serif",
};

export const fontSizes = {
  xs: ['0.75rem', '1.1rem'], sm: ['0.875rem', '1.35rem'], base: ['1rem', '1.55rem'],
  lg: ['1.125rem', '1.7rem'], xl: ['1.375rem', '1.9rem'], '2xl': ['1.75rem', '2.2rem'],
  '3xl': ['2.25rem', '2.6rem'], '4xl': ['3rem', '3.2rem'], '5xl': ['4rem', '4.1rem'],
} as const;

export const spacing = {
  0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem',
  8: '2rem', 9: '2.25rem', 10: '2.5rem', 12: '3rem', 14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
} as const;

export const radii = { sm: '0.5rem', md: '0.875rem', lg: '1.25rem', xl: '1.75rem', full: '9999px' } as const;

export const shadows = {
  card: '0 1px 2px rgb(var(--c-ink) / 0.06), 0 4px 16px rgb(var(--c-ink) / 0.06)',
  pop: '0 12px 40px rgb(var(--c-ink) / 0.18)',
} as const;

/** Breakpoints drive Tailwind AND the useBreakpoint hook. Facebook-style: 3 / 2 / 1 columns. */
export const breakpoints = { sm: 640, md: 768, lg: 1100, xl: 1400 } as const;

/** Layout dimensions used by AppShell (exposed as --layout-* variables). */
export const layout = {
  topbarH: '3.5rem', bottomNavH: '3.5rem',
  sidebarW: '17.5rem', sidebarCompactW: '4.5rem', railW: '20rem', feedMaxW: '42rem',
} as const;

/** Language-learning level palette (CEFR). */
export const levelColors = { A1: 'lvl-a', A2: 'lvl-a', B1: 'lvl-b', B2: 'lvl-b', C1: 'lvl-c', C2: 'lvl-c', Native: 'lvl-n' } as const;

type Palette = Record<string, string>;
export const themes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '246 247 251', surface: '255 255 255', 'surface-2': '238 240 248', border: '222 226 238',
    ink: '18 22 46', muted: '98 106 138', 'on-brand': '255 255 255',
    brand: '61 90 254', 'brand-soft': '226 231 255', accent: '255 176 32', aqua: '0 200 190',
    success: '22 163 98', danger: '229 57 74', 'lvl-a': '22 163 98', 'lvl-b': '61 90 254', 'lvl-c': '168 85 247', 'lvl-n': '255 140 0',
  },
  dark: {
    bg: '11 13 26', surface: '20 23 42', 'surface-2': '30 34 58', border: '44 49 79',
    ink: '236 239 255', muted: '148 156 190', 'on-brand': '255 255 255',
    brand: '107 130 255', 'brand-soft': '34 42 96', accent: '255 190 66', aqua: '45 220 210',
    success: '52 211 140', danger: '255 99 114', 'lvl-a': '52 211 140', 'lvl-b': '107 130 255', 'lvl-c': '192 132 252', 'lvl-n': '255 170 60',
  },
};

/** Gradients reference theme variables, so they follow light/dark automatically. */
export const gradients = {
  brand: 'linear-gradient(135deg, rgb(var(--c-brand)) 0%, rgb(var(--c-aqua)) 100%)',
  spark: 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-danger)) 100%)',
  hero: 'radial-gradient(60rem 30rem at 15% -10%, rgb(var(--c-brand) / 0.25), transparent), radial-gradient(40rem 25rem at 90% 0%, rgb(var(--c-aqua) / 0.2), transparent)',
  ring: 'conic-gradient(from 180deg, rgb(var(--c-aqua)), rgb(var(--c-brand)), rgb(var(--c-accent)), rgb(var(--c-aqua)))',
} as const;

export const motion = { fast: '120ms', base: '200ms', slow: '320ms', ease: 'cubic-bezier(.2,.8,.2,1)' } as const;
