import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Editable state seeded from data that arrives later.
 *
 * Every form in the app has the same shape: local state the user edits, seeded
 * from a record that is still loading on first render. The obvious
 * implementation — `useEffect(() => setState(mapped), [record])` — renders once
 * with empty fields and again with the real ones, which shows as a visible
 * flash on a slow connection.
 *
 * This uses React's documented "adjusting state when props change" pattern
 * instead: when `key` changes, the reset happens *during* render, so React
 * re-renders with the new values before anything reaches the screen.
 *
 * `key` should identify the source record — typically its id, or `null` while
 * the data is still loading.
 */
export function useSyncedState<T>(
  key: string | null,
  seed: () => T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(seed);
  const [syncedKey, setSyncedKey] = useState<string | null>(key);

  if (key !== syncedKey) {
    setSyncedKey(key);
    setState(seed());
  }

  return [state, setState];
}
