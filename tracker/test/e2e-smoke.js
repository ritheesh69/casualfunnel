// End-to-end smoke test. Loads the real demo pages (with the real tracker.js)
// in jsdom, clicks around, then reads the results back from the running API.
//
//   Terminal 1: cd server && npm run dev
//   Terminal 2: node demo/serve.js
//   Terminal 3: cd tracker && node test/e2e-smoke.js
//
// It writes real events into whatever database the API is connected to.
// jsdom is not a real browser, so this complements, not replaces, a manual
// check in Chrome or Firefox.
const { JSDOM } = require('jsdom');

const API = process.env.API_URL || 'http://localhost:4000';
const DEMO = process.env.DEMO_URL || 'http://localhost:5500';

let failures = 0;
function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  ${detail}`}`);
  if (!condition) failures += 1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage(pathname, { storedSession } = {}) {
  const dom = await JSDOM.fromURL(`${DEMO}${pathname}`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (url, init) => fetch(url, init);
      if (storedSession) window.localStorage.setItem('cf_session', storedSession);
    },
  });
  for (let i = 0; i < 100 && dom.window.document.readyState !== 'complete'; i++) await sleep(50);
  await sleep(400); // let deferred scripts run and the page_view post finish
  return dom;
}

function click(dom, selector, x, y) {
  const el = selector === 'body' ? dom.window.document.body : dom.window.document.querySelector(selector);
  el.dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 1 })
  );
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

(async () => {
  const health = await getJson('/api/health');
  check('API is healthy', health.status === 200, JSON.stringify(health.body));

  // Visitor A: shop page, three clicks, then navigates to the about page.
  const a1 = await openPage('/index.html');
  const sessionA = a1.window.CausalFunnelTracker.getSessionId();
  click(a1, '[data-add-to-cart]', 420, 280);
  click(a1, '.brand', 80, 40);
  click(a1, 'body', 700, 900);
  await sleep(400);
  const stored = a1.window.localStorage.getItem('cf_session');
  const a2 = await openPage('/about.html', { storedSession: stored });
  click(a2, 'body', 300, 300);
  await sleep(400);
  check('session id is reused on the next page', a2.window.CausalFunnelTracker.getSessionId() === sessionA);

  // Visitor B: fresh browser, one click on the shop page.
  const b1 = await openPage('/index.html');
  const sessionB = b1.window.CausalFunnelTracker.getSessionId();
  click(b1, '[data-add-to-cart]', 421, 281);
  await sleep(400);
  check('second visitor gets a different session id', sessionA !== sessionB);

  // Read everything back.
  const evA = await getJson(`/api/sessions/${sessionA}/events`);
  const eventsA = evA.body.events;
  check('visitor A has 6 events (2 page views + 4 clicks)', eventsA.length === 6, `got ${eventsA.length}`);
  check('visitor A page views = 2', eventsA.filter((e) => e.event_type === 'page_view').length === 2);
  check('visitor A clicks = 4', eventsA.filter((e) => e.event_type === 'click').length === 4);
  const times = eventsA.map((e) => Date.parse(e.timestamp));
  check('events are in chronological order', times.every((t, i) => i === 0 || t >= times[i - 1]));
  check(
    'first event is the page view of the shop page',
    eventsA[0].event_type === 'page_view' && eventsA[0].page_url === `${DEMO}/index.html`,
    JSON.stringify(eventsA[0])
  );
  const coords = eventsA.filter((e) => e.event_type === 'click').map((e) => `${e.coordinates.x},${e.coordinates.y}`);
  check('click coordinates match what was clicked', coords.includes('420,280') && coords.includes('80,40') && coords.includes('700,900') && coords.includes('300,300'), coords.join(' '));
  check('last event is on the about page', eventsA[eventsA.length - 1].page_url === `${DEMO}/about.html`);

  const evB = await getJson(`/api/sessions/${sessionB}/events`);
  check('visitor B has 2 events', evB.body.events.length === 2, `got ${evB.body.events.length}`);

  const pages = await getJson('/api/heatmap/pages');
  const urls = pages.body.pages.map((p) => p.page_url);
  check('heatmap lists the shop and about pages', urls.includes(`${DEMO}/index.html`) && urls.includes(`${DEMO}/about.html`), urls.join(', '));

  const shop = await getJson(`/api/heatmap?url=${encodeURIComponent(`${DEMO}/index.html`)}`);
  const about = await getJson(`/api/heatmap?url=${encodeURIComponent(`${DEMO}/about.html`)}`);
  check('shop heatmap has clicks from both visitors (>= 4)', shop.body.total_clicks >= 4, `got ${shop.body.total_clicks}`);
  check('about heatmap has only the one about-page click from visitor A', about.body.points.some((p) => p.x === 300 && p.y === 300));
  check('different pages return different click data', shop.body.total_clicks !== about.body.total_clicks);
  check('heatmap points carry page size', shop.body.points.every((p) => p.page_width > 0 && p.page_height > 0));

  const sessions = await getJson('/api/sessions');
  if (sessions.status === 200) {
    const ids = sessions.body.sessions.map((s) => s.session_id);
    check('both sessions appear separately in /api/sessions', ids.includes(sessionA) && ids.includes(sessionB));
    const rowA = sessions.body.sessions.find((s) => s.session_id === sessionA);
    check('session summary counts match stored events', rowA.total_events === 6 && rowA.page_views === 2 && rowA.clicks === 4, JSON.stringify(rowA));
  } else {
    console.log(`SKIP  /api/sessions responded ${sessions.status} (database engine may lack $cond/$max)`);
  }

  console.log(`\nSession A: ${sessionA}\nSession B: ${sessionB}`);
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
