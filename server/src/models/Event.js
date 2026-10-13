const mongoose = require('mongoose');
const { EVENT_TYPES, SESSION_ID_PATTERN } = require('../utils/validateEvent');

const isClick = function isClick() {
  return this.event_type === 'click';
};

const eventSchema = new mongoose.Schema(
  {
    session_id: {
      type: String,
      required: true,
      match: SESSION_ID_PATTERN,
    },
    event_type: {
      type: String,
      required: true,
      enum: EVENT_TYPES,
    },
    page_url: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    // Client-side time of the interaction.
    timestamp: {
      type: Date,
      required: true,
    },
    // Page-relative click position in CSS pixels. Only present on click events.
    coordinates: {
      x: { type: Number, required: isClick, min: 0, max: 100000 },
      y: { type: Number, required: isClick, min: 0, max: 100000 },
    },
    // Size of the whole page when the click happened. Lets the heatmap scale
    // clicks recorded on differently sized screens onto one canvas.
    page_size: {
      width: { type: Number, min: 1, max: 100000 },
      height: { type: Number, min: 1, max: 100000 },
    },
    // Server time the event was stored.
    received_at: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

// Session history: all events of one session in time order.
eventSchema.index({ session_id: 1, timestamp: 1 });
// Heatmap: clicks for a page, and the list of pages that have clicks.
eventSchema.index({ event_type: 1, page_url: 1 });
// Recent activity.
eventSchema.index({ timestamp: -1 });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
