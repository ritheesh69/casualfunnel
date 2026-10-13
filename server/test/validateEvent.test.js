const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEvent, normalizePageUrl } = require('../src/utils/validateEvent');

const NOW = Date.parse('2026-10-13T10:00:00.000Z');

function base(overrides = {}) {
  return {
    session_id: 'sess_abc12345',
    event_type: 'page_view',
    page_url: 'http://localhost:5500/index.html',
    timestamp: '2026-10-13T09:59:00.000Z',
    ...overrides,
  };
}

function fields(result) {
  return (result.errors || []).map((e) => e.field);
}

test('accepts a valid page_view and ignores coordinates on it', () => {
  const result = validateEvent(base({ coordinates: { x: 1, y: 2 } }), NOW);
  assert.equal(result.errors, undefined);
  assert.equal(result.value.event_type, 'page_view');
  assert.equal(result.value.coordinates, undefined);
  assert.ok(result.value.timestamp instanceof Date);
});

test('accepts a valid click with coordinates and page size', () => {
  const result = validateEvent(
    base({
      event_type: 'click',
      coordinates: { x: 420, y: 280.5 },
      page_size: { width: 1280, height: 1600 },
    }),
    NOW
  );
  assert.equal(result.errors, undefined);
  assert.deepEqual(result.value.coordinates, { x: 420, y: 280.5 });
  assert.deepEqual(result.value.page_size, { width: 1280, height: 1600 });
});

test('rejects non-object bodies', () => {
  for (const body of [null, undefined, 'text', 42, [], [base()]]) {
    assert.deepEqual(fields(validateEvent(body, NOW)), ['body']);
  }
});

test('rejects unsupported event types', () => {
  assert.deepEqual(fields(validateEvent(base({ event_type: 'scroll' }), NOW)), ['event_type']);
  assert.deepEqual(fields(validateEvent(base({ event_type: undefined }), NOW)), ['event_type']);
});

test('rejects bad session ids', () => {
  for (const session_id of [undefined, '', 'short', 'has space in it', 'x'.repeat(65), 12345678]) {
    assert.deepEqual(fields(validateEvent(base({ session_id }), NOW)), ['session_id']);
  }
});

test('rejects invalid or non-http page URLs', () => {
  for (const page_url of ['not a url', 'javascript:alert(1)', 'ftp://example.com/a', '', 5, 'http://a.com/' + 'x'.repeat(2100)]) {
    assert.deepEqual(fields(validateEvent(base({ page_url }), NOW)), ['page_url']);
  }
});

test('rejects malformed, impossible and future timestamps', () => {
  for (const timestamp of ['yesterday', '2026-10-13', '2026-13-45T10:00:00Z', 1760349600000, '1999-01-01T00:00:00Z', '2026-10-13T10:30:00.000Z']) {
    assert.deepEqual(fields(validateEvent(base({ timestamp }), NOW)), ['timestamp'], String(timestamp));
  }
});

test('click events require finite, non-negative coordinates', () => {
  const click = (coordinates) => base({ event_type: 'click', coordinates });
  for (const c of [undefined, null, {}, { x: 1 }, { x: '1', y: 2 }, { x: -1, y: 2 }, { x: 1, y: Infinity }, { x: 1, y: 1e9 }]) {
    assert.deepEqual(fields(validateEvent(click(c), NOW)), ['coordinates']);
  }
});

test('rejects a malformed page_size on a click', () => {
  const result = validateEvent(
    base({ event_type: 'click', coordinates: { x: 1, y: 1 }, page_size: { width: 0, height: 10 } }),
    NOW
  );
  assert.deepEqual(fields(result), ['page_size']);
});

test('reports every problem at once', () => {
  const result = validateEvent({ event_type: 'nope' }, NOW);
  assert.deepEqual(fields(result).sort(), ['event_type', 'page_url', 'session_id', 'timestamp']);
});

test('normalizePageUrl strips fragments and rejects junk', () => {
  assert.equal(normalizePageUrl('http://localhost:5500/about.html#team'), 'http://localhost:5500/about.html');
  assert.equal(normalizePageUrl('nope'), null);
  assert.equal(normalizePageUrl(undefined), null);
});
