/*!
 * CausalFunnel tracker
 *
 * Plain JavaScript, no dependencies. Records page views and clicks and sends
 * them to the analytics API. Nothing else is collected: no keystrokes, no form
 * values, no element text, no query strings or URL fragments.
 *
 * Configuration (highest priority first):
 *   1. Attributes on the script tag:
 *        data-endpoint="https://api.example.com/api/events"
 *        data-session-timeout-minutes="30"
 *        data-debug="true"
 *   2. window.CF_TRACKER_CONFIG = { endpoint, sessionTimeoutMinutes, debug }
 *      (define it before this script loads)
 *   3. Defaults: http://localhost:4000/api/events, 30 minutes, no logging.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Guard against the script being included twice, which would attach a second
  // click listener and double-count every interaction.
  if (window.__cfTrackerLoaded) return;
  window.__cfTrackerLoaded = true;

  var script = document.currentScript;
  var userConfig = window.CF_TRACKER_CONFIG || {};

  function scriptAttr(name) {
    return script && script.getAttribute ? script.getAttribute('data-' + name) : null;
  }

  function positiveNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : fallback;
  }

  var config = {
    endpoint: scriptAttr('endpoint') || userConfig.endpoint || 'http://localhost:4000/api/events',
    sessionTimeoutMs:
      positiveNumber(
        scriptAttr('session-timeout-minutes') || userConfig.sessionTimeoutMinutes,
        30
      ) *
      60 *
      1000,
    debug: scriptAttr('debug') === 'true' || userConfig.debug === true,
  };

  var SESSION_KEY = 'cf_session';
  var QUEUE_KEY = 'cf_pending_events';
  var MAX_QUEUED = 50;

  function log() {
    if (config.debug && window.console && console.log) {
      console.log.apply(console, ['[tracker]'].concat([].slice.call(arguments)));
    }
  }

  // ---------------------------------------------------------------- storage

  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function cookieGet(key) {
    var parts = (document.cookie || '').split('; ');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq > 0 && parts[i].slice(0, eq) === key) {
        try {
          return decodeURIComponent(parts[i].slice(eq + 1));
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }

  function cookieSet(key, value) {
    try {
      document.cookie =
        key + '=' + encodeURIComponent(value) + '; path=/; max-age=86400; SameSite=Lax';
    } catch (e) {
      /* cookies unavailable */
    }
  }

  // ---------------------------------------------------------------- session
  //
  // A session is { id, last }. It lives in localStorage (cookie if localStorage
  // is blocked, memory if both are) and is shared by every page of the same
  // origin. A new session starts when there is none, or when the previous
  // event was more than `sessionTimeoutMs` ago. Every event refreshes `last`.

  var memorySession = null;
  var storageWorks = lsSet('cf_probe', '1');
  try {
    window.localStorage.removeItem('cf_probe');
  } catch (e) {
    /* storage unavailable */
  }

  function randomHex(bytes) {
    var out = '';
    var cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      var arr = new Uint8Array(bytes);
      cryptoObj.getRandomValues(arr);
      for (var i = 0; i < arr.length; i++) out += ('0' + arr[i].toString(16)).slice(-2);
    } else {
      for (var j = 0; j < bytes; j++) {
        out += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2);
      }
    }
    return out;
  }

  function newSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return 'sess_' + window.crypto.randomUUID();
    }
    return 'sess_' + randomHex(16);
  }

  function readSession() {
    var raw = storageWorks ? lsGet(SESSION_KEY) : cookieGet(SESSION_KEY);
    if (!raw) return memorySession;
    var sep = raw.lastIndexOf('|');
    if (sep < 1) return memorySession;
    var last = Number(raw.slice(sep + 1));
    var id = raw.slice(0, sep);
    return /^sess_[A-Za-z0-9_-]{8,64}$/.test(id) && isFinite(last) ? { id: id, last: last } : null;
  }

  function writeSession(session) {
    memorySession = session;
    var raw = session.id + '|' + session.last;
    if (storageWorks) {
      lsSet(SESSION_KEY, raw);
    } else {
      cookieSet(SESSION_KEY, raw);
    }
  }

  function getSessionId() {
    var now = Date.now();
    var session = readSession();
    if (!session || now - session.last > config.sessionTimeoutMs) {
      session = { id: newSessionId(), last: now };
      log('new session', session.id);
    } else {
      session.last = now;
    }
    writeSession(session);
    return session.id;
  }

  // ---------------------------------------------------------------- sending

  function loadQueue() {
    var raw = lsGet(QUEUE_KEY);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveQueue(queue) {
    lsSet(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED)));
  }

  function enqueue(event) {
    var queue = loadQueue();
    queue.push(event);
    saveQueue(queue);
    log('queued for retry', event.event_type);
  }

  // Resolves when the server answered with something we should not retry
  // (success or a client error). Rejects on network failure, 429 and 5xx.
  function post(event) {
    return window
      .fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
        credentials: 'omit',
        mode: 'cors',
      })
      .then(function (res) {
        if (res.status >= 500 || res.status === 429) {
          throw new Error('Server responded ' + res.status);
        }
        if (res.status >= 400) {
          log('event rejected by server', res.status);
        }
      });
  }

  var flushing = false;

  // Re-send events that could not be delivered earlier (offline, API asleep).
  function flushQueue() {
    if (flushing) return;
    var queue = loadQueue();
    if (queue.length === 0) return;
    flushing = true;
    saveQueue([]);
    var pending = queue.map(function (event) {
      return post(event).catch(function () {
        enqueue(event);
      });
    });
    Promise.all(pending).then(function () {
      flushing = false;
    });
  }

  function send(event) {
    if (typeof window.fetch !== 'function') {
      log('fetch is not available; event dropped');
      return;
    }
    post(event)
      .then(function () {
        if (loadQueue().length > 0) flushQueue();
      })
      .catch(function (err) {
        log('send failed', err && err.message);
        enqueue(event);
      });
  }

  // ----------------------------------------------------------------- events

  // Page URL without query string or fragment, so tokens, emails and
  // campaign parameters in the address bar are never recorded.
  function currentPageUrl() {
    return window.location.origin + window.location.pathname;
  }

  function baseEvent(type) {
    return {
      session_id: getSessionId(),
      event_type: type,
      page_url: currentPageUrl(),
      timestamp: new Date().toISOString(),
    };
  }

  // Size of the whole page, so the dashboard can scale clicks from different
  // screen sizes onto one canvas. Omitted when the browser reports nothing usable.
  function pageSize() {
    var doc = document.documentElement;
    var body = document.body || {};
    var width = Math.max(doc.scrollWidth || 0, body.scrollWidth || 0) || window.innerWidth || 0;
    var height = Math.max(doc.scrollHeight || 0, body.scrollHeight || 0) || window.innerHeight || 0;
    return width > 0 && height > 0 ? { width: width, height: height } : null;
  }

  // Page-relative position (measured from the top-left of the whole document,
  // not the viewport), so clicks line up regardless of scroll position.
  function clickPosition(ev) {
    var scrollX = window.pageXOffset || 0;
    var scrollY = window.pageYOffset || 0;
    var x = typeof ev.pageX === 'number' ? ev.pageX : ev.clientX + scrollX;
    var y = typeof ev.pageY === 'number' ? ev.pageY : ev.clientY + scrollY;

    // A keyboard-activated click (Enter/Space on a button) has no pointer
    // position; use the centre of the element instead.
    var keyboardClick = ev.detail === 0 && !ev.clientX && !ev.clientY;
    if ((keyboardClick || !isFinite(x) || !isFinite(y)) && ev.target && ev.target.getBoundingClientRect) {
      var rect = ev.target.getBoundingClientRect();
      x = rect.left + rect.width / 2 + scrollX;
      y = rect.top + rect.height / 2 + scrollY;
    }
    if (!isFinite(x) || !isFinite(y)) return null;
    return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) };
  }

  function trackPageView() {
    send(baseEvent('page_view'));
  }

  function onClick(ev) {
    var position = clickPosition(ev);
    if (!position) return;
    var event = baseEvent('click');
    event.coordinates = position;
    var size = pageSize();
    if (size) event.page_size = size;
    send(event);
  }

  // -------------------------------------------------------------------- init

  // Capture phase, so a handler that calls stopPropagation() cannot hide a click.
  document.addEventListener('click', onClick, true);
  window.addEventListener('online', flushQueue);

  trackPageView();
  flushQueue();

  // Small public surface, handy for debugging.
  window.CausalFunnelTracker = {
    getSessionId: getSessionId,
    config: config,
  };
})();
