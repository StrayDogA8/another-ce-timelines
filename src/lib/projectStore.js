import { ENABLE_CLOUD } from './features.js';
import { isLoggedIn } from './auth.js';
import {
  saveTimelineToFile,
  listTimelines as electronListTimelines,
  loadTimeline as electronLoadTimeline,
  exportTimeline as electronExportTimeline,
  importTimeline as electronImportTimeline,
  renameTimeline as electronRenameTimeline,
} from '../utils/electronApi.js';
import {
  apiListTimelines,
  apiGetTimelineBySlug,
  apiCreateTimeline,
  apiUpdateTimeline,
  apiDeleteTimeline,
} from './api.js';

export class LocalProjectStore {
  async listTimelines() {
    return electronListTimelines();
  }

  async loadTimeline(id) {
    return electronLoadTimeline(id);
  }

  async saveTimeline(timelineData, id) {
    return saveTimelineToFile(timelineData, id);
  }

  async deleteTimeline(id) {
    if (window.electron?.deleteTimeline) {
      try {
        return await window.electron.deleteTimeline(id);
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Not in Electron environment' };
  }

  async renameTimeline({ oldId, newId }) {
    return electronRenameTimeline({ oldId, newId });
  }

  async exportTimeline(timelineData, suggestedName) {
    return electronExportTimeline(timelineData, suggestedName);
  }

  async importTimeline() {
    return electronImportTimeline();
  }
}

export class CloudProjectStore {
  async listTimelines() {
    const result = await apiListTimelines();
    if (!result.success) return { success: false, files: [], error: result.error };

    const files = (result.data ?? []).map(t => ({
      id: t.slug,
      title: t.title,
      updatedAt: t.updatedAt,
      isPublic: t.isPublic,
      _backendId: t.id,
    }));
    return { success: true, files };
  }

  async loadTimeline(slug) {
    const result = await apiGetTimelineBySlug(slug);
    if (!result.success) return result;

    const matches = result.data ?? [];
    if (matches.length === 0) return { success: false, error: `Timeline not found: ${slug}` };

    const timeline = matches[0];
    try {
      const data = typeof timeline.contentJson === 'string'
        ? JSON.parse(timeline.contentJson)
        : timeline.contentJson;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to parse contentJson: ${error.message}` };
    }
  }

  async saveTimeline(timelineData, slug) {
    const title = timelineData?.file?.title ?? slug;
    const description = timelineData?.file?.description ?? '';
    const contentJson = JSON.stringify(timelineData);

    const existing = await apiGetTimelineBySlug(slug);
    if (!existing.success) return existing;

    const matches = existing.data ?? [];
    const payload = { slug, title, description, contentJson, isPublic: false };

    if (matches.length > 0) {
      return apiUpdateTimeline(matches[0].id, payload);
    } else {
      return apiCreateTimeline(payload);
    }
  }

  async deleteTimeline(slug) {
    const existing = await apiGetTimelineBySlug(slug);
    if (!existing.success) return existing;

    const matches = existing.data ?? [];
    if (matches.length === 0) return { success: false, error: `Timeline not found: ${slug}` };

    return apiDeleteTimeline(matches[0].id);
  }

  async renameTimeline({ oldId, newId }) {
    const existing = await apiGetTimelineBySlug(oldId);
    if (!existing.success) return existing;

    const matches = existing.data ?? [];
    if (matches.length === 0) return { success: false, error: `Timeline not found: ${oldId}` };

    const { id: backendId, ...rest } = matches[0];
    return apiUpdateTimeline(backendId, { ...rest, slug: newId });
  }

  async exportTimeline(timelineData, suggestedName) {
    return electronExportTimeline(timelineData, suggestedName);
  }

  async importTimeline() {
    return electronImportTimeline();
  }
}

// Returns CloudProjectStore when cloud is enabled and the user is logged in, otherwise LocalProjectStore.
export function getProjectStore() {
  if (ENABLE_CLOUD && isLoggedIn()) {
    return new CloudProjectStore();
  }
  return new LocalProjectStore();
}
