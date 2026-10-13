const Event = require('../models/Event');
const ApiError = require('../utils/ApiError');
const { normalizePageUrl } = require('../utils/validateEvent');

const MAX_POINTS = 10000;

async function listHeatmapPages(req, res) {
  const rows = await Event.aggregate([
    { $match: { event_type: 'click' } },
    { $group: { _id: '$page_url', clicks: { $sum: 1 } } },
  ]);
  const pages = rows
    .map((r) => ({ page_url: r._id, clicks: r.clicks }))
    .sort((a, b) => b.clicks - a.clicks || (a.page_url < b.page_url ? -1 : 1));
  res.json({ pages });
}

async function getHeatmap(req, res) {
  const raw = req.query.url;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ApiError(400, 'missing_url', 'The url query parameter is required.');
  }
  const pageUrl = normalizePageUrl(raw);
  if (!pageUrl) {
    throw new ApiError(400, 'invalid_url', 'url must be an absolute http(s) URL.');
  }

  const filter = { event_type: 'click', page_url: pageUrl };
  const [totalClicks, docs] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter, { _id: 0, coordinates: 1, page_size: 1 }).limit(MAX_POINTS).lean(),
  ]);

  const points = docs
    .filter((d) => d.coordinates && Number.isFinite(d.coordinates.x) && Number.isFinite(d.coordinates.y))
    .map((d) => ({
      x: d.coordinates.x,
      y: d.coordinates.y,
      page_width: d.page_size && d.page_size.width ? d.page_size.width : null,
      page_height: d.page_size && d.page_size.height ? d.page_size.height : null,
    }));

  res.json({
    page_url: pageUrl,
    total_clicks: totalClicks,
    returned: points.length,
    points,
  });
}

module.exports = { listHeatmapPages, getHeatmap };
