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

export async function addExistingNote({ timelineId }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.addExistingNote({ timelineId });
  } catch (error) {
    console.error('Error adding existing note:', error);
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

export async function chooseNotesSubfolder() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.chooseNotesSubfolder();
  } catch (error) {
    console.error('Error choosing notes subfolder:', error);
    return { success: false, error: error.message };
  }
}

export async function chooseFontsDir() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.chooseFontsDir();
  } catch (error) {
    console.error('Error choosing fonts directory:', error);
    return { success: false, error: error.message };
  }
}

export async function openFontsFolder() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.openFontsFolder();
  } catch (error) {
    console.error('Error opening fonts folder:', error);
    return { success: false, error: error.message };
  }
}

export async function listFonts() {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, fonts: [] };
  }

  try {
    const fonts = await window.electron.listFonts();
    return { success: true, fonts: Array.isArray(fonts) ? fonts : [] };
  } catch (error) {
    console.error('Error listing fonts:', error);
    return { success: false, fonts: [], error: error.message };
  }
}

export async function saveUserTheme({ id, content }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.saveUserTheme({ id, content });
  } catch (error) {
    console.error('Error saving user theme:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteUserTheme({ id }) {
  if (!isElectron()) {
    console.warn('Not running in Electron');
    return { success: false, error: 'Not in Electron environment' };
  }

  try {
    return await window.electron.deleteUserTheme({ id });
  } catch (error) {
    console.error('Error deleting user theme:', error);
    return { success: false, error: error.message };
  }
}
