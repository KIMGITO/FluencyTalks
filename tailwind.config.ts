import type { Config } from 'tailwindcss';
import { themes, fontSizes, spacing, radii, fonts, breakpoints } from './src/theme/tokens';

// Every color key in tokens.ts becomes a Tailwind color: bg-surface, text-muted, border-border, bg-brand/20 ...
const colors = Object.fromEntries(Object.keys(themes.light).map((k) => [k, `rgb(var(--c-${k}) / <alpha-value>)`]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v}px`])),
    colors: { transparent: 'transparent', current: 'currentColor', ...colors },
    spacing: spacing as any,
    fontSize: fontSizes as any,
    borderRadius: { none: '0', ...radii },
    fontFamily: { sans: fonts.sans.split(','), display: fonts.display.split(',') },
    boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
    extend: { backgroundImage: { 'grad-brand': 'var(--grad-brand)', 'grad-spark': 'var(--grad-spark)', 'grad-hero': 'var(--grad-hero)' } },
  },
  plugins: [],
} satisfies Config;
