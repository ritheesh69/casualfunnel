// Runs the exact session pipelines against in-memory documents with `mingo`,
// a JavaScript implementation of MongoDB's aggregation framework. This checks
// the pipeline logic without needing a database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Aggregator } = require('mingo');
const { sessionPagePipeline, sessionTotalsPipeline } = require('../src/utils/pipelines');

const t = (iso) => new Date(iso);

const docs = [
  { session_id: 'sess_aaaa1111', event_type: 'page_view', timestamp: t('2026-10-13T10:00:00Z') },
  { session_id: 'sess_aaaa1111', event_type: 'click', timestamp: t('2026-10-13T10:00:05Z') },
  { session_id: 'sess_aaaa1111', event_type: 'click', timestamp: t('2026-10-13T10:00:09Z') },
  { session_id: 'sess_bbbb2222', event_type: 'page_view', timestamp: t('2026-10-13T11:00:00Z') },
  { session_id: 'sess_cccc3333', event_type: 'page_view', timestamp: t('2026-10-13T09:00:00Z') },
  { session_id: 'sess_cccc3333', event_type: 'page_view', timestamp: t('2026-10-13T09:05:00Z') },
  { session_id: 'sess_cccc3333', event_type: 'click', timestamp: t('2026-10-13T09:06:00Z') },
];

const run = (pipeline, input = docs) => new Aggregator(pipeline).run(input);

test('session page: counts per session, newest activity first', () => {
  const rows = run(sessionPagePipeline({ offset: 0, limit: 100 }));
  assert.deepEqual(
    rows.map((r) => r.session_id),
    ['sess_bbbb2222', 'sess_aaaa1111', 'sess_cccc3333']
  );
  const a = rows.find((r) => r.session_id === 'sess_aaaa1111');
  assert.deepEqual(
    { total: a.total_events, views: a.page_views, clicks: a.clicks },
    { total: 3, views: 1, clicks: 2 }
  );
  assert.equal(a.last_activity.toISOString(), '2026-10-13T10:00:09.000Z');
  const c = rows.find((r) => r.session_id === 'sess_cccc3333');
  assert.deepEqual(
    { total: c.total_events, views: c.page_views, clicks: c.clicks },
    { total: 3, views: 2, clicks: 1 }
  );
  assert.equal(Object.hasOwn(a, '_id'), false);
});

test('session page: offset and limit page through sessions', () => {
  const page = run(sessionPagePipeline({ offset: 1, limit: 1 }));
  assert.deepEqual(page.map((r) => r.session_id), ['sess_aaaa1111']);
});

test('session totals cover every session and match the event count', () => {
  const [totals] = run(sessionTotalsPipeline());
  assert.deepEqual(
    { sessions: totals.sessions, events: totals.events, page_views: totals.page_views, clicks: totals.clicks },
    { sessions: 3, events: docs.length, page_views: 4, clicks: 3 }
  );
});

test('no events produces no rows', () => {
  assert.deepEqual(run(sessionPagePipeline({ offset: 0, limit: 10 }), []), []);
  assert.deepEqual(run(sessionTotalsPipeline(), []), []);
});
