const KEY_RENAMES = {
  "dark-bg": "text-primary",
  "secondary-bg": "surface",
  "active-bg": "accent-color",
  "element-bg": "ui-muted",
  "primary-bg": "app-bg",
  "tertiary-bg": "inset-bg",
  "gray-1": "text-muted",
  "gray-2": "text-subtle",
  "gray-4": "era-label",
  "info-bg": "selection-color",
  "link-blue": "link-color",
};

const REMOVED_KEYS = ["gray-3", "gray-5", "off-white", "hover-bg", "info-blue"];

const OLD_FORMAT_KEYS = [...Object.keys(KEY_RENAMES), ...REMOVED_KEYS];

export const isOldFormatTheme = (theme) => {
  const colors = theme?.colors || {};
  return OLD_FORMAT_KEYS.some((key) => key in colors);
};

export const countOldFormatThemes = (themes) =>
  Object.values(themes || {}).filter(isOldFormatTheme).length;

const hexToRgb = (value) => {
  let hex = String(value || "").trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((ch) => ch + ch).join("");
  }
  if (hex.length !== 6) return null;
  const num = Number.parseInt(hex, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const relativeLuminance = (hexColor) => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const migrateThemeColors = (theme) => {
  const colors = theme?.colors || {};
  const newColors = {};

  Object.entries(colors).forEach(([key, value]) => {
    if (REMOVED_KEYS.includes(key)) return;

    const renamedKey = KEY_RENAMES[key];
    if (renamedKey) {
      if (!(renamedKey in colors)) {
        newColors[renamedKey] = value;
      }
      return;
    }

    newColors[key] = value;
  });

  if (!("surface-active" in newColors) && "accent-color" in newColors) {
    newColors["surface-active"] = newColors["accent-color"];
  }

  const migrated = { ...theme, colors: newColors };

  if (!migrated.type) {
    const bg = newColors["app-bg"] || newColors["surface"];
    const luminance = bg ? relativeLuminance(bg) : null;
    migrated.type = luminance === null || luminance >= 0.5 ? "light" : "dark";
  }

  if (!migrated.collection) {
    migrated.collection = "user";
  }

  return migrated;
};
