/**
 * Home Page — Featured "Best Blogs" section + bento grid listing
 */

import { getPostsIndex, filterPosts, getCategories } from '../store.js';
import { updateMeta } from '../utils/seo.js';
import { debounce, formatDate, readingTime } from '../utils/helpers.js';

/**
 * Render the home page.
 */
export async function renderHomePage() {
  updateMeta({
    title: null,
    description: 'Honest reviews and recommendations for the best tools, gadgets, and home improvement products.',
  });

  const html = `
    <div class="container">

      <!-- ====== Featured "Best Blogs" ====== -->
      <section class="featured-section">
        <div class="featured-header">
          <h1 class="featured-title">Best of the week</h1>
          <a href="#" class="featured-link" id="see-all-link">See all posts →</a>
        </div>
        <div class="featured-grid" id="featured-grid">
          <div class="skeleton skeleton-featured"></div>
          <div class="featured-right">
            <div class="skeleton skeleton-featured-sm"></div>
            <div class="skeleton skeleton-featured-sm"></div>
          </div>
        </div>
      </section>

      <!-- ====== All Blogs Listing ====== -->
      <section class="listing-section">
        <div class="listing-header">
          <h2 class="listing-title">All Reviews</h2>
          <span class="listing-count" id="listing-count"></span>
        </div>

        <div class="toolbar">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              class="search-input"
              id="search-input"
              placeholder="Search products..."
              aria-label="Search products"
            />
          </div>
          <div class="category-bar" id="category-bar"></div>
          <div class="sort-wrapper">
            <select class="sort-select" id="sort-select" aria-label="Sort posts">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
          </div>
        </div>

        <div class="bento-grid" id="bento-grid">
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
      </section>
    </div>
  `;

  setTimeout(() => initHomePage(), 0);
  return html;
}

/* ============================================
   Initialize home page interactivity
   ============================================ */
async function initHomePage() {
  const featuredGrid = document.getElementById('featured-grid');
  const bentoGrid    = document.getElementById('bento-grid');
  const categoryBar  = document.getElementById('category-bar');
  const searchInput  = document.getElementById('search-input');
  const sortSelect   = document.getElementById('sort-select');
  const listingCount = document.getElementById('listing-count');
  const seeAllLink   = document.getElementById('see-all-link');

  if (!bentoGrid) return;

  let activeCategory = 'All';
  let activeSort     = 'newest';

  // ---- Scroll "See all posts" to the listing section ----
  if (seeAllLink) {
    seeAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.listing-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // ---- Load featured posts ----
  const allPosts = await getPostsIndex();
  const featured = allPosts.filter(p => p.featured).sort((a, b) => a.featured - b.featured).slice(0, 3);

  if (featuredGrid && featured.length >= 3) {
    featuredGrid.innerHTML = `
      ${renderFeaturedPrimary(featured[0])}
      <div class="featured-right">
        ${renderFeaturedSecondary(featured[1])}
        ${renderFeaturedSecondary(featured[2])}
      </div>
    `;
  } else if (featuredGrid && featured.length > 0) {
    // Fallback: just show what we have
    featuredGrid.innerHTML = featured.map(p => renderFeaturedPrimary(p)).join('');
  }

  // ---- Load categories ----
  const categories = await getCategories();
  if (categoryBar) {
    categoryBar.innerHTML = categories.map(cat => `
      <button class="category-chip${cat === activeCategory ? ' active' : ''}" data-category="${cat}">
        ${cat}
      </button>
    `).join('');

    categoryBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      activeCategory = chip.dataset.category;
      categoryBar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadListing();
    });
  }

  // ---- Search ----
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => loadListing(), 250));
  }

  // ---- Sort ----
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value;
      loadListing();
    });
  }

  // ---- Load bento listing ----
  async function loadListing() {
    const query = searchInput ? searchInput.value : '';
    let posts = await filterPosts({ category: activeCategory, query });

    // Sort
    posts = sortPosts(posts, activeSort);

    // Update count
    if (listingCount) {
      listingCount.textContent = `${posts.length} product${posts.length !== 1 ? 's' : ''}`;
    }

    if (posts.length === 0) {
      bentoGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <h3 class="empty-state-title">No products found</h3>
          <p class="empty-state-text">Try a different search or category.</p>
        </div>
      `;
      return;
    }

    bentoGrid.innerHTML = posts.map((post, i) => renderBentoCard(post, i)).join('');
  }

  await loadListing();
}

/* ============================================
   Sort helper
   ============================================ */
function sortPosts(posts, sortKey) {
  const sorted = [...posts];
  switch (sortKey) {
    case 'oldest':
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'az':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'za':
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
  }
  return sorted;
}

/* ============================================
   Featured card renderers
   ============================================ */
function renderFeaturedPrimary(post) {
  const date = formatDate(post.date);
  return `
    <div class="featured-card featured-card-primary" onclick="window.location.hash='#/post/${post.slug}'">
      <img class="featured-card-img" src="${post.coverImage || 'https://placehold.co/800x500/E0DCD5/6B6B6B?text=No+Image'}" alt="${post.title}" loading="lazy" />
      <div class="featured-card-overlay">
        <div class="featured-card-meta">
          <span class="featured-card-date">${date}</span>
          ${post.category ? `<span class="badge">${post.category}</span>` : ''}
        </div>
        <h2 class="featured-card-title">${post.title}</h2>
        <p class="featured-card-excerpt">${post.excerpt || ''}</p>
      </div>
      <div class="featured-card-arrow">↗</div>
    </div>
  `;
}

function renderFeaturedSecondary(post) {
  const date = formatDate(post.date);
  return `
    <div class="featured-card featured-card-secondary" onclick="window.location.hash='#/post/${post.slug}'">
      <img class="featured-card-img" src="${post.coverImage || 'https://placehold.co/600x400/E0DCD5/6B6B6B?text=No+Image'}" alt="${post.title}" loading="lazy" />
      <div class="featured-card-overlay">
        <div class="featured-card-meta">
          ${post.category ? `<span class="badge">${post.category}</span>` : ''}
        </div>
        <h3 class="featured-card-title">${post.title}</h3>
      </div>
      <div class="featured-card-arrow">↗</div>
    </div>
  `;
}

/* ============================================
   Bento card renderer
   ============================================ */
function renderBentoCard(post, index) {
  const date = formatDate(post.date);
  const time = readingTime(post.contentPreview || []);

  // Assign bento size classes for visual variety
  // Pattern: first item large, every 5th item horizontal, rest normal
  let sizeClass = '';
  if (index === 0) {
    sizeClass = 'bento-card-large';
  } else if (index % 5 === 3) {
    sizeClass = 'bento-card-horizontal';
  }

  return `
    <article class="bento-card ${sizeClass}" onclick="window.location.hash='#/post/${post.slug}'" role="link" tabindex="0" aria-label="Read about ${post.title}">
      <div class="bento-card-image-wrapper">
        <img
          class="bento-card-img"
          src="${post.coverImage || 'https://placehold.co/600x375/E0DCD5/6B6B6B?text=No+Image'}"
          alt="${post.title}"
          loading="lazy"
        />
      </div>
      <div class="bento-card-body">
        ${post.category ? `<span class="badge bento-card-category">${post.category}</span>` : ''}
        <h3 class="bento-card-title">${post.title}</h3>
        <p class="bento-card-excerpt">${post.excerpt || ''}</p>
        <div class="bento-card-footer">
          <span>${date}</span>
          <span>📖 ${time}</span>
        </div>
      </div>
    </article>
  `;
}
