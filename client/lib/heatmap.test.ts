import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmapModel, referenceWidth, dotDiameter, dotOpacity } from './heatmap.ts';

const pt = (x: number, y: number, page_width: number | null = 1280, page_height: number | null = 1600) => ({
  x,
  y,
  page_width,
  page_height,
});

test('positions are kept when every click came from the reference width', () => {
  const m = buildHeatmapModel([pt(100, 200), pt(900, 700)]);
  assert.equal(m.width, 1280);
  assert.equal(m.dots.length, 2);
  const xs = m.dots.map((d) => d.x).sort((a, b) => a - b);
  assert.deepEqual(xs, [100, 900]);
  assert.equal(m.totalClicks, 2);
});

test('clicks from a narrower screen are scaled onto the reference canvas', () => {
  // Two clicks at the same relative spot (50% across, 25% down) on different widths.
  const m = buildHeatmapModel([
    pt(640, 400, 1280, 1600),
    pt(640, 400, 1280, 1600),
    pt(500, 312.5, 1000, 1250),
  ]);
  assert.equal(m.width, 1280);
  // 500 * 1.28 = 640 and 312.5 * 1.28 = 400, so all three land in one dot.
  assert.equal(m.dots.length, 1);
  assert.equal(m.dots[0].count, 3);
  assert.ok(Math.abs(m.dots[0].x - 640) < 1e-9);
  assert.ok(Math.abs(m.dots[0].y - 400) < 1e-9);
});

test('nearby clicks merge into one heavier dot, distant clicks stay apart', () => {
  const m = buildHeatmapModel([pt(101, 101), pt(105, 108), pt(112, 103), pt(600, 600)]);
  assert.equal(m.dots.length, 2);
  assert.equal(m.maxCount, 3);
  // busiest dot is drawn last
  assert.equal(m.dots[m.dots.length - 1].count, 3);
});

test('uses the most common page width as the reference', () => {
  assert.equal(referenceWidth([pt(1, 1, 1440), pt(1, 1, 1440), pt(1, 1, 800)]), 1440);
  assert.equal(referenceWidth([pt(1, 1, null)]), 1280);
  assert.equal(referenceWidth([]), 1280);
});

test('clicks without recorded page size are treated as reference-width clicks', () => {
  const m = buildHeatmapModel([pt(300, 300, null, null)]);
  assert.equal(m.dots[0].x, 300);
  assert.equal(m.dots[0].y, 300);
});

test('canvas is tall enough for the lowest click and never shorter than the minimum', () => {
  assert.equal(buildHeatmapModel([pt(10, 10, 1280, null)]).height, 600);
  assert.ok(buildHeatmapModel([pt(10, 2000, 1280, null)]).height >= 2040);
  assert.equal(buildHeatmapModel([pt(10, 10, 1280, 3000)]).height, 3000);
});

test('empty input gives an empty model', () => {
  const m = buildHeatmapModel([]);
  assert.equal(m.dots.length, 0);
  assert.equal(m.totalClicks, 0);
  assert.equal(m.maxCount, 0);
});

test('dot size and opacity grow with repeated clicks and are capped', () => {
  assert.equal(dotDiameter(1), 14);
  assert.ok(dotDiameter(4) > dotDiameter(2));
  assert.equal(dotDiameter(50), dotDiameter(9));
  assert.equal(dotOpacity(1), 0.35);
  assert.ok(dotOpacity(3) > dotOpacity(1));
  assert.equal(dotOpacity(100), 0.85);
});

test('implausible page widths are ignored instead of collapsing the canvas', () => {
  const m = buildHeatmapModel([pt(300, 300, 1, 1), pt(500, 200, 0, 0)]);
  assert.equal(m.width, 1280);
  assert.equal(m.dots.length, 2);
  assert.ok(m.dots.some((d) => d.x === 300 && d.y === 300));
});
