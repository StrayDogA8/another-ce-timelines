import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import themeConfig from './config/theme.json'
import { applyTheme, getInitialThemeKey } from './utils/theme'

applyTheme(themeConfig, getInitialThemeKey(themeConfig))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
