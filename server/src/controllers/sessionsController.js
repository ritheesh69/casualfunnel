const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const { SESSION_ID_PATTERN } = require('../utils/validateEvent');
const { sessionPagePipeline, sessionTotalsPipeline } = require('../utils/pipelines');

const MAX_EVENTS_PER_SESSION = 5000;

function parseIntParam(raw, name, { fallback, min, max }) {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw new ApiError(400, 'invalid_query', `${name} must be a whole number.`);
  }
  const n = Number.parseInt(raw, 10);
  if (n < min || n > max) {
    throw new ApiError(400, 'invalid_query', `${name} must be between ${min} and ${max}.`);
  }
  return n;
}

async function listSessions(req, res) {
  const limit = parseIntParam(req.query.limit, 'limit', { fallback: 100, min: 1, max: 500 });
  const offset = parseIntParam(req.query.offset, 'offset', { fallback: 0, min: 0, max: 1000000 });

  const [sessions, totalsRows] = await Promise.all([
    Event.aggregate(sessionPagePipeline({ offset, limit })),
    Event.aggregate(sessionTotalsPipeline()),
  ]);

  const t = totalsRows[0] || { sessions: 0, events: 0, page_views: 0, clicks: 0 };
  res.json({
    sessions,
    totals: { sessions: t.sessions, events: t.events, page_views: t.page_views, clicks: t.clicks },
    pagination: { limit, offset, returned: sessions.length },
  });
}

async function listSessionEvents(req, res) {
  const { sessionId } = req.params;
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new ApiError(400, 'invalid_session_id', 'sessionId is not a valid session identifier.');
  }

  const events = await Event.find({ session_id: sessionId })
    .sort({ timestamp: 1, _id: 1 })
    .limit(MAX_EVENTS_PER_SESSION)
    .lean();

  if (events.length === 0) {
    throw new ApiError(404, 'session_not_found', `No events found for session ${sessionId}.`);
  }

  res.json({
    session_id: sessionId,
    count: events.length,
    events: events.map((e) => ({
      id: String(e._id),
      event_type: e.event_type,
      page_url: e.page_url,
      timestamp: e.timestamp,
      coordinates: e.event_type === 'click' && e.coordinates ? e.coordinates : null,
    })),
  });
}

module.exports = { listSessions, listSessionEvents };
