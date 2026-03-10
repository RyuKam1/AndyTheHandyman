const THEME_STORAGE_KEY = 'ath_theme';
const DEFAULT_THEME = 'blossom-studio';

const THEME_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'moody', label: 'Moody' },
  { id: 'blossom-studio', label: 'Blossom Studio' },
];

export function getThemeOptions() {
  return THEME_OPTIONS;
}

export function getCurrentTheme() {
  const selected = localStorage.getItem(THEME_STORAGE_KEY);
  if (THEME_OPTIONS.some((theme) => theme.id === selected)) return selected;
  return DEFAULT_THEME;
}

export function getThemeLabel(themeId) {
  return THEME_OPTIONS.find((theme) => theme.id === themeId)?.label || 'Theme';
}

export function applyTheme(themeId, { persist = true } = {}) {
  const finalTheme = THEME_OPTIONS.some((theme) => theme.id === themeId) ? themeId : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', finalTheme);
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, finalTheme);
  }
  return finalTheme;
}

export function initTheme() {
  return applyTheme(getCurrentTheme(), { persist: false });
}
