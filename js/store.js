/**
 * Store — Data loading & caching layer
 * Loads post index and individual posts from /data/posts/
 */

let postsIndex = null;
const postCache = new Map();

/**
 * Load the posts index (list of all posts with metadata).
 * @returns {Promise<Array>}
 */
export async function getPostsIndex() {
  if (postsIndex) return postsIndex;

  try {
    const res = await fetch('/data/posts-index.json');
    if (!res.ok) throw new Error('Failed to load posts index');
    postsIndex = await res.json();
    // Sort by date descending
    postsIndex.sort((a, b) => new Date(b.date) - new Date(a.date));
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
    const res = await fetch(`/data/posts/${slug}.json`);
    if (!res.ok) throw new Error(`Post not found: ${slug}`);
    const post = await res.json();
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
  const posts = await getPostsIndex();
  const cats = new Set();
  posts.forEach(p => {
    if (p.category) cats.add(p.category);
  });
  return ['All', ...Array.from(cats).sort()];
}

/**
 * Filter posts by category and/or search query.
 * @param {Object} filters — { category?: string, query?: string }
 * @returns {Promise<Array>}
 */
export async function filterPosts({ category = 'All', query = '' } = {}) {
  const posts = await getPostsIndex();
  return posts.filter(post => {
    const matchCategory = category === 'All' || post.category === category;
    const q = query.toLowerCase().trim();
    const matchQuery = !q ||
      post.title.toLowerCase().includes(q) ||
      post.excerpt.toLowerCase().includes(q) ||
      (post.tags && post.tags.some(t => t.toLowerCase().includes(q)));
    return matchCategory && matchQuery;
  });
}

/**
 * Get related posts (same category, excluding current).
 * @param {string} currentSlug
 * @param {string} category
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getRelatedPosts(currentSlug, category, limit = 3) {
  const posts = await getPostsIndex();
  return posts
    .filter(p => p.slug !== currentSlug && p.category === category)
    .slice(0, limit);
}

/**
 * Clear cache (useful for admin after adding new post).
 */
export function clearCache() {
  postsIndex = null;
  postCache.clear();
}
