/**
 * SEO Utility — Dynamic meta tag management
 */

const defaults = {
  title: 'Andy The Handyman — Trusted Tool & Product Reviews',
  description: 'Honest reviews and recommendations for the best tools, gadgets, and home improvement products. Find exactly what you need with Andy The Handyman.',
  image: '',
  url: window.location.origin,
};

/**
 * Update page meta tags for SEO.
 * @param {Object} meta
 */
export function updateMeta({ title, description, image, url } = {}) {
  const t = title ? `${title} | Andy The Handyman` : defaults.title;
  const d = description || defaults.description;
  const img = image || defaults.image;
  const u = url || window.location.href;

  // Title
  document.title = t;

  // Standard meta
  setMetaTag('name', 'description', d);

  // Open Graph
  setMetaTag('property', 'og:title', t);
  setMetaTag('property', 'og:description', d);
  setMetaTag('property', 'og:url', u);
  if (img) setMetaTag('property', 'og:image', img);

  // Twitter Card
  setMetaTag('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
  setMetaTag('name', 'twitter:title', t);
  setMetaTag('name', 'twitter:description', d);
  if (img) setMetaTag('name', 'twitter:image', img);
}

/**
 * Set or create a meta tag.
 */
function setMetaTag(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/**
 * Reset meta tags to defaults.
 */
export function resetMeta() {
  updateMeta(defaults);
}
