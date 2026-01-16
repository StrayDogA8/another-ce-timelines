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
