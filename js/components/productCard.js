/**
 * Product Card Component
 */

import { formatDate, readingTime } from '../utils/helpers.js';

/**
 * Render a product card.
 * @param {Object} post — post metadata from index
 * @returns {string} HTML
 */
export function renderProductCard(post) {
  const time = readingTime(post.contentPreview || []);
  const date = formatDate(post.date);

  return `
    <article class="card" data-slug="${post.slug}" onclick="window.location.hash='#/post/${post.slug}'" role="link" tabindex="0" aria-label="Read about ${post.title}">
      <div class="card-image-wrapper">
        <img
          class="card-image"
          src="${post.coverImage || 'https://placehold.co/600x375/E0DCD5/6B6B6B?text=No+Image'}"
          alt="${post.title}"
          loading="lazy"
        />
        ${post.category ? `<span class="badge" style="position:absolute;top:var(--space-md);left:var(--space-md);">${post.category}</span>` : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${post.title}</h3>
        <p class="card-excerpt">${post.excerpt || ''}</p>
        <div class="card-meta">
          <span class="card-date">${date}</span>
          <span class="card-read-time">📖 ${time}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render a skeleton loading card.
 */
export function renderSkeletonCard() {
  return `<div class="skeleton skeleton-card"></div>`;
}
