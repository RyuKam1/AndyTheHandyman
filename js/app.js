/**
 * App Entry Point — Andy The Handyman
 * Initializes the SPA: header, footer, router, pages.
 */

import { addRoute, initRouter } from './router.js';
import { renderHeader, initHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { renderHomePage } from './pages/home.js';
import { renderPostPage } from './pages/post.js';
import { renderAdminPage } from './pages/admin.js';

/**
 * Initialize the application.
 */
function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // Render shell (header + content container + footer)
  app.innerHTML = `
    ${renderHeader()}
    <main class="page-content" id="page-content"></main>
    ${renderFooter()}
  `;

  // Initialize header behavior
  initHeader();

  // Register routes
  addRoute('/', async () => {
    return await renderHomePage();
  });

  addRoute('/post/:slug', async (params) => {
    return await renderPostPage(params);
  });

  addRoute('/admin', async () => {
    return await renderAdminPage();
  });

  // Start router
  initRouter();
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
