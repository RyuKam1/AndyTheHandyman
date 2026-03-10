/**
 * Blog Renderer — Converts post JSON content blocks to HTML
 * Supports all block types from the admin CMS.
 */

import { sanitizeHTML } from '../utils/helpers.js';

/**
 * Render an array of content blocks into HTML.
 * @param {Array} blocks — content block array from post JSON
 * @returns {string} HTML string
 */
export function renderBlogContent(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(block => renderBlock(block)).join('\n');
}

/**
 * Render a single content block.
 */
function renderBlock(block) {
  const style = buildStyle(block);

  switch (block.type) {
    case 'heading':
      return renderHeading(block, style);
    case 'paragraph':
      return renderParagraph(block, style);
    case 'image':
      return renderImage(block);
    case 'button':
      return renderButton(block);
    case 'list':
      return renderList(block, style);
    case 'blockquote':
      return renderBlockquote(block, style);
    case 'divider':
      return renderDivider(block);
    case 'proscons':
      return renderProsCons(block);
    case 'rating':
      return renderRating(block);
    case 'cta':
      return renderCTA(block);
    default:
      return '';
  }
}

/**
 * Build inline style string from block properties.
 */
function buildStyle(block) {
  const parts = [];
  if (block.color) parts.push(`color: ${block.color}`);
  if (block.fontSize) parts.push(`font-size: ${block.fontSize}`);
  if (block.textAlign) parts.push(`text-align: ${block.textAlign}`);
  if (block.fontWeight) parts.push(`font-weight: ${block.fontWeight}`);
  if (block.backgroundColor) parts.push(`background-color: ${block.backgroundColor}`);
  if (block.padding) parts.push(`padding: ${block.padding}`);
  if (block.borderRadius) parts.push(`border-radius: ${block.borderRadius}`);
  return parts.length ? ` style="${parts.join('; ')}"` : '';
}

function renderHeading(block, style) {
  const level = block.level || 2;
  const tag = `h${Math.min(Math.max(level, 2), 4)}`;
  return `<${tag}${style}>${block.text || ''}</${tag}>`;
}

function renderParagraph(block, style) {
  return `<p${style}>${block.text || ''}</p>`;
}

function renderImage(block) {
  const wrapStyle = block.align ? ` style="text-align: ${block.align}"` : '';
  const imgStyle = [];
  if (block.width) imgStyle.push(`width: ${block.width}`);
  if (block.maxWidth) imgStyle.push(`max-width: ${block.maxWidth}`);
  if (block.borderRadius) imgStyle.push(`border-radius: ${block.borderRadius}`);
  const styleStr = imgStyle.length ? ` style="${imgStyle.join('; ')}"` : '';

  let html = `<div${wrapStyle}>`;
  html += `<img src="${block.src || ''}" alt="${sanitizeHTML(block.alt || '')}"${styleStr} loading="lazy" />`;
  if (block.caption) {
    html += `<p class="image-caption">${block.caption}</p>`;
  }
  html += `</div>`;
  return html;
}

function renderButton(block) {
  const btnStyle = [];
  if (block.bgColor) btnStyle.push(`background: ${block.bgColor}`);
  if (block.textColor) btnStyle.push(`color: ${block.textColor}`);
  if (block.fontSize) btnStyle.push(`font-size: ${block.fontSize}`);
  const styleStr = btnStyle.length ? ` style="${btnStyle.join('; ')}"` : '';
  const size = block.size === 'large' ? ' btn-lg' : block.size === 'small' ? ' btn-sm' : '';
  const align = block.align ? ` style="text-align: ${block.align}"` : ' style="text-align: center"';

  return `
    <div${align}>
      <a href="${block.url || '#'}" class="btn btn-affiliate${size}" target="_blank" rel="noopener noreferrer"${styleStr}>
        ${block.text || 'Learn More'}
      </a>
    </div>
  `;
}

function renderList(block, style) {
  const tag = block.ordered ? 'ol' : 'ul';
  const items = (block.items || []).map(item => `<li>${item}</li>`).join('');
  return `<${tag}${style}>${items}</${tag}>`;
}

function renderBlockquote(block, style) {
  let html = `<blockquote${style}>${block.text || ''}`;
  if (block.cite) {
    html += `<cite>— ${block.cite}</cite>`;
  }
  html += `</blockquote>`;
  return html;
}

function renderDivider(block) {
  const cls = block.style ? ` ${block.style}` : '';
  return `<hr class="divider${cls}" />`;
}

function renderProsCons(block) {
  const prosItems = (block.pros || []).map(p => `<li>${p}</li>`).join('');
  const consItems = (block.cons || []).map(c => `<li>${c}</li>`).join('');

  return `
    <div class="pros-cons">
      <div class="pros-box">
        <h4>👍 Pros</h4>
        <ul>${prosItems}</ul>
      </div>
      <div class="cons-box">
        <h4>👎 Cons</h4>
        <ul>${consItems}</ul>
      </div>
    </div>
  `;
}

function renderRating(block) {
  const rating = parseFloat(block.value) || 0;
  const max = block.max || 5;
  let stars = '';
  for (let i = 1; i <= max; i++) {
    if (i <= Math.floor(rating)) {
      stars += `<span class="star filled">★</span>`;
    } else if (i === Math.ceil(rating) && rating % 1 !== 0) {
      stars += `<span class="star filled">★</span>`;
    } else {
      stars += `<span class="star">★</span>`;
    }
  }
  const label = block.label ? `<span class="rating-text">${block.label}</span>` : `<span class="rating-text">${rating}/${max}</span>`;
  return `<div class="star-rating">${stars}${label}</div>`;
}

function renderCTA(block) {
  const btnStyle = [];
  if (block.bgColor) btnStyle.push(`background: ${block.bgColor}`);
  if (block.textColor) btnStyle.push(`color: ${block.textColor}`);
  const styleStr = btnStyle.length ? ` style="${btnStyle.join('; ')}"` : '';

  return `
    <div class="cta-block">
      ${block.heading ? `<h3 style="margin-bottom: var(--space-md);">${block.heading}</h3>` : ''}
      ${block.text ? `<p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">${block.text}</p>` : ''}
      <a href="${block.url || '#'}" class="btn btn-affiliate btn-lg" target="_blank" rel="noopener noreferrer"${styleStr}>
        ${block.buttonText || 'Check Price'}
      </a>
    </div>
  `;
}
