/**
 * Admin CMS Page — Blog post builder with live preview
 * Password-gated, supports all content block types with full customization.
 */

import { renderBlogContent } from "../components/blogRenderer.js";
import { updateMeta } from "../utils/seo.js";
import { slugify, uid, showToast } from "../utils/helpers.js";
import { clearCache } from "../store.js";

const ADMIN_KEY_STORAGE = "ath_admin_api_key";
const ADMIN_AUTH_STORAGE = "ath_admin_auth";
const ADMIN_DRAFT_STORAGE = "ath_admin_draft_v1";
const ADMIN_MOBILE_VIEW_TAB_STORAGE = "ath_admin_mobile_view_tab";
const ADMIN_PAGE_PASSWORD = "handyandy10010";

let adminApiKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
let isAuthenticated = sessionStorage.getItem(ADMIN_AUTH_STORAGE) === "1";
let postData = createEmptyPost();
let contentBlocks = [];
let draggedIndex = null;
let hasLoadedDraft = false;
let coverImageSource = "";
let coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
let coverCropStatesByRatio = {};
let activeCropRatio = "ratio-16-9";
let libraryDragType = null;
let cleanupEditorListeners = () => {};
let lastDraftSavedAt = 0;
let currentCropSourceKey = "";
let coverCropEditorStateBySource = {};
let coverCropEditorActiveRatio = "ratio-16-9";
const COVER_RATIOS = {
  "ratio-custom": { label: "Custom", aspect: 16 / 9, width: 1600, height: 900 },
  "ratio-3-2": { label: "3:2", aspect: 3 / 2, width: 1800, height: 1200 },
  "ratio-4-3": { label: "4:3", aspect: 4 / 3, width: 1600, height: 1200 },
  "ratio-5-4": { label: "5:4", aspect: 5 / 4, width: 1500, height: 1200 },
  "ratio-16-10": { label: "16:10", aspect: 16 / 10, width: 1600, height: 1000 },
  "ratio-16-9": { label: "16:9", aspect: 16 / 9, width: 1600, height: 900 },
  "ratio-4-5": { label: "4:5", aspect: 4 / 5, width: 1200, height: 1500 },
  "ratio-1-1": { label: "1:1", aspect: 1, width: 1400, height: 1400 },
  "ratio-3-4": { label: "3:4", aspect: 3 / 4, width: 1200, height: 1600 },
  "ratio-21-9": { label: "21:9", aspect: 21 / 9, width: 2100, height: 900 },
};

function createEmptyPost() {
  return {
    slug: "",
    title: "",
    subtitle: "",
    author: "Andy",
    category: "",
    tags: "",
    date: new Date().toISOString().split("T")[0],
    coverImage: "",
    coverImageSelected: "",
    coverImageLibrary: [],
    coverImageVariants: {},
    coverImageCrops: {},
    coverImagePostRatio: "ratio-16-9",
    coverImageCustomEnabled: false,
    coverImageCustomSize: { width: 1200, height: 675 },
    coverImageDisplayRatios: [
      "ratio-3-2",
      "ratio-4-3",
      "ratio-5-4",
      "ratio-16-10",
      "ratio-16-9",
      "ratio-4-5",
      "ratio-1-1",
      "ratio-3-4",
      "ratio-21-9",
    ],
    excerpt: "",
    featured: "",
    affiliateUrl: "",
    affiliateButtonText: "Check Price & Availability",
    affiliateButtonAlign: "center",
    affiliateButtonBgColor: "",
    affiliateButtonTextColor: "",
    seoTitle: "",
    seoDescription: "",
  };
}

/**
 * Render the admin page.
 */
export async function renderAdminPage() {
  updateMeta({ title: "Admin CMS" });
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
        <p>Enter your admin password to access the dashboard.</p>
        <div class="form-group">
          <input type="password" class="form-input" id="admin-password" placeholder="Enter admin password" />
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
  const btn = document.getElementById("admin-login-btn");
  const input = document.getElementById("admin-password");
  const error = document.getElementById("login-error");

  if (!btn) return;

  function attempt() {
    if (input.value === ADMIN_PAGE_PASSWORD) {
      isAuthenticated = true;
      sessionStorage.setItem(ADMIN_AUTH_STORAGE, "1");
      renderAdminInPlace();
    } else {
      error.textContent = "Incorrect admin password.";
      error.style.display = "block";
      input.value = "";
      input.focus();
    }
  }

  btn.addEventListener("click", attempt);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attempt();
  });
}

function renderAdminInPlace() {
  const contentEl = document.querySelector(".page-content");
  if (!contentEl) return;
  cleanupEditorListeners();
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
      postData.coverImageCustomEnabled = Boolean(postData.coverImageCustomEnabled);
      postData.coverImageCustomSize = normalizeCustomHeroSize(
        postData.coverImageCustomSize,
      );
      postData.coverImageCrops =
        postData.coverImageCrops && typeof postData.coverImageCrops === "object"
          ? postData.coverImageCrops
          : {};
      if (postData.coverImageCustomEnabled) {
        postData.coverImagePostRatio = "ratio-custom";
      }
      if (!Array.isArray(postData.coverImageDisplayRatios)) {
        postData.coverImageDisplayRatios = getDisplayRatioKeys();
      } else {
        postData.coverImageDisplayRatios = postData.coverImageDisplayRatios.filter(
          (key) => key !== "ratio-custom" && COVER_RATIOS[key],
        );
        if (!postData.coverImageDisplayRatios.length) {
          postData.coverImageDisplayRatios = getDisplayRatioKeys();
        }
      }
      contentBlocks = Array.isArray(parsed.contentBlocks)
        ? parsed.contentBlocks
        : [];
      if (parsed?.cropEditorState?.bySource && typeof parsed.cropEditorState.bySource === "object") {
        coverCropEditorStateBySource = parsed.cropEditorState.bySource;
      }
      if (
        typeof parsed?.cropEditorState?.activeRatio === "string" &&
        COVER_RATIOS[parsed.cropEditorState.activeRatio]
      ) {
        coverCropEditorActiveRatio = parsed.cropEditorState.activeRatio;
        activeCropRatio = coverCropEditorActiveRatio;
      }
      const selectedItem = Array.isArray(postData.coverImageLibrary)
        ? postData.coverImageLibrary.find(
            (item) => item?.id === postData.coverImageSelected,
          )
        : null;
      coverImageSource = selectedItem?.src || postData.coverImage || "";
    }
  } catch (error) {
    console.warn("Admin: failed to restore draft from storage", error);
  }
}

function persistDraft() {
  try {
    localStorage.setItem(
      ADMIN_DRAFT_STORAGE,
      JSON.stringify({
        postData,
        contentBlocks,
        cropEditorState: {
          bySource: coverCropEditorStateBySource,
          activeRatio: coverCropEditorActiveRatio,
        },
      }),
    );
    lastDraftSavedAt = Date.now();
    window.dispatchEvent(
      new CustomEvent("admin-draft-saved", {
        detail: { timestamp: lastDraftSavedAt },
      }),
    );
  } catch (error) {
    console.warn("Admin: failed to save draft to storage", error);
  }
}

function renderEditor() {
  setTimeout(() => initEditor(), 0);

  return `
    <div class="container admin-page">
      <div class="admin-tabs">
        <a href="#/admin" class="admin-tab active">Editor</a>
        <a href="#/admin/analytics" class="admin-tab">Analytics</a>
      </div>
      <h2 style="margin-bottom: var(--space-lg);">📝 Create New Post</h2>
      <p class="admin-autosave-status" id="admin-autosave-status">Autosave active</p>
      <div class="admin-workspace-tabs" id="admin-workspace-tabs">
        <button type="button" class="admin-workspace-tab active" data-admin-workspace-tab="edit">✏️ Edit</button>
        <button type="button" class="admin-workspace-tab" data-admin-workspace-tab="preview">👁️ Preview</button>
      </div>

      <div class="admin-layout">
        <div class="admin-tools" id="admin-tools">
          <h4 class="admin-tools-title">Template Presets</h4>
          <div class="admin-template-actions">
            <button class="btn btn-outline btn-sm admin-template-btn" data-template="review">📦 Product Review</button>
            <button class="btn btn-outline btn-sm admin-template-btn" data-template="quick">⚡ Quick Recommendation</button>
          </div>

          <h4 class="admin-tools-title" style="margin-top: var(--space-lg);">Block Library</h4>
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
          <input
            type="password"
            class="form-input form-input-sm"
            id="admin-api-key-input"
            value="${esc(adminApiKey)}"
            placeholder="Publishing API key for save/delete"
            style="margin-bottom: var(--space-sm);"
          />
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
          <div class="admin-section" id="admin-section-post-info">
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
          <div class="admin-section" id="admin-section-media">
            <h3 class="admin-section-title">Cover Image & Excerpt</h3>
            <div class="form-group">
              <label class="form-label">Image Library URL</label>
              <div class="form-row">
                <input type="text" class="form-input" id="cover-library-url" placeholder="https://example.com/image.jpg" />
                <button type="button" class="btn btn-outline" id="btn-cover-add-url">Add To Library</button>
              </div>
            </div>
            <div class="cover-library-list" id="cover-library-list">
              ${renderCoverLibrary()}
            </div>
            <div class="form-group">
              <label class="form-label">Blog Post Hero Image Source</label>
              <input type="text" class="form-input" id="field-coverImage" value="${esc(postData.coverImage)}" placeholder="Used on post page hero only" />
              <div class="form-row" style="margin-top: var(--space-sm);">
                <div class="form-group">
                  <label class="form-label">Blog Post Hero Ratio</label>
                  <select class="form-select" id="field-coverImagePostRatio">
                    ${Object.entries(COVER_RATIOS)
                      .map(
                        ([key, value]) =>
                          `<option value="${key}" ${postData.coverImagePostRatio === key ? "selected" : ""}>${value.label}</option>`,
                      )
                      .join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Custom</label>
                  <label class="form-label" style="display:flex; align-items:center; gap:8px; margin-top: 8px;">
                    <input type="checkbox" id="field-coverImageCustomEnabled" ${postData.coverImageCustomEnabled ? "checked" : ""} />
                    <span>Resizable hero</span>
                  </label>
                </div>
              </div>
              <div class="form-row" style="${postData.coverImageCustomEnabled ? "" : "display:none;"}" id="cover-custom-size-row">
                <div class="form-group">
                  <label class="form-label">Custom Width (px)</label>
                  <input type="number" class="form-input" id="field-coverImageCustomWidth" min="280" max="2400" step="10" value="${Number(postData.coverImageCustomSize?.width || 1200)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Custom Height (px)</label>
                  <input type="number" class="form-input" id="field-coverImageCustomHeight" min="220" max="2400" step="10" value="${Number(postData.coverImageCustomSize?.height || 675)}" />
                </div>
              </div>
              <div class="cover-image-actions">
                <button type="button" class="btn btn-outline btn-sm" id="btn-cover-upload">🖼️ Upload To Library</button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-cover-recrop">✂️ Crop Selected</button>
              </div>
              <input type="file" id="cover-image-file" accept="image/*" style="display: none;" />
              <p class="form-help">Cover source here affects only the post page. Main page cards use ratios checked as Display in cropper.</p>
            </div>
            <div class="form-group">
              <label class="form-label">Excerpt</label>
              <textarea class="form-textarea" id="field-excerpt" rows="3" placeholder="Short description shown on cards...">${esc(postData.excerpt)}</textarea>
            </div>
          </div>

          <!-- Affiliate -->
          <div class="admin-section affiliate-quick-section" id="admin-section-affiliate">
            <h3 class="admin-section-title">Affiliate Link</h3>
            <div class="form-group">
              <label class="form-label">Affiliate URL</label>
              <input type="url" class="form-input" id="field-affiliateUrl" value="${esc(postData.affiliateUrl)}" placeholder="https://amazon.com/..." />
            </div>
            <div class="form-group">
              <label class="form-label">Button Text</label>
              <input type="text" class="form-input" id="field-affiliateButtonText" value="${esc(postData.affiliateButtonText)}" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Button Position</label>
                <select class="form-select" id="field-affiliateButtonAlign">
                  <option value="left" ${postData.affiliateButtonAlign === "left" ? "selected" : ""}>Left</option>
                  <option value="center" ${postData.affiliateButtonAlign === "center" ? "selected" : ""}>Center</option>
                  <option value="right" ${postData.affiliateButtonAlign === "right" ? "selected" : ""}>Right</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Button Background</label>
                <input type="color" class="form-input" id="field-affiliateButtonBgColor" value="${postData.affiliateButtonBgColor || "#d4923a"}" />
              </div>
              <div class="form-group">
                <label class="form-label">Button Text Color</label>
                <input type="color" class="form-input" id="field-affiliateButtonTextColor" value="${postData.affiliateButtonTextColor || "#ffffff"}" />
              </div>
            </div>
          </div>

          <!-- SEO -->
          <div class="admin-section" id="admin-section-seo">
            <h3 class="admin-section-title">SEO Settings</h3>
            <div class="form-group">
              <label class="form-label">SEO Title (optional)</label>
              <input type="text" class="form-input" id="field-seoTitle" value="${esc(postData.seoTitle)}" placeholder="Custom page title for search engines" />
            </div>
            <div class="form-group">
              <label class="form-label">SEO Description (optional)</label>
              <textarea class="form-textarea" id="field-seoDescription" rows="2" placeholder="Custom meta description...">${esc(postData.seoDescription)}</textarea>
            </div>
            <div class="seo-hints" id="seo-hints"></div>
          </div>

          <div class="admin-section">
            <h3 class="admin-section-title">Pre-Publish Checklist</h3>
            <div class="admin-checklist" id="admin-checklist"></div>
          </div>

          <!-- Content Blocks -->
          <div class="admin-section" id="admin-content-blocks-section">
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

      <div class="admin-mobile-dock" id="admin-mobile-dock" aria-label="Mobile admin quick actions">
        <button type="button" class="admin-mobile-dock-btn" id="mobile-dock-tools">🧰 Tools</button>
        <button type="button" class="admin-mobile-dock-btn" id="mobile-dock-publish">🚀 Publish</button>
        <button type="button" class="admin-mobile-dock-btn" id="mobile-dock-blocks">🧱 Blocks</button>
      </div>

      <div class="image-crop-modal" id="image-crop-modal" aria-hidden="true">
        <div class="image-crop-backdrop" id="image-crop-cancel"></div>
        <div class="image-crop-dialog" role="dialog" aria-modal="true" aria-label="Crop cover image">
          <h3 style="margin-bottom: var(--space-sm);">Crop Cover Image</h3>
          <div class="crop-ratio-tabs" id="crop-ratio-tabs">
            ${Object.entries(COVER_RATIOS)
              .map(
                ([key, value]) => `
                  <div class="crop-ratio-tile ${key === "ratio-custom" ? "custom-only" : ""}">
                    <button type="button" class="crop-ratio-tab ${key === activeCropRatio ? "active" : ""}" data-ratio-key="${key}">${value.label}</button>
                    ${
                      key !== "ratio-custom"
                        ? `<label class="crop-ratio-toggle">
                            <input type="checkbox" data-display-ratio="${key}" ${isDisplayRatioChecked(postData.coverImageDisplayRatios, key) ? "checked" : ""} />
                            <span>Display</span>
                          </label>`
                        : `<span class="crop-ratio-toggle crop-ratio-toggle-muted">Hero only</span>`
                    }
                  </div>
                `,
              )
              .join("")}
          </div>
          <p class="form-help" style="margin-bottom: var(--space-md);">Drag image to reposition. Use zoom slider for tighter crop.</p>
          <div class="image-crop-frame" id="image-crop-frame">
            <img id="image-crop-img" alt="Crop preview" />
          </div>
          <div class="image-crop-controls">
            <label class="form-label" for="image-crop-zoom">Zoom</label>
            <input id="image-crop-zoom" type="range" min="0.35" max="4" step="0.01" value="1" />
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
  if (!str) return "";
  return str
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isDisplayRatioChecked(displayRatios, key) {
  const list = Array.isArray(displayRatios) ? displayRatios : [];
  if (!list.length) return true;
  return list.includes(key);
}

function getDisplayRatioKeys() {
  return Object.keys(COVER_RATIOS).filter((key) => key !== "ratio-custom");
}

function normalizeCustomHeroSize(value) {
  const widthRaw = Number.parseInt(String(value?.width ?? 1200), 10);
  const heightRaw = Number.parseInt(String(value?.height ?? 675), 10);
  const width = Number.isFinite(widthRaw)
    ? Math.min(2400, Math.max(280, widthRaw))
    : 1200;
  const height = Number.isFinite(heightRaw)
    ? Math.min(2400, Math.max(220, heightRaw))
    : 675;
  return { width, height };
}

function customHeroInlineStyle(value, { preview = false } = {}) {
  const size = normalizeCustomHeroSize(value);
  const widthCap = preview ? Math.min(920, size.width) : size.width;
  return `--hero-custom-aspect: ${size.width} / ${size.height}; width: min(100%, ${widthCap}px); max-width: min(100%, ${widthCap}px);`;
}

function cropDatasetAttrs(crop) {
  if (!crop || typeof crop !== "object") return "";
  const zoom = Number.parseFloat(String(crop.zoom ?? 1));
  const x = Number.parseFloat(String(crop.offsetXPct ?? 0));
  const y = Number.parseFloat(String(crop.offsetYPct ?? 0));
  const safeZoom = Number.isFinite(zoom) ? Math.min(4, Math.max(0.35, zoom)) : 1;
  const safeX = Number.isFinite(x) ? Math.min(120, Math.max(-120, x)) : 0;
  const safeY = Number.isFinite(y) ? Math.min(120, Math.max(-120, y)) : 0;
  return `data-crop-zoom="${safeZoom}" data-crop-xpct="${safeX}" data-crop-ypct="${safeY}"`;
}

function applyPreviewCropTransforms(root) {
  if (!root) return;
  const targets = root.querySelectorAll("img[data-crop-zoom]");
  targets.forEach((img) => {
    const apply = () => {
      const frame = img.parentElement;
      if (!frame) return;
      const frameW = frame.clientWidth || 1;
      const frameH = frame.clientHeight || 1;
      const naturalW = img.naturalWidth || 1;
      const naturalH = img.naturalHeight || 1;
      const zoom = Number.parseFloat(img.dataset.cropZoom || "1") || 1;
      const xpct = Number.parseFloat(img.dataset.cropXpct || "0") || 0;
      const ypct = Number.parseFloat(img.dataset.cropYpct || "0") || 0;
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

      if (!frame.style.position) frame.style.position = "relative";
      if (!frame.style.overflow) frame.style.overflow = "hidden";
      img.style.position = "absolute";
      img.style.top = "50%";
      img.style.left = "50%";
      img.style.maxWidth = "none";
      img.style.width = `${naturalW}px`;
      img.style.height = `${naturalH}px`;
      img.style.objectFit = "unset";
      img.style.transformOrigin = "center center";
      img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`;
    };
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  });
}

function renderCoverLibrary() {
  const items = Array.isArray(postData.coverImageLibrary)
    ? postData.coverImageLibrary
    : [];
  if (!items.length) {
    return `<p class="form-help">No images yet. Upload or add URL to build your reusable library.</p>`;
  }
  return items
    .map((item) => {
      const selected = item.id === postData.coverImageSelected;
      return `
      <div class="cover-library-item ${selected ? "selected" : ""}">
        <img src="${esc(item.src)}" alt="${esc(item.label || "Library image")}" />
        <div class="cover-library-meta">
          <span>${esc(item.label || item.id)}</span>
          <div class="cover-library-actions">
            <button type="button" class="btn btn-outline btn-sm cover-lib-use" data-cover-id="${esc(item.id)}">Use</button>
            <button type="button" class="btn btn-outline btn-sm cover-lib-crop" data-cover-id="${esc(item.id)}">Crop</button>
            <button type="button" class="btn btn-outline btn-sm cover-lib-remove" data-cover-id="${esc(item.id)}" style="color: var(--color-danger);">Remove</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function initEditor() {
  cleanupEditorListeners();
  const listenerCleanups = [];
  const on = (target, event, handler, options) => {
    if (!target) return;
    target.addEventListener(event, handler, options);
    listenerCleanups.push(() =>
      target.removeEventListener(event, handler, options),
    );
  };
  cleanupEditorListeners = () => {
    while (listenerCleanups.length) {
      const remove = listenerCleanups.pop();
      try {
        remove?.();
      } catch {
        // ignore cleanup failures
      }
    }
  };

  const blockList = document.getElementById("block-list");
  const previewContent = document.getElementById("preview-content");
  const addBlockArea = document.querySelector(".add-block-area");
  const coverUploadBtn = document.getElementById("btn-cover-upload");
  const coverRecropBtn = document.getElementById("btn-cover-recrop");
  const coverAddUrlBtn = document.getElementById("btn-cover-add-url");
  const coverLibraryUrlInput = document.getElementById("cover-library-url");
  const coverFileInput = document.getElementById("cover-image-file");
  const coverImageField = document.getElementById("field-coverImage");
  const coverImageRatioField = document.getElementById("field-coverImagePostRatio");
  const coverCustomToggleField = document.getElementById(
    "field-coverImageCustomEnabled",
  );
  const coverCustomSizeRow = document.getElementById("cover-custom-size-row");
  const coverCustomWidthField = document.getElementById(
    "field-coverImageCustomWidth",
  );
  const coverCustomHeightField = document.getElementById(
    "field-coverImageCustomHeight",
  );
  const coverLibraryList = document.getElementById("cover-library-list");

  const cropModal = document.getElementById("image-crop-modal");
  const cropFrame = document.getElementById("image-crop-frame");
  const cropImage = document.getElementById("image-crop-img");
  const cropZoom = document.getElementById("image-crop-zoom");
  const cropReset = document.getElementById("image-crop-reset");
  const cropCancel = document.getElementById("image-crop-cancel");
  const cropClose = document.getElementById("image-crop-close");
  const cropApply = document.getElementById("image-crop-apply");
  const cropRatioTabs = document.getElementById("crop-ratio-tabs");
  const postsSearch = document.getElementById("admin-posts-search");
  const postsList = document.getElementById("admin-posts-list");
  const adminApiKeyInput = document.getElementById("admin-api-key-input");
  const mobileDockToolsBtn = document.getElementById("mobile-dock-tools");
  const mobileDockPublishBtn = document.getElementById("mobile-dock-publish");
  const mobileDockBlocksBtn = document.getElementById("mobile-dock-blocks");
  const adminToolsPane = document.getElementById("admin-tools");
  const adminContentBlocksSection = document.getElementById(
    "admin-content-blocks-section",
  );
  const adminLayout = document.querySelector(".admin-layout");
  const workspaceTabs = document.getElementById("admin-workspace-tabs");
  const autosaveStatusEl = document.getElementById("admin-autosave-status");
  const seoHintsEl = document.getElementById("seo-hints");
  const checklistEl = document.getElementById("admin-checklist");
  const templateButtons = document.querySelectorAll(".admin-template-btn");
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (!blockList) {
    cleanupEditorListeners();
    return;
  }

  postData.coverImageCustomEnabled = Boolean(postData.coverImageCustomEnabled);
  postData.coverImageCustomSize = normalizeCustomHeroSize(
    postData.coverImageCustomSize,
  );
  if (postData.coverImageCustomEnabled) {
    postData.coverImagePostRatio = "ratio-custom";
  }

  on(window, "routechange", (event) => {
    const nextPath = event?.detail?.path || "";
    if (nextPath !== "/admin") {
      cleanupEditorListeners();
    }
  });

  function setAutosaveStatus() {
    if (!autosaveStatusEl) return;
    if (!lastDraftSavedAt) {
      autosaveStatusEl.textContent = "Autosave active";
      return;
    }
    autosaveStatusEl.textContent = `Saved ${formatRelativeTime(lastDraftSavedAt)}`;
  }
  on(window, "admin-draft-saved", setAutosaveStatus);
  const autosaveTimer = setInterval(setAutosaveStatus, 15000);
  listenerCleanups.push(() => clearInterval(autosaveTimer));

  const isMobileAdminViewport = () =>
    window.matchMedia("(max-width: 1023px)").matches;
  let mobileWorkspaceTab =
    sessionStorage.getItem(ADMIN_MOBILE_VIEW_TAB_STORAGE) || "edit";

  function applyMobileWorkspaceTab(nextTab) {
    mobileWorkspaceTab = nextTab === "preview" ? "preview" : "edit";
    sessionStorage.setItem(ADMIN_MOBILE_VIEW_TAB_STORAGE, mobileWorkspaceTab);

    if (workspaceTabs) {
      workspaceTabs
        .querySelectorAll("[data-admin-workspace-tab]")
        .forEach((btn) => {
          btn.classList.toggle(
            "active",
            btn.dataset.adminWorkspaceTab === mobileWorkspaceTab,
          );
        });
    }

    if (!adminLayout) return;
    if (!isMobileAdminViewport()) {
      adminLayout.classList.remove("mobile-tab-edit", "mobile-tab-preview");
      return;
    }
    adminLayout.classList.toggle("mobile-tab-edit", mobileWorkspaceTab === "edit");
    adminLayout.classList.toggle(
      "mobile-tab-preview",
      mobileWorkspaceTab === "preview",
    );
  }

  function setSectionCollapsed(section, collapsed) {
    section.classList.toggle("collapsed-mobile", collapsed);
    const caret = section.querySelector(".section-caret");
    if (caret) caret.textContent = collapsed ? "▸" : "▾";
  }

  function initMobileSectionAccordions() {
    const sections = Array.from(
      document.querySelectorAll(".admin-editor .admin-section"),
    );
    sections.forEach((section) => {
      const title = section.querySelector(".admin-section-title");
      if (!title) return;
      title.classList.add("mobile-collapsible-title");
      if (!title.querySelector(".section-caret")) {
        title.insertAdjacentHTML(
          "beforeend",
          `<span class="section-caret" aria-hidden="true">▾</span>`,
        );
      }
      on(title, "click", () => {
        if (!isMobileAdminViewport()) return;
        setSectionCollapsed(
          section,
          !section.classList.contains("collapsed-mobile"),
        );
      });
    });

    const syncAccordionMode = () => {
      const mobile = isMobileAdminViewport();
      sections.forEach((section, idx) => {
        if (!mobile) {
          setSectionCollapsed(section, false);
          return;
        }
        if (section.dataset.mobileInit === "1") return;
        const keepOpen =
          idx === 0 ||
          idx === sections.length - 1 ||
          section.id === "admin-content-blocks-section";
        setSectionCollapsed(section, !keepOpen);
        section.dataset.mobileInit = "1";
      });
    };

    syncAccordionMode();
    on(window, "resize", syncAccordionMode);
  }

  function buildTemplateBlocks(template) {
    if (template === "quick") {
      const heading = createBlock("heading");
      heading.text = "Quick Verdict";
      const paragraph = createBlock("paragraph");
      paragraph.text = "This product is best for...";
      const proscons = createBlock("proscons");
      proscons.pros = ["Good value", "Easy to use"];
      proscons.cons = ["Not for heavy-duty tasks"];
      const rating = createBlock("rating");
      rating.value = 4;
      rating.label = "Overall score";
      const cta = createBlock("cta");
      cta.heading = "Check latest price";
      cta.buttonText = "View deal";
      return [heading, paragraph, proscons, rating, cta];
    }

    const introHeading = createBlock("heading");
    introHeading.text = "Overview";
    const introParagraph = createBlock("paragraph");
    introParagraph.text = "This product stands out for...";
    const featuresHeading = createBlock("heading");
    featuresHeading.text = "Key Features";
    featuresHeading.level = 3;
    const featuresList = createBlock("list");
    featuresList.items = ["Feature 1", "Feature 2", "Feature 3"];
    const proscons = createBlock("proscons");
    proscons.pros = ["Strong build quality", "Great performance"];
    proscons.cons = ["Premium pricing"];
    const rating = createBlock("rating");
    rating.value = 4;
    rating.label = "Editor rating";
    const verdict = createBlock("heading");
    verdict.text = "Final Verdict";
    verdict.level = 3;
    const verdictParagraph = createBlock("paragraph");
    verdictParagraph.text = "If you need..., this is a strong choice.";
    const cta = createBlock("cta");
    cta.heading = "Buy This Product";
    cta.buttonText = "Check Price";
    return [
      introHeading,
      introParagraph,
      featuresHeading,
      featuresList,
      proscons,
      rating,
      verdict,
      verdictParagraph,
      cta,
    ];
  }

  templateButtons.forEach((btn) => {
    on(btn, "click", () => {
      const template = btn.dataset.template || "review";
      if (
        contentBlocks.length > 0 &&
        !confirm("Replace current blocks with this template?")
      ) {
        return;
      }
      contentBlocks = buildTemplateBlocks(template);
      if (!postData.title) {
        postData.title =
          template === "quick" ? "Quick Product Recommendation" : "Product Review";
      }
      postData.slug = slugify(postData.title);
      renderAdminInPlace();
      showToast("✅ Template applied.");
    });
  });

  if (workspaceTabs) {
    on(workspaceTabs, "click", (e) => {
      const btn = e.target.closest("[data-admin-workspace-tab]");
      if (!btn) return;
      applyMobileWorkspaceTab(btn.dataset.adminWorkspaceTab);
    });
  }
  on(window, "resize", () => applyMobileWorkspaceTab(mobileWorkspaceTab));
  applyMobileWorkspaceTab(mobileWorkspaceTab);

  function forceReauth(
    message = "Invalid API key on server. Please sign in again.",
  ) {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE);
    adminApiKey = "";
    isAuthenticated = false;
    showToast(`❌ ${message}`);
    renderAdminInPlace();
  }

  if (adminApiKeyInput) {
    adminApiKeyInput.addEventListener("input", () => {
      adminApiKey = adminApiKeyInput.value.trim();
      sessionStorage.setItem(ADMIN_KEY_STORAGE, adminApiKey);
    });
  }

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
    if (!Number.isFinite(coverCropState.zoom)) coverCropState.zoom = 1;
    coverCropState.zoom = Math.min(4, Math.max(0.35, coverCropState.zoom));
    const frameW = cropFrame.clientWidth;
    const frameH = cropFrame.clientHeight;
    const drawW = cropNaturalWidth * cropBaseScale * coverCropState.zoom;
    const drawH = cropNaturalHeight * cropBaseScale * coverCropState.zoom;
    const maxX = Math.max((drawW - frameW) / 2, 0);
    const maxY = Math.max((drawH - frameH) / 2, 0);
    coverCropState.offsetX = Math.min(
      Math.max(coverCropState.offsetX, -maxX),
      maxX,
    );
    coverCropState.offsetY = Math.min(
      Math.max(coverCropState.offsetY, -maxY),
      maxY,
    );
  }

  function renderCropImageTransform() {
    if (!cropImage) return;
    refreshCropBaseScale();
    clampCropOffsets();
    persistActiveCropState();
    const scale = cropBaseScale * coverCropState.zoom;
    cropImage.style.transform = `translate(calc(-50% + ${coverCropState.offsetX}px), calc(-50% + ${coverCropState.offsetY}px)) scale(${scale})`;
  }

  function resetCropState() {
    coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
    coverCropStatesByRatio[activeCropRatio] = { ...coverCropState };
    if (cropZoom) cropZoom.value = "1";
  }

  function persistActiveCropState() {
    const safeZoom = Math.min(4, Math.max(0.35, Number(coverCropState.zoom) || 1));
    const drawW = Math.max(
      1,
      (cropNaturalWidth || 1) * (cropBaseScale || 1) * safeZoom,
    );
    const drawH = Math.max(
      1,
      (cropNaturalHeight || 1) * (cropBaseScale || 1) * safeZoom,
    );
    coverCropStatesByRatio[activeCropRatio] = {
      zoom: safeZoom,
      offsetX: coverCropState.offsetX,
      offsetY: coverCropState.offsetY,
      offsetXPct: Math.round(((coverCropState.offsetX || 0) / drawW) * 10000) / 100,
      offsetYPct: Math.round(((coverCropState.offsetY || 0) / drawH) * 10000) / 100,
    };
    if (currentCropSourceKey) {
      coverCropEditorStateBySource[currentCropSourceKey] = deepClone(
        coverCropStatesByRatio,
      );
    }
    coverCropEditorActiveRatio = activeCropRatio;
  }

  function ensureCropStateForRatio(ratioKey) {
    if (!coverCropStatesByRatio[ratioKey]) {
      coverCropStatesByRatio[ratioKey] = { zoom: 1, offsetX: 0, offsetY: 0 };
    }
    return coverCropStatesByRatio[ratioKey];
  }

  function getCurrentRatioConfig() {
    if (activeCropRatio === "ratio-custom") {
      const customSize = normalizeCustomHeroSize(postData.coverImageCustomSize);
      return {
        label: "Custom",
        aspect: customSize.width / customSize.height,
        width: customSize.width,
        height: customSize.height,
      };
    }
    return COVER_RATIOS[activeCropRatio] || COVER_RATIOS["ratio-16-9"];
  }

  function getSelectedCoverId() {
    return (
      postData.coverImageSelected ||
      (Array.isArray(postData.coverImageLibrary)
        ? postData.coverImageLibrary[0]?.id || ""
        : "")
    );
  }

  function getSelectedVariantMap() {
    const root =
      postData.coverImageVariants && typeof postData.coverImageVariants === "object"
        ? postData.coverImageVariants
        : {};
    const selectedId = getSelectedCoverId();
    if (!selectedId) return {};
    const map = root[selectedId];
    return map && typeof map === "object" ? map : {};
  }

  function getSelectedCropMap() {
    const root =
      postData.coverImageCrops && typeof postData.coverImageCrops === "object"
        ? postData.coverImageCrops
        : {};
    const selectedId = getSelectedCoverId();
    if (!selectedId) return {};
    const map = root[selectedId];
    if (map && typeof map === "object") return map;
    return {};
  }

  function setActiveCropRatio(nextKey) {
    if (!COVER_RATIOS[nextKey]) return;
    if (nextKey === "ratio-custom" && !postData.coverImageCustomEnabled) return;
    persistActiveCropState();
    activeCropRatio = nextKey;
    const nextState = ensureCropStateForRatio(nextKey);
    coverCropState = {
      zoom: nextState.zoom ?? 1,
      offsetX: nextState.offsetX ?? 0,
      offsetY: nextState.offsetY ?? 0,
    };
    if (cropFrame) {
      applyCropFrameSizing();
      if (
        typeof nextState.offsetXPct === "number" ||
        typeof nextState.offsetYPct === "number"
      ) {
        const drawW = Math.max(
          1,
          (cropNaturalWidth || 1) * (cropBaseScale || 1) * (coverCropState.zoom || 1),
        );
        const drawH = Math.max(
          1,
          (cropNaturalHeight || 1) * (cropBaseScale || 1) * (coverCropState.zoom || 1),
        );
        coverCropState.offsetX =
          drawW * ((Number(nextState.offsetXPct) || 0) / 100);
        coverCropState.offsetY =
          drawH * ((Number(nextState.offsetYPct) || 0) / 100);
      }
    }
    if (cropZoom) cropZoom.value = String(coverCropState.zoom);
    cropRatioTabs?.querySelectorAll("[data-ratio-key]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.ratioKey === activeCropRatio);
    });
    renderCropImageTransform();
  }

  function applyCropFrameSizing() {
    if (!cropFrame) return;
    const ratio = getCurrentRatioConfig().aspect;
    const maxWidth = Math.max(220, (window.innerWidth || 360) * 0.9);
    const maxHeight = Math.max(180, (window.innerHeight || 640) * 0.52);
    const widthFromHeight = maxHeight * ratio;
    const targetWidth = Math.max(220, Math.min(maxWidth, widthFromHeight));
    cropFrame.style.width = `${targetWidth}px`;
    cropFrame.style.maxWidth = "100%";
    cropFrame.style.aspectRatio = String(ratio);
    cropFrame.style.margin = "0 auto";
    refreshCropBaseScale();
    cropRatioTabs?.querySelectorAll("[data-ratio-key]").forEach((btn) => {
      const key = btn.dataset.ratioKey || "";
      const disabled = key === "ratio-custom" && !postData.coverImageCustomEnabled;
      btn.disabled = disabled;
      btn.classList.toggle("disabled", disabled);
      if (disabled && key === activeCropRatio) {
        activeCropRatio = "ratio-16-9";
      }
    });
  }

  function refreshCropBaseScale() {
    if (!cropFrame || !cropNaturalWidth || !cropNaturalHeight) return;
    const frameW = cropFrame.clientWidth || 1;
    const frameH = cropFrame.clientHeight || 1;
    cropBaseScale = Math.max(
      frameW / cropNaturalWidth,
      frameH / cropNaturalHeight,
    );
  }

  function getRatioAspectByKey(ratioKey) {
    if (ratioKey === "ratio-custom") {
      const customSize = normalizeCustomHeroSize(postData.coverImageCustomSize);
      return customSize.width / customSize.height;
    }
    return (COVER_RATIOS[ratioKey] || COVER_RATIOS["ratio-16-9"]).aspect;
  }

  function getFrameSizeForRatio(ratioKey) {
    const ratio = getRatioAspectByKey(ratioKey);
    const maxWidth = Math.max(220, (window.innerWidth || 360) * 0.9);
    const maxHeight = Math.max(180, (window.innerHeight || 640) * 0.52);
    const widthFromHeight = maxHeight * ratio;
    const frameW = Math.max(220, Math.min(maxWidth, widthFromHeight));
    const frameH = frameW / ratio;
    return { frameW, frameH };
  }

  function getDrawSizeForRatio(ratioKey, zoom = 1) {
    if (!cropNaturalWidth || !cropNaturalHeight) {
      const fallback = getFrameSizeForRatio(ratioKey);
      return {
        drawW: fallback.frameW,
        drawH: fallback.frameH,
        frameW: fallback.frameW,
        frameH: fallback.frameH,
      };
    }
    const { frameW, frameH } = getFrameSizeForRatio(ratioKey);
    const baseScale = Math.max(
      frameW / cropNaturalWidth,
      frameH / cropNaturalHeight,
    );
    const safeZoom = Math.min(4, Math.max(0.35, Number(zoom) || 1));
    return {
      drawW: cropNaturalWidth * baseScale * safeZoom,
      drawH: cropNaturalHeight * baseScale * safeZoom,
      frameW,
      frameH,
    };
  }

  function isRemoteImageUrl(value) {
    return /^https?:\/\//i.test((value || "").trim());
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read image blob."));
      reader.readAsDataURL(blob);
    });
  }

  async function normalizeCropSource(source) {
    const value = String(source || "").trim();
    if (!value) throw new Error("No image source found.");
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

  async function optimizeImageSource(source, { maxEdge = 1800, quality = 0.78 } = {}) {
    const normalized = await normalizeCropSource(source);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || 1;
        const height = img.naturalHeight || 1;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        const outW = Math.max(1, Math.round(width * scale));
        const outH = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not optimize image."));
          return;
        }
        ctx.drawImage(img, 0, 0, outW, outH);
        const optimized = canvas.toDataURL("image/jpeg", quality);
        resolve(
          typeof optimized === "string" && optimized.startsWith("data:image/")
            ? optimized
            : normalized,
        );
      };
      img.onerror = () => reject(new Error("Failed to decode image for optimization."));
      img.src = normalized;
    });
  }

  function closeCropper() {
    if (!cropModal) return;
    cropModal.classList.remove("open");
    cropModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openCropper(sourceUrl, useExistingTransform = false) {
    if (!cropModal || !cropImage || !cropFrame || !cropZoom) return;
    if (!sourceUrl) return;

    const sourceKey = `${getSelectedCoverId() || "standalone"}:${String(sourceUrl).slice(0, 96)}`;
    if (sourceKey !== currentCropSourceKey) {
      const selectedSavedCrops = getSelectedCropMap();
      const hasEditorState =
        coverCropEditorStateBySource[sourceKey] &&
        typeof coverCropEditorStateBySource[sourceKey] === "object";
      const initialState = hasEditorState
        ? coverCropEditorStateBySource[sourceKey]
        : Object.fromEntries(
            Object.entries(selectedSavedCrops).map(([ratioKey, crop]) => [
              ratioKey,
              {
                zoom: Number(crop?.zoom) || 1,
                offsetX: 0,
                offsetY: 0,
                offsetXPct: Number(crop?.offsetXPct) || 0,
                offsetYPct: Number(crop?.offsetYPct) || 0,
              },
            ]),
          );
      coverCropStatesByRatio = deepClone(
        initialState || {},
      );
      currentCropSourceKey = sourceKey;
      activeCropRatio = coverCropEditorActiveRatio;
      if (activeCropRatio === "ratio-custom" && !postData.coverImageCustomEnabled) {
        activeCropRatio = "ratio-16-9";
      }
    }

    if (!useExistingTransform) {
      coverCropStatesByRatio = {};
      resetCropState();
    }

    cropImage.onload = () => {
      cropNaturalWidth = cropImage.naturalWidth;
      cropNaturalHeight = cropImage.naturalHeight;
      const frameW = cropFrame.clientWidth || 1;
      const frameH = cropFrame.clientHeight || 1;
      cropBaseScale = Math.max(
        frameW / cropNaturalWidth,
        frameH / cropNaturalHeight,
      );
      setActiveCropRatio(activeCropRatio);
    };
    cropImage.src = sourceUrl;
    Object.keys(COVER_RATIOS).forEach((ratioKey) => ensureCropStateForRatio(ratioKey));
    cropZoom.value = String(coverCropState.zoom);
    setActiveCropRatio(activeCropRatio);
    applyCropFrameSizing();
    cropModal.classList.add("open");
    cropModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // ---- Sync fields to postData ----
  const fieldIds = [
    "title",
    "subtitle",
    "author",
    "date",
    "featured",
    "category",
    "tags",
    "coverImage",
    "coverImageSelected",
    "coverImagePostRatio",
    "excerpt",
    "affiliateUrl",
    "affiliateButtonText",
    "affiliateButtonAlign",
    "affiliateButtonBgColor",
    "affiliateButtonTextColor",
    "seoTitle",
    "seoDescription",
  ];
  fieldIds.forEach((id) => {
    const el = document.getElementById(`field-${id}`);
    if (el) {
      el.addEventListener("input", () => {
        postData[id] = el.value;
        if (id === "coverImage") {
          coverImageSource = el.value.trim() || coverImageSource;
        }
        if (id === "coverImagePostRatio") {
          if (
            postData.coverImagePostRatio === "ratio-custom" &&
            !postData.coverImageCustomEnabled
          ) {
            postData.coverImageCustomEnabled = true;
            if (coverCustomToggleField) coverCustomToggleField.checked = true;
            if (coverCustomSizeRow) coverCustomSizeRow.style.display = "";
          }
          if (
            postData.coverImageCustomEnabled &&
            postData.coverImagePostRatio !== "ratio-custom"
          ) {
            postData.coverImagePostRatio = "ratio-custom";
            if (coverImageRatioField) coverImageRatioField.value = "ratio-custom";
          }
          const selectedItem = (postData.coverImageLibrary || []).find(
            (item) => item?.id === getSelectedCoverId(),
          );
          if (selectedItem?.src) {
            postData.coverImage = selectedItem.src;
          }
        }
        postData.slug = slugify(postData.title);
        updatePreview();
      });
    }
  });

  if (coverCustomToggleField) {
    on(coverCustomToggleField, "change", () => {
      postData.coverImageCustomEnabled = Boolean(coverCustomToggleField.checked);
      if (coverCustomSizeRow) {
        coverCustomSizeRow.style.display = postData.coverImageCustomEnabled
          ? ""
          : "none";
      }
      if (postData.coverImageCustomEnabled) {
        postData.coverImagePostRatio = "ratio-custom";
        if (coverImageRatioField) coverImageRatioField.value = "ratio-custom";
      } else if (postData.coverImagePostRatio === "ratio-custom") {
        postData.coverImagePostRatio = "ratio-16-9";
        if (coverImageRatioField) coverImageRatioField.value = "ratio-16-9";
      }
      applyCropFrameSizing();
      updatePreview();
    });
  }

  const syncCustomSizeFromInputs = () => {
    const nextSize = normalizeCustomHeroSize({
      width: coverCustomWidthField?.value,
      height: coverCustomHeightField?.value,
    });
    postData.coverImageCustomSize = nextSize;
    if (coverCustomWidthField && coverCustomWidthField.value !== String(nextSize.width)) {
      coverCustomWidthField.value = String(nextSize.width);
    }
    if (
      coverCustomHeightField &&
      coverCustomHeightField.value !== String(nextSize.height)
    ) {
      coverCustomHeightField.value = String(nextSize.height);
    }
    if (postData.coverImageCustomEnabled) {
      postData.coverImagePostRatio = "ratio-custom";
      if (coverImageRatioField) coverImageRatioField.value = "ratio-custom";
    }
    if (activeCropRatio === "ratio-custom" || postData.coverImageCustomEnabled) {
      applyCropFrameSizing();
      renderCropImageTransform();
    }
    updatePreview();
  };

  if (coverCustomWidthField) {
    on(coverCustomWidthField, "input", syncCustomSizeFromInputs);
    on(coverCustomWidthField, "change", syncCustomSizeFromInputs);
  }
  if (coverCustomHeightField) {
    on(coverCustomHeightField, "input", syncCustomSizeFromInputs);
    on(coverCustomHeightField, "change", syncCustomSizeFromInputs);
  }

  if (coverUploadBtn && coverFileInput) {
    coverUploadBtn.addEventListener("click", () => {
      coverFileInput.value = "";
      coverFileInput.click();
    });

    coverFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const src =
          typeof ev.target?.result === "string" ? ev.target.result : "";
        if (!src) return;
        let optimized = src;
        try {
          optimized = await optimizeImageSource(src);
        } catch {
          optimized = src;
        }
        const imageEntry = {
          id: uid(),
          src: optimized,
          label: file.name || "Uploaded image",
        };
        postData.coverImageLibrary = Array.isArray(postData.coverImageLibrary)
          ? [...postData.coverImageLibrary, imageEntry]
          : [imageEntry];
        postData.coverImageSelected = imageEntry.id;
        postData.coverImage = optimized;
        coverImageSource = optimized;
        renderAdminInPlace();
      };
      reader.readAsDataURL(file);
    });
  }

  if (coverAddUrlBtn && coverLibraryUrlInput) {
    on(coverAddUrlBtn, "click", async () => {
      const raw = (coverLibraryUrlInput.value || "").trim();
      if (!raw) return;
      try {
        const optimized = await optimizeImageSource(raw);
        const imageEntry = { id: uid(), src: optimized, label: "URL image" };
        postData.coverImageLibrary = Array.isArray(postData.coverImageLibrary)
          ? [...postData.coverImageLibrary, imageEntry]
          : [imageEntry];
        postData.coverImageSelected = imageEntry.id;
        postData.coverImage = optimized;
        coverImageSource = optimized;
        renderAdminInPlace();
        showToast("✅ Image added to library.");
      } catch (error) {
        showToast(`❌ ${error.message || "Failed to add image URL."}`);
      }
    });
  }

  if (coverLibraryList) {
    on(coverLibraryList, "click", async (e) => {
      const useBtn = e.target.closest(".cover-lib-use");
      const cropBtn = e.target.closest(".cover-lib-crop");
      const removeBtn = e.target.closest(".cover-lib-remove");

      const imageId = useBtn?.dataset.coverId || cropBtn?.dataset.coverId || removeBtn?.dataset.coverId;
      if (!imageId) return;
      const items = Array.isArray(postData.coverImageLibrary)
        ? postData.coverImageLibrary
        : [];
      const selectedItem = items.find((i) => i.id === imageId);

      if (useBtn && selectedItem) {
        postData.coverImageSelected = imageId;
        coverImageSource = selectedItem.src;
        postData.coverImage = selectedItem.src;
        updatePreview();
        renderAdminInPlace();
      }

      if (cropBtn && selectedItem) {
        postData.coverImageSelected = imageId;
        coverImageSource = selectedItem.src;
        try {
          const normalized = await normalizeCropSource(selectedItem.src);
          coverImageSource = normalized;
          openCropper(normalized, true);
        } catch (error) {
          showToast(`❌ ${error.message}`);
        }
      }

      if (removeBtn) {
        postData.coverImageLibrary = items.filter((i) => i.id !== imageId);
        if (postData.coverImageSelected === imageId) {
          postData.coverImageSelected = postData.coverImageLibrary[0]?.id || "";
          coverImageSource = postData.coverImageLibrary[0]?.src || "";
          postData.coverImage = coverImageSource;
        }
        renderAdminInPlace();
      }
    });
  }

  if (coverRecropBtn) {
    coverRecropBtn.addEventListener("click", async () => {
      const selectedItem = (postData.coverImageLibrary || []).find(
        (i) => i.id === postData.coverImageSelected,
      );
      const source = selectedItem?.src || coverImageSource || postData.coverImage;
      if (!source) {
        showToast("❌ Upload an image first to crop.");
        return;
      }
      try {
        showToast("⏳ Loading image for crop...");
        const normalized = await normalizeCropSource(source);
        coverImageSource = normalized;
        openCropper(normalized, true);
      } catch (error) {
        showToast(`❌ ${error.message}`);
      }
    });
  }

  if (cropZoom) {
    cropZoom.addEventListener("input", () => {
      coverCropState.zoom = Number.parseFloat(cropZoom.value) || 1;
      persistActiveCropState();
      renderCropImageTransform();
    });
  }

  if (cropRatioTabs) {
    on(cropRatioTabs, "click", (e) => {
      const btn = e.target.closest("[data-ratio-key]");
      if (!btn) return;
      setActiveCropRatio(btn.dataset.ratioKey);
    });
    on(cropRatioTabs, "change", (e) => {
      const checkbox = e.target.closest("[data-display-ratio]");
      if (!checkbox) return;
      const key = checkbox.dataset.displayRatio;
      const set = new Set(
        Array.isArray(postData.coverImageDisplayRatios)
          ? postData.coverImageDisplayRatios
          : getDisplayRatioKeys(),
      );
      if (checkbox.checked) set.add(key);
      else set.delete(key);
      postData.coverImageDisplayRatios = [...set];
      updatePreview();
    });
  }

  if (cropReset) {
    cropReset.addEventListener("click", () => {
      resetCropState();
      renderCropImageTransform();
    });
  }

  if (cropCancel) {
    cropCancel.addEventListener("click", closeCropper);
  }

  if (cropClose) {
    cropClose.addEventListener("click", closeCropper);
  }

  on(window, "keydown", (e) => {
    if (e.key === "Escape" && cropModal?.classList.contains("open")) {
      closeCropper();
    }
  });

  if (cropFrame) {
    const onPointerDown = (e) => {
      if (!cropModal?.classList.contains("open")) return;
      cropDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOriginX = coverCropState.offsetX;
      dragOriginY = coverCropState.offsetY;
      cropFrame.classList.add("dragging");
      if (typeof cropFrame.setPointerCapture === "function" && e.pointerId != null) {
        cropFrame.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!cropDragging) return;
      coverCropState.offsetX = dragOriginX + (e.clientX - dragStartX);
      coverCropState.offsetY = dragOriginY + (e.clientY - dragStartY);
      persistActiveCropState();
      renderCropImageTransform();
      e.preventDefault();
    };
    const onPointerUp = (e) => {
      if (!cropDragging) return;
      cropDragging = false;
      cropFrame.classList.remove("dragging");
      if (
        typeof cropFrame.releasePointerCapture === "function" &&
        e.pointerId != null
      ) {
        try {
          cropFrame.releasePointerCapture(e.pointerId);
        } catch {
          // ignore release errors
        }
      }
    };

    on(cropFrame, "pointerdown", onPointerDown);
    on(window, "pointermove", onPointerMove);
    on(window, "pointerup", onPointerUp);
    on(window, "pointercancel", onPointerUp);
  }

  if (cropApply) {
    cropApply.addEventListener("click", () => {
      try {
        if (
          !cropImage ||
          !cropFrame ||
          !cropNaturalWidth ||
          !cropNaturalHeight
        ) {
          showToast("❌ No image loaded for cropping.");
          return;
        }

        clampCropOffsets();

        persistActiveCropState();

        const toCropSetting = (ratioKey, state) => {
          const safeZoom = Math.min(4, Math.max(0.35, Number(state?.zoom) || 1));
          const hasPctX = Number.isFinite(Number(state?.offsetXPct));
          const hasPctY = Number.isFinite(Number(state?.offsetYPct));
          const { drawW, drawH } = getDrawSizeForRatio(ratioKey, safeZoom);
          const offsetXPct = hasPctX
            ? Number(state.offsetXPct)
            : Math.round(((Number(state?.offsetX) || 0) / drawW) * 10000) / 100;
          const offsetYPct = hasPctY
            ? Number(state.offsetYPct)
            : Math.round(((Number(state?.offsetY) || 0) / drawH) * 10000) / 100;
          return {
            zoom: safeZoom,
            offsetXPct: Math.min(120, Math.max(-120, offsetXPct)),
            offsetYPct: Math.min(120, Math.max(-120, offsetYPct)),
          };
        };

        if (!postData.coverImageCrops || typeof postData.coverImageCrops !== "object") {
          postData.coverImageCrops = {};
        }
        const selectedId = getSelectedCoverId();
        if (selectedId) {
          if (!postData.coverImageCrops[selectedId] || typeof postData.coverImageCrops[selectedId] !== "object") {
            postData.coverImageCrops[selectedId] = {};
          }
          Object.entries(coverCropStatesByRatio || {}).forEach(([ratioKey, state]) => {
            if (!COVER_RATIOS[ratioKey]) return;
            if (ratioKey === "ratio-custom" && !postData.coverImageCustomEnabled) return;
            postData.coverImageCrops[selectedId][ratioKey] = toCropSetting(ratioKey, state);
          });
        } else {
          Object.entries(coverCropStatesByRatio || {}).forEach(([ratioKey, state]) => {
            if (!COVER_RATIOS[ratioKey]) return;
            if (ratioKey === "ratio-custom" && !postData.coverImageCustomEnabled) return;
            postData.coverImageCrops[ratioKey] = toCropSetting(ratioKey, state);
          });
        }

        const selectedItem = (postData.coverImageLibrary || []).find(
          (item) => item?.id === selectedId,
        );
        postData.coverImage = selectedItem?.src || cropImage.src || postData.coverImage;
        coverImageSource = cropImage.src;
        if (coverImageField) coverImageField.value = postData.coverImage;
        updatePreview();
        closeCropper();
        showToast(`✅ Crop settings saved for all edited ratios.`);
      } catch (error) {
        console.error("Crop apply failed:", error);
        showToast(
          "❌ Crop failed. For external URLs, upload the image file first, then crop.",
        );
      }
    });
  }

  // ---- Add blocks ----
  if (addBlockArea) {
    addBlockArea.querySelectorAll(".add-block-btn").forEach((btn) => {
      if (isCoarsePointer) {
        btn.setAttribute("draggable", "false");
      } else {
        btn.addEventListener("dragstart", (e) => {
          libraryDragType = btn.dataset.type || null;
          btn.classList.add("dragging");
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("text/plain", libraryDragType || "");
          }
        });

        btn.addEventListener("dragend", () => {
          libraryDragType = null;
          libraryDropIndex = null;
          btn.classList.remove("dragging");
          clearLibraryDropIndicator();
        });
      }
    });

    addBlockArea.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-block-btn");
      if (!btn) return;
      const type = btn.dataset.type;
      contentBlocks.push(createBlock(type));
      renderBlocks();
      updatePreview();
    });
  }

  if (postsSearch) {
    postsSearch.addEventListener("input", () => {
      clearTimeout(postsSearchTimer);
      postsSearchTimer = setTimeout(() => {
        refreshPostsManager(postsSearch.value || "");
      }, 220);
    });
  }

  if (postsList) {
    const closePostsMenus = () => {
      postsList
        .querySelectorAll(".admin-post-row.menu-open")
        .forEach((row) => row.classList.remove("menu-open"));
    };
    on(document, "click", (e) => {
      if (!postsList.contains(e.target)) closePostsMenus();
    });

    postsList.addEventListener("click", async (e) => {
      const menuTrigger = e.target.closest(".admin-post-menu-trigger");
      const editBtn = e.target.closest(".admin-post-edit");
      const duplicateBtn = e.target.closest(".admin-post-duplicate");
      const deleteBtn = e.target.closest(".admin-post-delete");

      if (menuTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const row = menuTrigger.closest(".admin-post-row");
        if (!row) return;
        const willOpen = !row.classList.contains("menu-open");
        closePostsMenus();
        row.classList.toggle("menu-open", willOpen);
        return;
      }

      if (!e.target.closest(".admin-post-context-menu")) {
        closePostsMenus();
      }

      if (editBtn) {
        closePostsMenus();
        const slug = decodeURIComponent(editBtn.dataset.slug || "");
        if (!slug) return;
        try {
          const res = await fetch(
            `/api/posts/by-slug?slug=${encodeURIComponent(slug)}`,
          );
          if (!res.ok) {
            let message = `Failed to load post (${res.status})`;
            const txt = await res.text();
            try {
              const parsed = JSON.parse(txt);
              if (parsed?.error) message = parsed.error;
            } catch {
              if (txt.includes("<!DOCTYPE"))
                message =
                  "API returned HTML instead of JSON. Check Vercel routing for /api/*.";
            }
            throw new Error(message);
          }
          const data = await res.json();
          loadPostData(data);
          showToast(`✏️ Editing: ${data.title || slug}`);
        } catch (error) {
          showToast(`❌ ${error.message || "Failed to load post"}`);
        }
        return;
      }

      if (duplicateBtn) {
        closePostsMenus();
        const slug = decodeURIComponent(duplicateBtn.dataset.slug || "");
        if (!slug) return;
        try {
          const res = await fetch(
            `/api/posts/by-slug?slug=${encodeURIComponent(slug)}`,
          );
          if (!res.ok) throw new Error(`Failed to load post (${res.status})`);
          const data = await res.json();
          if (!data || !data.slug) throw new Error("Post not found.");
          data.slug = "";
          data.title = `${data.title || slug} (Copy)`;
          loadPostData(data);
          showToast(`🧪 Duplicated draft from: ${slug}`);
        } catch (error) {
          showToast(`❌ ${error.message || "Duplicate failed"}`);
        }
      }

      if (deleteBtn) {
        closePostsMenus();
        const slug = decodeURIComponent(deleteBtn.dataset.slug || "");
        if (!slug) return;
        if (!confirm(`Delete post "${slug}"? This cannot be undone.`)) return;
        if (!adminApiKey) {
          showToast("❌ Add your publishing API key first.");
          return;
        }
        try {
          const res = await fetch(
            `/api/posts/by-slug?slug=${encodeURIComponent(slug)}`,
            {
              method: "DELETE",
              headers: { "x-admin-key": adminApiKey },
            },
          );
          if (!res.ok) {
            let msg = `Failed to delete (${res.status})`;
            try {
              const data = await res.json();
              if (data?.error) msg = data.error;
            } catch {
              // keep fallback
            }
            if (res.status === 401) {
              forceReauth("Invalid API key for delete action.");
              return;
            }
            throw new Error(msg);
          }
          clearCache();
          showToast("🗑️ Post deleted");
          await refreshPostsManager(postsSearch?.value || "");
          if ((postData.slug || slugify(postData.title)) === slug) {
            postData = createEmptyPost();
            contentBlocks = [];
            coverImageSource = "";
            renderAdminInPlace();
          }
        } catch (error) {
          showToast(`❌ ${error.message || "Delete failed"}`);
        }
      }
    });
  }

  // ---- Render blocks ----
  function renderBlocks() {
    blockList.innerHTML = contentBlocks
      .map((block, i) => renderBlockEditor(block, i))
      .join("");
    attachBlockEvents();
  }

  function getDropInsertIndex(e) {
    const targetItem = e.target.closest(".block-item");
    if (!targetItem) return contentBlocks.length;
    const idx = parseInt(targetItem.dataset.index, 10);
    const rect = targetItem.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
  }

  function getInsertIndexFromPointer(clientY) {
    const items = Array.from(blockList.querySelectorAll(".block-item"));
    if (!items.length) return 0;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return items.length;
  }

  function clearLinkedSelection() {
    blockList
      .querySelectorAll(".block-item.linked-selected")
      .forEach((el) => el.classList.remove("linked-selected"));
    previewContent
      ?.querySelectorAll(".preview-block-anchor.linked-selected")
      .forEach((el) => el.classList.remove("linked-selected"));
  }

  function renderPostsManager(items = [], query = "") {
    if (!postsList) return;
    if (!items.length) {
      postsList.innerHTML = `<p class="form-help">No posts found${query ? ` for "${esc(query)}"` : ""}.</p>`;
      return;
    }
    postsList.innerHTML = items
      .map(
        (post) => `
      <div class="admin-post-row">
        <div class="admin-post-meta">
          <strong>${esc(post.title || post.slug)}</strong>
          <span>${esc(post.slug)}</span>
        </div>
        <div class="admin-post-actions-menu">
          <button class="admin-post-menu-trigger" aria-label="Open post actions" title="Post actions">⋯</button>
          <div class="admin-post-context-menu" role="menu">
            <button class="admin-post-menu-item admin-post-edit" role="menuitem" data-slug="${encodeURIComponent(post.slug)}">Edit</button>
            <button class="admin-post-menu-item admin-post-duplicate" role="menuitem" data-slug="${encodeURIComponent(post.slug)}">Duplicate</button>
            <button class="admin-post-menu-item admin-post-delete danger" role="menuitem" data-slug="${encodeURIComponent(post.slug)}">Delete</button>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  async function refreshPostsManager(searchQuery = "") {
    if (!postsList) return;
    try {
      const params = new URLSearchParams({ limit: "100", sort: "newest" });
      if (searchQuery.trim()) params.set("query", searchQuery.trim());
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const items = await res.json();
      renderPostsManager(Array.isArray(items) ? items : [], searchQuery);
    } catch (error) {
      postsList.innerHTML = `<p class="form-help" style="color: var(--color-danger);">${esc(error.message || "Failed to load posts")}</p>`;
    }
  }

  function focusEditorBlock(index) {
    const blockEl = blockList.querySelector(
      `.block-item[data-index="${index}"]`,
    );
    if (!blockEl) return;
    clearLinkedSelection();
    blockEl.classList.add("linked-selected");
    blockEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstField = blockEl.querySelector("input, textarea, select");
    if (firstField) {
      setTimeout(() => firstField.focus(), 180);
    }
  }

  function showLibraryDropIndicator(insertIndex) {
    blockList.querySelectorAll(".block-item").forEach((el) => {
      el.classList.remove("insert-before");
      el.classList.remove("insert-after");
    });

    const items = Array.from(blockList.querySelectorAll(".block-item"));
    if (!items.length) {
      blockList.classList.add("insert-empty");
      return;
    }

    blockList.classList.remove("insert-empty");
    if (insertIndex <= 0) {
      items[0].classList.add("insert-before");
    } else if (insertIndex >= items.length) {
      items[items.length - 1].classList.add("insert-after");
    } else {
      items[insertIndex].classList.add("insert-before");
    }
  }

  function clearLibraryDropIndicator() {
    blockList.classList.remove("insert-empty");
    blockList.classList.remove("library-drop-active");
    blockList.querySelectorAll(".block-item").forEach((el) => {
      el.classList.remove("insert-before");
      el.classList.remove("insert-after");
    });
  }

  function attachBlockEvents() {
    // Delete buttons
    blockList.querySelectorAll(".block-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        contentBlocks.splice(idx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll(".block-insert-trigger").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = btn.dataset.index;
        const menu = blockList.querySelector(
          `.block-insert-menu[data-index="${idx}"]`,
        );
        if (!menu) return;
        blockList.querySelectorAll(".block-insert-menu").forEach((m) => {
          if (m !== menu) m.classList.remove("open");
        });
        menu.classList.toggle("open");
      });
    });

    blockList.querySelectorAll(".block-insert-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const insertAfter = parseInt(btn.dataset.insertIndex, 10);
        const type = btn.dataset.type;
        if (Number.isNaN(insertAfter) || !type) return;
        contentBlocks.splice(insertAfter + 1, 0, createBlock(type));
        renderBlocks();
        updatePreview();
      });
    });

    // Move up/down
    blockList.querySelectorAll(".block-move-up").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        if (idx > 0) {
          [contentBlocks[idx - 1], contentBlocks[idx]] = [
            contentBlocks[idx],
            contentBlocks[idx - 1],
          ];
          renderBlocks();
          updatePreview();
        }
      });
    });

    blockList.querySelectorAll(".block-move-down").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        if (idx < contentBlocks.length - 1) {
          [contentBlocks[idx], contentBlocks[idx + 1]] = [
            contentBlocks[idx + 1],
            contentBlocks[idx],
          ];
          renderBlocks();
          updatePreview();
        }
      });
    });

    // Input changes
    blockList.querySelectorAll("[data-block-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = parseInt(input.dataset.blockIndex);
        const field = input.dataset.blockField;
        contentBlocks[idx][field] = input.value;
        updatePreview();
      });
    });

    // Drag & drop (desktop pointer)
    blockList.querySelectorAll(".block-item").forEach((item) => {
      if (isCoarsePointer) {
        item.setAttribute("draggable", "false");
        return;
      }
      item.addEventListener("dragstart", (e) => {
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        blockList
          .querySelectorAll(".block-item")
          .forEach((el) => el.classList.remove("drop-target"));
        draggedIndex = null;
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = libraryDragType ? "copy" : "move";
        if (libraryDragType) {
          libraryDropIndex = getInsertIndexFromPointer(e.clientY);
          showLibraryDropIndicator(libraryDropIndex);
        }
      });

      item.addEventListener("dragenter", () => {
        if (
          draggedIndex !== null &&
          draggedIndex !== parseInt(item.dataset.index, 10)
        ) {
          item.classList.add("drop-target");
        }
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drop-target");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        item.classList.remove("drop-target");
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
      on(document, "click", () => {
        blockList
          .querySelectorAll(".block-insert-menu")
          .forEach((m) => m.classList.remove("open"));
      });
      insertMenuEventsBound = true;
    }

    blockList.querySelectorAll(".block-insert-menu").forEach((menu) => {
      menu.addEventListener("click", (e) => e.stopPropagation());
    });

    // List item management
    blockList.querySelectorAll(".list-add-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.blockIndex);
        if (!contentBlocks[idx].items) contentBlocks[idx].items = [];
        contentBlocks[idx].items.push("");
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll(".list-remove-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const blockIdx = parseInt(btn.dataset.blockIndex);
        const itemIdx = parseInt(btn.dataset.itemIndex);
        contentBlocks[blockIdx].items.splice(itemIdx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll("[data-list-item]").forEach((input) => {
      input.addEventListener("input", () => {
        const blockIdx = parseInt(input.dataset.blockIndex);
        const itemIdx = parseInt(input.dataset.itemIndex);
        contentBlocks[blockIdx].items[itemIdx] = input.value;
        updatePreview();
      });
    });

    // Pros/cons item management
    blockList.querySelectorAll(".proscons-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.blockIndex);
        const list = btn.dataset.list; // 'pros' or 'cons'
        if (!contentBlocks[idx][list]) contentBlocks[idx][list] = [];
        contentBlocks[idx][list].push("");
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll(".proscons-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const blockIdx = parseInt(btn.dataset.blockIndex);
        const list = btn.dataset.list;
        const itemIdx = parseInt(btn.dataset.itemIndex);
        contentBlocks[blockIdx][list].splice(itemIdx, 1);
        renderBlocks();
        updatePreview();
      });
    });

    blockList.querySelectorAll("[data-proscons-item]").forEach((input) => {
      input.addEventListener("input", () => {
        const blockIdx = parseInt(input.dataset.blockIndex);
        const list = input.dataset.list;
        const itemIdx = parseInt(input.dataset.itemIndex);
        contentBlocks[blockIdx][list][itemIdx] = input.value;
        updatePreview();
      });
    });
  }

  blockList.addEventListener("dragover", (e) => {
    if (isCoarsePointer) return;
    if (!libraryDragType) return;
    e.preventDefault();
    blockList.classList.add("library-drop-active");
    libraryDropIndex = getInsertIndexFromPointer(e.clientY);
    showLibraryDropIndicator(libraryDropIndex);
  });

  blockList.addEventListener("dragleave", (e) => {
    if (isCoarsePointer) return;
    if (!libraryDragType) return;
    if (!blockList.contains(e.relatedTarget)) {
      libraryDropIndex = null;
      clearLibraryDropIndicator();
    }
  });

  blockList.addEventListener("drop", (e) => {
    if (isCoarsePointer) return;
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

  previewContent?.addEventListener("click", (e) => {
    if (!e.ctrlKey) return;
    const anchor = e.target.closest("[data-preview-block-index]");
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    const idx = Number.parseInt(anchor.dataset.previewBlockIndex || "", 10);
    if (Number.isNaN(idx)) return;
    clearLinkedSelection();
    anchor.classList.add("linked-selected");
    focusEditorBlock(idx);
  });

  // ---- Update preview ----
  function bindCustomHeroResizer() {
    if (!previewContent) return;
    const frame = previewContent.querySelector("[data-custom-hero-resizable]");
    const handle = frame?.querySelector("[data-custom-hero-handle]");
    if (!frame || !handle) return;

    const activate = () => frame.classList.add("is-active");
    on(frame, "pointerdown", activate);
    on(frame, "click", activate);

    const onResizeStart = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const start = normalizeCustomHeroSize(postData.coverImageCustomSize);
      const startX = event.clientX;
      const startY = event.clientY;
      activate();
      if (typeof handle.setPointerCapture === "function" && event.pointerId != null) {
        handle.setPointerCapture(event.pointerId);
      }
      const move = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const nextSize = normalizeCustomHeroSize({
          width: Math.round(start.width + deltaX * 2),
          height: Math.round(start.height + deltaY * 2),
        });
        postData.coverImageCustomSize = nextSize;
        if (coverCustomWidthField) coverCustomWidthField.value = String(nextSize.width);
        if (coverCustomHeightField) coverCustomHeightField.value = String(nextSize.height);
        frame.setAttribute("style", customHeroInlineStyle(nextSize, { preview: true }));
        applyCropFrameSizing();
        applyPreviewCropTransforms(previewContent);
      };
      const end = (endEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (
          typeof handle.releasePointerCapture === "function" &&
          endEvent.pointerId != null
        ) {
          try {
            handle.releasePointerCapture(endEvent.pointerId);
          } catch {
            // ignore release failures
          }
        }
        updatePreview();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };

    on(handle, "pointerdown", onResizeStart);
  }

  function updatePreview() {
    if (!previewContent) return;
    let html = "";
    const postRatio =
      postData.coverImageCustomEnabled || postData.coverImagePostRatio === "ratio-custom"
        ? "ratio-custom"
        : postData.coverImagePostRatio || "ratio-16-9";
    const previewRatioClass = toHeroRatioClass(postRatio);
    const selectedCoverEntry = (postData.coverImageLibrary || []).find(
      (item) => item?.id === getSelectedCoverId(),
    );
    const cropMap = getSelectedCropMap();
    const previewCrop =
      (cropMap && cropMap[postRatio]) ||
      (cropMap && cropMap["ratio-16-9"]) ||
      null;
    const previewCover =
      selectedCoverEntry?.src ||
      getSelectedVariantMap()?.[postRatio] ||
      getSelectedVariantMap()?.["ratio-21-9"] ||
      getSelectedVariantMap()?.["ratio-16-9"] ||
      postData.coverImage ||
      coverImageSource;

    if (previewCover) {
      const customAttrs =
        postRatio === "ratio-custom"
          ? ` data-custom-hero-resizable="1" style="${customHeroInlineStyle(postData.coverImageCustomSize, { preview: true })}"`
          : "";
      const customHandle =
        postRatio === "ratio-custom"
          ? `<button type="button" class="hero-resize-handle" data-custom-hero-handle aria-label="Resize hero image"></button>`
          : "";
      html += `
        <div class="post-hero-frame ${previewRatioClass} preview-hero-frame"${customAttrs}>
          <img class="post-hero-image" src="${previewCover}" alt="${esc(postData.title)}" ${cropDatasetAttrs(previewCrop)} />
          ${customHandle}
        </div>
      `;
    }
    if (postData.title) {
      html += `<h2 style="font-size: var(--fs-xl); margin-bottom: var(--space-sm);">${esc(postData.title)}</h2>`;
    }
    if (postData.subtitle) {
      html += `<p style="color: var(--color-text-secondary); margin-bottom: var(--space-md);">${esc(postData.subtitle)}</p>`;
    }

    if (postData.affiliateUrl) {
      const align = ["left", "center", "right"].includes(postData.affiliateButtonAlign)
        ? postData.affiliateButtonAlign
        : "center";
      const btnStyle = [
        postData.affiliateButtonBgColor
          ? `background:${postData.affiliateButtonBgColor}`
          : "",
        postData.affiliateButtonTextColor
          ? `color:${postData.affiliateButtonTextColor}`
          : "",
      ]
        .filter(Boolean)
        .join(";");
      html += `
        <div class="cta-block" style="margin-bottom: var(--space-lg); text-align:${align};">
          <a href="${postData.affiliateUrl}" class="btn btn-affiliate" target="_blank" rel="noopener noreferrer" style="${btnStyle}">
            ${esc(postData.affiliateButtonText) || "Check Price"}
          </a>
        </div>
      `;
    }

    const previewBlocks = contentBlocks
      .map(
        (block, idx) =>
          `<div class="preview-block-anchor" data-preview-block-index="${idx}">${renderBlogContent([block])}</div>`,
      )
      .join("");
    html += `<div class="blog-content">${previewBlocks}</div>`;

    previewContent.innerHTML = html;
    applyPreviewCropTransforms(previewContent);
    bindCustomHeroResizer();
    renderChecklist();
    renderSeoHints();
    persistDraft();
  }

  function renderSeoHints() {
    if (!seoHintsEl) return;
    const title = (postData.seoTitle || postData.title || "").trim();
    const description = (postData.seoDescription || postData.excerpt || "").trim();
    const titleLen = title.length;
    const descLen = description.length;
    const titleGood = titleLen >= 35 && titleLen <= 65;
    const descGood = descLen >= 120 && descLen <= 160;
    seoHintsEl.innerHTML = `
      <p class="form-help">SEO title length: <strong>${titleLen}</strong> (${titleGood ? "good" : "target 35-65"})</p>
      <p class="form-help">SEO description length: <strong>${descLen}</strong> (${descGood ? "good" : "target 120-160"})</p>
    `;
  }

  function getChecklistItems() {
    return [
      { label: "Post title is set", ok: Boolean((postData.title || "").trim()) },
      {
        label: "Cover image is provided",
        ok: Boolean((postData.coverImage || "").trim()),
      },
      { label: "Excerpt is written", ok: Boolean((postData.excerpt || "").trim()) },
      {
        label: "Category is selected",
        ok: Boolean((postData.category || "").trim()),
      },
      { label: "At least 4 content blocks", ok: contentBlocks.length >= 4 },
      {
        label: "Affiliate link has button text",
        ok:
          !postData.affiliateUrl ||
          Boolean((postData.affiliateButtonText || "").trim()),
      },
      {
        label: "SEO title or post title available",
        ok: Boolean((postData.seoTitle || postData.title || "").trim()),
      },
    ];
  }

  function renderChecklist() {
    if (!checklistEl) return;
    const items = getChecklistItems();
    checklistEl.innerHTML = items
      .map(
        (item) => `
        <div class="admin-checklist-item ${item.ok ? "ok" : "warn"}">
          <span>${item.ok ? "✅" : "⚠️"}</span>
          <span>${esc(item.label)}</span>
        </div>
      `,
      )
      .join("");
  }

  // ---- Export JSON ----
  document
    .getElementById("btn-publish")
    ?.addEventListener("click", async () => {
      const payload = buildPublishPayload();
      if (!payload.title) {
        showToast("❌ Title is required before publishing.");
        return;
      }
      if (!adminApiKey) {
        showToast("❌ Add your publishing API key first.");
        return;
      }
      const blockers = getChecklistItems().filter((item) => !item.ok);
      if (
        blockers.length &&
        !confirm(
          `You have ${blockers.length} checklist warning(s). Publish anyway?`,
        )
      ) {
        return;
      }

      try {
        const payloadJson = JSON.stringify(payload);
        const payloadBytes = new Blob([payloadJson]).size;
        if (payloadBytes > 4_200_000) {
          showToast(
            "⚠️ This post payload is very large. Consider fewer display ratios or recropping images.",
          );
        }
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminApiKey,
          },
          body: payloadJson,
        });

        if (!res.ok) {
          let message = "Publish failed. Verify API key and try again.";
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch {
            // Use fallback
          }
          if (res.status === 401) {
            forceReauth("Invalid API key for publish action.");
            return;
          }
          if (res.status === 413) {
            throw new Error(
              "Payload too large. Reduce number of stored image variants or recrop with smaller outputs.",
            );
          }
          throw new Error(message);
        }

        clearCache();
        await refreshPostsManager(postsSearch?.value || "");
        showToast("✅ Published to database successfully!");
      } catch (error) {
        showToast(`❌ ${error.message}`);
      }
    });

  // ---- Export JSON ----
  document.getElementById("btn-export")?.addEventListener("click", () => {
    const json = buildJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${postData.slug || "post"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ JSON file downloaded!");
  });

  // ---- Copy JSON ----
  document.getElementById("btn-copy")?.addEventListener("click", async () => {
    const json = buildJSON();
    try {
      await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
      showToast("📋 Copied to clipboard!");
    } catch {
      showToast("❌ Failed to copy. Try the export button.");
    }
  });

  // ---- Load JSON ----
  document.getElementById("btn-load")?.addEventListener("click", () => {
    document.getElementById("file-input")?.click();
  });

  document.getElementById("file-input")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadPostData(data);
        showToast("✅ Post loaded successfully!");
      } catch {
        showToast("❌ Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  });

  // ---- Clear ----
  document.getElementById("btn-clear")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear everything?")) {
      postData = createEmptyPost();
      contentBlocks = [];
      coverImageSource = "";
      coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
      coverCropStatesByRatio = {};
      coverCropEditorStateBySource = {};
      currentCropSourceKey = "";
      coverCropEditorActiveRatio = "ratio-16-9";
      activeCropRatio = "ratio-16-9";
      localStorage.removeItem(ADMIN_DRAFT_STORAGE);
      renderAdminInPlace();
    }
  });

  if (mobileDockToolsBtn && adminToolsPane) {
    on(mobileDockToolsBtn, "click", () => {
      applyMobileWorkspaceTab("edit");
      adminToolsPane.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (mobileDockPublishBtn) {
    on(mobileDockPublishBtn, "click", () => {
      document.getElementById("btn-publish")?.click();
    });
  }

  if (mobileDockBlocksBtn && adminContentBlocksSection) {
    on(mobileDockBlocksBtn, "click", () => {
      applyMobileWorkspaceTab("edit");
      adminContentBlocksSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  // Initial render
  on(window, "resize", () => {
    if (!cropModal?.classList.contains("open")) return;
    applyCropFrameSizing();
    renderCropImageTransform();
  });
  initMobileSectionAccordions();
  setAutosaveStatus();
  refreshPostsManager();
  renderBlocks();
  updatePreview();
}

function loadPostData(data) {
  postData = {
    ...createEmptyPost(),
    slug: data.slug || "",
    title: data.title || "",
    subtitle: data.subtitle || "",
    author: data.author || "Andy",
    category: data.category || "",
    tags: Array.isArray(data.tags) ? data.tags.join(", ") : data.tags || "",
    date: data.date || new Date().toISOString().split("T")[0],
    featured: data.featured || "",
    coverImage: data.coverImage || "",
    coverImageSelected: data.coverImageSelected || "",
    coverImageLibrary: Array.isArray(data.coverImageLibrary)
      ? data.coverImageLibrary
      : [],
    coverImageVariants:
      data.coverImageVariants && typeof data.coverImageVariants === "object"
        ? data.coverImageVariants
        : {},
    coverImageCrops:
      data.coverImageCrops && typeof data.coverImageCrops === "object"
        ? data.coverImageCrops
        : {},
    coverImagePostRatio:
      typeof data.coverImagePostRatio === "string" &&
      COVER_RATIOS[data.coverImagePostRatio]
        ? data.coverImagePostRatio
        : "ratio-16-9",
    coverImageCustomEnabled: Boolean(data.coverImageCustomEnabled),
    coverImageCustomSize: normalizeCustomHeroSize(data.coverImageCustomSize),
    coverImageDisplayRatios: Array.isArray(data.coverImageDisplayRatios)
      ? (() => {
          const filtered = data.coverImageDisplayRatios.filter(
            (key) => key !== "ratio-custom" && COVER_RATIOS[key],
          );
          return filtered.length ? filtered : getDisplayRatioKeys();
        })()
      : getDisplayRatioKeys(),
    excerpt: data.excerpt || "",
    affiliateUrl: data.affiliateUrl || "",
    affiliateButtonText:
      data.affiliateButtonText || "Check Price & Availability",
    affiliateButtonAlign: data.affiliateButtonAlign || "center",
    affiliateButtonBgColor: data.affiliateButtonBgColor || "",
    affiliateButtonTextColor: data.affiliateButtonTextColor || "",
    seoTitle: data.seoTitle || "",
    seoDescription: data.seoDescription || "",
  };
  if (postData.coverImageCustomEnabled) {
    postData.coverImagePostRatio = "ratio-custom";
  }
  contentBlocks = Array.isArray(data.content) ? data.content : [];
  coverImageSource = postData.coverImage || "";
  const selectedItem = (postData.coverImageLibrary || []).find(
    (i) => i.id === postData.coverImageSelected,
  );
  if (selectedItem?.src) {
    coverImageSource = selectedItem.src;
  }
  coverCropState = { zoom: 1, offsetX: 0, offsetY: 0 };
  coverCropStatesByRatio = {};
  coverCropEditorStateBySource = {};
  currentCropSourceKey = "";
  coverCropEditorActiveRatio = "ratio-16-9";
  activeCropRatio = "ratio-16-9";
  persistDraft();
  renderAdminInPlace();
}

function buildJSON() {
  const slug = slugify(postData.title) || "untitled";
  return {
    slug,
    title: postData.title,
    subtitle: postData.subtitle,
    author: postData.author,
    category: postData.category,
    tags: postData.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    date: postData.date,
    featured: postData.featured ? parseInt(postData.featured, 10) : null,
    coverImage: postData.coverImage,
    coverImageSelected: postData.coverImageSelected || "",
    coverImageLibrary: Array.isArray(postData.coverImageLibrary)
      ? postData.coverImageLibrary
      : [],
    coverImageVariants:
      postData.coverImageVariants && typeof postData.coverImageVariants === "object"
        ? postData.coverImageVariants
        : {},
    coverImageCrops:
      postData.coverImageCrops && typeof postData.coverImageCrops === "object"
        ? postData.coverImageCrops
        : {},
    coverImagePostRatio:
      postData.coverImageCustomEnabled
        ? "ratio-custom"
        : typeof postData.coverImagePostRatio === "string" &&
            COVER_RATIOS[postData.coverImagePostRatio]
          ? postData.coverImagePostRatio
          : "ratio-16-9",
    coverImageCustomEnabled: Boolean(postData.coverImageCustomEnabled),
    coverImageCustomSize: normalizeCustomHeroSize(postData.coverImageCustomSize),
    coverImageDisplayRatios: Array.isArray(postData.coverImageDisplayRatios)
      ? postData.coverImageDisplayRatios.filter(
          (key) => key !== "ratio-custom" && COVER_RATIOS[key],
        )
      : getDisplayRatioKeys(),
    excerpt: postData.excerpt,
    affiliateUrl: postData.affiliateUrl,
    affiliateButtonText: postData.affiliateButtonText,
    affiliateButtonAlign: postData.affiliateButtonAlign || "center",
    affiliateButtonBgColor: postData.affiliateButtonBgColor || "",
    affiliateButtonTextColor: postData.affiliateButtonTextColor || "",
    seoTitle: postData.seoTitle,
    seoDescription: postData.seoDescription,
    content: contentBlocks,
    contentPreview: contentBlocks
      .filter((b) => b.type === "paragraph")
      .slice(0, 3),
  };
}

function buildPublishPayload() {
  const payload = buildJSON();
  payload.coverImageVariants = compactCoverImageVariantsForPublish(payload);
  if (Array.isArray(payload.coverImageLibrary) && payload.coverImageSelected) {
    const selectedItem = payload.coverImageLibrary.find(
      (item) => item?.id === payload.coverImageSelected && item?.src,
    );
    payload.coverImageLibrary = selectedItem ? [selectedItem] : [];
  }
  delete payload.contentPreview;
  return payload;
}

function compactCoverImageVariantsForPublish(payload) {
  const source =
    payload?.coverImageVariants && typeof payload.coverImageVariants === "object"
      ? payload.coverImageVariants
      : {};
  const hasAnyCropData = (() => {
    const root =
      payload?.coverImageCrops && typeof payload.coverImageCrops === "object"
        ? payload.coverImageCrops
        : {};
    const entries = Object.entries(root);
    if (!entries.length) return false;
    const directMode = entries.some(
      ([key, value]) =>
        key.startsWith("ratio-") && value && typeof value === "object",
    );
    if (directMode) return true;
    return entries.some(
      ([, value]) =>
        value &&
        typeof value === "object" &&
        Object.keys(value).some((key) => key.startsWith("ratio-")),
    );
  })();
  if (hasAnyCropData) {
    return {};
  }
  const keepKeys = new Set(
    [
      "ratio-16-9",
      "ratio-21-9",
      payload?.coverImagePostRatio,
      ...(Array.isArray(payload?.coverImageDisplayRatios)
        ? payload.coverImageDisplayRatios
        : []),
    ].filter((key) => typeof key === "string" && key && key !== "ratio-custom"),
  );
  if (payload?.coverImageCustomEnabled) {
    keepKeys.add("ratio-custom");
  }

  const pickMap = (map) => {
    const out = {};
    if (!map || typeof map !== "object") return out;
    for (const key of keepKeys) {
      const value = map[key];
      if (typeof value === "string" && value.trim()) {
        out[key] = value;
      }
    }
    return out;
  };

  const selectedId =
    typeof payload?.coverImageSelected === "string"
      ? payload.coverImageSelected
      : "";
  if (
    selectedId &&
    source[selectedId] &&
    typeof source[selectedId] === "object"
  ) {
    return { [selectedId]: pickMap(source[selectedId]) };
  }

  return pickMap(source);
}

function createBlock(type) {
  const base = { id: uid(), type };
  switch (type) {
    case "heading":
      return { ...base, text: "", level: 2, color: "", fontSize: "" };
    case "paragraph":
      return { ...base, text: "", color: "", fontSize: "", textAlign: "" };
    case "image":
      return {
        ...base,
        src: "",
        alt: "",
        caption: "",
        width: "",
        align: "center",
      };
    case "button":
      return {
        ...base,
        text: "Learn More",
        url: "",
        bgColor: "",
        textColor: "",
        size: "",
        align: "center",
      };
    case "list":
      return { ...base, items: [""], ordered: false };
    case "blockquote":
      return { ...base, text: "", cite: "" };
    case "divider":
      return { ...base, style: "" };
    case "proscons":
      return { ...base, pros: [""], cons: [""] };
    case "rating":
      return { ...base, value: 4, max: 5, label: "" };
    case "cta":
      return {
        ...base,
        heading: "",
        text: "",
        url: "",
        buttonText: "Check Price",
        bgColor: "",
        textColor: "",
      };
    default:
      return base;
  }
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - Number(timestamp || 0);
  if (diff < 5000) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

function toHeroRatioClass(ratioKey) {
  const map = {
    "ratio-custom": "hero-ratio-custom",
    "ratio-3-2": "hero-ratio-3-2",
    "ratio-4-3": "hero-ratio-4-3",
    "ratio-5-4": "hero-ratio-5-4",
    "ratio-16-10": "hero-ratio-16-10",
    "ratio-16-9": "hero-ratio-16-9",
    "ratio-4-5": "hero-ratio-4-5",
    "ratio-1-1": "hero-ratio-1-1",
    "ratio-3-4": "hero-ratio-3-4",
    "ratio-21-9": "hero-ratio-21-9",
  };
  return map[ratioKey] || map["ratio-16-9"];
}

function renderBlockEditor(block, index) {
  const typeLabels = {
    heading: "📝 Heading",
    paragraph: "📄 Paragraph",
    image: "🖼️ Image",
    button: "🔘 Button",
    list: "📋 List",
    blockquote: "💬 Blockquote",
    divider: "➖ Divider",
    proscons: "👍👎 Pros/Cons",
    rating: "⭐ Star Rating",
    cta: "🎯 CTA Block",
  };

  let fields = "";

  switch (block.type) {
    case "heading":
      fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Text</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="text" value="${esc(block.text)}" placeholder="Heading text" />
          </div>
          <div class="form-group">
            <label class="form-label">Level</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="level">
              <option value="2" ${block.level == 2 ? "selected" : ""}>H2</option>
              <option value="3" ${block.level == 3 ? "selected" : ""}>H3</option>
              <option value="4" ${block.level == 4 ? "selected" : ""}>H4</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Color</label>
              <input type="color" data-block-index="${index}" data-block-field="color" value="${block.color || "#2C2C2C"}" />
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

    case "paragraph":
      fields = `
        <div class="form-group">
          <label class="form-label">Text</label>
          <textarea class="form-textarea form-input-sm" data-block-index="${index}" data-block-field="text" rows="3" placeholder="Paragraph text...">${esc(block.text)}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Color</label>
              <input type="color" data-block-index="${index}" data-block-field="color" value="${block.color || "#2C2C2C"}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Font Size</label>
            <input type="text" class="form-input form-input-sm" data-block-index="${index}" data-block-field="fontSize" value="${esc(block.fontSize)}" placeholder="e.g. 1rem" />
          </div>
          <div class="form-group">
            <label class="form-label">Text Align</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="textAlign">
              <option value="" ${!block.textAlign ? "selected" : ""}>Default</option>
              <option value="left" ${block.textAlign === "left" ? "selected" : ""}>Left</option>
              <option value="center" ${block.textAlign === "center" ? "selected" : ""}>Center</option>
              <option value="right" ${block.textAlign === "right" ? "selected" : ""}>Right</option>
            </select>
          </div>
        </div>
      `;
      break;

    case "image":
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
              <option value="center" ${block.align === "center" ? "selected" : ""}>Center</option>
              <option value="left" ${block.align === "left" ? "selected" : ""}>Left</option>
              <option value="right" ${block.align === "right" ? "selected" : ""}>Right</option>
            </select>
          </div>
        </div>
      `;
      break;

    case "button":
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
              <input type="color" data-block-index="${index}" data-block-field="bgColor" value="${block.bgColor || "#D4923A"}" />
            </div>
          </div>
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Text Color</label>
              <input type="color" data-block-index="${index}" data-block-field="textColor" value="${block.textColor || "#FFFFFF"}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Size</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="size">
              <option value="" ${!block.size ? "selected" : ""}>Default</option>
              <option value="small" ${block.size === "small" ? "selected" : ""}>Small</option>
              <option value="large" ${block.size === "large" ? "selected" : ""}>Large</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Position</label>
            <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="align">
              <option value="left" ${block.align === "left" ? "selected" : ""}>Left</option>
              <option value="center" ${!block.align || block.align === "center" ? "selected" : ""}>Center</option>
              <option value="right" ${block.align === "right" ? "selected" : ""}>Right</option>
            </select>
          </div>
        </div>
      `;
      break;

    case "list":
      const listItems = (block.items || [])
        .map(
          (item, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-list-item data-block-index="${index}" data-item-index="${ii}" value="${esc(item)}" placeholder="List item" style="flex: 1;" />
          <button class="block-action-btn delete list-remove-item" data-block-index="${index}" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `,
        )
        .join("");

      fields = `
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="ordered">
            <option value="false" ${!block.ordered ? "selected" : ""}>Bulleted</option>
            <option value="true" ${block.ordered ? "selected" : ""}>Numbered</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Items</label>
          ${listItems}
          <button class="btn btn-sm btn-outline list-add-item" data-block-index="${index}">+ Add Item</button>
        </div>
      `;
      break;

    case "blockquote":
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

    case "divider":
      fields = `
        <div class="form-group">
          <label class="form-label">Style</label>
          <select class="form-select form-input-sm" data-block-index="${index}" data-block-field="style">
            <option value="" ${!block.style ? "selected" : ""}>Simple line</option>
            <option value="dotted" ${block.style === "dotted" ? "selected" : ""}>Dotted</option>
            <option value="thick" ${block.style === "thick" ? "selected" : ""}>Thick gradient</option>
          </select>
        </div>
      `;
      break;

    case "proscons":
      const prosItems = (block.pros || [])
        .map(
          (p, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-proscons-item data-block-index="${index}" data-list="pros" data-item-index="${ii}" value="${esc(p)}" placeholder="Pro..." style="flex: 1;" />
          <button class="block-action-btn delete proscons-remove" data-block-index="${index}" data-list="pros" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `,
        )
        .join("");

      const consItems = (block.cons || [])
        .map(
          (c, ii) => `
        <div style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); align-items: center;">
          <input type="text" class="form-input form-input-sm" data-proscons-item data-block-index="${index}" data-list="cons" data-item-index="${ii}" value="${esc(c)}" placeholder="Con..." style="flex: 1;" />
          <button class="block-action-btn delete proscons-remove" data-block-index="${index}" data-list="cons" data-item-index="${ii}" title="Remove">✕</button>
        </div>
      `,
        )
        .join("");

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

    case "rating":
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

    case "cta":
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
              <input type="color" data-block-index="${index}" data-block-field="bgColor" value="${block.bgColor || "#D4923A"}" />
            </div>
          </div>
          <div class="form-group">
            <div class="color-picker-wrapper">
              <label class="form-label">Text Color</label>
              <input type="color" data-block-index="${index}" data-block-field="textColor" value="${block.textColor || "#FFFFFF"}" />
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
    ["heading", "Heading"],
    ["paragraph", "Paragraph"],
    ["image", "Image"],
    ["button", "Button"],
    ["list", "List"],
    ["blockquote", "Quote"],
    ["divider", "Divider"],
    ["proscons", "Pros/Cons"],
    ["rating", "Rating"],
    ["cta", "CTA"],
  ];

  return types
    .map(
      ([type, label]) =>
        `<button class="block-insert-btn" data-insert-index="${index}" data-type="${type}">+ ${label}</button>`,
    )
    .join("");
}
