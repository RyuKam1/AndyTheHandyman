import { ensureSchema, sql } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT DISTINCT category
      FROM posts
      ORDER BY category ASC
    `;

    return res.status(200).json(['All', ...rows.map((r) => r.category)]);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Database request failed.' });
  }
}
