import type { HeatmapPoint } from './api';

/** Width used when no click carries a page width. */
export const FALLBACK_PAGE_WIDTH = 1280;
/** Narrower "pages" than this are treated as bad data and ignored for scaling. */
const MIN_PLAUSIBLE_PAGE_WIDTH = 200;
/** Clicks closer than this (in reference pixels) are drawn as one dot. */
export const CELL_SIZE = 20;
const MIN_REFERENCE_HEIGHT = 600;
const BOTTOM_PADDING = 40;

export interface Dot {
  /** Position in reference pixels. */
  x: number;
  y: number;
  count: number;
}

export interface HeatmapModel {
  /** Reference canvas size in CSS pixels. All dot positions are relative to it. */
  width: number;
  height: number;
  dots: Dot[];
  totalClicks: number;
  maxCount: number;
}

/** Most common page width among clicks, so the canvas matches typical visitors. */
function usableWidth(p: HeatmapPoint): number | null {
  return p.page_width && p.page_width >= MIN_PLAUSIBLE_PAGE_WIDTH ? p.page_width : null;
}

export function referenceWidth(points: HeatmapPoint[]): number {
  const counts = new Map<number, number>();
  for (const p of points) {
    const w = usableWidth(p);
    if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = FALLBACK_PAGE_WIDTH;
  let bestCount = 0;
  for (const [width, count] of counts) {
    if (count > bestCount || (count === bestCount && width > best)) {
      best = width;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Maps every click onto one reference canvas.
 *
 * A click recorded on a page that was `page_width` wide is scaled by
 * `referenceWidth / page_width` in both directions. Using the same factor for
 * x and y keeps the page's proportions, so a visitor on a narrow screen lands
 * in the same relative spot as one on a wide screen.
 */
export function buildHeatmapModel(points: HeatmapPoint[]): HeatmapModel {
  const width = referenceWidth(points);

  const cells = new Map<string, { sx: number; sy: number; count: number }>();
  let maxY = 0;
  let maxPageHeight = 0;

  for (const p of points) {
    const scale = width / (usableWidth(p) ?? width);
    const x = Math.min(p.x * scale, width);
    const y = p.y * scale;
    maxY = Math.max(maxY, y);
    if (p.page_height && usableWidth(p)) maxPageHeight = Math.max(maxPageHeight, p.page_height * scale);

    const key = `${Math.floor(x / CELL_SIZE)}:${Math.floor(y / CELL_SIZE)}`;
    const cell = cells.get(key);
    if (cell) {
      cell.sx += x;
      cell.sy += y;
      cell.count += 1;
    } else {
      cells.set(key, { sx: x, sy: y, count: 1 });
    }
  }

  const dots: Dot[] = [];
  let maxCount = 0;
  for (const cell of cells.values()) {
    dots.push({ x: cell.sx / cell.count, y: cell.sy / cell.count, count: cell.count });
    maxCount = Math.max(maxCount, cell.count);
  }
  // Draw the busiest spots last so they sit on top.
  dots.sort((a, b) => a.count - b.count);

  const height = Math.ceil(Math.max(MIN_REFERENCE_HEIGHT, maxPageHeight, maxY + BOTTOM_PADDING));

  return { width, height, dots, totalClicks: points.length, maxCount };
}

/** Dot diameter in CSS pixels: 14 for one click, growing to 38. */
export function dotDiameter(count: number): number {
  return 14 + Math.min(count - 1, 8) * 3;
}

/** Dot opacity: 0.35 for one click, up to 0.85. Overlaps darken further. */
export function dotOpacity(count: number): number {
  return Math.min(0.35 + Math.min(count - 1, 5) * 0.1, 0.85);
}
