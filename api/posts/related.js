import { ensureSchema, sql } from '../_lib/db.js';
import { postSummaryFromRow } from '../_lib/posts.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();

    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const currentSlug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const limitRaw = Number.parseInt(String(req.query.limit || '3'), 10);
    const limit = Number.isNaN(limitRaw) ? 3 : Math.min(Math.max(limitRaw, 1), 12);

    if (!category) {
      return res.status(200).json([]);
    }

    const rows = await sql`
      SELECT slug, title, excerpt, category, tags, cover_image, published_on, featured_rank, content
      FROM posts
      WHERE category = ${category}
        AND (${currentSlug || null}::varchar IS NULL OR slug <> ${currentSlug || null})
      ORDER BY published_on DESC
      LIMIT ${limit}
    `;

    return res.status(200).json(rows.map(postSummaryFromRow));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Database request failed.' });
  }
}
