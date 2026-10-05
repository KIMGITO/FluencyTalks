import { useEffect, useState } from 'react';

/** Value that only settles after `delay` ms of silence. The search page waits for typing to stop before querying. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const t = setTimeout(() => setSettled(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return settled;
}