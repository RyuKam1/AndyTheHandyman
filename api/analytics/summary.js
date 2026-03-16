import { ensureSchema, sql } from '../_lib/db.js';
import { ensureAnalyticsSchema, resolveDateRange } from '../_lib/analytics.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    await ensureAnalyticsSchema();
    if (req.method === 'DELETE') {
      return await handleDelete(req, res);
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { from, to } = resolveDateRange(req.query);
    const includeBots = String(req.query?.includeBots || '').toLowerCase() === 'true';

    const [totals] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS total_page_views,
        COUNT(*) FILTER (WHERE event_type = 'impression')::int AS total_impressions,
        COUNT(*) FILTER (WHERE event_type = 'affiliate_click')::int AS total_affiliate_clicks,
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view' AND session_id IS NOT NULL)::int AS unique_visitors,
        COALESCE(SUM(duration_ms) FILTER (WHERE event_type = 'time_spent'), 0)::bigint AS total_time_spent_ms,
        COALESCE(AVG(duration_ms) FILTER (WHERE event_type = 'time_spent'), 0)::int AS avg_time_spent_ms
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
    `;

    const topBlogsByViews = await sql`
      SELECT slug, COUNT(*)::int AS views
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND event_type = 'page_view'
        AND slug IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY slug
      ORDER BY views DESC
      LIMIT 10
    `;

    const topBlogsByImpressions = await sql`
      SELECT slug, COUNT(*)::int AS impressions
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND event_type = 'impression'
        AND slug IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY slug
      ORDER BY impressions DESC
      LIMIT 10
    `;

    const routeTime = await sql`
      SELECT route, COALESCE(SUM(duration_ms), 0)::bigint AS time_ms
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND event_type = 'time_spent'
        AND route IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY route
      ORDER BY time_ms DESC
      LIMIT 15
    `;

    const pageViewsByRoute = await sql`
      SELECT route, COUNT(*)::int AS views
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND event_type = 'page_view'
        AND route IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY route
      ORDER BY views DESC
      LIMIT 15
    `;

    const topBlogsByAffiliateClicks = await sql`
      SELECT slug, COUNT(*)::int AS clicks
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND event_type = 'affiliate_click'
        AND slug IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY slug
      ORDER BY clicks DESC
      LIMIT 10
    `;

    const funnelByBlog = await sql`
      SELECT
        slug,
        COUNT(*) FILTER (WHERE event_type = 'impression')::int AS impressions,
        COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS views,
        COUNT(*) FILTER (WHERE event_type = 'affiliate_click')::int AS clicks,
        COALESCE(SUM(duration_ms) FILTER (WHERE event_type = 'time_spent'), 0)::bigint AS time_ms
      FROM analytics_events
      WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
        AND slug IS NOT NULL
        AND (${includeBots}::boolean = TRUE OR COALESCE((meta->>'isBot')::boolean, FALSE) = FALSE)
      GROUP BY slug
      HAVING COUNT(*) FILTER (WHERE event_type = 'impression') > 0
         OR COUNT(*) FILTER (WHERE event_type = 'page_view') > 0
         OR COUNT(*) FILTER (WHERE event_type = 'affiliate_click') > 0
      ORDER BY views DESC, clicks DESC
      LIMIT 20
    `;

    return res.status(200).json({
      ok: true,
      range: { from, to },
      includeBots,
      totals: {
        totalPageViews: totals?.total_page_views || 0,
        totalImpressions: totals?.total_impressions || 0,
        totalAffiliateClicks: totals?.total_affiliate_clicks || 0,
        uniqueVisitors: totals?.unique_visitors || 0,
        totalTimeSpentMs: Number(totals?.total_time_spent_ms || 0),
        avgTimeSpentMs: totals?.avg_time_spent_ms || 0,
      },
      topBlogsByViews,
      topBlogsByImpressions,
      topBlogsByAffiliateClicks,
      routeTime,
      pageViewsByRoute,
      funnelByBlog: funnelByBlog.map((row) => ({
        ...row,
        time_ms: Number(row.time_ms || 0),
        clickThroughRate: row.views > 0 ? Number(((row.clicks / row.views) * 100).toFixed(2)) : 0,
        viewRate: row.impressions > 0 ? Number(((row.views / row.impressions) * 100).toFixed(2)) : 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Analytics summary failed' });
  }
}

async function handleDelete(req, res) {
  const expectedKey = String(process.env.ADMIN_API_KEY || process.env.HANDY_ADMIN_API_KEY || '').trim();
  const providedHeader = req.headers['x-admin-key'];
  const providedKey = Array.isArray(providedHeader)
    ? String(providedHeader[0] || '').trim()
    : String(providedHeader || '').trim();
  if (!expectedKey) {
    return res.status(500).json({ error: 'Server missing ADMIN_API_KEY environment variable.' });
  }
  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key.' });
  }

  const { from, to } = resolveDateRange(req.query);
  const clearAll = String(req.query?.all || '').toLowerCase() === 'true';
  if (clearAll) {
    const rows = await sql`DELETE FROM analytics_events RETURNING id`;
    return res.status(200).json({ ok: true, deleted: rows.length || 0, mode: 'all' });
  }

  const rows = await sql`
    DELETE FROM analytics_events
    WHERE created_at BETWEEN ${from}::timestamptz AND ${to}::timestamptz
    RETURNING id
  `;
  return res.status(200).json({ ok: true, deleted: rows.length || 0, mode: 'range', range: { from, to } });
}
