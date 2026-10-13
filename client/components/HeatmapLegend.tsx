import { dotDiameter, dotOpacity } from '@/lib/heatmap';

const samples = [
  { count: 1, label: '1 click' },
  { count: 3, label: '3 clicks' },
  { count: 6, label: '6 clicks' },
  { count: 9, label: '9 or more' },
];

export default function HeatmapLegend({ maxCount }: { maxCount: number }) {
  return (
    <div className="space-y-4 px-5 py-4 text-sm">
      <ul className="space-y-3">
        {samples.map(({ count, label }) => (
          <li key={count} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span
                className="rounded-full bg-accent"
                style={{ width: dotDiameter(count), height: dotDiameter(count), opacity: dotOpacity(count) }}
              />
            </span>
            <span className="text-[13px]">{label}</span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] leading-relaxed text-muted">
        Clicks within 20 px of each other are drawn as one dot. Larger, darker dots mean more clicks in
        that spot.
        {maxCount > 1 ? ` The busiest spot on this page has ${maxCount} clicks.` : ''}
      </p>
    </div>
  );
}
