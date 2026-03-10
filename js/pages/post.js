/**
 * Post Page — Individual blog/product page
 */

import { getPost, getRelatedPosts } from "../store.js";
import { renderBlogContent } from "../components/blogRenderer.js";
import { renderProductCard } from "../components/productCard.js";
import { updateMeta } from "../utils/seo.js";
import { formatDate, readingTime } from "../utils/helpers.js";

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

  const blogHTML = renderBlogContent(post.content || []);

  const html = `
    <div class="container content-width">
      <div class="post-page">
        <a href="#/" class="post-back">← Back to all products</a>

        ${post.coverImage ? `<img class="post-hero-image" src="${post.coverImage}" alt="${post.title}" />` : ""}

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

        <article class="blog-content" id="blog-content">
          ${blogHTML}
        </article>

        ${
          post.affiliateUrl
            ? `
          <div class="cta-block" style="margin-top: var(--space-2xl);">
            <h3 style="margin-bottom: var(--space-md);">Interested in this product?</h3>
            <a href="${post.affiliateUrl}" class="btn btn-affiliate btn-lg" target="_blank" rel="noopener noreferrer">
              ${post.affiliateButtonText || "🛒 Check Price & Availability"}
            </a>
          </div>
        `
            : ""
        }

        <div id="related-section"></div>
      </div>
    </div>

    ${
      post.affiliateUrl
        ? `
      <div class="sticky-cta" id="sticky-cta">
        <div class="sticky-cta-inner">
          <span class="sticky-cta-text">${post.title}</span>
          <a href="${post.affiliateUrl}" class="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">
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

/**
 * Initialize post page behavior.
 */
async function initPostPage(post) {
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
