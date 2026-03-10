/**
 * Footer Component
 */

export function renderFooter() {
  const year = new Date().getFullYear();
  return `
    <footer class="site-footer">
      <div class="container footer-content">
        <div class="footer-links">
          <a href="#/" class="footer-link">Home</a>
        </div>
        <p class="footer-disclosure">
          <strong>Affiliate Disclosure:</strong> Some of the links on this site are affiliate links.
          This means if you click on the link and purchase the item, we may receive an affiliate commission
          at no extra cost to you. All opinions remain our own.
        </p>
        <p class="footer-copyright">© ${year} Andy The Handyman. All rights reserved.</p>
      </div>
    </footer>
  `;
}
