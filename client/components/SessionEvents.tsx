'use client';

import { fetchSessionEvents } from '@/lib/api';
import { formatDateTimeMs, shortUrl } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import Message from './Message';

export default function SessionEvents({ sessionId }: { sessionId: string }) {
  const state = useApi(() => fetchSessionEvents(sessionId), sessionId);

  if (state.status === 'loading') return <Message title="Loading events…" />;
  if (state.status === 'error') {
    return (
      <Message title="Couldn't load this session" tone="problem">
        {state.message}
      </Message>
    );
  }

  const { events } = state.data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[13px] text-muted">
            <th scope="col" className="w-10 px-5 py-2.5 font-medium">#</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Event</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Page</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Position</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={e.id} className="border-b border-line align-top last:border-b-0">
              <td className="px-5 py-2.5 tabular-nums text-muted">{i + 1}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                {e.event_type === 'click' ? 'Click' : 'Page view'}
              </td>
              <td className="break-all px-3 py-2.5 text-[13px]">{shortUrl(e.page_url)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[13px] tabular-nums text-muted">
                {e.coordinates ? `${Math.round(e.coordinates.x)}, ${Math.round(e.coordinates.y)}` : '–'}
              </td>
              <td className="whitespace-nowrap px-5 py-2.5 text-[13px] tabular-nums text-muted">
                {formatDateTimeMs(e.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
