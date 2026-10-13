import type { Totals } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export default function Stats({ totals }: { totals: Totals | null }) {
  const items = [
    { label: 'Sessions', value: totals?.sessions },
    { label: 'Events', value: totals?.events },
    { label: 'Page views', value: totals?.page_views },
    { label: 'Clicks', value: totals?.clicks },
  ];

  return (
    <dl className="grid grid-cols-2 divide-line rounded-md border border-line bg-surface sm:grid-cols-4 sm:divide-x">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-5 py-4 ${i >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${
            i % 2 === 1 ? 'border-l border-line sm:border-l-0' : ''
          }`}
        >
          <dt className="text-[13px] text-muted">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {item.value === undefined ? '–' : formatNumber(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
