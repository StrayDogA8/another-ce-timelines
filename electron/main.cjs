const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const themeConfig = require('../src/config/theme.json');

let mainWindow;
const appSettingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');
const defaultTimelinesDir = () => path.join(app.getPath('userData'), 'timelines');

const safeName = (value) => String(value || '')
  .trim()
  .replace(/[^\w.-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

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
  return path.join(baseDir, `${timelineId}.assets`, 'notes');
};

function createWindow() {
  // Get the active theme
  const themes = themeConfig.themes || {};
  const activeTheme =
    themes[themeConfig.activeTheme] || themes[Object.keys(themes)[0]];
  const backgroundColor =
    activeTheme?.colors?.['secondary-bg'] || '#ffffff';

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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

// Initialize user data directory and copy example timelines on first run
async function initializeUserData() {
  const userDataDir = await getTimelinesDir();

  try {
    await fs.mkdir(userDataDir, { recursive: true });

    // Check if this is first run by looking for any .timeline files
    const files = await fs.readdir(userDataDir);
    const hasTimelineFiles = files.some(f => f.endsWith('.timeline'));

    if (!hasTimelineFiles) {
      // First run - copy example timelines from src/data
      console.log('First run detected, copying example timelines...');
      const templatesDir = path.join(__dirname, '..', 'src', 'data');
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.timeline')) {
          const srcPath = path.join(templatesDir, file);
          const destPath = path.join(userDataDir, file);
          await fs.copyFile(srcPath, destPath);
          console.log(`Copied example: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing user data:', error);
  }
}

app.whenReady().then(async () => {
  await initializeUserData();
  createWindow();

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

    const safeFilename = filename.replace(/[^a-z0-9-_]/gi, '-');
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
    const filePath = path.join(userDataDir, `${filename}.timeline`);

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
    const filePath = path.join(userDataDir, `${filename}.timeline`);

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

    const notesDir = await getNotesDir(timelineId);
    await fs.mkdir(notesDir, { recursive: true });

    const base = safeName(title) || safeName(elementId) || 'note';
    let filename = `${base}.md`;
    let counter = 1;

    while (true) {
      try {
        await fs.access(path.join(notesDir, filename));
        counter += 1;
        filename = `${base}-${counter}.md`;
      } catch (err) {
        break;
      }
    }

    const filePath = path.join(notesDir, filename);
    const heading = title ? `# ${title}\n\n` : '';
    await fs.writeFile(filePath, heading, 'utf8');

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
    const filePath = path.join(await getNotesDir(timelineId), filename);
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-note', async (event, { timelineId, filename, content }) => {
  try {
    if (!timelineId || !filename) {
      return { success: false, error: 'Missing timelineId or filename' };
    }
    const notesDir = await getNotesDir(timelineId);
    await fs.mkdir(notesDir, { recursive: true });
    const filePath = path.join(notesDir, filename);
    await fs.writeFile(filePath, content ?? '', 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing note:', error);
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
