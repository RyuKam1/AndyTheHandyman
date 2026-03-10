/**
 * Admin CMS Page — Blog post builder with live preview
 * Password-gated, supports all content block types with full customization.
 */

import { renderBlogContent } from '../components/blogRenderer.js';
import { updateMeta } from '../utils/seo.js';
import { slugify, uid, showToast } from '../utils/helpers.js';
import { clearCache } from '../store.js';

const ADMIN_KEY_STORAGE = 'ath_admin_api_key';
const ADMIN_DRAFT_STORAGE = 'ath_admin_draft_v1';

let adminApiKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
let isAuthenticated = Boolean(adminApiKey);
let postData = createEmptyPost();
let contentBlocks = [];
let draggedIndex = null;
let hasLoadedDraft = false;
let coverImageSource = '';
let coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
let libraryDragType = null;

function createEmptyPost() {
  return {
    slug: '',
    title: '',
    subtitle: '',
    author: 'Andy',
    category: '',
    tags: '',
    date: new Date().toISOString().split('T')[0],
    coverImage: '',
    excerpt: '',
    featured: '',
    affiliateUrl: '',
    affiliateButtonText: 'Check Price & Availability',
    seoTitle: '',
    seoDescription: '',
  };
}

/**
 * Render the admin page.
 */
export async function renderAdminPage() {
  updateMeta({ title: 'Admin CMS' });
  hydrateDraftOnce();

  if (!isAuthenticated) {
    return renderLoginForm();
  }

  return renderEditor();
}

function renderLoginForm() {
  setTimeout(() => initLogin(), 0);

  return `
    <div class="container">
      <div class="admin-login">
        <div style="font-size: 3rem; margin-bottom: var(--space-md);">🔐</div>
        <h2>Admin Access</h2>
        <p>Enter your publishing API key to manage blog posts.</p>
        <div class="form-group">
          <input type="password" class="form-input" id="admin-password" placeholder="Enter API key" />
        </div>
        <button class="btn btn-primary btn-lg" id="admin-login-btn" style="width: 100%;">
          Sign In
        </button>
        <p id="login-error" style="color: var(--color-danger); margin-top: var(--space-md); display: none;"></p>
      </div>
    </div>
  `;
}

function initLogin() {
  const btn = document.getElementById('admin-login-btn');
  const input = document.getElementById('admin-password');
  const error = document.getElementById('login-error');

  if (!btn) return;

  function attempt() {
    if (input.value.trim().length >= 8) {
      adminApiKey = input.value.trim();
      sessionStorage.setItem(ADMIN_KEY_STORAGE, adminApiKey);
      isAuthenticated = true;
      renderAdminInPlace();
    } else {
      error.textContent = 'Please enter a valid API key.';
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attempt();
  });
}

function renderAdminInPlace() {
  const contentEl = document.querySelector('.page-content');
  if (!contentEl) return;
  contentEl.innerHTML = isAuthenticated ? renderEditor() : renderLoginForm();
}

function hydrateDraftOnce() {
  if (hasLoadedDraft) return;
  hasLoadedDraft = true;

  try {
    const raw = localStorage.getItem(ADMIN_DRAFT_STORAGE);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.postData && parsed?.contentBlocks) {
      postData = { ...createEmptyPost(), ...parsed.postData };
      contentBlocks = Array.isArray(parsed.contentBlocks) ? parsed.contentBlocks : [];
      coverImageSource = postData.coverImage || '';
    }
  } catch (error) {
    console.warn('Admin: failed to restore draft from storage', error);
  }
}

function persistDraft() {
  try {
    localStorage.setItem(
      ADMIN_DRAFT_STORAGE,
      JSON.stringify({ postData, contentBlocks })
    );
  } catch (error) {
    console.warn('Admin: failed to save draft to storage', error);
  }
}

function renderEditor() {
  setTimeout(() => initEditor(), 0);

  return `
    <div class="container admin-page">
      <h2 style="margin-bottom: var(--space-lg);">📝 Create New Post</h2>

      <div class="admin-layout">
        <div class="admin-tools" id="admin-tools">
          <h4 class="admin-tools-title">Block Library</h4>
          <div class="add-block-area">
            <button class="add-block-btn" draggable="true" data-type="heading">➕ Heading</button>
            <button class="add-block-btn" draggable="true" data-type="paragraph">➕ Paragraph</button>
            <button class="add-block-btn" draggable="true" data-type="image">➕ Image</button>
            <button class="add-block-btn" draggable="true" data-type="button">➕ Button</button>
            <button class="add-block-btn" draggable="true" data-type="list">➕ List</button>
            <button class="add-block-btn" draggable="true" data-type="blockquote">➕ Quote</button>
            <button class="add-block-btn" draggable="true" data-type="divider">➕ Divider</button>
            <button class="add-block-btn" draggable="true" data-type="proscons">➕ Pros/Cons</button>
            <button class="add-block-btn" draggable="true" data-type="rating">➕ Rating</button>
            <button class="add-block-btn" draggable="true" data-type="cta">➕ CTA Block</button>
          </div>

          <h4 class="admin-tools-title" style="margin-top: var(--space-lg);">Actions</h4>
          <div class="admin-actions">
            <button class="btn btn-primary" id="btn-publish">🚀 Publish to Database</button>
            <button class="btn btn-primary" id="btn-export">💾 Export JSON</button>
            <button class="btn btn-outline" id="btn-copy">📋 Copy to Clipboard</button>
            <button class="btn btn-outline" id="btn-load">📂 Load JSON</button>
            <button class="btn btn-outline" id="btn-clear" style="color: var(--color-danger);">🗑️ Clear All</button>
          </div>

          <h4 class="admin-tools-title" style="margin-top: var(--space-lg);">Existing Blogs</h4>
          <input type="text" class="form-input form-input-sm" id="admin-posts-search" placeholder="Search by title or slug..." />
          <div class="admin-posts-list" id="admin-posts-list">
            <p class="form-help">Loading posts...</p>
          </div>
          <input type="file" id="file-input" accept=".json" style="display: none;" />
        </div>

        <!-- Editor Pane -->
        <div class="admin-editor" id="admin-editor">

          <!-- Post Info -->
          <div class="admin-section">
            <h3 class="admin-section-title">Post Information</h3>
            <div class="form-group">
              <label class="form-label">Title *</label>
              <input type="text" class="form-input" id="field-title" value="${esc(postData.title)}" placeholder="e.g. Best Cordless Drill for Home Use" />
            </div>
            <div class="form-group">
              <label class="form-label">Subtitle</label>
              <input type="text" class="form-input" id="field-subtitle" value="${esc(postData.subtitle)}" placeholder="A brief tagline" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Author</label>
                <input type="text" class="form-input" id="field-author" value="${esc(postData.author)}" />
              </div>
              <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" id="field-date" value="${postData.date}" />
              </div>
              <div class="form-group">
                <label class="form-label">Featured Rank (1-3)</label>
                <input type="number" class="form-input" id="field-featured" min="1" max="3" value="${postData.featured}" placeholder="Optional" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Category</label>
                <input type="text" class="form-input" id="field-category" value="${esc(postData.category)}" placeholder="e.g. Power Tools" />
              </div>
              <div class="form-group">
                <label class="form-label">Tags (comma-separated)</label>
                <input type="text" class="form-input" id="field-tags" value="${esc(postData.tags)}" placeholder="drill, cordless, diy" />
              </div>
            </div>
          </div>

          <!-- Media -->
          <div class="admin-section">
            <h3 class="admin-section-title">Cover Image & Excerpt</h3>
            <div class="form-group">
              <label class="form-label">Cover Image URL</label>
              <input type="text" class="form-input" id="field-coverImage" value="${esc(postData.coverImage)}" placeholder="https://example.com/image.jpg or cropped image data" />
              <div class="cover-image-actions">
                <button type="button" class="btn btn-outline btn-sm" id="btn-cover-upload">🖼️ Upload & Crop</button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-cover-recrop">✂️ Edit / Re-crop</button>
              </div>
              <input type="file" id="cover-image-file" accept="image/*" style="display: none;" />
              <p class="form-help">Upload from your device, drag to reposition, zoom, and apply crop.</p>
            </div>
            <div class="form-group">
              <label class="form-label">Excerpt</label>
              <textarea class="form-textarea" id="field-excerpt" rows="3" placeholder="Short description shown on cards...">${esc(postData.excerpt)}</textarea>
            </div>
          </div>

          <!-- Affiliate -->
          <div class="admin-section">
            <h3 class="admin-section-title">Affiliate Link</h3>
            <div class="form-group">
              <label class="form-label">Affiliate URL</label>
              <input type="url" class="form-input" id="field-affiliateUrl" value="${esc(postData.affiliateUrl)}" placeholder="https://amazon.com/..." />
            </div>
            <div class="form-group">
              <label class="form-label">Button Text</label>
              <input type="text" class="form-input" id="field-affiliateButtonText" value="${esc(postData.affiliateButtonText)}" />
            </div>
          </div>

          <!-- SEO -->
          <div class="admin-section">
            <h3 class="admin-section-title">SEO Settings</h3>
            <div class="form-group">
              <label class="form-label">SEO Title (optional)</label>
              <input type="text" class="form-input" id="field-seoTitle" value="${esc(postData.seoTitle)}" placeholder="Custom page title for search engines" />
            </div>
            <div class="form-group">
              <label class="form-label">SEO Description (optional)</label>
              <textarea class="form-textarea" id="field-seoDescription" rows="2" placeholder="Custom meta description...">${esc(postData.seoDescription)}</textarea>
            </div>
          </div>

          <!-- Content Blocks -->
          <div class="admin-section">
            <h3 class="admin-section-title">Content Blocks</h3>
            <p class="form-help" style="margin-bottom: var(--space-md);">Drag blocks using the handle to reorder them.</p>
            <div class="block-list" id="block-list"></div>
          </div>
        </div>

        <!-- Preview Pane -->
        <div class="admin-preview" id="admin-preview">
          <h4 style="color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px; font-size: var(--fs-xs); margin-bottom: var(--space-lg);">Live Preview</h4>
          <p class="form-help" style="margin-bottom: var(--space-md);">Tip: hold Ctrl and click any preview block to jump to its editor block.</p>
          <div id="preview-content"></div>
        </div>
      </div>

      <!-- Mobile preview toggle -->
      <button class="preview-toggle btn btn-primary" id="preview-toggle">👁️ Preview</button>

      <div class="image-crop-modal" id="image-crop-modal" aria-hidden="true">
        <div class="image-crop-backdrop" id="image-crop-cancel"></div>
        <div class="image-crop-dialog" role="dialog" aria-modal="true" aria-label="Crop cover image">
          <h3 style="margin-bottom: var(--space-sm);">Crop Cover Image</h3>
          <p class="form-help" style="margin-bottom: var(--space-md);">Drag image to reposition. Use zoom slider for tighter crop.</p>
          <div class="image-crop-frame" id="image-crop-frame">
            <img id="image-crop-img" alt="Crop preview" />
          </div>
          <div class="image-crop-controls">
            <label class="form-label" for="image-crop-zoom">Zoom</label>
            <input id="image-crop-zoom" type="range" min="1" max="3" step="0.01" value="1" />
          </div>
          <div class="image-crop-actions">
            <button type="button" class="btn btn-outline" id="image-crop-reset">Reset</button>
            <button type="button" class="btn btn-outline" id="image-crop-close">Cancel</button>
            <button type="button" class="btn btn-primary" id="image-crop-apply">Apply Crop</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initEditor() {
  const blockList = document.getElementById('block-list');
  const previewContent = document.getElementById('preview-content');
  const addBlockArea = document.querySelector('.add-block-area');
  const coverUploadBtn = document.getElementById('btn-cover-upload');
  const coverRecropBtn = document.getElementById('btn-cover-recrop');
  const coverFileInput = document.getElementById('cover-image-file');
  const coverImageField = document.getElementById('field-coverImage');

  const cropModal = document.getElementById('image-crop-modal');
  const cropFrame = document.getElementById('image-crop-frame');
  const cropImage = document.getElementById('image-crop-img');
  const cropZoom = document.getElementById('image-crop-zoom');
  const cropReset = document.getElementById('image-crop-reset');
  const cropCancel = document.getElementById('image-crop-cancel');
  const cropClose = document.getElementById('image-crop-close');
  const cropApply = document.getElementById('image-crop-apply');
  const postsSearch = document.getElementById('admin-posts-search');
  const postsList = document.getElementById('admin-posts-list');

  if (!blockList) return;

  let cropNaturalWidth = 0;
  let cropNaturalHeight = 0;
  let cropBaseScale = 1;
  let cropDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let insertMenuEventsBound = false;
  let libraryDropIndex = null;
  let postsSearchTimer = null;

  function clampCropOffsets() {
    if (!cropFrame || !cropNaturalWidth || !cropNaturalHeight) return;
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    const drawW = cropNaturalWidth * cropBaseScale * coverCropState.zoom;
    const drawH = cropNaturalHeight * cropBaseScale * coverCropState.zoom;
    const maxX = Math.max((drawW - frameW) / 2, 0);
    const maxY = Math.max((drawH - frameH) / 2, 0);
    coverCropState.offsetX = Math.min(Math.max(coverCropState.offsetX, -maxX), maxX);
    coverCropState.offsetY = Math.min(Math.max(coverCropState.offsetY, -maxY), maxY);
  }

  function renderCropImageTransform() {
    if (!cropImage) return;
    clampCropOffsets();
    const scale = cropBaseScale * coverCropState.zoom;
    cropImage.style.transform = `translate(calc(-50% + ${coverCropState.offsetX}px), calc(-50% + ${coverCropState.offsetY}px)) scale(${scale})`;
  }

  function resetCropState() {
    coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
    if (cropZoom) cropZoom.value = '1';
  }

  function isRemoteImageUrl(value) {
    return /^https?:\/\//i.test((value || '').trim());
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read image blob.'));
      reader.readAsDataURL(blob);
    });
  }

  async function normalizeCropSource(source) {
    const value = String(source || '').trim();
    if (!value) throw new Error('No image source found.');
    if (!isRemoteImageUrl(value)) return value;

    const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(value)}`;
    const res = await fetch(proxiedUrl);
    if (!res.ok) {
      let message = `Failed to fetch image (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        // keep default
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    return blobToDataUrl(blob);
  }

  function closeCropper() {
    if (!cropModal) return;
    cropModal.classList.remove('open');
    cropModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openCropper(sourceUrl, useExistingTransform = false) {
    if (!cropModal || !cropImage || !cropFrame || !cropZoom) return;
    if (!sourceUrl) return;

    if (!useExistingTransform) {
      resetCropState();
    }

    cropImage.onload = () => {
      cropNaturalWidth = cropImage.naturalWidth;
      cropNaturalHeight = cropImage.naturalHeight;
      const frameW = cropFrame.clientWidth || 1;
      const frameH = cropFrame.clientHeight || 1;
      cropBaseScale = Math.max(frameW / cropNaturalWidth, frameH / cropNaturalHeight);
      renderCropImageTransform();
    };
    cropImage.src = sourceUrl;
    cropZoom.value = String(coverCropState.zoom);
    cropModal.classList.add('open');
    cropModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // ---- Sync fields to postData ----
  const fieldIds = ['title', 'subtitle', 'author', 'date', 'featured', 'category', 'tags', 'coverImage', 'excerpt', 'affiliateUrl', 'affiliateButtonText', 'seoTitle', 'seoDescription'];
  fieldIds.forEach(id => {
    const el = document.getElementById(`field-${id}`);
    if (el) {
      el.addEventListener('input', () => {
        postData[id] = el.value;
        if (id === 'coverImage') {
          coverImageSource = el.value.trim() || coverImageSource;
        }
        postData.slug = slugify(postData.title);
        updatePreview();
      });
    }
  });

  if (coverUploadBtn && coverFileInput) {
    coverUploadBtn.addEventListener('click', () => {
      coverFileInput.value = '';
      coverFileInput.click();
    });

    coverFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = typeof ev.target?.result === 'string' ? ev.target.result : '';
        if (!src) return;
        coverImageSource = src;
        resetCropState();
        openCropper(src, false);
      };
      reader.readAsDataURL(file);
    });
  }

  if (coverRecropBtn) {
    coverRecropBtn.addEventListener('click', async () => {
      const source = coverImageSource || postData.coverImage;
      if (!source) {
        showToast('❌ Upload an image first to crop.');
        return;
      }
      try {
        showToast('⏳ Loading image for crop...');
        const normalized = await normalizeCropSource(source);
        coverImageSource = normalized;
        openCropper(normalized, true);
      } catch (error) {
        showToast(`❌ ${error.message}`);
      }
    });
  }

  if (cropZoom) {
    cropZoom.addEventListener('input', () => {
      coverCropState.zoom = Number.parseFloat(cropZoom.value) || 1;
      renderCropImageTransform();
    });
  }

  if (cropReset) {
    cropReset.addEventListener('click', () => {
      resetCropState();
      renderCropImageTransform();
    });
  }

  if (cropCancel) {
    cropCancel.addEventListener('click', closeCropper);
  }

  if (cropClose) {
    cropClose.addEventListener('click', closeCropper);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cropModal?.classList.contains('open')) {
      closeCropper();
    }
  });

  if (cropFrame) {
    cropFrame.addEventListener('mousedown', (e) => {
      if (!cropModal?.classList.contains('open')) return;
      cropDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOriginX = coverCropState.offsetX;
      dragOriginY = coverCropState.offsetY;
      cropFrame.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!cropDragging) return;
      coverCropState.offsetX = dragOriginX + (e.clientX - dragStartX);
      coverCropState.offsetY = dragOriginY + (e.clientY - dragStartY);
      renderCropImageTransform();
    });

    window.addEventListener('mouseup', () => {
      if (!cropDragging) return;
      cropDragging = false;
      cropFrame.classList.remove('dragging');
    });
  }

  if (cropApply) {
    cropApply.addEventListener('click', () => {
      try {
        if (!cropImage || !cropFrame || !cropNaturalWidth || !cropNaturalHeight) {
          showToast('❌ No image loaded for cropping.');
          return;
        }

        clampCropOffsets();

        const frameW = cropFrame.clientWidth;
        const frameH = cropFrame.clientHeight;
        const outputW = 1200;
        const outputH = 675;
        const scale = cropBaseScale * coverCropState.zoom;
        const drawW = cropNaturalWidth * scale;
        const drawH = cropNaturalHeight * scale;
        const centerX = frameW / 2 + coverCropState.offsetX;
        const centerY = frameH / 2 + coverCropState.offsetY;
        const topLeftX = centerX - drawW / 2;
        const topLeftY = centerY - drawH / 2;

        let sx = (0 - topLeftX) / scale;
        let sy = (0 - topLeftY) / scale;
        let sw = frameW / scale;
        let sh = frameH / scale;

        sx = Math.max(0, Math.min(sx, cropNaturalWidth - sw));
        sy = Math.max(0, Math.min(sy, cropNaturalHeight - sh));
        sw = Math.max(1, Math.min(sw, cropNaturalWidth));
        sh = Math.max(1, Math.min(sh, cropNaturalHeight));

        const canvas = document.createElement('canvas');
        canvas.width = outputW;
        canvas.height = outputH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          showToast('❌ Failed to process image crop.');
          return;
        }

        ctx.drawImage(cropImage, sx, sy, sw, sh, 0, 0, outputW, outputH);
        const cropped = canvas.toDataURL('image/jpeg', 0.82);
        if (!cropped || !cropped.startsWith('data:image/')) {
          throw new Error('Crop export failed.');
        }

        postData.coverImage = cropped;
        coverImageSource = cropImage.src;
        if (coverImageField) coverImageField.value = cropped;
        updatePreview();
        closeCropper();
        showToast('✅ Cover image cropped.');
      } catch (error) {
        console.error('Crop apply failed:', error);
        showToast('❌ Crop failed. For external URLs, upload the image file first, then crop.');
      }
    });
  }

  // ---- Add blocks ----
  if (addBlockArea) {
    addBlockArea.querySelectorAll('.add-block-btn').forEach((btn) => {
      btn.addEventListener('dragstart', (e) => {
        libraryDragType = btn.dataset.type || null;
        btn.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', libraryDragType || '');
        }
      });

      btn.addEventListener('dragend', () => {
        libraryDragType = null;
        libraryDropIndex = null;
        btn.classList.remove('dragging');
        clearLibraryDropIndicator();
      });
    });

    addBlockArea.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-block-btn');
      if (!btn) return;
      const type = btn.dataset.type;
      contentBlocks.push(createBlock(type));
      renderBlocks();
      updatePreview();
    });
  }

  if (postsSearch) {
    postsSearch.addEventListener('input', () => {
      clearTimeout(postsSearchTimer);
      postsSearchTimer = setTimeout(() => {
        refreshPostsManager(postsSearch.value || '');
      }, 220);
    });
  }

  if (postsList) {
    postsList.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.admin-post-edit');
      const deleteBtn = e.target.closest('.admin-post-delete');

      if (editBtn) {
        const slug = decodeURIComponent(editBtn.dataset.slug || '');
        if (!slug) return;
        try {
          const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
          if (!res.ok) throw new Error(`Failed to load post (${res.status})`);
          const data = await res.json();
          loadPostData(data);
          showToast(`✏️ Editing: ${data.title || slug}`);
        } catch (error) {
          showToast(`❌ ${error.message || 'Failed to load post'}`);
        }
        return;
      }

      if (deleteBtn) {
        const slug = decodeURIComponent(deleteBtn.dataset.slug || '');
        if (!slug) return;
        if (!confirm(`Delete post "${slug}"? This cannot be undone.`)) return;
        try {
          const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`, {
            method: 'DELETE',
            headers: { 'x-admin-key': adminApiKey },
          });
          if (!res.ok) {
            let msg = `Failed to delete (${res.status})`;
            try {
              const data = await res.json();
              if (data?.error) msg = data.error;
            } catch {
              // keep fallback
            }
            throw new Error(msg);
          }
          clearCache();
          showToast('🗑️ Post deleted');
          await refreshPostsManager(postsSearch?.value || '');
          if ((postData.slug || slugify(postData.title)) === slug) {
            postData = createEmptyPost();
            contentBlocks = [];
            coverImageSource = '';
            renderAdminInPlace();
          }
        } catch (error) {
          showToast(`❌ ${error.message || 'Delete failed'}`);
        }
      }
    });
  }

  // ---- Render blocks ----
  function renderBlocks() {
    blockList.innerHTML = contentBlocks.map((block, i) => renderBlockEditor(block, i)).join('');
    attachBlockEvents();
  }

  function getDropInsertIndex(e) {
    const targetItem = e.target.closest('.block-item');
    if (!targetItem) return contentBlocks.length;
    const idx = parseInt(targetItem.dataset.index, 10);
    const rect = targetItem.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
  }

  function getInsertIndexFromPointer(clientY) {
    const items = Array.from(blockList.querySelectorAll('.block-item'));
    if (!items.length) return 0;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return items.length;
  }

  function clearLinkedSelection() {
    blockList.querySelectorAll('.block-item.linked-selected').forEach((el) => el.classList.remove('linked-selected'));
    previewContent?.querySelectorAll('.preview-block-anchor.linked-selected').forEach((el) => el.classList.remove('linked-selected'));
  }

  function renderPostsManager(items = [], query = '') {
    if (!postsList) return;
    if (!items.length) {
      postsList.innerHTML = `<p class="form-help">No posts found${query ? ` for "${esc(query)}"` : ''}.</p>`;
      return;
    }
    postsList.innerHTML = items.map((post) => `
      <div class="admin-post-row">
        <div class="admin-post-meta">
          <strong>${esc(post.title || post.slug)}</strong>
          <span>${esc(post.slug)}</span>
        </div>
        <div class="admin-post-actions">
          <button class="btn btn-outline btn-sm admin-post-edit" data-slug="${encodeURIComponent(post.slug)}">Edit</button>
          <button class="btn btn-outline btn-sm admin-post-delete" data-slug="${encodeURIComponent(post.slug)}" style="color: var(--color-danger);">Delete</button>
        </div>
      </div>
    `).join('');
  }

  async function refreshPostsManager(searchQuery = '') {
    if (!postsList) return;
    try {
      const params = new URLSearchParams({ limit: '100', sort: 'newest' });
      if (searchQuery.trim()) params.set('query', searchQuery.trim());
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const items = await res.json();
      renderPostsManager(Array.isArray(items) ? items : [], searchQuery);
    } catch (error) {
      postsList.innerHTML = `<p class="form-help" style="color: var(--color-danger);">${esc(error.message || 'Failed to load posts')}</p>`;
    }
  }

  function focusEditorBlock(index) {
    const blockEl = blockList.querySelector(`.block-item[data-index="${index}"]`);
    if (!blockEl) return;
    clearLinkedSelection();
    blockEl.classList.add('linked-selected');
    blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const firstField = blockEl.querySelector('input, textarea, select');
    if (firstField) {
      setTimeout(() => firstField.focus(), 180);
    }
  }

  function showLibraryDropIndicator(insertIndex) {
    blockList.querySelectorAll('.block-item').forEach((el) => {
      el.classList.remove('insert-before');
      el.classList.remove('insert-after');
    });

    const items = Array.from(blockList.querySelectorAll('.block-item'));
    if (!items.length) {
      blockList.classList.add('insert-empty');
      return;
    }

    blockList.classList.remove('insert-empty');
    if (insertIndex <= 0) {
      items[0].classList.add('insert-before');
    } else if (insertIndex >= items.length) {
      items[items.length - 1].classList.add('insert-after');
    } else {
      items[insertIndex].classList.add('insert-before');
    }
  }

  function clearLibraryDropIndicator() {
    blockList.classList.remove('insert-empty');
    blockList.classList.remove('library-drop-active');
    blockList.querySelectorAll('.block-item').forEach((el) => {
      el.classList.remove('insert-before');
      el.classList.remove('insert-after');
    });
  }

  function attachBlockEvents() {
    // Delete buttons
    blockList.querySelectorAll('.block-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        contentBlocks.splice(idx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll('.block-insert-trigger').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.index;
        const menu = blockList.querySelector(`.block-insert-menu[data-index="${idx}"]`);
        if (!menu) return;
        blockList.querySelectorAll('.block-insert-menu').forEach((m) => {
          if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
    });

    blockList.querySelectorAll('.block-insert-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const insertAfter = parseInt(btn.dataset.insertIndex, 10);
        const type = btn.dataset.type;
        if (Number.isNaN(insertAfter) || !type) return;
        contentBlocks.splice(insertAfter + 1, 0, createBlock(type));
        renderBlocks();
        updatePreview();
      });
    });

    // Move up/down
    blockList.querySelectorAll('.block-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        if (idx > 0) {
          [contentBlocks[idx - 1], contentBlocks[idx]] = [contentBlocks[idx], contentBlocks[idx - 1]];
          renderBlocks();
          updatePreview();
        }
      });
    });

    blockList.querySelectorAll('.block-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        if (idx < contentBlocks.length - 1) {
          [contentBlocks[idx], contentBlocks[idx + 1]] = [contentBlocks[idx + 1], contentBlocks[idx]];
          renderBlocks();
          updatePreview();
        }
      });
    });

    // Input changes
    blockList.querySelectorAll('[data-block-field]').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.blockIndex);
        const field = input.dataset.blockField;
        contentBlocks[idx][field] = input.value;
        updatePreview();
      });
    });

    // Drag & drop
    blockList.querySelectorAll('.block-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        blockList.querySelectorAll('.block-item').forEach(el => el.classList.remove('drop-target'));
        draggedIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = libraryDragType ? 'copy' : 'move';
        if (libraryDragType) {
          libraryDropIndex = getInsertIndexFromPointer(e.clientY);
          showLibraryDropIndicator(libraryDropIndex);
        }
      });

      item.addEventListener('dragenter', () => {
        if (draggedIndex !== null && draggedIndex !== parseInt(item.dataset.index, 10)) {
          item.classList.add('drop-target');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drop-target');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drop-target');
        if (libraryDragType) {
          const insertIdx = libraryDropIndex ?? getDropInsertIndex(e);
          contentBlocks.splice(insertIdx, 0, createBlock(libraryDragType));
          libraryDropIndex = null;
          clearLibraryDropIndicator();
          renderBlocks();
          updatePreview();
          return;
        }
        const targetIdx = parseInt(item.dataset.index);
        if (draggedIndex !== null && draggedIndex !== targetIdx) {
          const dragged = contentBlocks.splice(draggedIndex, 1)[0];
          contentBlocks.splice(targetIdx, 0, dragged);
          renderBlocks();
          updatePreview();
        }
      });
    });

    if (!insertMenuEventsBound) {
      document.addEventListener('click', () => {
        blockList.querySelectorAll('.block-insert-menu').forEach((m) => m.classList.remove('open'));
      });
      insertMenuEventsBound = true;
    }

    blockList.querySelectorAll('.block-insert-menu').forEach((menu) => {
      menu.addEventListener('click', (e) => e.stopPropagation());
    });

    // List item management
    blockList.querySelectorAll('.list-add-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.blockIndex);
        if (!contentBlocks[idx].items) contentBlocks[idx].items = [];
        contentBlocks[idx].items.push('');
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll('.list-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const blockIdx = parseInt(btn.dataset.blockIndex);
        const itemIdx = parseInt(btn.dataset.itemIndex);
        contentBlocks[blockIdx].items.splice(itemIdx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll('[data-list-item]').forEach(input => {
      input.addEventListener('input', () => {
        const blockIdx = parseInt(input.dataset.blockIndex);
        const itemIdx = parseInt(input.dataset.itemIndex);
        contentBlocks[blockIdx].items[itemIdx] = input.value;
        updatePreview();
      });
    });

    // Pros/cons item management
    blockList.querySelectorAll('.proscons-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.blockIndex);
        const list = btn.dataset.list; // 'pros' or 'cons'
        if (!contentBlocks[idx][list]) contentBlocks[idx][list] = [];
        contentBlocks[idx][list].push('');
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll('.proscons-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const blockIdx = parseInt(btn.dataset.blockIndex);
        const list = btn.dataset.list;
        const itemIdx = parseInt(btn.dataset.itemIndex);
        contentBlocks[blockIdx][list].splice(itemIdx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll('[data-proscons-item]').forEach(input => {
      input.addEventListener('input', () => {
        const blockIdx = parseInt(input.dataset.blockIndex);
        const list = input.dataset.list;
        const itemIdx = parseInt(input.dataset.itemIndex);
        contentBlocks[blockIdx][list][itemIdx] = input.value;
        updatePreview();
      });
    });
  }

  blockList.addEventListener('dragover', (e) => {
    if (!libraryDragType) return;
    e.preventDefault();
    blockList.classList.add('library-drop-active');
    libraryDropIndex = getInsertIndexFromPointer(e.clientY);
    showLibraryDropIndicator(libraryDropIndex);
  });

  blockList.addEventListener('dragleave', (e) => {
    if (!libraryDragType) return;
    if (!blockList.contains(e.relatedTarget)) {
      libraryDropIndex = null;
      clearLibraryDropIndicator();
    }
  });

  blockList.addEventListener('drop', (e) => {
    if (!libraryDragType) return;
    e.preventDefault();
    const insertIdx = libraryDropIndex ?? getDropInsertIndex(e);
    contentBlocks.splice(insertIdx, 0, createBlock(libraryDragType));
    libraryDragType = null;
    libraryDropIndex = null;
    clearLibraryDropIndicator();
    renderBlocks();
    updatePreview();
  });

  previewContent?.addEventListener('click', (e) => {
    if (!e.ctrlKey) return;
    const anchor = e.target.closest('[data-preview-block-index]');
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = Number.parseInt(anchor.dataset.previewBlockIndex || '', 10);
    if (Number.isNaN(idx)) return;
    clearLinkedSelection();
    anchor.classList.add('linked-selected');
    focusEditorBlock(idx);
  });

  // ---- Update preview ----
  function updatePreview() {
    if (!previewContent) return;
    let html = '';
    const previewCover = postData.coverImage || coverImageSource;

    if (previewCover) {
      html += `<img class="post-hero-image" src="${previewCover}" alt="${esc(postData.title)}" style="max-height: 200px; width: 100%; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-md);" />`;
    }
    if (postData.title) {
      html += `<h2 style="font-size: var(--fs-xl); margin-bottom: var(--space-sm);">${esc(postData.title)}</h2>`;
    }
    if (postData.subtitle) {
      html += `<p style="color: var(--color-text-secondary); margin-bottom: var(--space-md);">${esc(postData.subtitle)}</p>`;
    }

    const previewBlocks = contentBlocks
      .map((block, idx) => `<div class="preview-block-anchor" data-preview-block-index="${idx}">${renderBlogContent([block])}</div>`)
      .join('');
    html += `<div class="blog-content">${previewBlocks}</div>`;

    if (postData.affiliateUrl) {
      html += `
        <div class="cta-block" style="margin-top: var(--space-xl);">
          <a href="${postData.affiliateUrl}" class="btn btn-affiliate" target="_blank" rel="noopener noreferrer">
            ${esc(postData.affiliateButtonText) || 'Check Price'}
          </a>
        </div>
      `;
    }

    previewContent.innerHTML = html;
    persistDraft();
  }

  // ---- Export JSON ----
  document.getElementById('btn-publish')?.addEventListener('click', async () => {
    const payload = buildJSON();
    if (!payload.title) {
      showToast('❌ Title is required before publishing.');
      return;
    }

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = 'Publish failed. Verify API key and try again.';
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // Use fallback
        }
        throw new Error(message);
      }

      clearCache();
      await refreshPostsManager(postsSearch?.value || '');
      showToast('✅ Published to database successfully!');
    } catch (error) {
      showToast(`❌ ${error.message}`);
    }
  });

  // ---- Export JSON ----
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const json = buildJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${postData.slug || 'post'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ JSON file downloaded!');
  });

  // ---- Copy JSON ----
  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    const json = buildJSON();
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      showToast('📋 Copied to clipboard!');
    } catch {
      showToast('❌ Failed to copy. Try the export button.');
    }
  });

  // ---- Load JSON ----
  document.getElementById('btn-load')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadPostData(data);
        showToast('✅ Post loaded successfully!');
      } catch {
        showToast('❌ Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });

  // ---- Clear ----
  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear everything?')) {
      postData = createEmptyPost();
      contentBlocks = [];
      coverImageSource = '';
      coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
      localStorage.removeItem(ADMIN_DRAFT_STORAGE);
      renderAdminInPlace();
    }
  });

  // ---- Mobile preview toggle ----
  const previewToggle = document.getElementById('preview-toggle');
  const previewPane = document.getElementById('admin-preview');
  if (previewToggle && previewPane) {
    previewToggle.addEventListener('click', () => {
      const isVisible = previewPane.classList.contains('visible');
      previewPane.classList.toggle('visible');
      previewToggle.textContent = isVisible ? '👁️ Preview' : '✏️ Editor';
    });
  }

  // Initial render
  refreshPostsManager();
  renderBlocks();
  updatePreview();
}

function loadPostData(data) {
  postData = {
    ...createEmptyPost(),
    slug: data.slug || '',
    title: data.title || '',
    subtitle: data.subtitle || '',
    author: data.author || 'Andy',
    category: data.category || '',
    tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
    date: data.date || new Date().toISOString().split('T')[0],
    featured: data.featured || '',
    coverImage: data.coverImage || '',
    excerpt: data.excerpt || '',
    affiliateUrl: data.affiliateUrl || '',
    affiliateButtonText: data.affiliateButtonText || 'Check Price & Availability',
    seoTitle: data.seoTitle || '',
    seoDescription: data.seoDescription || '',
  };
  contentBlocks = Array.isArray(data.content) ? data.content : [];
  coverImageSource = postData.coverImage || '';
  coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
  persistDraft();
  renderAdminInPlace();
}

function buildJSON() {
  const slug = slugify(postData.title) || 'untitled';
  return {
    slug,
    title: postData.title,
    subtitle: postData.subtitle,
    author: postData.author,
    category: postData.category,
    tags: postData.tags.split(',').map(t => t.trim()).filter(Boolean),
    date: postData.date,
    featured: postData.featured ? parseInt(postData.featured, 10) : null,
    coverImage: postData.coverImage,
    excerpt: postData.excerpt,
    affiliateUrl: postData.affiliateUrl,
    affiliateButtonText: postData.affiliateButtonText,
    seoTitle: postData.seoTitle,
    seoDescription: postData.seoDescription,
    content: contentBlocks,
    contentPreview: contentBlocks.filter(b => b.type === 'paragraph').slice(0, 3),
  };
}

function createBlock(type) {
  const base = { id: uid(), type };
  switch (type) {
    case 'heading':
      return { ...base, text: '', level: 2, color: '', fontSize: '' };
    case 'paragraph':
      return { ...base, text: '', color: '', fontSize: '', textAlign: '' };
    case 'image':
      return { ...base, src: '', alt: '', caption: '', width: '', align: 'center' };
    case 'button':
      return { ...base, text: 'Learn More', url: '', bgColor: '', textColor: '', size: '', align: 'center' };
    case 'list':
      return { ...base, items: [''], ordered: false };
    case 'blockquote':
      return { ...base, text: '', cite: '' };
    case 'divider':
      return { ...base, style: '' };
    case 'proscons':
      return { ...base, pros: [''], cons: [''] };
    case 'rating':
      return { ...base, value: 4, max: 5, label: '' };
    case 'cta':
      return { ...base, heading: '', text: '', url: '', buttonText: 'Check Price', bgColor: '', textColor: '' };
    default:
      return base;
  }
}

function renderBlockEditor(block, index) {
  const typeLabels = {
    heading: '📝 Heading',
    paragraph: '📄 Paragraph',
    image: '🖼️ Image',
    button: '🔘 Button',
    list: '📋 List',
    blockquote: '💬 Blockquote',
    divider: '➖ Divider',
    proscons: '👍👎 Pros/Cons',
    rating: '⭐ Star Rating',
    cta: '🎯 CTA Block',
  };

  let fields = '';

  switch (block.type) {
    case 'heading':
      fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Text</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="text" value="${esc(block.text)}" placeholder="Heading text" />
          </div>
          <div class="form-group">
            <label class="form-label">Level</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="level">
              <option value="2" ${block.level == 2 ? 'selected' : ''}>H2</option>
              <option value="3" ${block.level == 3 ? 'selected' : ''}>H3</option>
              <option value="4" ${block.level == 4 ? 'selected' : ''}>H4</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Color</label>
              <input type="color" data-block-index="${index}" data-block-field="color" value="${block.color || '#2C2C2C'}" />
              <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="color" value="${esc(block.color)}" placeholder="#2C2C2C" style="max-width: 100px;" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Font Size</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="fontSize" value="${esc(block.fontSize)}" placeholder="e.g. 1.5rem" />
          </div>
        </div>
      `;
      break;

    case 'paragraph':
      fields = `
        <div class="form-group">
          <label class="form-label">Text</label>
          <textarea class="form-textarea form-input-sm" data-block-index="${index}" data-block-field="text" rows="3" placeholder="Paragraph text...">${esc(block.text)}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Color</label>
              <input type="color" data-block-index="${index}" data-block-field="color" value="${block.color || '#2C2C2C'}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Font Size</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="fontSize" value="${esc(block.fontSize)}" placeholder="e.g. 1rem" />
          </div>
          <div class="form-group">
            <label class="form-label">Text Align</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="textAlign">
              <option value="" ${!block.textAlign ? 'selected' : ''}>Default</option>
              <option value="left" ${block.textAlign === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${block.textAlign === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${block.textAlign === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'image':
      fields = `
        <div class="form-group">
          <label class="form-label">Image URL</label>
          <input type="url" class="form-input form-input-sm" data-block-index="${index}" data-block-field="src" value="${esc(block.src)}" placeholder="https://..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Alt Text</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="alt" value="${esc(block.alt)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Caption</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="caption" value="${esc(block.caption)}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Width</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="width" value="${esc(block.width)}" placeholder="e.g. 100% or 400px" />
          </div>
          <div class="form-group">
            <label class="form-label">Alignment</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="align">
              <option value="center" ${block.align === 'center' ? 'selected' : ''}>Center</option>
              <option value="left" ${block.align === 'left' ? 'selected' : ''}>Left</option>
              <option value="right" ${block.align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'button':
      fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Button Text</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="text" value="${esc(block.text)}" />
          </div>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="url" class="form-input form-input-sm" data-block-index="${index}" data-block-field="url" value="${esc(block.url)}" placeholder="https://..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">BG Color</label>
              <input type="color" data-block-index="${index}" data-block-field="bgColor" value="${block.bgColor || '#D4923A'}" />
            </div>
          </div>
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Text Color</label>
              <input type="color" data-block-index="${index}" data-block-field="textColor" value="${block.textColor || '#FFFFFF'}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Size</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="size">
              <option value="" ${!block.size ? 'selected' : ''}>Default</option>
              <option value="small" ${block.size === 'small' ? 'selected' : ''}>Small</option>
              <option value="large" ${block.size === 'large' ? 'selected' : ''}>Large</option>
            </select>
          </div>
        </div>
      `;
      break;

    case 'list':
      const listItems = (block.items || []).map((item, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-list-item data-block-index="${index}" data-item-index="${ii}" value="${esc(item)}" placeholder="List item" style="flex: 1;" />
          <button class="block-action-btn delete list-remove-item" data-block-index="${index}" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `).join('');

      fields = `
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="ordered">
            <option value="false" ${!block.ordered ? 'selected' : ''}>Bulleted</option>
            <option value="true" ${block.ordered ? 'selected' : ''}>Numbered</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Items</label>
          ${listItems}
          <button class="btn btn-sm btn-outline list-add-item" data-block-index="${index}">+ Add Item</button>
        </div>
      `;
      break;

    case 'blockquote':
      fields = `
        <div class="form-group">
          <label class="form-label">Quote Text</label>
          <textarea class="form-textarea form-input-sm" data-block-index="${index}" data-block-field="text" rows="2">${esc(block.text)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Attribution</label>
          <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="cite" value="${esc(block.cite)}" placeholder="Who said it?" />
        </div>
      `;
      break;

    case 'divider':
      fields = `
        <div class="form-group">
          <label class="form-label">Style</label>
          <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="style">
            <option value="" ${!block.style ? 'selected' : ''}>Simple line</option>
            <option value="dotted" ${block.style === 'dotted' ? 'selected' : ''}>Dotted</option>
            <option value="thick" ${block.style === 'thick' ? 'selected' : ''}>Thick gradient</option>
          </select>
        </div>
      `;
      break;

    case 'proscons':
      const prosItems = (block.pros || []).map((p, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-proscons-item data-block-index="${index}" data-list="pros" data-item-index="${ii}" value="${esc(p)}" placeholder="Pro..." style="flex: 1;" />
          <button class="block-action-btn delete proscons-remove" data-block-index="${index}" data-list="pros" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `).join('');

      const consItems = (block.cons || []).map((c, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-proscons-item data-block-index="${index}" data-list="cons" data-item-index="${ii}" value="${esc(c)}" placeholder="Con..." style="flex: 1;" />
          <button class="block-action-btn delete proscons-remove" data-block-index="${index}" data-list="cons" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `).join('');

      fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pros</label>
            ${prosItems}
            <button class="btn btn-sm btn-outline proscons-add" data-block-index="${index}" data-list="pros">+ Add Pro</button>
          </div>
          <div class="form-group">
            <label class="form-label">Cons</label>
            ${consItems}
            <button class="btn btn-sm btn-outline proscons-add" data-block-index="${index}" data-list="cons">+ Add Con</button>
          </div>
        </div>
      `;
      break;

    case 'rating':
      fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Rating Value</label>
            <input type="number" class="form-input form-input-sm" data-block-index="${index}" data-block-field="value" value="${block.value}" min="0" max="${block.max || 5}" step="0.5" />
          </div>
          <div class="form-group">
            <label class="form-label">Max Stars</label>
            <input type="number" class="form-input form-input-sm" data-block-index="${index}" data-block-field="max" value="${block.max}" min="1" max="10" />
          </div>
          <div class="form-group">
            <label class="form-label">Label</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="label" value="${esc(block.label)}" placeholder="e.g. Excellent!" />
          </div>
        </div>
      `;
      break;

    case 'cta':
      fields = `
        <div class="form-group">
          <label class="form-label">Heading</label>
          <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="heading" value="${esc(block.heading)}" placeholder="Ready to buy?" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea form-input-sm" data-block-index="${index}" data-block-field="text" rows="2" placeholder="Short persuasive text">${esc(block.text)}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Button Text</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="buttonText" value="${esc(block.buttonText)}" />
          </div>
          <div class="form-group">
            <label class="form-label">URL</label>
            <input type="url" class="form-input form-input-sm" data-block-index="${index}" data-block-field="url" value="${esc(block.url)}" placeholder="https://..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">BG Color</label>
              <input type="color" data-block-index="${index}" data-block-field="bgColor" value="${block.bgColor || '#D4923A'}" />
            </div>
          </div>
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Text Color</label>
              <input type="color" data-block-index="${index}" data-block-field="textColor" value="${block.textColor || '#FFFFFF'}" />
            </div>
          </div>
        </div>
      `;
      break;
  }

  return `
    <div class="block-item" data-index="${index}" draggable="true">
      <div class="block-header">
        <span class="block-type-label">
          <span class="block-drag-handle" title="Drag to reorder">⠿</span>
          ${typeLabels[block.type] || block.type}
        </span>
        <div class="block-actions">
          <button class="block-action-btn block-move-up" data-index="${index}" title="Move up">↑</button>
          <button class="block-action-btn block-move-down" data-index="${index}" title="Move down">↓</button>
          <button class="block-action-btn delete block-delete" data-index="${index}" title="Delete">✕</button>
        </div>
      </div>
      ${fields}
      <div class="block-insert-row">
        <button class="block-insert-trigger" data-index="${index}" title="Insert block below">＋</button>
        <div class="block-insert-menu" data-index="${index}">
          ${renderInsertButtons(index)}
        </div>
      </div>
    </div>
  `;
}

function renderInsertButtons(index) {
  const types = [
    ['heading', 'Heading'],
    ['paragraph', 'Paragraph'],
    ['image', 'Image'],
    ['button', 'Button'],
    ['list', 'List'],
    ['blockquote', 'Quote'],
    ['divider', 'Divider'],
    ['proscons', 'Pros/Cons'],
    ['rating', 'Rating'],
    ['cta', 'CTA'],
  ];

  return types
    .map(([type, label]) => `<button class="block-insert-btn" data-insert-index="${index}" data-type="${type}">+ ${label}</button>`)
    .join('');
}
