import { dotDiameter, dotOpacity, type HeatmapModel } from '@/lib/heatmap';

/**
 * A blank page drawn at the reference size. Dots are positioned with
 * percentages of that size, so they stay put when the canvas is resized.
 */
export default function HeatmapCanvas({ model, label }: { model: HeatmapModel; label: string }) {
  const gridX = (100 / model.width) * 100;
  const gridY = (100 / model.height) * 100;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line px-5 py-2.5 text-[13px] text-muted">
        <span className="break-all">{label}</span>
        <span className="tabular-nums">
          Page canvas, {model.width} × {model.height} px
        </span>
      </figcaption>
      <div className="p-5">
        <div
          role="img"
          aria-label={`Click map with ${model.totalClicks} clicks`}
          className="relative w-full overflow-hidden border border-line bg-canvas"
          style={{
            aspectRatio: `${model.width} / ${model.height}`,
            backgroundImage:
              'linear-gradient(to right, #e4e2dc 1px, transparent 1px), linear-gradient(to bottom, #e4e2dc 1px, transparent 1px)',
            backgroundSize: `${gridX}% ${gridY}%`,
          }}
        >
          {model.dots.map((dot, i) => {
            const d = dotDiameter(dot.count);
            return (
              <span
                key={i}
                className="absolute rounded-full bg-accent"
                style={{
                  left: `${(dot.x / model.width) * 100}%`,
                  top: `${(dot.y / model.height) * 100}%`,
                  width: d,
                  height: d,
                  opacity: dotOpacity(dot.count),
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[13px] text-muted">Grid squares are 100 px. Origin is the top-left corner of the page.</p>
      </div>
    </figure>
  );
}
