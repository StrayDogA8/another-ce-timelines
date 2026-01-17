const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveTimeline: (data, filename) => ipcRenderer.invoke('save-timeline', { data, filename }),
  listTimelines: () => ipcRenderer.invoke('list-timelines'),
  loadTimeline: (filename) => ipcRenderer.invoke('load-timeline', filename),
  exportTimeline: (data, suggestedName) => ipcRenderer.invoke('export-timeline', { data, suggestedName }),
  importTimeline: () => ipcRenderer.invoke('import-timeline'),
  deleteTimeline: (filename) => ipcRenderer.invoke('delete-timeline', filename),
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});
