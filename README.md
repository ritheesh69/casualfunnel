# User Analytics

A small analytics platform for e-commerce pages. A tracking script records page views and clicks, an Express API stores them in MongoDB, and a Next.js dashboard shows sessions, each session's event history, and a click heatmap per page.

Built for the CausalFunnel Full Stack Engineer Intern assignment.

## Features

* **Tracker** (`tracker/tracker.js`): one plain JavaScript file, no dependencies. Records `page\\\\\\\_view` and `click` events with session ID, page URL, ISO 8601 timestamp and, for clicks, page-relative x/y coordinates.
* **API**: validates and stores events, summarises sessions with a MongoDB aggregation, returns a session's events in order, and serves heatmap data.
* **Dashboard**: overview totals, a sessions table with a chronological event history for the selected session, and a heatmap page with a page selector, a click map, a legend and a click count.
* **Demo storefront**: a three-page ceramics shop (shop, lookbook, about) that includes the tracker, so real interactions produce real events.

## Technology stack

|Part|Choice|
|-|-|
|Dashboard|Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Lucide icons|
|API|Node.js, Express 4, Mongoose 8, Helmet, express-rate-limit|
|Database|MongoDB (Atlas)|
|Tracker and demo|Plain JavaScript, HTML, CSS|
|Tests|Node's built-in test runner, Supertest, jsdom, mingo|

Recharts was left out on purpose. Nothing in the dashboard needs a chart (the heatmap is drawn directly), and Recharts' tooltips only appear on hover, which this project avoids.

## Prerequisites

* Node.js 20 or newer (22 recommended; the client unit tests use `--experimental-strip-types`, which needs 22.6+)
* npm
* A free MongoDB Atlas cluster (or any MongoDB 5+ instance)

## Folder structure

```
user-analytics/
  client/              Next.js dashboard
    app/               Routes: / (sessions) and /heatmap
    components/        UI components
    lib/               API client, formatting, heatmap math (+ unit tests)
  server/              Express API
    src/
      config/          Environment and database connection
      controllers/     Request handlers
      middleware/      Error handling
      models/          Mongoose schema
      routes/          Route table
      utils/           Event validation, aggregation pipelines
    test/              API, validation and pipeline tests
    .env.example
  tracker/
    tracker.js         The tracking script
    test/              jsdom tests and an end-to-end smoke script
  demo/                Storefront pages and a tiny static server
  render.yaml          Render blueprint for the API
  README.md
```

## Installation

```bash
git clone https://github.com/ritheesh69/casualfunnel.git
cd casualfunnel
npm run install:all
```

This installs dependencies in `server/`, `client/` and `tracker/` (the tracker only needs its dependencies for tests).

## MongoDB Atlas setup

1. Create a free cluster at [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access**: add a database user with a password and the *Read and write to any database* role (or restrict it to one database).
3. **Network Access**: Add your current IP address for local testing. For hosted deployments, prefer narrowly scoped IP allowlisting where available. `0.0.0.0/0` allows connection attempts from any IP and should not be used casually.
4. **Database > Connect > Drivers**: copy the connection string. Replace `<password>` and add a database name before the `?`:

```
   mongodb+srv://analytics\\\\\\\_user:<password>@cluster0.xxxxx.mongodb.net/user\\\\\\\_analytics?retryWrites=true\\\\\\\&w=majority
   ```

URL-encode special characters in the password (`@` becomes `%40`).

5. The `events` collection and its indexes are created automatically when the API starts.

## Environment variables

Copy the examples and fill them in. The real `.env` files are git-ignored.

**`server/.env`**

|Variable|Required|Description|
|-|-|-|
|`MONGODB\\\\\\\_URI`|yes|Atlas connection string|
|`PORT`|no|Defaults to `4000` (Render sets this itself)|
|`CORS\\\\\\\_ORIGINS`|no|Comma-separated browser origins allowed to call the API: the dashboard and every site that embeds the tracker. Defaults to `http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500`|
|`RATE\\\\\\\_LIMIT\\\\\\\_PER\\\\\\\_MINUTE`|no|Max `POST /api/events` per IP per minute. Defaults to `300`|
|`TEST\\\\\\\_MONGODB\\\\\\\_URI`|no|Throwaway database for integration tests (see Testing)|

**`client/.env.local`**

|Variable|Required|Description|
|-|-|-|
|`NEXT\\\\\\\_PUBLIC\\\\\\\_API\\\\\\\_URL`|yes in production|API base URL without `/api`, e.g. `https://user-analytics-api.onrender.com`. Defaults to `http://localhost:4000`|
|`NEXT\\\\\\\_PUBLIC\\\\\\\_DEMO\\\\\\\_URL`|no|Only used in an empty-state hint. Defaults to `http://localhost:5500`|

```bash
cp server/.env.example server/.env      # then edit MONGODB\\\\\\\_URI
cp client/.env.example client/.env.local
```

## Running locally

Use three terminals.

**1. API** (port 4000)

```bash
npm run dev:server
```

Check `http://localhost:4000/api/health`. It should report `"database": "connected"`.

**2. Dashboard** (port 3000)

```bash
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000).

**3. Demo storefront** (port 5500)

```bash
npm run demo
```

Open [http://localhost:5500](http://localhost:5500), click around, visit the other pages, then reload the dashboard.

For a production build of the dashboard: `cd client \\\\\\\&\\\\\\\& npm run build \\\\\\\&\\\\\\\& npm start`.

## Installing the tracker on a page

Add two lines before `</head>`:

```html
<script>
  window.CF\\\\\\\_TRACKER\\\\\\\_CONFIG = { endpoint: 'https://your-api.example.com/api/events' };
</script>
<script src="https://your-site.example.com/tracker.js" defer></script>
```

Host `tracker.js` anywhere you can serve static files. The endpoint can also be set with an attribute:

```html
<script src="/tracker.js" data-endpoint="https://your-api.example.com/api/events" defer></script>
```

|Setting|Script attribute|`CF\\\\\\\_TRACKER\\\\\\\_CONFIG` key|Default|
|-|-|-|-|
|API endpoint|`data-endpoint`|`endpoint`|`http://localhost:4000/api/events`|
|Session timeout|`data-session-timeout-minutes`|`sessionTimeoutMinutes`|`30`|
|Console logging|`data-debug="true"`|`debug: true`|off|

The page must be served over `http://` or `https://`. Every site that embeds the tracker must also be listed in the API's `CORS\\\\\\\_ORIGINS`.

### What the tracker records

* A `page\\\\\\\_view` when the script runs on page load.
* A `click` for every click, using a capture-phase listener so handlers that stop propagation cannot hide it.
* Page URL as origin plus path. **Query strings and `#fragments` are dropped**, so tokens, email addresses and campaign parameters in the address bar are never sent.
* Click position as `pageX`/`pageY`: pixels from the top-left of the whole document, independent of scroll position. A click triggered from the keyboard (no pointer position) is recorded at the centre of the element.
* The size of the page at click time (`page\\\\\\\_size`), used to scale clicks from different screen sizes onto one heatmap.

It does not listen to input, keyboard or change events, and never reads element text, form values or attributes. The only keys in a payload are `session\\\\\\\_id`, `event\\\\\\\_type`, `page\\\\\\\_url`, `timestamp`, `coordinates` and `page\\\\\\\_size`.

### Sessions

* The session ID (`sess\\\\\\\_<uuid>`) is stored in `localStorage` under `cf\\\\\\\_session` together with the time of the last event.
* Every page of the same origin reads the same value, so the ID survives navigation and reloads.
* A **new session starts** when there is no stored session (first visit, storage cleared, private window) or when the last event was more than 30 minutes ago. Every event refreshes the timer. The timeout is configurable.
* If `localStorage` is blocked the tracker falls back to a first-party cookie, then to memory (a new session per page load).
* Sessions are per origin. The same person on two different domains appears as two sessions.

### Reliability

* Requests use `fetch` with `keepalive`, and no credentials are sent.
* Network failures, `429` and `5xx` responses are saved to a small retry queue in `localStorage` (capped at 50 events) and re-sent on the next page load, when the browser comes back online, or after the next successful request.
* `4xx` responses are not retried: the server decided the event is invalid.
* A global guard (`window.\\\\\\\_\\\\\\\_cfTrackerLoaded`) makes a second `<script>` include do nothing, so listeners are never duplicated.

## API

Base path `/api`. Errors always look like:

```json
{ "error": { "code": "invalid\\\\\\\_event", "message": "The event payload is invalid.", "details": \\\\\\\[ { "field": "event\\\\\\\_type", "message": "..." } ] } }
```

### Event payload

```json
{
  "session\\\\\\\_id": "sess\\\\\\\_2c6f7a1e-5d3b-4f0e-9a52-6a1c0b7d8e44",
  "event\\\\\\\_type": "click",
  "page\\\\\\\_url": "http://localhost:5500/index.html",
  "timestamp": "2026-10-13T10:00:00.000Z",
  "coordinates": { "x": 420, "y": 280 },
  "page\\\\\\\_size": { "width": 1280, "height": 1640 }
}
```

`coordinates` is required for `click` and ignored for `page\\\\\\\_view`. `page\\\\\\\_size` is optional.

### Endpoints

|Method and path|Description|
|-|-|
|`GET /api/health`|`200` with `{ status: "ok", database: "connected" }`, or `503` when the database is down|
|`POST /api/events`|Validates and stores one event. `201 { id, session\\\\\\\_id }`. `400` for invalid payloads or malformed JSON, `415` for a non-JSON content type, `413` above 10 kB, `429` when rate limited|
|`GET /api/sessions?limit=\\\\\\\&offset=`|`{ sessions: \\\\\\\[{ session\\\\\\\_id, total\\\\\\\_events, page\\\\\\\_views, clicks, last\\\\\\\_activity }], totals: { sessions, events, page\\\\\\\_views, clicks }, pagination }`. Most recently active first. `limit` 1 to 500 (default 100). `totals` cover all sessions, not just the page|
|`GET /api/sessions/:sessionId/events`|`{ session\\\\\\\_id, count, events: \\\\\\\[{ id, event\\\\\\\_type, page\\\\\\\_url, timestamp, coordinates }] }` oldest first. `404` for an unknown session, `400` for a malformed ID|
|`GET /api/heatmap/pages`|`{ pages: \\\\\\\[{ page\\\\\\\_url, clicks }] }` for pages with at least one click, busiest first|
|`GET /api/heatmap?url=<encoded-url>`|`{ page\\\\\\\_url, total\\\\\\\_clicks, returned, points: \\\\\\\[{ x, y, page\\\\\\\_width, page\\\\\\\_height }] }`. An empty `points` array for a page without clicks. `400` for a missing or invalid `url`. At most 10,000 points are returned|

Validation rules: `session\\\\\\\_id` is 8 to 64 characters of letters, numbers, `\\\\\\\_` or `-`; `event\\\\\\\_type` is `page\\\\\\\_view` or `click`; `page\\\\\\\_url` is an absolute http(s) URL under 2,048 characters (fragments are stripped); `timestamp` is ISO 8601, after 2000 and not more than 5 minutes in the future; coordinates are finite numbers from 0 to 100,000.

### Data model and indexes

One `events` collection (Mongoose model `Event`). Indexes:

* `{ session\\\\\\\_id: 1, timestamp: 1 }` for session histories
* `{ event\\\\\\\_type: 1, page\\\\\\\_url: 1 }` for the heatmap queries
* `{ timestamp: -1 }` for recency

Session summaries are computed at read time with an aggregation (`$group` by `session\\\\\\\_id` with conditional `$sum` counters and `$max` of the timestamp, then `$sort`, `$skip`, `$limit` and `$project`). The pipelines live in `server/src/utils/pipelines.js`.

## Heatmap scaling

Clicks are stored as page-relative pixels plus the page size at click time. The dashboard picks the most common page width as a reference width and scales every click by `reference width / its own page width` in both directions, so visitors on different screens land in the same relative spot. Dots are placed with percentages of the canvas, so they stay correct when the canvas is resized. Clicks within 20 reference pixels are merged into one dot, whose size and opacity grow with the click count (with a semi-transparent fill, so overlaps also darken).

## Testing

```bash
npm test                 # runs server, tracker and client suites
```

|Suite|Command|Needs|
|-|-|-|
|Event validation, session pipelines (run on in-memory documents with `mingo`)|`cd server \\\\\\\&\\\\\\\& npm test`|nothing|
|API integration (stores events, rejects bad input, counts, ordering, heatmap, CORS, reconnect)|same command|`TEST\\\\\\\_MONGODB\\\\\\\_URI` pointing at a **throwaway** database. These tests delete every event in it; they are skipped when the variable is unset|
|Tracker (page view, clicks, session persistence and expiry, duplicate guard, privacy, retry queue)|`cd tracker \\\\\\\&\\\\\\\& npm test`|nothing|
|Heatmap math|`cd client \\\\\\\&\\\\\\\& npm test`|Node 22.6+|

End-to-end smoke test (needs the API and the demo server running; writes real events):

```bash
cd tracker \\\\\\\&\\\\\\\& node test/e2e-smoke.js
```

It loads the real demo pages with the real tracker in jsdom, clicks around, and reads the results back from the API. jsdom is not a real browser, so also do the manual check below once.

### Manual check in a browser

1. Open `http://localhost:5500` with the dev tools Network tab open. A `POST /api/events` with `event\\\\\\\_type: "page\\\\\\\_view"` should appear.
2. Click a few products and links. Each click sends a `click` event with `coordinates`.
3. Reload. The `session\\\\\\\_id` in the request body is unchanged (also visible under Application > Local Storage > `cf\\\\\\\_session`).
4. Open the site in a private window. It gets a different session, and both appear separately in the dashboard.
5. In the dashboard, select each session: events are oldest first and the count matches the table.
6. Open Heatmap, switch between pages, and compare the dots with where you clicked.
7. Point the dashboard at an empty database: Overview shows zeros and both views show their empty states.
8. Stop and restart the API: the data is still there.

## Deployment

Order matters because each service needs the other's URL.

1. **Database**: set up Atlas as above.
2. **API on Render**: New > Blueprint (uses `render.yaml`) or New > Web Service with root directory `server`, build command `npm install`, start command `npm start`, health check path `/api/health`. Set `MONGODB\\\\\\\_URI`. Set `CORS\\\\\\\_ORIGINS` after step 3.
3. **Dashboard on Vercel**: import the repository, set **Root Directory** to `client`, and add `NEXT\\\\\\\_PUBLIC\\\\\\\_API\\\\\\\_URL` with your Render URL (no trailing slash, no `/api`). Deploy.
4. Go back to Render and set `CORS\\\\\\\_ORIGINS` to the Vercel URL, plus the URL of any site that runs the tracker. Origins must match exactly (scheme and host, no trailing slash). Redeploy the API.
5. **Demo site (optional)**: deploy `demo/` as a static site. Copy `tracker/tracker.js` into it (for example a build command `cp ../tracker/tracker.js ./tracker.js`) and set the production API URL in `demo/config.js`.

Render's free tier sleeps after inactivity, so the first event after a pause can take a while. The tracker's retry queue covers that gap.

## Assumptions and trade-offs

- **Timestamps come from the visitor's clock.** The server rejects dates before 2000 or more than 5 minutes ahead and also stores `received_at`, but an incorrect device clock can still misplace events.
- **Session summaries are computed on read.** This is simple and keeps summaries accurate. With millions of events, per-session documents could be precomputed.
- **Dashboard shows the latest 200 sessions.** Totals in the overview still cover all sessions.
- **One reference width for the heatmap.** Scaling by width assumes the page keeps its proportions as it narrows. Pages that reflow heavily on mobile will not line up perfectly with desktop clicks.
- **The heatmap is drawn on a blank, labelled canvas**, not on a screenshot of the page.
- **Query strings are not recorded.** Pages that differ only by query string are counted as one page.
- **No authentication.** The read endpoints and dashboard are open to anyone who knows the URLs. Put them behind authentication before using real data.
- **`POST /api/events` is unauthenticated by nature** because it is called from public pages. It is protected by CORS, input validation, a body-size limit, and a per-IP rate limit. These measures do not prevent a determined non-browser client from inserting fake events.
- **No Recharts.** The dashboard uses a lightweight custom heatmap canvas instead of adding a separate charting library.
- **Next.js 15 and Tailwind 3.** These versions were retained to avoid potentially breaking major-version upgrades. The client production dependency audit (`npm --prefix client audit --omit=dev`) reported zero vulnerabilities. The full client audit reported 7 remaining development/build dependency findings (5 high and 2 moderate). No forced major-version upgrade was applied.

## Known limitations

* Single-page apps: only the initial load is a page view. Client-side route changes are not tracked.
* Only clicks and page views. No scroll depth, hover, form, or time-on-page data.
* Events are not de-duplicated across retries. A request that reached the server but whose response was lost is sent again.
* Bots and crawlers are not filtered.

## Verification notes

Verified locally on Windows:

- Automated tests: 55 passed, 0 failed, 0 skipped (31 server tests, including MongoDB Atlas integration; 15 tracker tests; 9 dashboard heatmap tests).
- Next.js production build completed successfully after the dependency changes.
- TypeScript typecheck completed successfully during local verification.
- Manual browser testing confirmed that events appeared in the sessions dashboard and click positions appeared in the heatmap.
- Client production dependency audit (`npm --prefix client audit --omit=dev`): zero vulnerabilities reported.
- Full client audit: 7 development/build dependency findings remained (5 high, 2 moderate). No forced major-version upgrade was applied.
- Source code is published at https://github.com/ritheesh69/casualfunnel.
- Production hosting has not been completed; deployment is optional for this assignment.
