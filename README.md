# 
![Temp Banner](docs/temp-banner.png)

A free, open-source app for creating customizable, interactive timelines for worldbuilding and history. Organize events, spans, and eras with tags and groups, link Markdown notes or MediaWiki sources directly to elements, and visualize timelines geographically with map view and coordinate support.

**An [early](https://github.com/sreegjl/timelines/releases/tag/v0.4.0-alpha.2) version is now available for testing.**

- Events, spans, and eras with automatic lane stacking and nested sub-era support
- Map view for elements with latitude/longitude coordinates
- Markdown notes and Wikipedia/MediaWiki source linking per element
- Collapsible groups, tags, and a search overlay
- Custom themes and fonts (with a community marketplace)
- Video and PNG export
- Configurable keyboard shortcuts

[![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB)](#)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?logo=electron&logoColor=fff)](#)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


![Default View](docs/default-view.png)

![Right Panel](docs/right-panel.png)

## Data

Timelines are stored as `.timeline` JSON files and notes as `.md` files. By default these live in your system app data folder. You can point to a custom directory in app settings.

## Development

**Prerequisites:** Node.js 20.19+ or 22+

```bash
npm install
```

**Run in development (Electron + Vite):**
```bash
npm run electron:dev
```

## Building

**Build the Electron app installer:**
```bash
npm run electron:build
```

<!-- ![Design Doc](docs/design-doc.png) -->
