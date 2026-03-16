const SESSION_KEY = 'ath_analytics_session';
const CONSENT_KEY = 'ath_analytics_consent';

let activeRoute = null;
let activeSlug = null;
let routeStartedAt = 0;
let initialized = false;
let hasSeenRouteEvent = false;
let consent = getConsentLevel();

export function initAnalyticsTracking() {
  if (initialized) return;
  initialized = true;
  renderConsentBanner();

  window.addEventListener('routechange', (event) => {
    hasSeenRouteEvent = true;
    const path = event?.detail?.path || window.location.hash.slice(1) || '/';
    handleRouteChange(path);
  });

  window.addEventListener('beforeunload', () => {
    flushTimeSpent();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushTimeSpent();
      routeStartedAt = 0;
    } else if (document.visibilityState === 'visible' && activeRoute && !routeStartedAt) {
      routeStartedAt = Date.now();
    }
  });

  setTimeout(() => {
    if (hasSeenRouteEvent) return;
    const initialPath = window.location.hash.slice(1) || window.location.pathname || '/';
    handleRouteChange(initialPath);
  }, 500);
}

export function trackImpression({ slug, kind = 'generic', route = null } = {}) {
  if (consent !== 'full') return;
  sendEvent({
    eventType: 'impression',
    slug: slug || null,
    kind,
    route: route || activeRoute || '/',
  });
}

export function trackEvent(payload = {}) {
  if (!payload?.eventType) return;
  sendEvent(payload);
}

function handleRouteChange(path) {
  flushTimeSpent();
  if (!shouldTrackRoute(path)) {
    activeRoute = null;
    activeSlug = null;
    routeStartedAt = 0;
    return;
  }

  activeRoute = path || '/';
  activeSlug = extractSlug(activeRoute);
  routeStartedAt = Date.now();

  sendEvent({
    eventType: 'page_view',
    route: activeRoute,
    slug: activeSlug,
  });
}

function flushTimeSpent() {
  if (!activeRoute || !routeStartedAt) return;
  const durationMs = Date.now() - routeStartedAt;
  if (durationMs < 250) return;

  sendEvent({
    eventType: 'time_spent',
    route: activeRoute,
    slug: activeSlug,
    durationMs,
  });
  routeStartedAt = Date.now();
}

function sendEvent(payload) {
  if (!payload?.eventType) return;
  if (consent !== 'full' && payload.eventType === 'impression') return;

  const body = JSON.stringify({
    ...payload,
    consentLevel: consent,
    sessionId: getSessionId(),
    sentAt: new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/event', blob);
      return;
    }
  } catch {
    // fallback to fetch
  }

  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function extractSlug(path) {
  const match = String(path || '').match(/^\/post\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function shouldTrackRoute(path) {
  const route = String(path || '/');
  return !route.startsWith('/admin');
}

function getConsentLevel() {
  const stored = localStorage.getItem(CONSENT_KEY);
  return stored === 'full' ? 'full' : 'minimal';
}

function setConsentLevel(level) {
  consent = level === 'full' ? 'full' : 'minimal';
  localStorage.setItem(CONSENT_KEY, consent);
  document.dispatchEvent(new CustomEvent('analytics-consent-changed', { detail: { consent } }));
}

function renderConsentBanner() {
  if (document.getElementById('analytics-consent-banner')) return;
  const root = document.createElement('div');
  root.id = 'analytics-consent-banner';
  root.className = 'analytics-consent-banner';
  root.innerHTML = `
    <p>We use lightweight analytics to improve content quality.</p>
    <div class="analytics-consent-actions">
      <button class="btn btn-outline btn-sm" type="button" data-consent="minimal">Keep Minimal</button>
      <button class="btn btn-primary btn-sm" type="button" data-consent="full">Allow Full Analytics</button>
    </div>
  `;
  document.body.appendChild(root);
  updateConsentBannerVisibility();

  root.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-consent]');
    if (!btn) return;
    setConsentLevel(btn.dataset.consent || 'minimal');
    updateConsentBannerVisibility();
  });

  document.addEventListener('analytics-consent-changed', updateConsentBannerVisibility);
}

function updateConsentBannerVisibility() {
  const root = document.getElementById('analytics-consent-banner');
  if (!root) return;
  if (consent === 'full') {
    root.classList.add('hidden');
  } else {
    root.classList.remove('hidden');
  }
}
