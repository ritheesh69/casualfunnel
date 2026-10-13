'use client';

import { useEffect, useState } from 'react';

export type ApiState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/** Runs `load` on mount and whenever `key` changes. Ignores stale responses. */
export function useApi<T>(load: (() => Promise<T>) | null, key: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' });

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    setState({ status: 'loading' });
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Request failed.' });
        }
      }
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated on every render; `key` identifies what is being loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
