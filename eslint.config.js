import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-viewer']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['src/viewer/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/HomePage', '**/HomePage.jsx'],
            message: 'HomePage is desktop-shell UI; the web viewer must not import it.',
          },
          {
            group: ['**/electronApi', '**/electronApi.js'],
            message: 'electronApi is the Electron bridge; the web viewer must not import it.',
          },
          {
            group: ['**/electron/*', '*electron*'],
            message: 'Electron main/preload modules must not be imported by the web viewer.',
          },
        ],
      }],
    },
  },
])
