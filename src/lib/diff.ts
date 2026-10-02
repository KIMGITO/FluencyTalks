export type DiffPart = { text: string; kind: 'same' | 'add' | 'del' };
const MAX_CELLS = 250000; // beyond this, skip word-level diff and show before/after

/** Word-level diff (longest common subsequence). Whitespace is kept as tokens so output re-joins cleanly. */
export function diffWords(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/).filter(Boolean); const y = b.split(/(\s+)/).filter(Boolean);
  if (x.length * y.length > MAX_CELLS) return [{ text: a, kind: 'del' }, { text: b, kind: 'add' }];
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--)
    dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, kind: DiffPart['kind']) => { const last = out[out.length - 1]; if (last && last.kind === kind) last.text += text; else out.push({ text, kind }); };
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { push(x[i], 'same'); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push(x[i++], 'del'); else push(y[j++], 'add');
  }
  while (i < x.length) push(x[i++], 'del'); while (j < y.length) push(y[j++], 'add');
  return out;
}
