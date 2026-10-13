const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const { validateEvent } = require('../utils/validateEvent');

async function createEvent(req, res) {
  if (!req.is('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }

  const { value, errors } = validateEvent(req.body);
  if (errors) {
    throw new ApiError(400, 'invalid_event', 'The event payload is invalid.', errors);
  }

  const event = await Event.create(value);
  res.status(201).json({ id: event.id, session_id: event.session_id });
}

module.exports = { createEvent };
