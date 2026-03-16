/**
 * Post Page — Individual blog/product page
 */

import { getPost, getRelatedPosts } from "../store.js";
import { renderBlogContent } from "../components/blogRenderer.js";
import { renderProductCard } from "../components/productCard.js";
import { updateMeta } from "../utils/seo.js";
import { formatDate, readingTime } from "../utils/helpers.js";
import { trackEvent } from "../utils/analytics.js";

/**
 * Render a blog post page.
 * @param {Object} params — { slug }
 */
export async function renderPostPage(params) {
  const post = await getPost(params.slug);

  if (!post) {
    return `
      <div class="container">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2 class="empty-state-title">Post Not Found</h2>
          <p class="empty-state-text">This product review doesn't exist or may have been removed.</p>
          <a href="#/" class="btn btn-primary" style="margin-top: var(--space-lg);">Back to Home</a>
        </div>
      </div>
    `;
  }

  // Update SEO
  updateMeta({
    title: post.title,
    description: post.excerpt || post.seoDescription || "",
    image: post.coverImage,
  });

  const date = formatDate(post.date);
  const time = readingTime(post.content || []);
  const variants = getVariantMap(post);
  const crops = getCropMap(post);
  const heroRatio = post.coverImageCustomEnabled
    ? "ratio-custom"
    : typeof post.coverImagePostRatio === "string"
      ? post.coverImagePostRatio
      : "ratio-16-9";
  const heroRatioClass = toHeroRatioClass(heroRatio);
  const heroCustomStyle = heroRatio === "ratio-custom"
    ? ` style="${customHeroInlineStyle(post.coverImageCustomSize)}"`
    : "";
  const heroCrop =
    (crops && crops[heroRatio]) ||
    (crops && crops["ratio-16-9"]) ||
    null;
  const selectedLibraryImage = resolveSelectedLibraryImage(post);
  const heroImage =
    (selectedLibraryImage && heroCrop
      ? selectedLibraryImage
      : "") ||
    variants?.[heroRatio] ||
    variants?.["ratio-21-9"] ||
    variants?.["ratio-16-9"] ||
    selectedLibraryImage ||
    post.coverImage;

  const blogHTML = renderBlogContent(post.content || []);
  const affiliateAlign = ["left", "center", "right"].includes(post.affiliateButtonAlign)
    ? post.affiliateButtonAlign
    : "center";
  const affiliateBtnStyle = [
    post.affiliateButtonBgColor ? `background:${post.affiliateButtonBgColor}` : "",
    post.affiliateButtonTextColor ? `color:${post.affiliateButtonTextColor}` : "",
  ]
    .filter(Boolean)
    .join(";");

  const html = `
    <div class="reading-progress" id="reading-progress"></div>
    <div class="container content-width">
      <div class="post-page">
        <a href="#/" class="post-back">← Back to all products</a>

        ${
          heroImage
            ? `
          <div class="post-hero-frame ${heroRatioClass}"${heroCustomStyle}>
            <img class="post-hero-image" src="${heroImage}" alt="${post.title}" ${cropDatasetAttrs(heroCrop)} />
          </div>
        `
            : ""
        }

        <header class="post-header">
          ${post.category ? `<span class="badge post-category">${post.category}</span>` : ""}
          <h1 class="post-title">${post.title}</h1>
          ${post.subtitle ? `<p style="font-size: var(--fs-md); color: var(--color-text-secondary); margin-bottom: var(--space-md);">${post.subtitle}</p>` : ""}
          <div class="post-meta-bar">
            ${post.author ? `<span>By <strong>${post.author}</strong></span>` : ""}
            <span>📅 ${date}</span>
            <span>📖 ${time}</span>
          </div>
        </header>

        <nav class="post-toc" id="post-toc" aria-label="Table of contents"></nav>

        ${
          post.affiliateUrl
            ? `
          <div class="cta-block" style="margin-bottom: var(--space-lg); text-align:${affiliateAlign};">
            <a href="${post.affiliateUrl}" class="btn btn-affiliate btn-lg js-affiliate-link" data-affiliate-kind="primary" target="_blank" rel="noopener noreferrer" style="${affiliateBtnStyle}">
              ${post.affiliateButtonText || "🛒 Check Price & Availability"}
            </a>
          </div>
        `
            : ""
        }

        <article class="blog-content" id="blog-content">
          ${blogHTML}
        </article>

        <div id="related-section"></div>
      </div>
    </div>

    ${
      post.affiliateUrl
        ? `
      <div class="sticky-cta" id="sticky-cta">
        <div class="sticky-cta-inner">
          <span class="sticky-cta-text">${post.title}</span>
          <a href="${post.affiliateUrl}" class="btn btn-accent btn-sm js-affiliate-link" data-affiliate-kind="sticky" target="_blank" rel="noopener noreferrer">
            ${post.affiliateButtonText || "Check Price"}
          </a>
        </div>
      </div>
    `
        : ""
    }
  `;

  // Deferred init
  setTimeout(() => initPostPage(post), 0);

  return html;
}

function resolveSelectedLibraryImage(post) {
  const selected = typeof post?.coverImageSelected === "string" ? post.coverImageSelected : "";
  if (!Array.isArray(post?.coverImageLibrary)) return "";
  if (selected) {
    const item = post.coverImageLibrary.find((entry) => entry?.id === selected);
    if (typeof item?.src === "string") return item.src;
  }
  const fallback = post.coverImageLibrary.find(
    (entry) => typeof entry?.src === "string" && entry.src.trim(),
  );
  return typeof fallback?.src === "string" ? fallback.src : "";
}

function getVariantMap(post) {
  const root = post?.coverImageVariants && typeof post.coverImageVariants === "object"
    ? post.coverImageVariants
    : {};
  const selected = typeof post?.coverImageSelected === "string" ? post.coverImageSelected : "";
  if (selected && root[selected] && typeof root[selected] === "object") {
    return root[selected];
  }
  const firstNested = Object.values(root).find(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  );
  if (firstNested) return firstNested;
  return root;
}

function getCropMap(post) {
  const root = post?.coverImageCrops && typeof post.coverImageCrops === "object"
    ? post.coverImageCrops
    : {};
  const selected = typeof post?.coverImageSelected === "string" ? post.coverImageSelected : "";
  if (selected && root[selected] && typeof root[selected] === "object") {
    return root[selected];
  }
  const firstNested = Object.values(root).find(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  );
  if (firstNested) return firstNested;
  const directKeys = Object.keys(root);
  const hasDirectRatio = directKeys.some((k) => k.startsWith("ratio-") && typeof root[k] === "object");
  if (hasDirectRatio) return root;
  return {};
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

function customHeroInlineStyle(value) {
  const size = normalizeCustomHeroSize(value);
  return `--hero-custom-aspect: ${size.width} / ${size.height}; width: min(100%, ${size.width}px); max-width: min(100%, ${size.width}px);`;
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

function applyCropTransforms(root) {
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

/**
 * Initialize post page behavior.
 */
async function initPostPage(post) {
  applyCropTransforms(document.querySelector(".post-page"));
  window.addEventListener("resize", () => {
    applyCropTransforms(document.querySelector(".post-page"));
  });
  document.querySelectorAll(".js-affiliate-link").forEach((el) => {
    el.addEventListener("click", () => {
      trackEvent({
        eventType: "affiliate_click",
        slug: post.slug,
        route: `/post/${post.slug}`,
        kind: el.dataset.affiliateKind || "affiliate-button",
      });
    });
  });

  // ---- Sticky CTA visibility ----
  const stickyCta = document.getElementById("sticky-cta");
  if (stickyCta) {
    const observer = new IntersectionObserver(
      (entries) => {
        // Show sticky CTA when user scrolls past the hero image
        stickyCta.classList.toggle("visible", !entries[0].isIntersecting);
      },
      { threshold: 0 },
    );

    const heroImg = document.querySelector(".post-hero-image");
    if (heroImg) {
      observer.observe(heroImg);
    } else {
      // No hero image, show after slight scroll
      setTimeout(() => stickyCta.classList.add("visible"), 1000);
    }
  }

  // ---- Reading progress ----
  const progress = document.getElementById("reading-progress");
  const article = document.getElementById("blog-content");
  if (progress && article) {
    const onScroll = () => {
      const rect = article.getBoundingClientRect();
      const total = Math.max(article.scrollHeight - window.innerHeight, 1);
      const consumed = Math.min(
        Math.max(window.scrollY - (window.scrollY + rect.top), 0),
        total,
      );
      const pct = Math.min(100, Math.max(0, (consumed / total) * 100));
      progress.style.transform = `scaleX(${pct / 100})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- Table of contents ----
  const toc = document.getElementById("post-toc");
  if (toc && article) {
    const headings = Array.from(article.querySelectorAll("h2, h3"));
    if (headings.length >= 2) {
      toc.innerHTML = `
        <p class="post-toc-title">On this page</p>
        <div class="post-toc-list">
          ${headings
            .map((heading, idx) => {
              const text = heading.textContent?.trim() || `Section ${idx + 1}`;
              const id = heading.id || `section-${idx + 1}`;
              heading.id = id;
              const level = heading.tagName.toLowerCase();
              return `<a class="post-toc-link ${level}" href="#${id}">${text}</a>`;
            })
            .join("")}
        </div>
      `;
      toc.addEventListener("click", (e) => {
        const link = e.target.closest(".post-toc-link");
        if (!link) return;
        e.preventDefault();
        const id = link.getAttribute("href")?.replace("#", "");
        if (!id) return;
        document.getElementById(id)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } else {
      toc.remove();
    }
  }

  // ---- Related posts ----
  if (post.category) {
    const relatedPosts = await getRelatedPosts(post.slug, post.category, 3);
    const relatedSection = document.getElementById("related-section");

    if (relatedSection && relatedPosts.length > 0) {
      relatedSection.innerHTML = `
        <section class="related-section">
          <h3>You Might Also Like</h3>
          <div class="related-grid">
            ${relatedPosts.map((p) => renderProductCard(p)).join("")}
          </div>
        </section>
      `;
    }
  }
}
