const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const fsSync = require('fs');
const DEFAULT_THEME_KEY = 'parchment';

let mainWindow;
const appSettingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');
const defaultTimelinesDir = () => path.join(app.getPath('userData'), 'timelines');
const userThemesDir = () => path.join(app.getPath('userData'), 'themes');
const defaultFontsDir = () => path.join(app.getPath('userData'), 'fonts');

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

const getFontsDir = async () => {
  const settings = await readAppSettings();
  const customDir = settings?.fontStorageDir;
  if (customDir && typeof customDir === 'string') {
    const trimmed = customDir.trim();
    if (trimmed) return trimmed;
  }
  return defaultFontsDir();
};

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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const debugProd = process.env.TIMELINES_DEBUG === 'true';
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    if (debugProd) {
      mainWindow.webContents.openDevTools();
    }
  }

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

app.whenReady().then(async () => {
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

      if (!normalizedFontPath.startsWith(normalizedFontsDir)) {
        return new Response('Forbidden', { status: 403 });
      }

      return net.fetch(pathToFileURL(fontPath).toString());
    } catch (error) {
      console.error('Error serving font:', error);
      return new Response('Not found', { status: 404 });
    }
  });

  await initializeUserData();
  await createWindow();

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

    const timelines = await Promise.all(
      timelineFiles.map(async (file) => {
        const filePath = path.join(userDataDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        const filename = file.replace('.timeline', '');

        return {
          id: filename,
          name: data.file?.title || filename
        };
      })
    );

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

ipcMain.handle('delete-timeline', async (event, filename) => {
  try {
    const userDataDir = await getTimelinesDir();
    const safeFilename = sanitizeTimelineId(filename);
    const filePath = path.join(userDataDir, `${safeFilename}.timeline`);

    await fs.unlink(filePath);
    console.log(`Deleted timeline: ${filename}`);

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

ipcMain.handle('read-note', async (event, { timelineId, filename }) => {
  try {
    if (!timelineId || !filename) {
      return { success: false, error: 'Missing timelineId or filename' };
    }
    const filePath = path.join(
      await getNotesDir(sanitizeTimelineId(timelineId)),
      sanitizeNoteFilename(filename)
    );
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
    const filePath = path.join(notesDir, sanitizeNoteFilename(filename));
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
    const notesDir = await getNotesDir(sanitizeTimelineId(timelineId));
    const oldPath = path.join(notesDir, sanitizeNoteFilename(oldFilename));
    const nextPath = path.join(notesDir, sanitizeNoteFilename(newFilename));
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
    const filePath = path.join(
      await getNotesDir(sanitizeTimelineId(timelineId)),
      sanitizeNoteFilename(filename)
    );
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

ipcMain.handle('set-app-settings', async (event, settings) => {
  try {
    const filePath = appSettingsPath();
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
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

ipcMain.handle('choose-fonts-dir', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, path: filePaths[0] };
  } catch (error) {
    console.error('Error choosing fonts directory:', error);
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
    const dir = userThemesDir();
    await fs.mkdir(dir, { recursive: true });
    const safeId = sanitizeId(id, 'theme');
    const filePath = path.join(dir, `${safeId}.json`);
    await fs.writeFile(filePath, content, 'utf8');
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
