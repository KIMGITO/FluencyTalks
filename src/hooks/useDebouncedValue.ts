import { useEffect, useState } from 'react';


export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const t = setTimeout(() => setSettled(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return settled;
}