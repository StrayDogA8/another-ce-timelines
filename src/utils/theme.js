export const getInitialThemeKey = (themeConfig) => {
  if (themeConfig.activeTheme && themeConfig.themes?.[themeConfig.activeTheme]) {
    return themeConfig.activeTheme;
  }

  const keys = Object.keys(themeConfig.themes || {});
  return keys[0] || "warm";
};

export const applyTheme = (themeConfig, themeKey) => {
  const themes = themeConfig.themes || {};
  const fallbackKey = themeConfig.activeTheme || Object.keys(themes)[0];
  const theme = themes[themeKey] || themes[fallbackKey];
  if (!theme) return;

  document.body.classList.add("theme-transitioning");
  const root = document.documentElement;
  Object.entries(theme.colors || {}).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  requestAnimationFrame(() => {
    setTimeout(() => document.body.classList.remove("theme-transitioning"), 250);
  });
};
