const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { config } = require('./config/env');
const buildRouter = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp(options = {}) {
  const corsOrigins = options.corsOrigins || config.corsOrigins;
  const rateLimitPerMinute = options.rateLimitPerMinute || config.rateLimitPerMinute;

  const app = express();
  app.disable('x-powered-by');
  // Render and similar hosts sit behind one proxy; needed for per-client rate limiting.
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (curl, server to server) are allowed.
        callback(null, !origin || corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '10kb' }));

  const eventsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: rateLimitPerMinute,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: { code: 'rate_limited', message: 'Too many events from this client. Try again shortly.' },
      }),
  });

  app.use('/api', buildRouter({ eventsLimiter }));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
