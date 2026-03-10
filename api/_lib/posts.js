function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function normalizeContentBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .map((block) => {
      if (!block || typeof block !== 'object') return null;
      const props = block.props && typeof block.props === 'object' ? block.props : {};
      const type = block.type === 'pros-cons' ? 'proscons' : block.type;

      if (!type) return null;
      return {
        id: block.id || crypto.randomUUID(),
        type,
        ...props,
        ...Object.fromEntries(
          Object.entries(block).filter(([key]) => !['id', 'type', 'props'].includes(key))
        ),
      };
    })
    .filter(Boolean);
}

export function postSummaryFromRow(row) {
  const previewText = extractPreviewText(row.content);
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    tags: row.tags || [],
    coverImage: row.cover_image,
    date: row.published_on,
    featured: row.featured_rank,
    contentPreview: previewText ? [{ type: 'paragraph', text: previewText }] : [],
  };
}

function extractPreviewText(content) {
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block?.type === 'paragraph' && typeof block.text === 'string') {
      return block.text.trim().slice(0, 180);
    }
  }
  return '';
}

export function postDetailFromRow(row) {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || '',
    author: row.author || 'Andy',
    category: row.category,
    tags: row.tags || [],
    date: row.published_on,
    coverImage: row.cover_image || '',
    excerpt: row.excerpt || '',
    affiliateUrl: row.affiliate_url || '',
    affiliateButtonText: row.affiliate_button_text || 'Check Price & Availability',
    seoTitle: row.seo_title || '',
    seoDescription: row.seo_description || '',
    featured: row.featured_rank ?? null,
    content: Array.isArray(row.content) ? row.content : [],
  };
}

export function parseListParams(query = {}) {
  return {
    category: typeof query.category === 'string' ? query.category.trim() : '',
    search: typeof query.query === 'string' ? query.query.trim() : '',
    sort: query.sort === 'oldest' ? 'oldest' : query.sort === 'az' ? 'az' : query.sort === 'za' ? 'za' : 'newest',
    limit: Math.min(Math.max(toInt(query.limit, 50), 1), 100),
  };
}

export function normalizeIncomingPost(payload = {}) {
  const title = String(payload.title || '').trim();
  const slug = String(payload.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
  if (!title || !slug) {
    throw new Error('Title and slug are required.');
  }

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    slug,
    title,
    subtitle: String(payload.subtitle || '').trim(),
    author: String(payload.author || 'Andy').trim() || 'Andy',
    category: String(payload.category || '').trim() || 'General',
    tags: [...new Set(tags)],
    publishedOn: String(payload.date || new Date().toISOString().slice(0, 10)),
    coverImage: String(payload.coverImage || '').trim(),
    excerpt: String(payload.excerpt || '').trim().slice(0, 420),
    affiliateUrl: String(payload.affiliateUrl || payload.affiliateLink || '').trim(),
    affiliateButtonText: String(payload.affiliateButtonText || '').trim(),
    seoTitle: String(payload.seoTitle || '').trim(),
    seoDescription: String(payload.seoDescription || '').trim().slice(0, 420),
    featuredRank: payload.featured == null || payload.featured === ''
      ? null
      : Math.min(Math.max(toInt(payload.featured, null), 1), 3),
    content: normalizeContentBlocks(payload.content || []),
  };
}
