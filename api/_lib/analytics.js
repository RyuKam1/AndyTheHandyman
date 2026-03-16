import { sql } from './db.js';

export async function ensureAnalyticsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      event_type VARCHAR(40) NOT NULL,
      route VARCHAR(255),
      slug VARCHAR(140),
      kind VARCHAR(40),
      duration_ms INTEGER,
      session_id VARCHAR(80),
      user_agent TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events (created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events (event_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_slug ON analytics_events (slug);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events (session_id);`;
}

export function resolveDateRange(query = {}) {
  const now = new Date();
  const to = safeDate(query.to) || now;
  const from = safeDate(query.from) || new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function safeDate(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}
