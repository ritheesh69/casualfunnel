const EVENT_TYPES = ['page_view', 'click'];
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const MAX_URL_LENGTH = 2048;
const MAX_COORDINATE = 100000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const EARLIEST_TIMESTAMP = Date.parse('2000-01-01T00:00:00.000Z');

/**
 * Returns a normalized http(s) page URL (origin + path + query, no fragment)
 * or null when the value is not a usable URL.
 */
function normalizePageUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) {
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.href;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_COORDINATE;
}

function isDimension(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_COORDINATE;
}

/**
 * Validates an incoming tracker payload.
 * Returns { value } with a clean document, or { errors } listing every problem found.
 */
function validateEvent(body, now = Date.now()) {
  if (!isPlainObject(body)) {
    return { errors: [{ field: 'body', message: 'Request body must be a JSON object.' }] };
  }

  const errors = [];
  const value = {};

  if (typeof body.session_id !== 'string' || !SESSION_ID_PATTERN.test(body.session_id)) {
    errors.push({
      field: 'session_id',
      message: 'session_id is required: 8-64 characters, letters, numbers, "_" or "-".',
    });
  } else {
    value.session_id = body.session_id;
  }

  if (!EVENT_TYPES.includes(body.event_type)) {
    errors.push({
      field: 'event_type',
      message: `event_type must be one of: ${EVENT_TYPES.join(', ')}.`,
    });
  } else {
    value.event_type = body.event_type;
  }

  const pageUrl = normalizePageUrl(body.page_url);
  if (!pageUrl) {
    errors.push({
      field: 'page_url',
      message: `page_url must be an absolute http(s) URL of at most ${MAX_URL_LENGTH} characters.`,
    });
  } else {
    value.page_url = pageUrl;
  }

  if (typeof body.timestamp !== 'string' || !ISO_8601_PATTERN.test(body.timestamp)) {
    errors.push({ field: 'timestamp', message: 'timestamp must be an ISO 8601 string.' });
  } else {
    const time = Date.parse(body.timestamp);
    if (Number.isNaN(time) || time < EARLIEST_TIMESTAMP) {
      errors.push({ field: 'timestamp', message: 'timestamp is not a valid date.' });
    } else if (time > now + MAX_CLOCK_SKEW_MS) {
      errors.push({ field: 'timestamp', message: 'timestamp is in the future.' });
    } else {
      value.timestamp = new Date(time);
    }
  }

  if (value.event_type === 'click') {
    const c = body.coordinates;
    if (!isPlainObject(c) || !isCoordinate(c.x) || !isCoordinate(c.y)) {
      errors.push({
        field: 'coordinates',
        message: `click events need coordinates { x, y } with numbers between 0 and ${MAX_COORDINATE}.`,
      });
    } else {
      value.coordinates = { x: c.x, y: c.y };
    }

    if (body.page_size !== undefined) {
      const s = body.page_size;
      if (!isPlainObject(s) || !isDimension(s.width) || !isDimension(s.height)) {
        errors.push({
          field: 'page_size',
          message: 'page_size must be { width, height } with positive numbers.',
        });
      } else {
        value.page_size = { width: s.width, height: s.height };
      }
    }
  }
  // Coordinates and page_size on page_view events are ignored on purpose.

  return errors.length > 0 ? { errors } : { value };
}

module.exports = { validateEvent, normalizePageUrl, EVENT_TYPES, SESSION_ID_PATTERN };
