import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// Loads once, then again every `intervalMs` while `live` is on, and whenever `tick` (the manual
// refresh button) or `key` (the range) changes. The previous data stays on screen while a reload is
// in flight, so charts keep their frame instead of flashing a skeleton.
export function usePolling<T>(
  load: () => Promise<T>,
  key: string,
  live: boolean,
  tick: number,
  onUpdated?: (at: number) => void,
  intervalMs = 15_000
): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  const onUpdatedRef = useRef(onUpdated);
  loadRef.current = load;
  onUpdatedRef.current = onUpdated;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState((current) => ({ ...current, loading: true }));
      try {
        const data = await loadRef.current();
        if (cancelled) return;
        setState({ data, error: null, loading: false });
        onUpdatedRef.current?.(Date.now());
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof ApiError ? toSpanishMessage(caught.message) : 'No pudimos cargar los datos.';
        setState((current) => ({ ...current, error: message, loading: false }));
      }
    }

    run();
    if (!live) return () => { cancelled = true; };
    const timer = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, live, tick, intervalMs]);

  return state;
}
