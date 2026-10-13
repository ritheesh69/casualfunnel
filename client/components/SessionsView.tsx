'use client';

import { useEffect, useState } from 'react';
import { DEMO_URL, fetchSessions } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import Message from './Message';
import Panel from './Panel';
import SessionEvents from './SessionEvents';
import SessionsTable from './SessionsTable';
import Stats from './Stats';

export default function SessionsView() {
  const state = useApi(fetchSessions, 'sessions');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Open the most recent session once the list arrives.
  useEffect(() => {
    if (state.status === 'ready' && selectedId === null && state.data.sessions.length > 0) {
      setSelectedId(state.data.sessions[0].session_id);
    }
  }, [state, selectedId]);

  const totals = state.status === 'ready' ? state.data.totals : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-3 text-lg font-semibold tracking-tight">Overview</h1>
        <Stats totals={totals} />
      </div>

      {state.status === 'loading' && (
        <Panel title="Sessions">
          <Message title="Loading sessions…" />
        </Panel>
      )}

      {state.status === 'error' && (
        <Panel title="Sessions">
          <Message title="Couldn't load sessions" tone="problem">
            <p>{state.message}</p>
            <p className="mt-2">
              Check that the API is running and that this site&apos;s address is listed in the API&apos;s
              CORS_ORIGINS setting.
            </p>
          </Message>
        </Panel>
      )}

      {state.status === 'ready' && state.data.sessions.length === 0 && (
        <Panel title="Sessions">
          <Message title="No sessions recorded yet">
            <p>
              Open the demo storefront at {DEMO_URL}, click a few things, then reload this page. Each
              visitor appears here as a session.
            </p>
          </Message>
        </Panel>
      )}

      {state.status === 'ready' && state.data.sessions.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <Panel
            title="Sessions"
            note={
              state.data.totals.sessions > state.data.sessions.length
                ? `Latest ${formatNumber(state.data.sessions.length)} of ${formatNumber(state.data.totals.sessions)}`
                : `${formatNumber(state.data.totals.sessions)} total`
            }
          >
            <SessionsTable
              sessions={state.data.sessions}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Panel>

          <Panel title="Session events" note={selectedId ? 'Oldest first' : undefined}>
            {selectedId ? (
              <>
                <p className="break-all border-b border-line px-5 py-2.5 font-mono text-xs text-muted">
                  {selectedId}
                </p>
                <SessionEvents sessionId={selectedId} />
              </>
            ) : (
              <Message title="Select a session to see its events" />
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
