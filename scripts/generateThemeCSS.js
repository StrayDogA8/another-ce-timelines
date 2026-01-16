import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const themePath = join(__dirname, '../src/config/theme.json');
const cssPath = join(__dirname, '../src/styles/02-theme.css');

// Read the theme JSON
const themeData = JSON.parse(readFileSync(themePath, 'utf8'));

const activeThemeName = themeData.activeTheme;
const activeTheme = themeData.themes[activeThemeName];

if (!activeTheme) {
  console.error(`Error: Theme "${activeThemeName}" not found in theme.json`);
  process.exit(1);
}

// Generate CSS content
let cssContent = ':root {\n';

for (const [key, value] of Object.entries(activeTheme.colors)) {
  cssContent += `  --${key}: ${value};\n`;
}

cssContent += '}\n';

writeFileSync(cssPath, cssContent, 'utf8');

console.log(`✓ Theme CSS generated successfully (using "${activeTheme.name}" theme)`);
