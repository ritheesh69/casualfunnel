// Aggregation pipelines for session summaries, kept separate from the
// controller so they can be tested on their own.

// One row per session, built from the events collection.
const groupBySession = {
  $group: {
    _id: '$session_id',
    total_events: { $sum: 1 },
    page_views: { $sum: { $cond: [{ $eq: ['$event_type', 'page_view'] }, 1, 0] } },
    clicks: { $sum: { $cond: [{ $eq: ['$event_type', 'click'] }, 1, 0] } },
    last_activity: { $max: '$timestamp' },
  },
};

// A page of session summaries, most recently active first.
function sessionPagePipeline({ offset, limit }) {
  return [
    groupBySession,
    { $sort: { last_activity: -1, _id: 1 } },
    { $skip: offset },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        session_id: '$_id',
        total_events: 1,
        page_views: 1,
        clicks: 1,
        last_activity: 1,
      },
    },
  ];
}

// Totals across every session (not just the requested page).
function sessionTotalsPipeline() {
  return [
    groupBySession,
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        events: { $sum: '$total_events' },
        page_views: { $sum: '$page_views' },
        clicks: { $sum: '$clicks' },
      },
    },
  ];
}

module.exports = { sessionPagePipeline, sessionTotalsPipeline };
