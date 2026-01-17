const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const themeConfig = require('../src/config/theme.json');

let mainWindow;

function createWindow() {
  // Get the active theme
  const activeTheme = themeConfig.themes[themeConfig.activeTheme];

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: activeTheme.colors['secondary-bg'],
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
}

// Initialize user data directory and copy templates on first run
async function initializeUserData() {
  const userDataDir = path.join(app.getPath('userData'), 'timelines');

  try {
    await fs.mkdir(userDataDir, { recursive: true });

    // Check if this is first run by looking for any .timeline files
    const files = await fs.readdir(userDataDir);
    const hasTimelineFiles = files.some(f => f.endsWith('.timeline'));

    if (!hasTimelineFiles) {
      // First run - copy template files from src/data
      console.log('First run detected, copying template files...');
      const templatesDir = path.join(__dirname, '..', 'src', 'data');
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.timeline')) {
          const srcPath = path.join(templatesDir, file);
          const destPath = path.join(userDataDir, file);
          await fs.copyFile(srcPath, destPath);
          console.log(`Copied template: ${file}`);
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
    const dataDir = path.join(app.getPath('userData'), 'timelines');

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
    const userDataDir = path.join(app.getPath('userData'), 'timelines');
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
    const userDataDir = path.join(app.getPath('userData'), 'timelines');
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
