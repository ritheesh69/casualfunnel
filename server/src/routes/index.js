const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const { createEvent } = require('../controllers/eventsController');
const { listSessions, listSessionEvents } = require('../controllers/sessionsController');
const { listHeatmapPages, getHeatmap } = require('../controllers/heatmapController');

function buildRouter({ eventsLimiter }) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      uptime_seconds: Math.round(process.uptime()),
    });
  });

  router.post('/events', eventsLimiter, asyncHandler(createEvent));
  router.get('/sessions', asyncHandler(listSessions));
  router.get('/sessions/:sessionId/events', asyncHandler(listSessionEvents));
  router.get('/heatmap/pages', asyncHandler(listHeatmapPages));
  router.get('/heatmap', asyncHandler(getHeatmap));

  return router;
}

module.exports = buildRouter;
