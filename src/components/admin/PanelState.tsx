import type { ReactNode } from 'react';

// What a tab shows before it has any data, or when loading failed with nothing to fall back on.
export function PanelState({ error, loading, children }: { error: string | null; loading: boolean; children: ReactNode }) {
  return (
    <>
      {error && (
        <div role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong">
          {error}
        </div>
      )}
      {children}
      {loading && !error && <span className="sr-only" role="status">Cargando datos</span>}
    </>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-text-caption">Cargando…</p>;
}
