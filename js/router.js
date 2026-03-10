/**
 * Router — Hash-based SPA routing
 * Supports: #/, #/post/:slug, #/admin
 */

const routes = [];
let notFoundHandler = null;

/**
 * Register a route pattern with its handler.
 * @param {string} pattern — e.g. '/', '/post/:slug', '/admin'
 * @param {Function} handler — async (params) => HTMLString
 */
export function addRoute(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');

  routes.push({
    pattern,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
  });
}

/**
 * Set a fallback handler for unknown routes.
 */
export function setNotFound(handler) {
  notFoundHandler = handler;
}

/**
 * Navigate to a given path (updates hash).
 */
export function navigateTo(path) {
  window.location.hash = path;
}

/**
 * Get the current path from hash.
 */
export function getCurrentPath() {
  const hashPath = window.location.hash.slice(1).trim();
  if (hashPath) return hashPath;

  const pathname = window.location.pathname || '/';
  return pathname;
}

/**
 * Match a path against registered routes.
 */
function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { handler: route.handler, params };
    }
  }
  return null;
}

/**
 * Render the current route into #app.
 */
async function handleRoute() {
  const path = getCurrentPath();
  const matched = matchRoute(path);

  const contentEl = document.querySelector('.page-content');
  if (!contentEl) return;

  // Fade out
  contentEl.style.opacity = '0';
  contentEl.style.transform = 'translateY(8px)';

  await new Promise(r => setTimeout(r, 150));

  if (matched) {
    const html = await matched.handler(matched.params);
    contentEl.innerHTML = html;
  } else if (notFoundHandler) {
    contentEl.innerHTML = await notFoundHandler();
  } else {
    contentEl.innerHTML = `
      <div class="container">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2 class="empty-state-title">Page Not Found</h2>
          <p class="empty-state-text">The page you're looking for doesn't exist.</p>
          <a href="#/" class="btn btn-primary" style="margin-top: var(--space-lg);">Back to Home</a>
        </div>
      </div>
    `;
  }

  // Fade in
  requestAnimationFrame(() => {
    contentEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    contentEl.style.opacity = '1';
    contentEl.style.transform = 'translateY(0)';
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Signal that the route has changed (for components to update)
  window.dispatchEvent(new CustomEvent('routechange', { detail: { path } }));
}

/**
 * Initialize the router.
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);
  // Handle initial load
  handleRoute();
}
