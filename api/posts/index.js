import { ensureSchema, sql } from '../_lib/db.js';
import { normalizeIncomingPost, parseListParams, postSummaryFromRow } from '../_lib/posts.js';

function unauthorized(res) {
  res.status(401).json({ error: 'Invalid API key.' });
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method === 'GET') {
    const { category, search, sort, limit } = parseListParams(req.query);
    const categoryArg = category && category !== 'All' ? category : null;
    const searchArg = search || null;

    const rows = await sql`
      SELECT slug, title, excerpt, category, tags, cover_image, published_on, featured_rank, content
      FROM posts
      WHERE (${categoryArg}::varchar IS NULL OR category = ${categoryArg})
        AND (
          ${searchArg}::text IS NULL
          OR title ILIKE ('%' || ${searchArg} || '%')
          OR excerpt ILIKE ('%' || ${searchArg} || '%')
          OR EXISTS (
            SELECT 1
            FROM unnest(tags) AS tag
            WHERE tag ILIKE ('%' || ${searchArg} || '%')
          )
        )
      ORDER BY published_on DESC
    `;

    let normalized = rows.map(postSummaryFromRow);
    if (sort === 'oldest') {
      normalized = normalized.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sort === 'az') {
      normalized = normalized.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'za') {
      normalized = normalized.sort((a, b) => b.title.localeCompare(a.title));
    }

    return res.status(200).json(normalized.slice(0, limit));
  }

  if (req.method === 'POST') {
    const expectedKey = String(process.env.ADMIN_API_KEY || '').trim();
    const providedHeader = req.headers['x-admin-key'];
    const providedKey = Array.isArray(providedHeader)
      ? String(providedHeader[0] || '').trim()
      : String(providedHeader || '').trim();

    if (!expectedKey) {
      return res.status(500).json({ error: 'Server missing ADMIN_API_KEY environment variable.' });
    }

    if (providedKey !== expectedKey) {
      return unauthorized(res);
    }

    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const post = normalizeIncomingPost(payload);

      await sql`
        INSERT INTO posts (
          slug, title, subtitle, author, category, tags, published_on,
          cover_image, excerpt, affiliate_url, affiliate_button_text,
          seo_title, seo_description, content, featured_rank, updated_at
        )
        VALUES (
          ${post.slug}, ${post.title}, ${post.subtitle || null}, ${post.author}, ${post.category}, ${post.tags},
          ${post.publishedOn}, ${post.coverImage || null}, ${post.excerpt || ''}, ${post.affiliateUrl || null},
          ${post.affiliateButtonText || null}, ${post.seoTitle || null}, ${post.seoDescription || null},
          ${JSON.stringify(post.content)}, ${post.featuredRank}, now()
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          author = EXCLUDED.author,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          published_on = EXCLUDED.published_on,
          cover_image = EXCLUDED.cover_image,
          excerpt = EXCLUDED.excerpt,
          affiliate_url = EXCLUDED.affiliate_url,
          affiliate_button_text = EXCLUDED.affiliate_button_text,
          seo_title = EXCLUDED.seo_title,
          seo_description = EXCLUDED.seo_description,
          content = EXCLUDED.content,
          featured_rank = EXCLUDED.featured_rank,
          updated_at = now()
      `;

      return res.status(200).json({ ok: true, slug: post.slug });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid request body' });
    }
  }

  return methodNotAllowed(res);
}
