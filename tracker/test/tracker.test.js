const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '..', 'tracker.js'), 'utf8');

const HTML = `<!doctype html><html><body>
  <button id="buy">Add to cart</button>
  <form>
    <input id="email" type="email" value="jane@example.com">
    <input id="pw" type="password" value="hunter2-secret">
    <textarea id="note">my private note</textarea>
  </form>
</body></html>`;

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Builds a page, stubs fetch, and injects tracker.js as a real <script> element
 * (so document.currentScript and data-* attributes behave as in a browser).
 */
function createPage({ url = 'http://shop.test/products.html', scriptAttrs = {}, fetchImpl, config } = {}) {
  const calls = [];
  const dom = new JSDOM(HTML, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch =
        fetchImpl ||
        ((endpoint, init) => {
          calls.push({ endpoint, init, body: JSON.parse(init.body) });
          return Promise.resolve({ status: 201 });
        });
      if (config) window.CF_TRACKER_CONFIG = config;
    },
  });
  const { window } = dom;

  function injectTracker(attrs = scriptAttrs) {
    const el = window.document.createElement('script');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.textContent = source;
    window.document.body.appendChild(el);
  }
  injectTracker();

  return { dom, window, calls, injectTracker };
}

function clickAt(window, target, clientX, clientY) {
  target.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY, detail: 1 })
  );
}

test('sends a page_view on load with url, ISO timestamp and session id', async () => {
  const { calls } = createPage({ url: 'http://shop.test/products.html?utm_source=ad&token=abc#section' });
  await tick();
  assert.equal(calls.length, 1);
  const e = calls[0].body;
  assert.equal(e.event_type, 'page_view');
  // query string and fragment are never recorded (this also keeps UTM parameters out)
  assert.equal(e.page_url, 'http://shop.test/products.html');
  assert.match(e.session_id, /^sess_[A-Za-z0-9_-]{8,64}$/);
  assert.match(e.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(e.timestamp).toISOString(), e.timestamp);
  assert.equal(e.coordinates, undefined);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'omit');
});

test('records each click with page-relative coordinates and page size', async () => {
  const { window, calls } = createPage();
  await tick();
  clickAt(window, window.document.getElementById('buy'), 420, 280);
  clickAt(window, window.document.body, 15, 33);
  await tick();

  const clicks = calls.map((c) => c.body).filter((e) => e.event_type === 'click');
  assert.equal(clicks.length, 2);
  assert.deepEqual(clicks[0].coordinates, { x: 420, y: 280 });
  assert.deepEqual(clicks[1].coordinates, { x: 15, y: 33 });
  assert.equal(clicks[0].page_url, 'http://shop.test/products.html');
  assert.ok(clicks[0].page_size.width > 0 && clicks[0].page_size.height > 0);
  assert.equal(clicks[0].session_id, calls[0].body.session_id);
});

test('adds the scroll offset so coordinates are relative to the page, not the viewport', async () => {
  const { window, calls } = createPage();
  await tick();
  // jsdom computes pageX/pageY from the scroll offsets; emulate a scrolled page
  Object.defineProperty(window, 'pageYOffset', { value: 500, configurable: true });
  Object.defineProperty(window, 'pageXOffset', { value: 0, configurable: true });
  const ev = new window.MouseEvent('click', { bubbles: true, clientX: 100, clientY: 40, detail: 1 });
  Object.defineProperty(ev, 'pageX', { value: 100 });
  Object.defineProperty(ev, 'pageY', { value: 540 });
  window.document.getElementById('buy').dispatchEvent(ev);
  await tick();
  const click = calls.map((c) => c.body).find((e) => e.event_type === 'click');
  assert.deepEqual(click.coordinates, { x: 100, y: 540 });
});

test('reloading the page keeps the same session id', async () => {
  const first = createPage();
  await tick();
  const id = first.calls[0].body.session_id;

  // Simulate a reload / navigation within the same origin: same localStorage,
  // tracker loaded again from scratch.
  delete first.window.__cfTrackerLoaded;
  first.injectTracker();
  await tick();

  const pageViews = first.calls.map((c) => c.body).filter((e) => e.event_type === 'page_view');
  assert.equal(pageViews.length, 2);
  assert.equal(pageViews[1].session_id, id);
  assert.equal(first.window.localStorage.getItem('cf_session').split('|')[0], id);
});

test('a new session starts after the inactivity timeout', async () => {
  const page = createPage({ scriptAttrs: { 'data-session-timeout-minutes': '30' } });
  await tick();
  const oldId = page.calls[0].body.session_id;

  // Pretend the last activity was 31 minutes ago.
  page.window.localStorage.setItem('cf_session', `${oldId}|${Date.now() - 31 * 60 * 1000}`);
  delete page.window.__cfTrackerLoaded;
  page.injectTracker();
  await tick();

  const latest = page.calls[page.calls.length - 1].body;
  assert.notEqual(latest.session_id, oldId);
});

test('clearing storage starts a fresh session', async () => {
  const page = createPage();
  await tick();
  const oldId = page.calls[0].body.session_id;
  page.window.localStorage.clear();
  delete page.window.__cfTrackerLoaded;
  page.injectTracker();
  await tick();
  assert.notEqual(page.calls[page.calls.length - 1].body.session_id, oldId);
});

test('including the script twice does not duplicate listeners or events', async () => {
  const page = createPage();
  page.injectTracker(); // second include, flag not reset
  await tick();
  const before = page.calls.length;
  assert.equal(before, 1, 'only one page_view');
  clickAt(page.window, page.window.document.getElementById('buy'), 5, 5);
  await tick();
  assert.equal(page.calls.length - before, 1, 'exactly one click event');
});

test('endpoint can come from data-endpoint or CF_TRACKER_CONFIG', async () => {
  const fromAttr = createPage({ scriptAttrs: { 'data-endpoint': 'https://api.example.com/api/events' } });
  await tick();
  assert.equal(fromAttr.calls[0].endpoint, 'https://api.example.com/api/events');

  const fromConfig = createPage({ config: { endpoint: 'https://other.example.com/api/events' } });
  await tick();
  assert.equal(fromConfig.calls[0].endpoint, 'https://other.example.com/api/events');

  const byDefault = createPage();
  await tick();
  assert.equal(byDefault.calls[0].endpoint, 'http://localhost:4000/api/events');
});

test('never sends form values, element text or other page content', async () => {
  const page = createPage();
  await tick();
  for (const id of ['email', 'pw', 'note', 'buy']) {
    const el = page.window.document.getElementById(id);
    el.dispatchEvent(new page.window.Event('input', { bubbles: true }));
    el.dispatchEvent(new page.window.KeyboardEvent('keydown', { bubbles: true, key: 'x' }));
    clickAt(page.window, el, 50, 60);
  }
  await tick();

  const wire = JSON.stringify(page.calls.map((c) => c.body));
  for (const secret of ['jane@example.com', 'hunter2-secret', 'my private note', 'Add to cart']) {
    assert.equal(wire.includes(secret), false, `leaked: ${secret}`);
  }
  const allowed = new Set(['session_id', 'event_type', 'page_url', 'timestamp', 'coordinates', 'page_size']);
  for (const c of page.calls) {
    for (const key of Object.keys(c.body)) assert.ok(allowed.has(key), `unexpected field ${key}`);
  }
  // 1 page_view + 4 clicks (input/keydown listeners do not exist)
  assert.equal(page.calls.length, 5);
});

test('failed requests are queued, then re-sent when the connection returns', async () => {
  let online = false;
  const delivered = [];
  const fetchImpl = (endpoint, init) => {
    if (!online) return Promise.reject(new TypeError('Failed to fetch'));
    delivered.push(JSON.parse(init.body));
    return Promise.resolve({ status: 201 });
  };
  const page = createPage({ fetchImpl });
  await tick();
  clickAt(page.window, page.window.document.getElementById('buy'), 7, 8);
  await tick();

  const queued = JSON.parse(page.window.localStorage.getItem('cf_pending_events'));
  assert.equal(queued.length, 2);
  assert.equal(delivered.length, 0);

  online = true;
  page.window.dispatchEvent(new page.window.Event('online'));
  await tick();
  assert.equal(delivered.length, 2);
  assert.deepEqual(JSON.parse(page.window.localStorage.getItem('cf_pending_events')), []);
  assert.deepEqual(delivered.map((e) => e.event_type).sort(), ['click', 'page_view']);
});

test('server errors (5xx) and rate limiting (429) are queued for a later retry', async () => {
  const page = createPage({ fetchImpl: () => Promise.resolve({ status: 503 }) });
  await tick();
  const queued = JSON.parse(page.window.localStorage.getItem('cf_pending_events'));
  assert.equal(queued.length, 1);
  assert.equal(queued[0].event_type, 'page_view');

  const limited = createPage({ fetchImpl: () => Promise.resolve({ status: 429 }) });
  await tick();
  assert.equal(JSON.parse(limited.window.localStorage.getItem('cf_pending_events')).length, 1);
});

test('client errors (4xx) are dropped, not retried forever', async () => {
  let attempts = 0;
  const page = createPage({
    fetchImpl: () => {
      attempts += 1;
      return Promise.resolve({ status: 400 });
    },
  });
  await tick();
  clickAt(page.window, page.window.document.getElementById('buy'), 1, 1);
  await tick();
  assert.equal(attempts, 2);
  assert.equal(page.window.localStorage.getItem('cf_pending_events'), null);
});

test('a successful response flushes events queued earlier', async () => {
  const delivered = [];
  let healthy = false;
  const page = createPage({
    fetchImpl: (endpoint, init) => {
      if (!healthy) return Promise.resolve({ status: 503 });
      delivered.push(JSON.parse(init.body).event_type);
      return Promise.resolve({ status: 201 });
    },
  });
  await tick(); // page_view queued
  healthy = true;
  clickAt(page.window, page.window.document.getElementById('buy'), 4, 4);
  await tick();
  assert.deepEqual(delivered.sort(), ['click', 'page_view']);
  assert.deepEqual(JSON.parse(page.window.localStorage.getItem('cf_pending_events')), []);
});

test('the retry queue is capped', async () => {
  const fetchImpl = () => Promise.reject(new TypeError('offline'));
  const page = createPage({ fetchImpl });
  await tick();
  for (let i = 0; i < 70; i++) clickAt(page.window, page.window.document.body, i, i);
  await tick();
  const queued = JSON.parse(page.window.localStorage.getItem('cf_pending_events'));
  assert.ok(queued.length <= 50);
});

test('keeps working when localStorage is blocked (falls back to cookie/memory)', async () => {
  const calls = [];
  const dom = new JSDOM(HTML, {
    url: 'http://shop.test/',
    runScripts: 'dangerously',
    beforeParse(window) {
      window.fetch = (endpoint, init) => {
        calls.push(JSON.parse(init.body));
        return Promise.resolve({ status: 201 });
      };
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    },
  });
  const el = dom.window.document.createElement('script');
  el.textContent = source;
  dom.window.document.body.appendChild(el);
  await tick();
  dom.window.document.getElementById('buy').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, clientX: 1, clientY: 2, detail: 1 }));
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].session_id, calls[1].session_id);
});
