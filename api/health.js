import { isDatabaseConfigured, sql } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isDatabaseConfigured()) {
    return res.status(500).json({
      ok: false,
      databaseConfigured: false,
      error: 'DATABASE_URL/POSTGRES_URL is not configured on the server.',
    });
  }

  try {
    await sql`SELECT 1`;
    return res.status(200).json({ ok: true, databaseConfigured: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      databaseConfigured: true,
      error: error?.message || 'Database connection failed.',
    });
  }
}
