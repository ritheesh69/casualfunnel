'use client';

import { useMemo, useState } from 'react';
import { DEMO_URL, fetchHeatmap, fetchHeatmapPages } from '@/lib/api';
import { formatNumber, shortUrl } from '@/lib/format';
import { buildHeatmapModel } from '@/lib/heatmap';
import { useApi } from '@/lib/useApi';
import HeatmapCanvas from './HeatmapCanvas';
import HeatmapLegend from './HeatmapLegend';
import Message from './Message';
import Panel from './Panel';

export default function HeatmapView() {
  const pagesState = useApi(fetchHeatmapPages, 'pages');
  const [chosen, setChosen] = useState<string | null>(null);

  const pages = pagesState.status === 'ready' ? pagesState.data.pages : [];
  // Default to the page with the most clicks until the visitor picks one.
  const selected = chosen && pages.some((p) => p.page_url === chosen) ? chosen : pages[0]?.page_url ?? null;

  const heatmapState = useApi(selected ? () => fetchHeatmap(selected) : null, selected ?? '');

  const points = heatmapState.status === 'ready' ? heatmapState.data.points : null;
  const model = useMemo(() => (points ? buildHeatmapModel(points) : null), [points]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight">Click heatmap</h1>

      {pagesState.status === 'loading' && (
        <Panel title="Heatmap">
          <Message title="Loading pages…" />
        </Panel>
      )}

      {pagesState.status === 'error' && (
        <Panel title="Heatmap">
          <Message title="Couldn't load pages" tone="problem">
            <p>{pagesState.message}</p>
            <p className="mt-2">
              Check that the API is running and that this site&apos;s address is listed in the API&apos;s
              CORS_ORIGINS setting.
            </p>
          </Message>
        </Panel>
      )}

      {pagesState.status === 'ready' && pages.length === 0 && (
        <Panel title="Heatmap">
          <Message title="No clicks recorded yet">
            <p>
              Click around the demo storefront at {DEMO_URL}, then reload this page. Pages with at least
              one click show up in the page list.
            </p>
          </Message>
        </Panel>
      )}

      {pagesState.status === 'ready' && pages.length > 0 && selected && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <label htmlFor="page-select" className="mb-1 block text-[13px] text-muted">
                Page
              </label>
              <select
                id="page-select"
                value={selected}
                onChange={(e) => setChosen(e.target.value)}
                className="w-full max-w-full rounded border border-line bg-surface px-3 py-2 text-sm sm:w-[420px]"
              >
                {pages.map((p) => (
                  <option key={p.page_url} value={p.page_url}>
                    {shortUrl(p.page_url)} ({formatNumber(p.clicks)} {p.clicks === 1 ? 'click' : 'clicks'})
                  </option>
                ))}
              </select>
            </div>
            {heatmapState.status === 'ready' && (
              <p className="text-sm tabular-nums">
                <span className="font-semibold">{formatNumber(heatmapState.data.returned)}</span>{' '}
                {heatmapState.data.returned === 1 ? 'click' : 'clicks'} shown
                {heatmapState.data.total_clicks > heatmapState.data.returned
                  ? ` of ${formatNumber(heatmapState.data.total_clicks)}`
                  : ''}
              </p>
            )}
          </div>

          {heatmapState.status === 'loading' && (
            <Panel title="Click map">
              <Message title="Loading clicks…" />
            </Panel>
          )}

          {heatmapState.status === 'error' && (
            <Panel title="Click map">
              <Message title="Couldn't load clicks for this page" tone="problem">
                {heatmapState.message}
              </Message>
            </Panel>
          )}

          {heatmapState.status === 'ready' && model && model.totalClicks === 0 && (
            <Panel title="Click map">
              <Message title="No clicks on this page">
                <p>Pages only appear here once a visitor has clicked on them.</p>
              </Message>
            </Panel>
          )}

          {heatmapState.status === 'ready' && model && model.totalClicks > 0 && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <Panel title="Click map">
                <HeatmapCanvas model={model} label={shortUrl(heatmapState.data.page_url)} />
              </Panel>
              <Panel title="Legend">
                <HeatmapLegend maxCount={model.maxCount} />
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}
