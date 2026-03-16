import { updateMeta } from '../utils/seo.js';
import { showToast } from '../utils/helpers.js';

const ADMIN_AUTH_STORAGE = 'ath_admin_auth';
const ADMIN_KEY_STORAGE = 'ath_admin_api_key';

export async function renderAdminAnalyticsPage() {
  updateMeta({ title: 'Admin Analytics' });
  setTimeout(() => initAnalyticsPage(), 0);

  const isAuthenticated = sessionStorage.getItem(ADMIN_AUTH_STORAGE) === '1';
  if (!isAuthenticated) {
    return `
      <div class="container">
        <div class="admin-login">
          <div style="font-size: 3rem; margin-bottom: var(--space-md);">📊</div>
          <h2>Analytics Access</h2>
          <p>Sign in through the admin dashboard to view analytics.</p>
          <a href="#/admin" class="btn btn-primary btn-lg" style="width: 100%;">Go To Admin Sign In</a>
        </div>
      </div>
    `;
  }

  const { from, to } = defaultRange(7);

  return `
    <div class="container admin-page admin-analytics-page">
      <div class="admin-tabs">
        <a href="#/admin" class="admin-tab">Editor</a>
        <a href="#/admin/analytics" class="admin-tab active">Analytics</a>
      </div>

      <div class="analytics-header">
        <div>
          <h2 style="margin: 0 0 var(--space-xs);">📈 Website Analytics</h2>
          <p class="form-help" style="margin: 0;">Track engagement, visibility, and reading behavior across the blog.</p>
        </div>
        <div class="analytics-actions">
          <button class="btn btn-outline btn-sm" data-range-days="7">Last 7d</button>
          <button class="btn btn-outline btn-sm" data-range-days="30">Last 30d</button>
          <button class="btn btn-outline btn-sm" data-range-days="90">Last 90d</button>
          <button class="btn btn-primary btn-sm" id="analytics-refresh-btn">Refresh</button>
        </div>
      </div>

      <div class="analytics-filters admin-section">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">From</label>
            <input class="form-input" type="datetime-local" id="analytics-from" value="${from}" />
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input class="form-input" type="datetime-local" id="analytics-to" value="${to}" />
          </div>
          <div class="form-group">
            <label class="form-label">Include Bot Traffic</label>
            <label class="analytics-check-row">
              <input type="checkbox" id="analytics-include-bots" />
              <span class="form-help" style="margin: 0;">Disabled by default for cleaner real-user metrics.</span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Analytics Control API Key</label>
            <input class="form-input" type="password" id="analytics-admin-key" value="${escapeHtml(sessionStorage.getItem(ADMIN_KEY_STORAGE) || '')}" placeholder="Needed for clear actions" />
          </div>
          <div class="form-group">
            <label class="form-label">Control Actions</label>
            <div class="analytics-actions-row">
              <button class="btn btn-outline btn-sm" id="analytics-export-btn">Export JSON</button>
              <button class="btn btn-outline btn-sm" id="analytics-copy-btn">Copy Report</button>
              <button class="btn btn-outline btn-sm" id="analytics-clear-range-btn">Clear Range</button>
              <button class="btn btn-outline btn-sm" id="analytics-clear-all-btn" style="color: var(--color-danger);">Clear All</button>
            </div>
          </div>
        </div>
      </div>

      <div id="analytics-cards" class="analytics-cards">
        ${renderMetricCard('Total Page Views', '—')}
        ${renderMetricCard('Unique Visitors', '—')}
        ${renderMetricCard('Total Impressions', '—')}
        ${renderMetricCard('Affiliate Clicks', '—')}
        ${renderMetricCard('Avg Time/Interaction', '—')}
        ${renderMetricCard('Total Time Spent', '—')}
      </div>

      <div class="analytics-grid">
        <section class="admin-section">
          <h3 class="admin-section-title">Top Blogs By Views</h3>
          <div id="analytics-top-views">${renderLoadingRows()}</div>
        </section>
        <section class="admin-section">
          <h3 class="admin-section-title">Top Blogs By Impressions</h3>
          <div id="analytics-top-impressions">${renderLoadingRows()}</div>
        </section>
        <section class="admin-section">
          <h3 class="admin-section-title">Top Blogs By Affiliate Clicks</h3>
          <div id="analytics-top-affiliate-clicks">${renderLoadingRows()}</div>
        </section>
      </div>

      <div class="analytics-grid">
        <section class="admin-section">
          <h3 class="admin-section-title">Page Views By Route</h3>
          <div id="analytics-route-views">${renderLoadingRows()}</div>
        </section>
        <section class="admin-section">
          <h3 class="admin-section-title">Time Spent By Route</h3>
          <div id="analytics-route-time">${renderLoadingRows()}</div>
        </section>
      </div>

      <section class="admin-section" style="margin-top: var(--space-md);">
        <h3 class="admin-section-title">Blog Funnel (Impression → View → Affiliate Click)</h3>
        <div id="analytics-funnel">${renderLoadingRows()}</div>
      </section>
    </div>
  `;
}

function initAnalyticsPage() {
  if (!document.getElementById('analytics-cards')) return;
  const refreshBtn = document.getElementById('analytics-refresh-btn');
  const fromInput = document.getElementById('analytics-from');
  const toInput = document.getElementById('analytics-to');
  const exportBtn = document.getElementById('analytics-export-btn');
  const copyBtn = document.getElementById('analytics-copy-btn');
  const includeBotsInput = document.getElementById('analytics-include-bots');
  const adminKeyInput = document.getElementById('analytics-admin-key');
  const clearRangeBtn = document.getElementById('analytics-clear-range-btn');
  const clearAllBtn = document.getElementById('analytics-clear-all-btn');
  let lastSummary = null;
  let lastCompareSummary = null;

  async function load() {
    const fromISO = fromInput?.value ? new Date(fromInput.value).toISOString() : '';
    const toISO = toInput?.value ? new Date(toInput.value).toISOString() : '';
    const includeBots = !!includeBotsInput?.checked;
    const params = new URLSearchParams();
    if (fromISO) params.set('from', fromISO);
    if (toISO) params.set('to', toISO);
    if (includeBots) params.set('includeBots', 'true');

    try {
      if (refreshBtn) refreshBtn.disabled = true;
      const res = await fetch(`/api/analytics/summary?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load analytics');
      lastSummary = data;
      const compare = await loadCompareWindow(fromISO, toISO, includeBots);
      lastCompareSummary = compare;
      renderAnalyticsData(data, compare);
    } catch (error) {
      showToast(error?.message || 'Failed to load analytics', 'error');
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  refreshBtn?.addEventListener('click', load);
  fromInput?.addEventListener('change', load);
  toInput?.addEventListener('change', load);
  includeBotsInput?.addEventListener('change', load);
  adminKeyInput?.addEventListener('change', () => {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKeyInput.value || '');
  });

  document.querySelectorAll('[data-range-days]').forEach((button) => {
    button.addEventListener('click', () => {
      const days = Number.parseInt(button.dataset.rangeDays || '7', 10);
      const next = defaultRange(days);
      if (fromInput) fromInput.value = next.from;
      if (toInput) toInput.value = next.to;
      load();
    });
  });

  exportBtn?.addEventListener('click', () => {
    if (!lastSummary) return showToast('Load analytics first', 'error');
    const blob = new Blob([JSON.stringify(lastSummary, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  copyBtn?.addEventListener('click', async () => {
    if (!lastSummary) return showToast('Load analytics first', 'error');
    const t = lastSummary?.totals || {};
    const c = lastCompareSummary?.totals || {};
    const report = [
      `Page views: ${formatNumber(t.totalPageViews)}`,
      `Page views delta: ${formatDelta(t.totalPageViews, c.totalPageViews)}`,
      `Unique visitors: ${formatNumber(t.uniqueVisitors)}`,
      `Impressions: ${formatNumber(t.totalImpressions)}`,
      `Affiliate clicks: ${formatNumber(t.totalAffiliateClicks)}`,
      `Avg interaction time: ${formatDuration(t.avgTimeSpentMs)}`,
      `Total time spent: ${formatDuration(t.totalTimeSpentMs)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      showToast('Analytics report copied', 'success');
    } catch {
      showToast('Unable to copy report', 'error');
    }
  });

  clearRangeBtn?.addEventListener('click', async () => {
    if (!confirm('Delete analytics data only for the selected date range?')) return;
    await clearAnalytics(false);
  });

  clearAllBtn?.addEventListener('click', async () => {
    if (!confirm('Delete ALL analytics data? This cannot be undone.')) return;
    await clearAnalytics(true);
  });

  load();

  async function clearAnalytics(all) {
    const key = (adminKeyInput?.value || '').trim();
    if (!key) return showToast('API key required for clear action', 'error');
    const fromISO = fromInput?.value ? new Date(fromInput.value).toISOString() : '';
    const toISO = toInput?.value ? new Date(toInput.value).toISOString() : '';
    const params = new URLSearchParams();
    if (all) {
      params.set('all', 'true');
    } else {
      if (fromISO) params.set('from', fromISO);
      if (toISO) params.set('to', toISO);
    }
    try {
      const res = await fetch(`/api/analytics/summary?${params.toString()}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': key },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to clear analytics');
      showToast(`Deleted ${formatNumber(data.deleted || 0)} events`, 'success');
      load();
    } catch (error) {
      showToast(error?.message || 'Failed to clear analytics', 'error');
    }
  }
}

async function loadCompareWindow(fromISO, toISO, includeBots) {
  if (!fromISO || !toISO) return null;
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const ms = Math.max(1, to.getTime() - from.getTime());
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - ms);
  const params = new URLSearchParams({
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
  });
  if (includeBots) params.set('includeBots', 'true');
  const res = await fetch(`/api/analytics/summary?${params.toString()}`);
  if (!res.ok) return null;
  return await res.json();
}

function renderAnalyticsData(data, compareData) {
  const totals = data?.totals || {};
  const prev = compareData?.totals || {};
  const cardsEl = document.getElementById('analytics-cards');
  if (cardsEl) {
    cardsEl.innerHTML = [
      renderMetricCard('Total Page Views', formatNumber(totals.totalPageViews || 0), formatDelta(totals.totalPageViews, prev.totalPageViews)),
      renderMetricCard('Unique Visitors', formatNumber(totals.uniqueVisitors || 0), formatDelta(totals.uniqueVisitors, prev.uniqueVisitors)),
      renderMetricCard('Total Impressions', formatNumber(totals.totalImpressions || 0), formatDelta(totals.totalImpressions, prev.totalImpressions)),
      renderMetricCard('Affiliate Clicks', formatNumber(totals.totalAffiliateClicks || 0), formatDelta(totals.totalAffiliateClicks, prev.totalAffiliateClicks)),
      renderMetricCard('Avg Time/Interaction', formatDuration(totals.avgTimeSpentMs || 0), formatDelta(totals.avgTimeSpentMs, prev.avgTimeSpentMs, true)),
      renderMetricCard('Total Time Spent', formatDuration(totals.totalTimeSpentMs || 0), formatDelta(totals.totalTimeSpentMs, prev.totalTimeSpentMs, true)),
    ].join('');
  }

  replaceRows('analytics-top-views', data.topBlogsByViews, 'views');
  replaceRows('analytics-top-impressions', data.topBlogsByImpressions, 'impressions');
  replaceRows('analytics-top-affiliate-clicks', data.topBlogsByAffiliateClicks, 'clicks');
  replaceRows('analytics-route-views', data.pageViewsByRoute, 'views', 'route');
  replaceRows('analytics-route-time', data.routeTime, 'time_ms', 'route', true);
  replaceFunnel('analytics-funnel', data.funnelByBlog);
}

function replaceRows(id, rows, valueKey, labelKey = 'slug', isDuration = false) {
  const root = document.getElementById(id);
  if (!root) return;
  if (!rows?.length) {
    root.innerHTML = `<p class="form-help">No data in this time range.</p>`;
    return;
  }
  root.innerHTML = `<div class="analytics-list">${rows.map((row) => {
    const label = escapeHtml(row[labelKey] || '(unknown)');
    const value = isDuration
      ? formatDuration(Number(row[valueKey] || 0))
      : formatNumber(Number(row[valueKey] || 0));
    return `<div class="analytics-list-item"><span>${label}</span><strong>${value}</strong></div>`;
  }).join('')}</div>`;
}

function replaceFunnel(id, rows) {
  const root = document.getElementById(id);
  if (!root) return;
  if (!rows?.length) {
    root.innerHTML = `<p class="form-help">No funnel data in this time range.</p>`;
    return;
  }
  root.innerHTML = `
    <div class="analytics-table-wrap">
      <table class="analytics-table">
        <thead>
          <tr>
            <th>Blog</th>
            <th>Impressions</th>
            <th>Views</th>
            <th>View Rate</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>Time Spent</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.slug || '(unknown)')}</td>
              <td>${formatNumber(row.impressions || 0)}</td>
              <td>${formatNumber(row.views || 0)}</td>
              <td>${formatPercent(row.viewRate || 0)}</td>
              <td>${formatNumber(row.clicks || 0)}</td>
              <td>${formatPercent(row.clickThroughRate || 0)}</td>
              <td>${formatDuration(row.time_ms || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMetricCard(label, value, delta = '') {
  return `
    <div class="analytics-card admin-section">
      <p class="analytics-card-label">${label}</p>
      <h3 class="analytics-card-value">${value}</h3>
      ${delta ? `<p class="analytics-card-delta">${delta}</p>` : ''}
    </div>
  `;
}

function renderLoadingRows() {
  return `<p class="form-help">Loading data...</p>`;
}

function defaultRange(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: toDatetimeLocal(from),
    to: toDatetimeLocal(to),
  };
}

function toDatetimeLocal(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatDelta(current, previous, isDuration = false) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  if (b === 0 && a === 0) return 'vs previous: 0%';
  if (b === 0) return 'vs previous: +100%';
  const pct = ((a - b) / Math.abs(b)) * 100;
  const sign = pct > 0 ? '+' : '';
  if (isDuration) {
    return `vs previous: ${sign}${pct.toFixed(1)}% (${formatDuration(a - b)} delta)`;
  }
  return `vs previous: ${sign}${pct.toFixed(1)}%`;
}

function formatPercent(value) {
  const n = Number(value || 0);
  return `${n.toFixed(2)}%`;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
