const API_BASE_URL = 'http://localhost:3001/api';

export async function saveTimelineToFile(timelineData, filename = 'ancient-greece') {
  try {
    const response = await fetch(`${API_BASE_URL}/timeline/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: timelineData,
        filename: filename
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save timeline');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving timeline:', error);
    throw error;
  }
}

export async function listTimelines() {
  try {
    const response = await fetch(`${API_BASE_URL}/timeline/list`);

    if (!response.ok) {
      throw new Error('Failed to fetch timeline list');
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing timelines:', error);
    throw error;
  }
}
