import { ensureSchema, sql } from '../_lib/db.js';
import { ensureAnalyticsSchema } from '../_lib/analytics.js';

const ALLOWED_EVENTS = new Set(['page_view', 'impression', 'time_spent', 'affiliate_click']);
const BOT_UA_REGEX = /(bot|crawler|spider|crawling|headless|facebookexternalhit|slurp|wget|curl|python-requests|pingdom|uptimerobot)/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    await ensureAnalyticsSchema();

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const eventType = String(payload.eventType || '').trim();
    if (!ALLOWED_EVENTS.has(eventType)) {
      return res.status(400).json({ error: 'Invalid eventType' });
    }

    const route = stringOrNull(payload.route, 255);
    const slug = stringOrNull(payload.slug, 140);
    const kind = stringOrNull(payload.kind, 40);
    const sessionId = stringOrNull(payload.sessionId, 80);
    const durationMs = numberOrNull(payload.durationMs);
    const userAgent = stringOrNull(req.headers['user-agent'], 1200);
    const isBot = BOT_UA_REGEX.test(userAgent || '');
    if (isBot) {
      return res.status(202).json({ ok: true, ignored: 'bot' });
    }
    const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
    const consentLevel = stringOrNull(payload.consentLevel, 16) || 'minimal';
    const safeMeta = {
      ...meta,
      isBot,
      consentLevel: consentLevel === 'full' ? 'full' : 'minimal',
    };

    await sql`
      INSERT INTO analytics_events (
        event_type, route, slug, kind, duration_ms, session_id, user_agent, meta
      )
      VALUES (
        ${eventType}, ${route}, ${slug}, ${kind}, ${durationMs}, ${sessionId}, ${userAgent}, ${JSON.stringify(safeMeta)}
      )
    `;

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Analytics event failed' });
  }
}

function stringOrNull(value, max) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function numberOrNull(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
}
