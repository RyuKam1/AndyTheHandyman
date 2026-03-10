/**
 * Admin CMS Page — Blog post builder with live preview
 * Password-gated, supports all content block types with full customization.
 */

import { renderBlogContent } from '../components/blogRenderer.js';
import { updateMeta } from '../utils/seo.js';
import { slugify, uid, showToast } from '../utils/helpers.js';

// Simple admin password (SHA-256 hash of "andyhandyman2024")
const ADMIN_HASH = '8c4f2e2f1e9a3b4d5c6a7b8e9f0a1b2c'; // placeholder — we'll use plain compare for simplicity
const ADMIN_PASS = 'andyhandyman2024';

let isAuthenticated = false;
let postData = createEmptyPost();
let contentBlocks = [];
let draggedIndex = null;

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
        <p>Enter your admin password to manage blog posts.</p>
        <div class="form-group">
          <input type="password" class="form-input" id="admin-password" placeholder="Enter password" />
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
    if (input.value === ADMIN_PASS) {
      isAuthenticated = true;
      window.location.hash = '#/admin';
    } else {
      error.textContent = 'Incorrect password. Try again.';
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

function renderEditor() {
  setTimeout(() => initEditor(), 0);

  return `
    <div class="container admin-page">
      <h2 style="margin-bottom: var(--space-lg);">📝 Create New Post</h2>

      <div class="admin-layout">
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
              <input type="url" class="form-input" id="field-coverImage" value="${esc(postData.coverImage)}" placeholder="https://example.com/image.jpg" />
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
            <div class="block-list" id="block-list"></div>

            <div class="add-block-area" style="margin-top: var(--space-md);">
              <button class="add-block-btn" data-type="heading">➕ Heading</button>
              <button class="add-block-btn" data-type="paragraph">➕ Paragraph</button>
              <button class="add-block-btn" data-type="image">➕ Image</button>
              <button class="add-block-btn" data-type="button">➕ Button</button>
              <button class="add-block-btn" data-type="list">➕ List</button>
              <button class="add-block-btn" data-type="blockquote">➕ Quote</button>
              <button class="add-block-btn" data-type="divider">➕ Divider</button>
              <button class="add-block-btn" data-type="proscons">➕ Pros/Cons</button>
              <button class="add-block-btn" data-type="rating">➕ Rating</button>
              <button class="add-block-btn" data-type="cta">➕ CTA Block</button>
            </div>
          </div>

          <!-- Actions -->
          <div class="admin-actions">
            <button class="btn btn-primary" id="btn-export">💾 Export JSON</button>
            <button class="btn btn-outline" id="btn-copy">📋 Copy to Clipboard</button>
            <button class="btn btn-outline" id="btn-load">📂 Load JSON</button>
            <button class="btn btn-outline" id="btn-clear" style="color: var(--color-danger);">🗑️ Clear All</button>
            <input type="file" id="file-input" accept=".json" style="display: none;" />
          </div>
        </div>

        <!-- Preview Pane -->
        <div class="admin-preview" id="admin-preview">
          <h4 style="color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px; font-size: var(--fs-xs); margin-bottom: var(--space-lg);">Live Preview</h4>
          <div id="preview-content"></div>
        </div>
      </div>

      <!-- Mobile preview toggle -->
      <button class="preview-toggle btn btn-primary" id="preview-toggle">👁️ Preview</button>
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

  if (!blockList) return;

  // ---- Sync fields to postData ----
  const fieldIds = ['title', 'subtitle', 'author', 'date', 'category', 'tags', 'coverImage', 'excerpt', 'affiliateUrl', 'affiliateButtonText', 'seoTitle', 'seoDescription'];
  fieldIds.forEach(id => {
    const el = document.getElementById(`field-${id}`);
    if (el) {
      el.addEventListener('input', () => {
        postData[id] = el.value;
        postData.slug = slugify(postData.title);
        updatePreview();
      });
    }
  });

  // ---- Add blocks ----
  addBlockArea.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-block-btn');
    if (!btn) return;
    const type = btn.dataset.type;
    contentBlocks.push(createBlock(type));
    renderBlocks();
    updatePreview();
  });

  // ---- Render blocks ----
  function renderBlocks() {
    blockList.innerHTML = contentBlocks.map((block, i) => renderBlockEditor(block, i)).join('');
    attachBlockEvents();
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
        draggedIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = parseInt(item.dataset.index);
        if (draggedIndex !== null && draggedIndex !== targetIdx) {
          const dragged = contentBlocks.splice(draggedIndex, 1)[0];
          contentBlocks.splice(targetIdx, 0, dragged);
          renderBlocks();
          updatePreview();
        }
      });
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

  // ---- Update preview ----
  function updatePreview() {
    if (!previewContent) return;
    let html = '';

    if (postData.coverImage) {
      html += `<img class="post-hero-image" src="${postData.coverImage}" alt="${esc(postData.title)}" style="max-height: 200px; width: 100%; object-fit: cover; border-radius: var(--radius-md); margin-bottom: var(--space-md);" />`;
    }
    if (postData.title) {
      html += `<h2 style="font-size: var(--fs-xl); margin-bottom: var(--space-sm);">${esc(postData.title)}</h2>`;
    }
    if (postData.subtitle) {
      html += `<p style="color: var(--color-text-secondary); margin-bottom: var(--space-md);">${esc(postData.subtitle)}</p>`;
    }

    html += `<div class="blog-content">${renderBlogContent(contentBlocks)}</div>`;

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
  }

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
      // Re-render entire admin
      window.location.hash = '#/admin';
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
    coverImage: data.coverImage || '',
    excerpt: data.excerpt || '',
    affiliateUrl: data.affiliateUrl || '',
    affiliateButtonText: data.affiliateButtonText || 'Check Price & Availability',
    seoTitle: data.seoTitle || '',
    seoDescription: data.seoDescription || '',
  };
  contentBlocks = Array.isArray(data.content) ? data.content : [];
  // Trigger re-render
  window.location.hash = '#/admin';
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
        <span class="block-type-label">⠿ ${typeLabels[block.type] || block.type}</span>
        <div class="block-actions">
          <button class="block-action-btn block-move-up" data-index="${index}" title="Move up">↑</button>
          <button class="block-action-btn block-move-down" data-index="${index}" title="Move down">↓</button>
          <button class="block-action-btn delete block-delete" data-index="${index}" title="Delete">✕</button>
        </div>
      </div>
      ${fields}
    </div>
  `;
}
