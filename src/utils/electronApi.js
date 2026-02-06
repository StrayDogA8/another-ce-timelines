// Check if running in Electron
const isElectron = () => {
  return window.electron !== undefined;
};

export async function saveTimelineToFile(timelineData, filename = 'ancient-greece') {
  if (!isElectron()) {
    console.warn('Not running in Electron, skipping file save');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    const result = await window.electron.saveTimeline(timelineData, filename);
    return result;
  } catch (error) {
    console.error('Error saving timeline:', error);
    return { success: false, error: error.message };
  }
}

export async function listTimelines() {
  if (!isElectron()) {
    console.warn('Not running in Electron, returning empty list');
    return { success: true, files: [] };
  }

  try {
    const result = await window.electron.listTimelines();
    return result;
  } catch (error) {
    console.error('Error listing timelines:', error);
    return { success: false, files: [], error: error.message };
  }
}

export async function loadTimeline(filename) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    const result = await window.electron.loadTimeline(filename);
    return result;
  } catch (error) {
    console.error('Error loading timeline:', error);
    return { success: false, error: error.message };
  }
}

export async function exportTimeline(timelineData, suggestedName) {
  if (!isElectron()) {
    console.warn('Not running in Electron, using browser download');
    // Fallback to browser download
    const dataStr = JSON.stringify(timelineData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true };
  }

  try {
    const result = await window.electron.exportTimeline(timelineData, suggestedName);
    return result;
  } catch (error) {
    console.error('Error exporting timeline:', error);
    return { success: false, error: error.message };
  }
}

export async function importTimeline() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    const result = await window.electron.importTimeline();
    return result;
  } catch (error) {
    console.error('Error importing timeline:', error);
    return { success: false, error: error.message };
  }
}

export async function createNote({ timelineId, title, elementId }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.createNote({ timelineId, title, elementId });
  } catch (error) {
    console.error('Error creating note:', error);
    return { success: false, error: error.message };
  }
}

export async function readNote({ timelineId, filename }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.readNote({ timelineId, filename });
  } catch (error) {
    console.error('Error reading note:', error);
    return { success: false, error: error.message };
  }
}

export async function writeNote({ timelineId, filename, content }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.writeNote({ timelineId, filename, content });
  } catch (error) {
    console.error('Error writing note:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteNote({ timelineId, filename }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.deleteNote({ timelineId, filename });
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
}

export async function renameNote({ timelineId, oldFilename, newFilename }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.renameNote({ timelineId, oldFilename, newFilename });
  } catch (error) {
    console.error('Error renaming note:', error);
    return { success: false, error: error.message };
  }
}

export async function renameTimeline({ oldId, newId }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.renameTimeline({ oldId, newId });
  } catch (error) {
    console.error('Error renaming timeline:', error);
    return { success: false, error: error.message };
  }
}

export async function getNotesBaseDir() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.getNotesBaseDir();
  } catch (error) {
    console.error('Error resolving notes base directory:', error);
    return { success: false, error: error.message };
  }
}

export async function chooseTimelinesDir() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.chooseTimelinesDir();
  } catch (error) {
    console.error('Error choosing timelines directory:', error);
    return { success: false, error: error.message };
  }
}

export async function chooseNotesDir() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.chooseNotesDir();
  } catch (error) {
    console.error('Error choosing notes directory:', error);
    return { success: false, error: error.message };
  }
}
