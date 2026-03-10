/**
 * Store — Data loading & caching layer
 * Loads post index and individual posts from /data/posts/
 */

let postsIndex = null;
const postCache = new Map();

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

/**
 * Load the posts index (list of all posts with metadata).
 * @returns {Promise<Array>}
 */
export async function getPostsIndex() {
  if (postsIndex) return postsIndex;

  try {
    postsIndex = await fetchJSON('/api/posts');
    return postsIndex;
  } catch (err) {
    console.error('Store: Error loading posts index:', err);
    return [];
  }
}

/**
 * Load a single post by slug.
 * @param {string} slug
 * @returns {Promise<Object|null>}
 */
export async function getPost(slug) {
  if (postCache.has(slug)) return postCache.get(slug);

  try {
    const post = await fetchJSON(`/api/posts/${encodeURIComponent(slug)}`);
    postCache.set(slug, post);
    return post;
  } catch (err) {
    console.error('Store: Error loading post:', err);
    return null;
  }
}

/**
 * Get all unique categories from posts.
 * @returns {Promise<string[]>}
 */
export async function getCategories() {
  try {
    return await fetchJSON('/api/categories');
  } catch (err) {
    console.error('Store: Error loading categories:', err);
    return ['All'];
  }
}

/**
 * Filter posts by category and/or search query.
 * @param {Object} filters — { category?: string, query?: string }
 * @returns {Promise<Array>}
 */
export async function filterPosts({ category = 'All', query = '' } = {}) {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.set('category', category);
    if (query && query.trim()) params.set('query', query.trim());
    const qs = params.toString();
    return await fetchJSON(`/api/posts${qs ? `?${qs}` : ''}`);
  } catch (err) {
    console.error('Store: Error filtering posts:', err);
    return [];
  }
}

/**
 * Get related posts (same category, excluding current).
 * @param {string} currentSlug
 * @param {string} category
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getRelatedPosts(currentSlug, category, limit = 3) {
  try {
    const params = new URLSearchParams({
      slug: currentSlug,
      category,
      limit: String(limit),
    });
    return await fetchJSON(`/api/posts/related?${params.toString()}`);
  } catch (err) {
    console.error('Store: Error loading related posts:', err);
    return [];
  }
}

/**
 * Clear cache (useful for admin after adding new post).
 */
export function clearCache() {
  postsIndex = null;
  postCache.clear();
}
