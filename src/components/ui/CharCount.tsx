/** "120 / 500" under a text field. */
export const CharCount = ({ value, max }: { value: number; max: number }) => (
  <p className="mt-1 text-right text-xs text-muted" aria-live="polite">{value} / {max}</p>
);
