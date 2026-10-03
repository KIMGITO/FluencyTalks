import { themes, gradients, layout, radii, fonts, fontWeights, shadows, motion, spacing } from './tokens';

const block = (p: Record<string, string>) => Object.entries(p).map(([k, v]) => `--c-${k}:${v};`).join('');
const flat = (prefix: string, o: Record<string, string | number>) => Object.entries(o).map(([k, v]) => `--${prefix}-${k}:${v};`).join('');

/** Builds all CSS variables from tokens.ts and injects them. Called once in main.tsx. */
export function injectTokens() {
  const css =
    `:root{${block(themes.light)}${flat('grad', gradients)}${flat('layout', layout)}${flat('radius', radii)}` +
    `${flat('font', fonts)}${flat('fw', fontWeights)}${flat('shadow', shadows)}${flat('motion', motion)}${flat('space', spacing)}color-scheme:light;}` +
    `:root[data-theme="dark"]{${block(themes.dark)}color-scheme:dark;}`;
  let el = document.getElementById('ft-tokens') as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = 'ft-tokens'; document.head.appendChild(el); }
  el.textContent = css;
}