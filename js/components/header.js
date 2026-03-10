/**
 * Header Component — Logo, navigation, mobile menu
 */

import { navigateTo, getCurrentPath } from '../router.js';

/**
 * Render the site header.
 */
export function renderHeader() {
  return `
    <header class="site-header" id="site-header">
      <div class="header-inner">
        <a href="#/" class="logo" id="logo-link">
          <div class="logo-icon">🖼️</div>
          <div class="logo-text">Andy<span>The</span>Handyman</div>
        </a>

        <nav class="nav-links" id="nav-links">
          <a href="#/" class="nav-link" data-nav="home">Home</a>
        </nav>

        <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>

    <div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>
    <nav class="mobile-nav" id="mobile-nav">
      <a href="#/" class="mobile-nav-link" data-nav="home">Home</a>
    </nav>
  `;
}

/**
 * Initialize header behavior (scroll hide, mobile menu).
 */
export function initHeader() {
  const header = document.getElementById('site-header');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-nav-overlay');

  if (!header || !menuToggle) return;

  // ---- Scroll hide/show ----
  let lastScroll = 0;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScroll = window.scrollY;
        if (currentScroll > lastScroll && currentScroll > 80) {
          header.classList.add('hidden');
        } else {
          header.classList.remove('hidden');
        }
        lastScroll = currentScroll;
        ticking = false;
      });
      ticking = true;
    }
  });

  // ---- Mobile menu ----
  function toggleMenu() {
    const isOpen = mobileNav.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    menuToggle.classList.add('active');
    mobileNav.classList.add('open');
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    menuToggle.classList.remove('active');
    mobileNav.classList.remove('open');
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
  }

  menuToggle.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', closeMenu);

  // Close on nav link click
  mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // ---- Active link highlighting ----
  function updateActiveNav() {
    const path = getCurrentPath();
    document.querySelectorAll('[data-nav]').forEach(el => {
      const nav = el.getAttribute('data-nav');
      const isActive = (nav === 'home' && path === '/');
      el.classList.toggle('active', isActive);
    });
  }

  updateActiveNav();
  window.addEventListener('routechange', updateActiveNav);
}
