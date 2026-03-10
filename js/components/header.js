/**
 * Header Component — Logo, navigation, mobile menu
 */

import { navigateTo, getCurrentPath } from '../router.js';
import { applyTheme, getCurrentTheme, getThemeLabel, getThemeOptions } from '../utils/theme.js';

/**
 * Render the site header.
 */
export function renderHeader() {
  const options = getThemeOptions()
    .map((theme) => `<button class="theme-option" data-theme-id="${theme.id}" type="button">${theme.label}</button>`)
    .join('');

  const mobileOptions = getThemeOptions()
    .map((theme) => `<option value="${theme.id}">${theme.label}</option>`)
    .join('');

  return `
    <header class="site-header" id="site-header">
      <div class="header-inner">
        <a href="#/" class="logo" id="logo-link">
          <div class="logo-icon">🖼️</div>
          <div class="logo-text">Andy<span>The</span>Handyman</div>
        </a>

        <nav class="nav-links" id="nav-links">
          <a href="#/" class="nav-link" data-nav="home">Home</a>
          <div class="theme-switcher" id="theme-switcher">
            <button class="theme-trigger" id="theme-trigger" type="button" aria-haspopup="menu" aria-expanded="false">
              Theme: <span id="theme-current-label">${getThemeLabel(getCurrentTheme())}</span>
            </button>
            <div class="theme-menu" id="theme-menu" role="menu">
              ${options}
            </div>
          </div>
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
      <div class="mobile-theme-picker">
        <label for="mobile-theme-select">Theme</label>
        <select id="mobile-theme-select">${mobileOptions}</select>
      </div>
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
  const themeSwitcher = document.getElementById('theme-switcher');
  const themeTrigger = document.getElementById('theme-trigger');
  const themeMenu = document.getElementById('theme-menu');
  const themeCurrentLabel = document.getElementById('theme-current-label');
  const mobileThemeSelect = document.getElementById('mobile-theme-select');

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

  function applyAndRefreshTheme(themeId) {
    const finalTheme = applyTheme(themeId);
    if (themeCurrentLabel) themeCurrentLabel.textContent = getThemeLabel(finalTheme);
    if (mobileThemeSelect) mobileThemeSelect.value = finalTheme;
  }

  if (themeTrigger && themeMenu && themeSwitcher) {
    themeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = themeSwitcher.classList.toggle('open');
      themeTrigger.setAttribute('aria-expanded', String(isOpen));
    });

    themeMenu.addEventListener('click', (e) => {
      const option = e.target.closest('.theme-option');
      if (!option) return;
      applyAndRefreshTheme(option.dataset.themeId);
      themeSwitcher.classList.remove('open');
      themeTrigger.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('click', (e) => {
      if (!themeSwitcher.contains(e.target)) {
        themeSwitcher.classList.remove('open');
        themeTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (mobileThemeSelect) {
    mobileThemeSelect.value = getCurrentTheme();
    mobileThemeSelect.addEventListener('change', () => applyAndRefreshTheme(mobileThemeSelect.value));
  }

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
