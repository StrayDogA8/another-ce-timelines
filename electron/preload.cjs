const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveTimeline: (data, filename) => ipcRenderer.invoke('save-timeline', { data, filename }),
  listTimelines: () => ipcRenderer.invoke('list-timelines'),
  loadTimeline: (filename) => ipcRenderer.invoke('load-timeline', filename),
  exportTimeline: (data, suggestedName) => ipcRenderer.invoke('export-timeline', { data, suggestedName }),
  importTimeline: () => ipcRenderer.invoke('import-timeline'),
  deleteTimeline: (filename) => ipcRenderer.invoke('delete-timeline', filename),
  createNote: (payload) => ipcRenderer.invoke('create-note', payload),
  readNote: (payload) => ipcRenderer.invoke('read-note', payload),
  writeNote: (payload) => ipcRenderer.invoke('write-note', payload),
  deleteNote: (payload) => ipcRenderer.invoke('delete-note', payload),
  renameNote: (payload) => ipcRenderer.invoke('rename-note', payload),
  renameTimeline: (payload) => ipcRenderer.invoke('rename-timeline', payload),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  setAppSettings: (settings) => ipcRenderer.invoke('set-app-settings', settings),
  chooseTimelinesDir: () => ipcRenderer.invoke('choose-timelines-dir'),
  chooseNotesDir: () => ipcRenderer.invoke('choose-notes-dir'),
  openThemesFolder: () => ipcRenderer.invoke('open-themes-folder'),
  listThemes: () => ipcRenderer.invoke('list-themes'),
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});
