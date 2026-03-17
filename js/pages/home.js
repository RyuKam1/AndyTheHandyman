/**
 * Home Page — Featured "Best Blogs" section + bento grid listing
 */

import { getPostsIndex, filterPosts, getCategories } from '../store.js';
import { updateMeta } from '../utils/seo.js';
import { debounce, formatDate, readingTime } from '../utils/helpers.js';
import { trackImpression } from '../utils/analytics.js';

const BENTO_SESSION_SEED_KEY = 'ath_bento_session_seed';

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
  const sessionSeed = getBentoSessionSeed();

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
  applyCropTransforms(featuredGrid);
  bindImpressionTracking(featuredGrid);

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

    const layoutPlan = buildSessionBentoLayout(
      posts.length,
      `${sessionSeed}|${activeCategory}|${activeSort}|${query}`,
    );
    bentoGrid.innerHTML = posts
      .map((post, i) => {
        const layoutSlot = layoutPlan[i] || {};
        return renderBentoCard(post, i, {
          sizeClass: layoutSlot.sizeClass || '',
          shapeClass: layoutSlot.shapeClass || '',
          styleClass: layoutSlot.styleClass || '',
          imageContext: layoutSlot.imageContext || '',
          sessionSeed,
        });
      })
      .join('');
    applyCropTransforms(bentoGrid);
    bindImpressionTracking(bentoGrid);
  }

  await loadListing();
  window.addEventListener('resize', debounce(() => {
    applyCropTransforms(featuredGrid);
    applyCropTransforms(bentoGrid);
  }, 120));
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
  const image = resolveCardImage(post, { context: 'featured-primary', index: 0 });
  return `
    <div class="featured-card featured-card-primary" data-impression-slug="${post.slug}" data-impression-kind="featured-primary" onclick="window.location.hash='#/post/${post.slug}'">
      <img class="featured-card-img" src="${image.src}" alt="${post.title}" loading="lazy" ${cropDatasetAttrs(image.crop)} />
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
  const image = resolveCardImage(post, { context: 'featured-secondary', index: 0 });
  return `
    <div class="featured-card featured-card-secondary" data-impression-slug="${post.slug}" data-impression-kind="featured-secondary" onclick="window.location.hash='#/post/${post.slug}'">
      <img class="featured-card-img" src="${image.src}" alt="${post.title}" loading="lazy" ${cropDatasetAttrs(image.crop)} />
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
function renderBentoCard(
  post,
  index,
  {
    sizeClass = '',
    shapeClass = '',
    styleClass = '',
    imageContext = '',
    sessionSeed = '',
  } = {},
) {
  const date = formatDate(post.date);
  const time = readingTime(post.contentPreview || []);
  const initialContext = imageContext || (
    sizeClass === 'bento-card-large'
      ? 'bento-large'
      : sizeClass === 'bento-card-horizontal'
        ? 'bento-horizontal'
        : 'bento-normal'
  );
  const normalizedDesign = normalizeCardDesignForDisplayRatios(post, {
    sizeClass,
    shapeClass,
    imageContext: initialContext,
  });
  const image = resolveCardImage(post, {
    context: normalizedDesign.imageContext,
    index,
    sessionSeed,
  });
  const cardClasses = ['bento-card', normalizedDesign.sizeClass, normalizedDesign.shapeClass, styleClass]
    .filter(Boolean)
    .join(' ');

  return `
    <article class="${cardClasses}" data-impression-slug="${post.slug}" data-impression-kind="listing-card" onclick="window.location.hash='#/post/${post.slug}'" role="link" tabindex="0" aria-label="Read about ${post.title}">
      <div class="bento-card-image-wrapper">
        <img
          class="bento-card-img"
          src="${image.src}"
          alt="${post.title}"
          loading="lazy"
          ${cropDatasetAttrs(image.crop)}
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

function bindImpressionTracking(root) {
  if (!root || typeof IntersectionObserver === 'undefined') return;
  const targets = root.querySelectorAll('[data-impression-slug]:not([data-impression-bound])');
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.impressionTracked === '1') return;
      el.dataset.impressionTracked = '1';
      trackImpression({
        slug: el.dataset.impressionSlug,
        kind: el.dataset.impressionKind || 'listing-card',
        route: '/',
      });
      obs.unobserve(el);
    });
  }, { threshold: 0.45 });

  targets.forEach((el) => {
    el.dataset.impressionBound = '1';
    observer.observe(el);
  });
}

function resolveCardImage(post, { context = 'bento-normal', index = 0, sessionSeed = '' } = {}) {
  const crops = getCropMap(post);
  const selectedLibraryImage = resolveSelectedLibraryImage(post);
  const sourceImage = selectedLibraryImage
    || resolveFirstLibraryImage(post)
    || (typeof post?.coverImage === 'string' ? post.coverImage.trim() : '');
  const displaySet = getDisplayRatioSet(post);
  const orderByContext = {
    'featured-primary': ['ratio-21-9', 'ratio-16-10', 'ratio-16-9', 'ratio-3-2', 'ratio-4-3', 'ratio-5-4', 'ratio-4-5', 'ratio-1-1', 'ratio-3-4'],
    'featured-secondary': ['ratio-4-5', 'ratio-3-4', 'ratio-5-4', 'ratio-1-1', 'ratio-4-3', 'ratio-3-2', 'ratio-16-9'],
    'bento-large': ['ratio-21-9', 'ratio-16-10', 'ratio-16-9', 'ratio-3-2', 'ratio-4-3', 'ratio-4-5'],
    'bento-horizontal': ['ratio-16-10', 'ratio-16-9', 'ratio-3-2', 'ratio-21-9', 'ratio-4-3', 'ratio-5-4', 'ratio-4-5'],
    'bento-portrait': ['ratio-4-5', 'ratio-3-4', 'ratio-5-4', 'ratio-1-1', 'ratio-4-3', 'ratio-3-2'],
    'bento-tall': ['ratio-3-4', 'ratio-4-5', 'ratio-1-1', 'ratio-5-4', 'ratio-4-3'],
    'bento-square': ['ratio-1-1', 'ratio-5-4', 'ratio-4-5', 'ratio-4-3', 'ratio-3-2'],
    'bento-landscape': ['ratio-4-3', 'ratio-3-2', 'ratio-16-10', 'ratio-16-9', 'ratio-5-4', 'ratio-1-1'],
    'bento-cinematic': ['ratio-21-9', 'ratio-16-9', 'ratio-16-10', 'ratio-3-2', 'ratio-4-3'],
    'bento-normal': index % 2 === 0
      ? ['ratio-4-5', 'ratio-5-4', 'ratio-1-1', 'ratio-3-4', 'ratio-4-3', 'ratio-3-2', 'ratio-16-9']
      : ['ratio-1-1', 'ratio-5-4', 'ratio-4-5', 'ratio-3-4', 'ratio-4-3', 'ratio-3-2', 'ratio-16-9'],
  };
  const order = orderByContext[context] || orderByContext['bento-normal'];
  const enabledOrder = order.filter((key) => displaySet.has(key));
  const candidateOrder = enabledOrder.length
    ? enabledOrder
    : getGlobalDisplayRatioOrder(displaySet, order);

  // 1) Prefer enabled ratios with explicit crop data (what users edited in cropper).
  const cropCandidates = candidateOrder.filter((key) => {
    const cropValue = crops[key];
    return sourceImage && cropValue && typeof cropValue === 'object';
  });
  if (cropCandidates.length) {
    const chosenKey = pickBestCropKey(cropCandidates, candidateOrder, crops);
    const chosenCrop = crops[chosenKey];
    return {
      src: sourceImage,
      crop: chosenCrop && typeof chosenCrop === 'object' ? chosenCrop : null,
    };
  }

  if (sourceImage) {
    return { src: sourceImage, crop: null };
  }
  // Backward compatibility fallback for very old posts with no library/crops.
  if (typeof post?.coverImage === 'string' && post.coverImage.trim()) {
    return { src: post.coverImage.trim(), crop: null };
  }
  return { src: 'https://placehold.co/800x500/E0DCD5/6B6B6B?text=No+Image', crop: null };
}

function getGlobalDisplayRatioOrder(displaySet, preferredOrder = []) {
  const allKeys = [
    'ratio-21-9',
    'ratio-16-9',
    'ratio-16-10',
    'ratio-3-2',
    'ratio-4-3',
    'ratio-5-4',
    'ratio-1-1',
    'ratio-4-5',
    'ratio-3-4',
  ];
  const preferred = Array.isArray(preferredOrder) ? preferredOrder : [];
  const ordered = [...preferred, ...allKeys];
  return [...new Set(ordered)].filter((key) => displaySet.has(key));
}

function getDisplayRatioSet(post) {
  const list = Array.isArray(post?.coverImageDisplayRatios)
    ? post.coverImageDisplayRatios
    : [];
  const normalized = new Set(
    list
      .map((v) => String(v))
      .filter((key) => key !== 'ratio-custom'),
  );
  if (normalized.size) return normalized;
  return new Set(['ratio-16-9']);
}

function normalizeCardDesignForDisplayRatios(
  post,
  { sizeClass = '', shapeClass = '', imageContext = 'bento-normal' } = {},
) {
  const displaySet = getDisplayRatioSet(post);
  let nextShape = shapeClass;
  let nextSize = sizeClass;
  let nextContext = imageContext;

  const allowsUltraWide = displaySet.has('ratio-21-9');
  const allowsLandscape = (
    displaySet.has('ratio-16-9')
    || displaySet.has('ratio-16-10')
    || displaySet.has('ratio-3-2')
    || displaySet.has('ratio-4-3')
  );

  if (!allowsUltraWide && nextShape === 'bento-shape-wide') {
    nextShape = allowsLandscape ? 'bento-shape-landscape' : 'bento-shape-square';
  }
  if (!allowsUltraWide && nextContext === 'bento-cinematic') {
    nextContext = allowsLandscape ? 'bento-landscape' : 'bento-square';
  }
  if (!allowsLandscape && nextShape === 'bento-shape-landscape') {
    nextShape = 'bento-shape-square';
  }
  if (!allowsLandscape && nextContext === 'bento-landscape') {
    nextContext = 'bento-square';
  }
  if (!allowsLandscape && nextSize === 'bento-card-horizontal') {
    nextSize = '';
    if (!nextShape || nextShape === 'bento-shape-landscape' || nextShape === 'bento-shape-wide') {
      nextShape = 'bento-shape-square';
    }
    if (nextContext === 'bento-horizontal' || nextContext === 'bento-landscape' || nextContext === 'bento-cinematic') {
      nextContext = 'bento-square';
    }
  }

  return {
    sizeClass: nextSize,
    shapeClass: nextShape,
    imageContext: nextContext,
  };
}

function getFirstCropMap(root) {
  if (!root || typeof root !== 'object') return {};
  const nestedEntries = Object.entries(root).filter(
    ([key, value]) => !key.startsWith('ratio-') && value && typeof value === 'object',
  );
  if (nestedEntries.length === 1) {
    return nestedEntries[0][1];
  }
  return {};
}

function normalizeCropMap(map) {
  if (!map || typeof map !== 'object') return {};
  return Object.fromEntries(
    Object.entries(map).filter(([key, value]) =>
      key !== 'ratio-custom' && key.startsWith('ratio-') && value && typeof value === 'object',
    ),
  );
}

function getCropMap(post) {
  const root = post?.coverImageCrops && typeof post.coverImageCrops === 'object'
    ? post.coverImageCrops
    : {};
  const selected = getResolvedCoverId(post);
  if (selected && root[selected] && typeof root[selected] === 'object') {
    return normalizeCropMap(root[selected]);
  }
  const first = getFirstCropMap(root);
  return normalizeCropMap(first);
}

function getResolvedCoverId(post) {
  const selected = typeof post?.coverImageSelected === 'string' ? post.coverImageSelected.trim() : '';
  if (selected) return selected;
  if (!Array.isArray(post?.coverImageLibrary)) return '';
  return typeof post.coverImageLibrary[0]?.id === 'string'
    ? post.coverImageLibrary[0].id.trim()
    : '';
}

function resolveSelectedLibraryImage(post) {
  const selected = typeof post?.coverImageSelected === 'string' ? post.coverImageSelected : '';
  if (!Array.isArray(post?.coverImageLibrary)) return '';
  if (selected) {
    const item = post.coverImageLibrary.find((entry) => entry?.id === selected);
    if (typeof item?.src === 'string') return item.src;
  }
  const fallback = post.coverImageLibrary.find(
    (entry) => typeof entry?.src === 'string' && entry.src.trim(),
  );
  return typeof fallback?.src === 'string' ? fallback.src : '';
}

function resolveFirstLibraryImage(post) {
  if (!Array.isArray(post?.coverImageLibrary)) return '';
  const item = post.coverImageLibrary.find((entry) => typeof entry?.src === 'string' && entry.src.trim());
  return item?.src ? String(item.src).trim() : '';
}

function cropDatasetAttrs(crop) {
  if (!crop || typeof crop !== 'object') return '';
  const zoom = Number.parseFloat(String(crop.zoom ?? 1));
  const x = Number.parseFloat(String(crop.offsetXPct ?? 0));
  const y = Number.parseFloat(String(crop.offsetYPct ?? 0));
  const safeZoom = Number.isFinite(zoom) ? Math.min(4, Math.max(0.35, zoom)) : 1;
  const safeX = Number.isFinite(x) ? Math.min(120, Math.max(-120, x)) : 0;
  const safeY = Number.isFinite(y) ? Math.min(120, Math.max(-120, y)) : 0;
  return `data-crop-zoom="${safeZoom}" data-crop-xpct="${safeX}" data-crop-ypct="${safeY}"`;
}

function applyCropTransforms(root) {
  if (!root) return;
  const targets = root.querySelectorAll('img[data-crop-zoom]');
  targets.forEach((img) => {
    const apply = () => {
      const frame = img.parentElement;
      if (!frame) return;
      const frameW = frame.clientWidth || 1;
      const frameH = frame.clientHeight || 1;
      const naturalW = img.naturalWidth || 1;
      const naturalH = img.naturalHeight || 1;
      const zoom = Number.parseFloat(img.dataset.cropZoom || '1') || 1;
      const xpct = Number.parseFloat(img.dataset.cropXpct || '0') || 0;
      const ypct = Number.parseFloat(img.dataset.cropYpct || '0') || 0;
      const baseScale = Math.max(frameW / naturalW, frameH / naturalH);
      const scale = baseScale * zoom;
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;
      let offsetX = (xpct / 100) * drawW;
      let offsetY = (ypct / 100) * drawH;
      const maxX = Math.max((drawW - frameW) / 2, 0);
      const maxY = Math.max((drawH - frameH) / 2, 0);
      offsetX = Math.min(Math.max(offsetX, -maxX), maxX);
      offsetY = Math.min(Math.max(offsetY, -maxY), maxY);

      if (!frame.style.position) frame.style.position = 'relative';
      if (!frame.style.overflow) frame.style.overflow = 'hidden';
      img.style.position = 'absolute';
      img.style.top = '50%';
      img.style.left = '50%';
      img.style.maxWidth = 'none';
      img.style.width = `${naturalW}px`;
      img.style.height = `${naturalH}px`;
      img.style.objectFit = 'unset';
      img.style.transformOrigin = 'center center';
      img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`;
    };
    if (img.complete) apply();
    else img.addEventListener('load', apply, { once: true });
  });
}

function pickBestCropKey(candidates, preferredOrder, cropMap) {
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const rank = new Map(preferredOrder.map((key, i) => [key, i]));
  let bestKey = candidates[0];
  let bestScore = -Infinity;
  let bestRank = Number.POSITIVE_INFINITY;
  candidates.forEach((key) => {
    const score = getCropSelectionWeight(cropMap[key]);
    const orderRank = rank.has(key) ? rank.get(key) : Number.POSITIVE_INFINITY;
    if (score > bestScore || (score === bestScore && orderRank < bestRank)) {
      bestKey = key;
      bestScore = score;
      bestRank = orderRank;
    }
  });
  return bestKey;
}

function getCropSelectionWeight(crop) {
  if (!crop || typeof crop !== 'object') return 1;
  const zoom = Number.parseFloat(String(crop.zoom ?? 1));
  const x = Number.parseFloat(String(crop.offsetXPct ?? 0));
  const y = Number.parseFloat(String(crop.offsetYPct ?? 0));
  const zoomDelta = Number.isFinite(zoom) ? Math.abs(zoom - 1) : 0;
  const xDelta = Number.isFinite(x) ? Math.abs(x) : 0;
  const yDelta = Number.isFinite(y) ? Math.abs(y) : 0;
  const signal = zoomDelta + (xDelta + yDelta) / 30;
  return signal > 0.04 ? 1 + Math.min(4, signal) : 1;
}

function seededRandom(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967296;
  return normalized;
}

function getBentoSessionSeed() {
  try {
    const existing = sessionStorage.getItem(BENTO_SESSION_SEED_KEY);
    if (existing) return existing;
    const created = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    sessionStorage.setItem(BENTO_SESSION_SEED_KEY, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

function buildSessionBentoLayout(count, seedBase) {
  const layout = new Array(Math.max(0, count)).fill(null).map(() => ({
    sizeClass: '',
    shapeClass: '',
    styleClass: '',
    imageContext: 'bento-normal',
  }));
  if (!count) return layout;

  // Ensure one hero-like card appears near the top.
  const heroIndex = Math.min(
    count - 1,
    Math.floor(seededRandom(`${seedBase}|hero-index`) * Math.min(3, count)),
  );
  layout[heroIndex].sizeClass = 'bento-card-large';
  layout[heroIndex].shapeClass = pickWeightedVariant(
    ['bento-shape-landscape', 'bento-shape-wide'],
    [6, 4],
    `${seedBase}|shape|hero`,
  );
  layout[heroIndex].imageContext = layout[heroIndex].shapeClass === 'bento-shape-wide'
    ? 'bento-cinematic'
    : 'bento-large';
  layout[heroIndex].styleClass = pickWeightedVariant(
    ['bento-style-soft', 'bento-style-clean', 'bento-style-pop'],
    [5, 3, 2],
    `${seedBase}|style|hero`,
  );

  let previousShape = layout[heroIndex].shapeClass;
  for (let i = 0; i < count; i += 1) {
    if (layout[i].sizeClass) continue;
    const r = seededRandom(`${seedBase}|slot|${i}`);
    let sizeClass = '';
    if (r > 0.8 && i > 0) {
      sizeClass = 'bento-card-horizontal';
    } else if (r > 0.95 && i > 1) {
      sizeClass = 'bento-card-large';
    }
    const shape = pickShapeForSlot(sizeClass, `${seedBase}|shape|${i}`, previousShape);
    const style = pickWeightedVariant(
      ['bento-style-clean', 'bento-style-soft', 'bento-style-pop'],
      [5, 4, 2],
      `${seedBase}|style|${i}`,
    );
    layout[i] = {
      sizeClass,
      shapeClass: shape,
      styleClass: style,
      imageContext: imageContextFromShape(shape, sizeClass),
    };
    previousShape = shape;
  }

  return layout;
}

function pickShapeForSlot(sizeClass, seed, previousShape = '') {
  const presetsBySize = {
    'bento-card-large': {
      shapes: ['bento-shape-landscape', 'bento-shape-wide', 'bento-shape-square'],
      weights: [6, 4, 1],
    },
    'bento-card-horizontal': {
      shapes: ['bento-shape-landscape', 'bento-shape-wide', 'bento-shape-square'],
      weights: [6, 3, 1],
    },
    normal: {
      shapes: [
        'bento-shape-portrait',
        'bento-shape-tall',
        'bento-shape-square',
        'bento-shape-landscape',
        'bento-shape-wide',
      ],
      weights: [5, 3, 3, 2, 1],
    },
  };
  const preset = presetsBySize[sizeClass] || presetsBySize.normal;

  let shape = pickWeightedVariant(preset.shapes, preset.weights, seed);
  if (previousShape && shape === previousShape && preset.shapes.length > 1) {
    // Nudge away from repeated adjacent card shapes.
    shape = pickWeightedVariant(preset.shapes, preset.weights, `${seed}|retry`);
    if (shape === previousShape) {
      const nextIndex = (preset.shapes.indexOf(shape) + 1) % preset.shapes.length;
      shape = preset.shapes[nextIndex];
    }
  }
  return shape;
}

function imageContextFromShape(shapeClass, sizeClass) {
  if (sizeClass === 'bento-card-large') {
    if (shapeClass === 'bento-shape-wide') return 'bento-cinematic';
    if (shapeClass === 'bento-shape-square') return 'bento-square';
    return 'bento-large';
  }
  if (sizeClass === 'bento-card-horizontal') {
    if (shapeClass === 'bento-shape-wide') return 'bento-cinematic';
    if (shapeClass === 'bento-shape-square') return 'bento-square';
    return 'bento-landscape';
  }
  switch (shapeClass) {
    case 'bento-shape-tall':
      return 'bento-tall';
    case 'bento-shape-square':
      return 'bento-square';
    case 'bento-shape-landscape':
      return 'bento-landscape';
    case 'bento-shape-wide':
      return 'bento-cinematic';
    case 'bento-shape-portrait':
    default:
      return 'bento-portrait';
  }
}

function pickWeightedVariant(options, weights, seed) {
  if (!Array.isArray(options) || !options.length) return '';
  if (options.length === 1) return options[0];
  const safeWeights = Array.isArray(weights) && weights.length === options.length
    ? weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1))
    : options.map(() => 1);
  const total = safeWeights.reduce((sum, w) => sum + w, 0);
  let cursor = seededRandom(seed) * total;
  for (let i = 0; i < options.length; i += 1) {
    cursor -= safeWeights[i];
    if (cursor <= 0) return options[i];
  }
  return options[options.length - 1];
}
