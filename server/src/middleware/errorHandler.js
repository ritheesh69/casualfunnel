const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, 'not_found', `No route for ${req.method} ${req.path}.`));
}

function isDatabaseUnavailable(err) {
  const name = err && err.name;
  return (
    name === 'MongooseServerSelectionError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    (name === 'MongooseError' && /buffering timed out/i.test(err.message))
  );
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // body-parser failures
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON.' } });
  }
  if (err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res
      .status(400)
      .json({ error: { code: 'validation_failed', message: 'Event failed validation.', details } });
  }

  if (isDatabaseUnavailable(err)) {
    console.error('Database unavailable:', err.message);
    return res.status(503).json({
      error: { code: 'database_unavailable', message: 'The database is not reachable right now.' },
    });
  }

  console.error('Unhandled error:', err);
  return res
    .status(500)
    .json({ error: { code: 'internal_error', message: 'Something went wrong on the server.' } });
}

module.exports = { notFound, errorHandler };
