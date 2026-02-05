import themeIndex from "../config/theme.json";

const themeModules = import.meta.glob("../config/themes/*.json", { eager: true });

export const loadThemeConfig = () => {
  const themes = {};

  Object.entries(themeModules).forEach(([path, module]) => {
    const data = module?.default || module;
    if (!data) return;
    const fileName = path.split("/").pop() || "";
    const key = fileName.replace(".json", "");
    if (!key) return;
    themes[key] = data;
  });

  return {
    activeTheme: themeIndex.activeTheme,
    themes,
  };
};
