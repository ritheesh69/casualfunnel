import type { SessionSummary } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';

export default function SessionsTable({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[13px] text-muted">
            <th scope="col" className="px-5 py-2.5 font-medium">Session ID</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Events</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Page views</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Clicks</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const selected = s.session_id === selectedId;
            return (
              <tr
                key={s.session_id}
                onClick={() => onSelect(s.session_id)}
                className={`border-b border-line last:border-b-0 ${selected ? 'bg-accent-soft' : ''}`}
              >
                <td className="px-5 py-2.5">
                  <button
                    type="button"
                    onClick={() => onSelect(s.session_id)}
                    aria-pressed={selected}
                    className={`break-all text-left font-mono text-xs ${selected ? 'font-semibold text-accent' : ''}`}
                  >
                    {s.session_id}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.total_events)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.page_views)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(s.clicks)}</td>
                <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDateTime(s.last_activity)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
