const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const fsSync = require('fs');
const { autoUpdater } = require('electron-updater');
const DEFAULT_THEME_KEY = 'parchment';

// Force sRGB color profile to prevent washed-out appearance in screenshots/screenshare on HDR displays
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// Must run before app.ready
try {
  const settingsPath = path.join(app.getPath('userData'), 'app-settings.json');
  const raw = fsSync.readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(raw);
  if (settings?.hardwareAcceleration === false) {
    app.disableHardwareAcceleration();
  }
} catch {
  // Leave hardware acceleration at default (enabled)
}

let mainWindow;
const appSettingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');
const defaultTimelinesDir = () => path.join(app.getPath('userData'), 'timelines');
const cloudCacheDir = () => path.join(app.getPath('userData'), 'cloud-cache');
const userThemesDir = () => path.join(app.getPath('userData'), 'themes');
const defaultFontsDir = () => path.join(app.getPath('userData'), 'fonts');

const getCloudCacheDir = async () => {
  const dir = cloudCacheDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const safeName = (value) => String(value || '')
  .trim()
  .replace(/[^\w.-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const getTimelineIdFromTitle = (title) => safeName(title) || 'timeline';

const sanitizeId = (value, fallback = '') => safeName(value) || fallback;

const sanitizeTimelineId = (value) => sanitizeId(value, 'timeline');

const sanitizeNoteFilename = (value) => {
  const base = String(value || '').replace(/\.md$/i, '');
  const cleaned = sanitizeId(base, 'note');
  return `${cleaned}.md`;
};

const resolveNotePath = async (timelineId, notePath) => {
  const notesRootDir = await getNotesRootDir();
  const notesDir = await getNotesDir(sanitizeTimelineId(timelineId));
  const rawPath = String(notePath || '').trim();
  if (!rawPath) {
    throw new Error('Missing note path');
  }

  const usesRelativePath = rawPath.includes('/') || rawPath.includes('\\');
  const base = usesRelativePath ? notesRootDir : notesDir;
  const relativePath = usesRelativePath ? rawPath : sanitizeNoteFilename(rawPath);

  const resolvedBase = path.resolve(base);
  const resolvedPath = path.resolve(base, relativePath);

  if (resolvedPath === resolvedBase) {
    throw new Error('Invalid note path');
  }

  const relative = path.relative(resolvedBase, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Note path outside notes folder');
  }

  return resolvedPath;
};
const ensureUniqueNoteFilename = async (notesDir, desiredFilename) => {
  const base = String(desiredFilename || '').replace(/\.md$/i, '');
  const cleaned = sanitizeId(base, 'note');
  let candidate = `${cleaned}.md`;
  let counter = 2;
  while (true) {
    try {
      await fs.access(path.join(notesDir, candidate));
      candidate = `${cleaned}-${counter}.md`;
      counter += 1;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return candidate;
      }
      throw error;
    }
  }
};

const readAppSettings = async () => {
  try {
    const content = await fs.readFile(appSettingsPath(), 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
};

const getTimelinesDir = async () => {
  const settings = await readAppSettings();
  const customDir = settings?.timelineStorageDir ?? settings?.storageDir;
  if (customDir && typeof customDir === 'string') {
    const trimmed = customDir.trim();
    if (trimmed) return trimmed;
  }
  return defaultTimelinesDir();
};

const getNotesBaseDir = async () => {
  const baseDir = await getNotesRootDir();
  const settings = await readAppSettings();
  const useSubfolder = settings?.notesSubfolderEnabled === true;
  const subfolderValue = useSubfolder ? String(settings?.notesSubfolder || '').trim() : '';
  const normalizeSubfolder = (value) => {
    if (!value) return '';
    if (path.isAbsolute(value)) return '';
    const normalized = path.normalize(value);
    const parts = normalized.split(path.sep).filter(Boolean);
    if (parts.some((part) => part === '..')) return '';
    return parts.join(path.sep);
  };
  const subfolder = normalizeSubfolder(subfolderValue);
  return subfolder ? path.join(baseDir, subfolder) : baseDir;
};

const getNotesRootDir = async () => {
  const settings = await readAppSettings();
  const customDir = settings?.notesStorageDir;
  if (customDir && typeof customDir === 'string') {
    const trimmed = customDir.trim();
    if (trimmed) return trimmed;
  }
  return getTimelinesDir();
};

const getNotesDir = async (timelineId) => {
  const baseDir = await getNotesBaseDir();
  const safeTimelineId = safeName(timelineId) || 'timeline';
  return path.join(baseDir, safeTimelineId);
};

const getFontsDir = async () => defaultFontsDir();

async function getStartupBackgroundColor() {
  const fallback = '#FFFAF4';
  try {
    const settings = await readAppSettings();
    const themeKey = settings?.theme || DEFAULT_THEME_KEY;
    const themesDir = userThemesDir();

    if (!fsSync.existsSync(themesDir)) {
      return fallback;
    }

    const filePath = path.join(themesDir, `${sanitizeId(themeKey, '')}.json`);
    if (!fsSync.existsSync(filePath)) {
      return fallback;
    }

    const data = JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
    return data?.colors?.['secondary-bg'] || fallback;
  } catch (error) {
    console.error('Failed to resolve startup theme background:', error);
    return fallback;
  }
}

async function createWindow() {
  const backgroundColor = await getStartupBackgroundColor();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/favicon/favicon-light.ico'),
  });

  Menu.setApplicationMenu(null);

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5183');
    mainWindow.webContents.openDevTools();
  } else {
    const debugProd = process.env.TIMELINES_DEBUG === 'true';
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    if (debugProd) {
      mainWindow.webContents.openDevTools();
    }
  }

  // Open all external links in the default browser instead of a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = mainWindow.webContents.getURL();
    if (url !== appUrl) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable) return;
    const menu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]);
    menu.popup({ window: mainWindow });
  });
}

// Initialize user data directory
async function initializeUserData() {
  const userDataDir = await getTimelinesDir();

  try {
    await fs.mkdir(userDataDir, { recursive: true });
  } catch (error) {
    console.error('Error initializing user data:', error);
  }
}

// Register custom protocol for serving local fonts
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-font', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true } }
]);

// Auto-updater setup
function setupAutoUpdater() {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) return;

  autoUpdater.allowPrerelease = true;
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('updater-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater-status', { status: 'downloading', percent: Math.floor(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater-status', { status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater-status', { status: 'error', message: err.message });
  });
}

function setupOsmTileRequestHeaders() {
  const tileFilter = {
    urls: [
      'https://tile.openstreetmap.org/*',
      'https://*.tile.openstreetmap.org/*',
    ],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(tileFilter, (details, callback) => {
    const requestHeaders = { ...(details.requestHeaders || {}) };
    const appVersion = app.getVersion?.() || 'dev';
    requestHeaders['User-Agent'] = `Timelines/${appVersion} (+https://github.com/sreegjl/timelines)`;

    if (!requestHeaders.Referer && !requestHeaders.referer) {
      const currentUrl = mainWindow?.webContents?.getURL?.() || '';
      try {
        const parsed = new URL(currentUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          requestHeaders.Referer = `${parsed.origin}/`;
        } else {
          requestHeaders.Referer = 'https://github.com/sreegjl/timelines';
        }
      } catch {
        requestHeaders.Referer = 'https://github.com/sreegjl/timelines';
      }
    }

    callback({ requestHeaders });
  });
}

ipcMain.handle('check-for-updates', async () => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return { status: 'dev' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(async () => {
  setupOsmTileRequestHeaders();
  // Register protocol handler for local fonts
  protocol.handle('local-font', async (request) => {
    try {
      // URL format: local-font://font/encoded-path
      const url = new URL(request.url);
      const encodedPath = url.pathname.slice(1); // Remove leading /
      const fontPath = decodeURIComponent(encodedPath);

      // Verify the file exists and is in the fonts directory
      const fontsDir = await getFontsDir();
      const normalizedFontPath = path.normalize(fontPath);
      const normalizedFontsDir = path.normalize(fontsDir);

      if (!normalizedFontPath.startsWith(normalizedFontsDir + path.sep)) {
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(normalizedFontPath).toString());
    } catch (error) {
      console.error('Error serving font:', error);
      return new Response('Not found', { status: 404 });
    }
  });

  await initializeUserData();
  await createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window control handlers
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// IPC Handlers for file operations
ipcMain.handle('save-timeline', async (event, { data, filename }) => {
  try {
    const dataDir = await getTimelinesDir();

    // Ensure directory exists
    await fs.mkdir(dataDir, { recursive: true });

    const safeFilename = sanitizeTimelineId(filename);
    const filePath = path.join(dataDir, `${safeFilename}.timeline`);

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

    return {
      success: true,
      message: 'Timeline saved successfully',
      path: filePath,
    };
  } catch (error) {
    console.error('Error saving timeline:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle('list-timelines', async () => {
  try {
    const userDataDir = await getTimelinesDir();
    const files = await fs.readdir(userDataDir);
    const timelineFiles = files.filter(f => f.endsWith('.timeline'));

    const timelines = (await Promise.all(
      timelineFiles.map(async (file) => {
        try {
          const filePath = path.join(userDataDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          const filename = file.replace('.timeline', '');

          const stat = await fs.stat(filePath);
          return {
            id: filename,
            name: data.file?.title || filename,
            modifiedAt: stat.mtimeMs,
            eventCount: Array.isArray(data.elements) ? data.elements.length : 0,
          };
        } catch (err) {
          console.warn(`Skipping corrupt timeline ${file}:`, err.message);
          return null;
        }
      })
    )).filter(Boolean);

    return timelines;
  } catch (error) {
    console.error('Error listing timelines:', error);
    return [];
  }
});

ipcMain.handle('load-timeline', async (event, filename) => {
  try {
    const userDataDir = await getTimelinesDir();
    const safeFilename = sanitizeTimelineId(filename);
    const filePath = path.join(userDataDir, `${safeFilename}.timeline`);

    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    console.log(`Loaded timeline: ${filename}`);
    return data;
  } catch (error) {
    console.error('Error loading timeline:', error);
    throw error;
  }
});

ipcMain.handle('save-cloud-cache', async (event, { backendId, data, meta }) => {
  try {
    const cacheDir = await getCloudCacheDir();
    const safeId = sanitizeTimelineId(String(backendId));
    await fs.writeFile(path.join(cacheDir, `${safeId}.timeline`), JSON.stringify(data, null, 2), 'utf8');
    await fs.writeFile(path.join(cacheDir, `${safeId}.meta.json`), JSON.stringify(meta, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-cloud-cache', async (event, backendId) => {
  try {
    const cacheDir = await getCloudCacheDir();
    const safeId = sanitizeTimelineId(String(backendId));
    const [dataContent, metaContent] = await Promise.all([
      fs.readFile(path.join(cacheDir, `${safeId}.timeline`), 'utf8').catch(() => null),
      fs.readFile(path.join(cacheDir, `${safeId}.meta.json`), 'utf8').catch(() => null),
    ]);
    return {
      data: dataContent ? JSON.parse(dataContent) : null,
      meta: metaContent ? JSON.parse(metaContent) : null,
    };
  } catch {
    return { data: null, meta: null };
  }
});

ipcMain.handle('update-cloud-meta', async (event, { backendId, meta }) => {
  try {
    const cacheDir = await getCloudCacheDir();
    const safeId = sanitizeTimelineId(String(backendId));
    const metaPath = path.join(cacheDir, `${safeId}.meta.json`);
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {}
    await fs.writeFile(metaPath, JSON.stringify({ ...existing, ...meta }, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-cloud-cache', async (event, backendId) => {
  try {
    const cacheDir = await getCloudCacheDir();
    const safeId = sanitizeTimelineId(String(backendId));
    await Promise.all([
      fs.unlink(path.join(cacheDir, `${safeId}.timeline`)).catch(() => {}),
      fs.unlink(path.join(cacheDir, `${safeId}.meta.json`)).catch(() => {}),
    ]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-cloud-metas', async () => {
  try {
    const cacheDir = await getCloudCacheDir();
    const files = await fs.readdir(cacheDir).catch(() => []);
    const metas = {};
    await Promise.all(
      files.filter(f => f.endsWith('.meta.json')).map(async (file) => {
        try {
          const content = await fs.readFile(path.join(cacheDir, file), 'utf8');
          metas[file.replace('.meta.json', '')] = JSON.parse(content);
        } catch {}
      })
    );
    return metas;
  } catch {
    return {};
  }
});

ipcMain.handle('export-timeline', async (event, { data, suggestedName }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: suggestedName,
      filters: [
        { name: 'Timeline Files', extensions: ['timeline', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    console.error('Error exporting timeline:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle('import-timeline', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Timeline Files', extensions: ['timeline', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const content = await fs.readFile(filePaths[0], 'utf8');
    const data = JSON.parse(content);

    return {
      success: true,
      data,
      filename: path.basename(filePaths[0]),
    };
  } catch (error) {
    console.error('Error importing timeline:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle('delete-timeline', async (event, payload) => {
  try {
    const request = payload && typeof payload === 'object' ? payload : { id: payload };
    const deleteAssets = Boolean(request.deleteAssets);
    const filename = request.id ?? request.filename ?? request.timelineId;
    const userDataDir = await getTimelinesDir();
    const safeFilename = sanitizeTimelineId(filename);
    const filePath = path.join(userDataDir, `${safeFilename}.timeline`);

    await fs.unlink(filePath);
    console.log(`Deleted timeline: ${filename}`);

    if (deleteAssets) {
      const notesDir = await getNotesDir(safeFilename);
      await fs.rm(notesDir, { recursive: true, force: true });
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting timeline:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

ipcMain.handle('create-note', async (event, { timelineId, title, elementId }) => {
  try {
    if (!timelineId) {
      return { success: false, error: 'Missing timelineId' };
    }

    const notesDir = await getNotesDir(sanitizeTimelineId(timelineId));
    await fs.mkdir(notesDir, { recursive: true });

    const base = safeName(elementId) || safeName(title) || 'note';
    const filename = sanitizeNoteFilename(base);
    const filePath = path.join(notesDir, filename);

    try {
      await fs.access(filePath);
    } catch (err) {
      const heading = title ? `# ${title}\n\n` : '';
      await fs.writeFile(filePath, heading, 'utf8');
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Error creating note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-existing-note', async (event, { timelineId } = {}) => {
  try {
    if (!timelineId) {
      return { success: false, error: 'Missing timelineId' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });

    if (result.canceled || !result.filePaths?.length) {
      return { success: false, cancelled: true };
    }

    const sourcePath = result.filePaths[0];
    const baseDir = await getNotesRootDir();
    const resolvedBase = path.resolve(baseDir);
    const resolvedSource = path.resolve(sourcePath);
    const relative = path.relative(resolvedBase, resolvedSource);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { success: false, error: 'OUTSIDE_NOTES_DIR' };
    }

    const normalizedRelative = relative.split(path.sep).join('/');
    const content = await fs.readFile(sourcePath, 'utf8');

    return { success: true, filename: normalizedRelative, content };
  } catch (error) {
    console.error('Error adding existing note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-wikipedia', async (event, { url }) => {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing URL' };
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { success: false, error: 'Only HTTPS URLs are allowed' };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^\[.*\]$/.test(hostname) ||
      hostname === 'localhost' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    ) {
      return { success: false, error: 'Private or local URLs are not allowed' };
    }
    const response = await net.fetch(url, {
      headers: { 'User-Agent': 'Timelines/0.4.0 (https://timelines.studio)' },
    });
    if (!response.ok) {
      return { success: false, error: `Request returned ${response.status}` };
    }
    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-note', async (event, { timelineId, filename }) => {
  try {
    if (!timelineId || !filename) {
      return { success: false, error: 'Missing timelineId or filename' };
    }
    const filePath = await resolveNotePath(timelineId, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, error: 'NOT_FOUND' };
    }
    console.error('Error reading note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-note', async (event, { timelineId, filename, content }) => {
  try {
    if (!timelineId || !filename) {
      return { success: false, error: 'Missing timelineId or filename' };
    }
    const notesDir = await getNotesDir(sanitizeTimelineId(timelineId));
    await fs.mkdir(notesDir, { recursive: true });
    const filePath = await resolveNotePath(timelineId, filename);
    await fs.writeFile(filePath, content ?? '', 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-note', async (event, { timelineId, oldFilename, newFilename }) => {
  try {
    if (!timelineId || !oldFilename || !newFilename) {
      return { success: false, error: 'Missing timelineId or filenames' };
    }
    const oldPath = await resolveNotePath(timelineId, oldFilename);
    const nextPath = await resolveNotePath(timelineId, newFilename);
    try {
      await fs.rename(oldPath, nextPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: 'Note file not found' };
      }

      if (error.code !== 'EEXIST') {
        throw error;
      }

      const content = await fs.readFile(oldPath, 'utf8');
      await fs.writeFile(nextPath, content, 'utf8');
      await fs.unlink(oldPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error renaming note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-timeline', async (event, { oldId, newId }) => {
  try {
    if (!oldId || !newId) {
      return { success: false, error: 'Missing timeline ids' };
    }
    const timelinesDir = await getTimelinesDir();
    const safeOldId = sanitizeTimelineId(oldId);
    const safeNewId = sanitizeTimelineId(newId);
    const oldTimelinePath = path.join(timelinesDir, `${safeOldId}.timeline`);
    const newTimelinePath = path.join(timelinesDir, `${safeNewId}.timeline`);

    try {
      await fs.rename(oldTimelinePath, newTimelinePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const notesBase = await getNotesBaseDir();
    const oldNotesPath = path.join(notesBase, safeOldId);
    const newNotesPath = path.join(notesBase, safeNewId);
    try {
      await fs.rename(oldNotesPath, newNotesPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error renaming timeline:', error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle('delete-note', async (event, { timelineId, filename }) => {
  try {
    if (!timelineId || !filename) {
      return { success: false, error: 'Missing timelineId or filename' };
    }
    const filePath = await resolveNotePath(timelineId, filename);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
});

// App settings (stored in user data)
ipcMain.handle('get-app-settings', async () => {
  try {
    const filePath = appSettingsPath();
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('Error loading app settings:', error);
    return {};
  }
});

const ALLOWED_SETTINGS_KEYS = new Set([
  'timelineStorageDir', 'storageDir', 'notesStorageDir',
  'pluginsStorageDir', 'themeKey', 'enabledPlugins',
  'theme', 'notesSubfolder', 'notesSubfolderEnabled',
  'appFontFamily', 'appFontSize', 'keybinds', 'hardwareAcceleration',
]);

ipcMain.handle('set-app-settings', async (event, settings) => {
  try {
    if (!settings || typeof settings !== 'object') {
      return { success: false, error: 'Invalid settings' };
    }
    const sanitized = {};
    for (const key of Object.keys(settings)) {
      if (ALLOWED_SETTINGS_KEYS.has(key)) {
        sanitized[key] = settings[key];
      }
    }
    const filePath = appSettingsPath();
    await fs.writeFile(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving app settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('choose-timelines-dir', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('Error choosing timelines directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('choose-notes-dir', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('Error choosing notes directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('choose-plugins-dir', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('Error choosing plugins directory:', error);
    return { success: false, error: error.message };
  }
});

const pluginsRootDir = () => path.join(app.getPath('userData'), 'plugins');

ipcMain.handle('open-plugins-folder', async (event, payload) => {
  try {
    const root = path.resolve(pluginsRootDir());
    const dir = payload?.path ? path.resolve(payload.path) : root;
    const relative = path.relative(root, dir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { success: false, error: 'PATH_OUTSIDE_PLUGINS_ROOT' };
    }
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (error) {
    console.error('Error opening plugins folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-plugins', async (event, payload) => {
  try {
    const root = path.resolve(pluginsRootDir());
    const dir = payload?.path ? path.resolve(payload.path) : root;
    const relative = path.relative(root, dir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { success: false, error: 'PATH_OUTSIDE_PLUGINS_ROOT', plugins: [] };
    }
    await fs.mkdir(dir, { recursive: true });
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const plugins = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginDir = path.join(dir, entry.name);
      const manifestPath = path.join(pluginDir, 'manifest.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);
        if (!manifest?.id || !manifest?.name) continue;
        const mainFile = manifest.main || 'main.js';
        const entryPath = path.join(pluginDir, mainFile);
        plugins.push({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version || '0.0.0',
          description: manifest.description || '',
          main: mainFile,
          dir: pluginDir,
          entryPath,
        });
      } catch (error) {
        console.warn('Failed to load plugin manifest:', manifestPath, error.message);
      }
    }

    return { success: true, root: dir, plugins };
  } catch (error) {
    console.error('Error listing plugins:', error);
    return { success: false, error: error.message, plugins: [] };
  }
});

ipcMain.handle('read-plugin-module', async (event, payload) => {
  try {
    const entryPath = String(payload?.entryPath || '');
    if (!entryPath) {
      return { success: false, error: 'MISSING_ENTRY_PATH' };
    }

    const root = path.resolve(pluginsRootDir());
    const resolved = path.resolve(entryPath);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { success: false, error: 'PLUGIN_PATH_OUTSIDE_ROOT' };
    }

    const code = await fs.readFile(resolved, 'utf8');
    return { success: true, code, entryPath: resolved };
  } catch (error) {
    console.error('Error reading plugin module:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('choose-notes-subfolder', async () => {
  try {
    const rootDir = await getNotesRootDir();
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: rootDir,
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const selectedPath = filePaths[0];
    const resolvedRoot = path.resolve(rootDir);
    const resolvedSelected = path.resolve(selectedPath);
    const relative = path.relative(resolvedRoot, resolvedSelected);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return { success: false, error: 'OUTSIDE_NOTES_DIR' };
    }

    const normalizedRelative = relative.split(path.sep).join('/');
    return { success: true, subfolder: normalizedRelative };
  } catch (error) {
    console.error('Error choosing notes subfolder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('open-timelines-folder', async () => {
  try {
    const dir = await getTimelinesDir();
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (error) {
    console.error('Error opening timelines folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-notes-folder', async () => {
  try {
    const dir = await getNotesRootDir();
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (error) {
    console.error('Error opening notes folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-themes-folder', async () => {
  try {
    const dir = userThemesDir();
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (error) {
    console.error('Error opening themes folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-fonts-folder', async () => {
  try {
    const dir = await getFontsDir();
    await fs.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return { success: true, path: dir };
  } catch (error) {
    console.error('Error opening fonts folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, { url }) => {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing url' };
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external url:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-notes-base-dir', async () => {
  try {
    const dir = await getNotesBaseDir();
    const fileUrl = pathToFileURL(dir).toString();
    return { success: true, path: dir, fileUrl };
  } catch (error) {
    console.error('Error resolving notes base dir:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-themes', async () => {
  try {
    const dir = userThemesDir();
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const themeFiles = files.filter((file) => file.endsWith('.json'));
    const themes = {};

    for (const file of themeFiles) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf8');
        const data = JSON.parse(content);
        const key = file.replace('.json', '');
        themes[key] = data;
      } catch (error) {
        console.error(`Failed to load theme ${file}:`, error);
      }
    }

    return themes;
  } catch (error) {
    console.error('Error listing themes:', error);
    return {};
  }
});

ipcMain.handle('save-user-theme', async (event, { id, content }) => {
  try {
    if (!id || !content) {
      return { success: false, error: 'Missing id or content' };
    }
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return { success: false, error: 'Invalid JSON' };
    }
    const dir = userThemesDir();
    await fs.mkdir(dir, { recursive: true });
    const safeId = sanitizeId(id, 'theme');
    const filePath = path.join(dir, `${safeId}.json`);
    await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving user theme:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-user-theme', async (event, { id }) => {
  try {
    if (!id) {
      return { success: false, error: 'Missing id' };
    }
    const dir = userThemesDir();
    const safeId = sanitizeId(id, 'theme');
    const filePath = path.join(dir, `${safeId}.json`);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, error: 'NOT_FOUND' };
    }
    console.error('Error deleting user theme:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-fonts', async () => {
  try {
    const dir = await getFontsDir();
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const allowed = new Set(['.ttf', '.otf', '.woff', '.woff2']);

    const fonts = files
      .filter((file) => allowed.has(path.extname(file).toLowerCase()))
      .map((file) => {
        const ext = path.extname(file).toLowerCase();
        const name = path.basename(file, ext);
        const fullPath = path.join(dir, file);
        // Use custom protocol instead of file:// for security
        const fileUrl = `local-font://font/${encodeURIComponent(fullPath)}`;
        const format = ext === '.otf'
          ? 'opentype'
          : ext === '.ttf'
            ? 'truetype'
            : ext.slice(1);
        return { name, path: fullPath, fileUrl, format };
      });

    return fonts;
  } catch (error) {
    console.error('Error listing fonts:', error);
    return [];
  }
});

ipcMain.handle('capture-screenshot', async () => {
  const image = await mainWindow.webContents.capturePage();
  const filename = `screenshot-${Date.now()}.png`;
  const dest = path.join(app.getPath('downloads'), filename);
  await fs.writeFile(dest, image.toPNG());
  return dest;
});
