// Integration tests. They need a real MongoDB and wipe the events collection,
// so they only run when TEST_MONGODB_URI is set (use a throwaway database).
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.TEST_MONGODB_URI;
const skip = uri ? false : 'TEST_MONGODB_URI is not set';

const { createApp } = require('../src/app');
const Event = require('../src/models/Event');

const ORIGIN = 'http://localhost:5500';
const PAGE_A = 'http://localhost:5500/index.html';
const PAGE_B = 'http://localhost:5500/about.html';

function ago(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function pageView(session_id, page_url, timestamp) {
  return { session_id, event_type: 'page_view', page_url, timestamp };
}

function click(session_id, page_url, timestamp, x, y, page_size = { width: 1280, height: 1600 }) {
  return { session_id, event_type: 'click', page_url, timestamp, coordinates: { x, y }, page_size };
}

test('events API', { skip }, async (t) => {
  const app = createApp({ corsOrigins: [ORIGIN], rateLimitPerMinute: 10000 });
  const post = (body) => request(app).post('/api/events').set('Origin', ORIGIN).send(body);

  // FerretDB (a Mongo-compatible engine sometimes used for local runs) does not
  // implement $cond/$max, which the session summary pipeline uses on real MongoDB.
  let lacksAggregationOperators = false;
  const skipReason = 'engine does not implement $cond/$max (FerretDB); run against MongoDB';

  t.before(async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
    lacksAggregationOperators = Boolean(info.ferretdb || info.ferretdbVersion);
    await Event.init();
  });
  t.after(async () => {
    await Event.deleteMany({});
    await mongoose.disconnect();
  });
  t.beforeEach(async () => {
    await Event.deleteMany({});
  });

  await t.test('health reports a connected database', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });

  await t.test('stores a page_view and a click', async () => {
    const a = await post(pageView('sess_aaaa1111', PAGE_A, ago(10)));
    const b = await post(click('sess_aaaa1111', PAGE_A, ago(5), 420, 280));
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const stored = await Event.find({}).sort({ timestamp: 1 }).lean();
    assert.equal(stored.length, 2);
    assert.equal(stored[0].event_type, 'page_view');
    assert.equal(stored[0].coordinates?.x, undefined);
    assert.deepEqual({ x: stored[1].coordinates.x, y: stored[1].coordinates.y }, { x: 420, y: 280 });
    assert.ok(stored[1].timestamp instanceof Date);
  });

  await t.test('rejects malformed and unsupported events', async () => {
    const malformed = await request(app)
      .post('/api/events')
      .set('Content-Type', 'application/json')
      .send('{"session_id": ');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'invalid_json');

    const wrongType = await request(app).post('/api/events').set('Content-Type', 'text/plain').send('hello');
    assert.equal(wrongType.status, 415);

    const badEvents = [
      { ...pageView('sess_aaaa1111', PAGE_A, ago(1)), event_type: 'scroll' },
      { ...pageView('sess_aaaa1111', PAGE_A, ago(1)), session_id: undefined },
      { ...pageView('sess_aaaa1111', 'javascript:alert(1)', ago(1)) },
      { ...pageView('sess_aaaa1111', PAGE_A, 'yesterday') },
      { session_id: 'sess_aaaa1111', event_type: 'click', page_url: PAGE_A, timestamp: ago(1) },
      [pageView('sess_aaaa1111', PAGE_A, ago(1))],
    ];
    for (const body of badEvents) {
      const res = await post(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'invalid_event');
    }
    assert.equal(await Event.countDocuments(), 0);
  });

  await t.test('sessions endpoint aggregates counts per session', async (st) => {
    if (lacksAggregationOperators) return st.skip(skipReason);
    await post(pageView('sess_aaaa1111', PAGE_A, ago(100)));
    await post(click('sess_aaaa1111', PAGE_A, ago(90), 10, 10));
    await post(click('sess_aaaa1111', PAGE_A, ago(80), 20, 20));
    await post(pageView('sess_bbbb2222', PAGE_B, ago(30)));

    const res = await request(app).get('/api/sessions');
    assert.equal(res.status, 200);
    assert.equal(res.body.sessions.length, 2);

    // newest activity first
    const [first, second] = res.body.sessions;
    assert.equal(first.session_id, 'sess_bbbb2222');
    assert.deepEqual(
      [first.total_events, first.page_views, first.clicks],
      [1, 1, 0]
    );
    assert.equal(second.session_id, 'sess_aaaa1111');
    assert.deepEqual(
      [second.total_events, second.page_views, second.clicks],
      [3, 1, 2]
    );
    assert.ok(Math.abs(Date.parse(second.last_activity) - Date.parse(ago(80))) < 5000);
    assert.deepEqual(res.body.totals, { sessions: 2, events: 4, page_views: 2, clicks: 2 });

    // counts match what is actually stored
    assert.equal(res.body.totals.events, await Event.countDocuments());
  });

  await t.test('sessions endpoint validates paging parameters', async () => {
    const res = await request(app).get('/api/sessions?limit=abc');
    assert.equal(res.status, 400);
    const res2 = await request(app).get('/api/sessions?limit=0');
    assert.equal(res2.status, 400);
  });

  await t.test('session events come back in chronological order', async () => {
    // Insert out of order on purpose.
    await post(click('sess_aaaa1111', PAGE_A, ago(20), 3, 3));
    await post(pageView('sess_aaaa1111', PAGE_A, ago(60)));
    await post(click('sess_aaaa1111', PAGE_B, ago(40), 2, 2));
    await post(pageView('sess_bbbb2222', PAGE_A, ago(50)));

    const res = await request(app).get('/api/sessions/sess_aaaa1111/events');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 3);
    const times = res.body.events.map((e) => Date.parse(e.timestamp));
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
    assert.deepEqual(
      res.body.events.map((e) => e.event_type),
      ['page_view', 'click', 'click']
    );
    assert.equal(res.body.events[0].coordinates, null);
    assert.deepEqual(res.body.events[1].coordinates, { x: 2, y: 2 });
    assert.equal(res.body.count, await Event.countDocuments({ session_id: 'sess_aaaa1111' }));
  });

  await t.test('unknown and invalid session ids', async () => {
    const missing = await request(app).get('/api/sessions/sess_nothere1/events');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'session_not_found');

    const invalid = await request(app).get('/api/sessions/bad%20id/events');
    assert.equal(invalid.status, 400);
  });

  await t.test('heatmap pages lists only pages that have clicks', async () => {
    await post(pageView('sess_aaaa1111', PAGE_A, ago(50)));
    await post(pageView('sess_aaaa1111', 'http://localhost:5500/never-clicked.html', ago(45)));
    await post(click('sess_aaaa1111', PAGE_A, ago(40), 1, 1));
    await post(click('sess_aaaa1111', PAGE_A, ago(35), 2, 2));
    await post(click('sess_aaaa1111', PAGE_B, ago(30), 3, 3));

    const res = await request(app).get('/api/heatmap/pages');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.pages, [
      { page_url: PAGE_A, clicks: 2 },
      { page_url: PAGE_B, clicks: 1 },
    ]);
  });

  await t.test('heatmap returns coordinates for the selected page only', async () => {
    await post(click('sess_aaaa1111', PAGE_A, ago(40), 100, 200));
    await post(click('sess_bbbb2222', PAGE_A, ago(35), 300, 400, { width: 1000, height: 900 }));
    await post(click('sess_aaaa1111', PAGE_B, ago(30), 5, 6));
    await post(pageView('sess_aaaa1111', PAGE_A, ago(50)));

    const a = await request(app).get('/api/heatmap').query({ url: PAGE_A });
    assert.equal(a.status, 200);
    assert.equal(a.body.total_clicks, 2);
    assert.equal(a.body.points.length, 2);
    const sorted = [...a.body.points].sort((p, q) => p.x - q.x);
    assert.deepEqual(sorted[0], { x: 100, y: 200, page_width: 1280, page_height: 1600 });
    assert.deepEqual(sorted[1], { x: 300, y: 400, page_width: 1000, page_height: 900 });

    const b = await request(app).get('/api/heatmap').query({ url: PAGE_B });
    assert.equal(b.body.total_clicks, 1);
    assert.deepEqual(b.body.points[0].x, 5);
  });

  await t.test('heatmap validates the url parameter and handles pages with no clicks', async () => {
    assert.equal((await request(app).get('/api/heatmap')).status, 400);
    const bad = await request(app).get('/api/heatmap').query({ url: 'not a url' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'invalid_url');
    const arr = await request(app).get('/api/heatmap?url=http://a.com/&url=http://b.com/');
    assert.equal(arr.status, 400);

    const none = await request(app).get('/api/heatmap').query({ url: 'http://localhost:5500/empty.html' });
    assert.equal(none.status, 200);
    assert.equal(none.body.total_clicks, 0);
    assert.deepEqual(none.body.points, []);
  });

  await t.test('empty database: sessions endpoint returns zero totals', async (st) => {
    if (lacksAggregationOperators) return st.skip(skipReason);
    const sessions = await request(app).get('/api/sessions');
    assert.equal(sessions.status, 200);
    assert.deepEqual(sessions.body.sessions, []);
    assert.deepEqual(sessions.body.totals, { sessions: 0, events: 0, page_views: 0, clicks: 0 });
  });

  await t.test('empty database: heatmap endpoints return empty lists', async () => {
    const pages = await request(app).get('/api/heatmap/pages');
    assert.deepEqual(pages.body.pages, []);
  });

  await t.test('data survives a database reconnect', async () => {
    await post(pageView('sess_aaaa1111', PAGE_A, ago(10)));
    await mongoose.disconnect();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const res = await request(app).get('/api/sessions/sess_aaaa1111/events');
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
  });

  await t.test('CORS allows configured origins and withholds headers from others', async () => {
    const allowed = await request(app).options('/api/events').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST');
    assert.equal(allowed.headers['access-control-allow-origin'], ORIGIN);
    const denied = await request(app).options('/api/events').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  });

  await t.test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  });
});
