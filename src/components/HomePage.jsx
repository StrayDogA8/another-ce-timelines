import { useState, useEffect, useRef, useMemo } from "react";
import { File, FilePlus, Copy, Trash2, Settings, ArrowLeft, Folder, Store, X, HardDrive, LayoutGrid, List, MoreVertical, Cloud, RefreshCw, Pencil, RotateCcw } from "lucide-react";
import { login, logout, getCurrentUser, onAuthStateChange, refreshCurrentUser } from "../lib/auth.js";
import { apiCreateTimeline, apiListTimelines, apiDeleteTimeline, apiGetTimelineById, apiUpdateTimeline } from "../lib/api.js";
import { saveCloudCache, loadCloudCache, updateCloudMeta, deleteCloudCache, listCloudMetas, saveTimelineToFile } from "../utils/electronApi.js";

function relativeTime(ms) {
  if (!ms) return null;
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}
import NewTimelineModal from "./NewTimelineModal";
import "../styles/02-homepage.css";
import "../styles/07-modals-menus.css";
import themeConfig from "../config/theme.json";
import { loadThemeConfig } from "../utils/themeLoader";
import { deleteUserTheme, saveUserTheme } from "../utils/electronApi";
import { DEFAULT_KEYBINDS, cloneDefaultKeybinds, saveKeybinds } from "../utils/keybinds";

export default function HomePage({
  settingsOnly = false,
  reuseExistingBackdrop = false,
  onSelectTimeline,
  onCreateTimeline,
  appThemeKey,
  appFontFamily,
  appFontSize,
  fonts,
  themes,
  onAppThemeChange,
  onAppFontChange,
  onAppFontSizeChange,
  timelineStorageDir,
  notesStorageDir,
  notesSubfolder,
  notesSubfolderEnabled,
  onTimelineStorageDirChange,
  onNotesStorageDirChange,
  onNotesSubfolderChange,
  onNotesSubfolderEnabledChange,
  onPickNotesSubfolder,
  onPickTimelinesDir,
  onPickNotesDir,
  onOpenFontsFolder,
  onRefreshThemes,
  openSettingsSignal = 0,
  openCloudSettingsSignal = 0,
  onAppSettingsClosed,
  keybinds = cloneDefaultKeybinds(),
  onKeybindsChange,
}) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [cloudTimelineFiles, setCloudTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [view, setView] = useState(settingsOnly ? "settings" : "home");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [filter, setFilter] = useState("all");
  const [cloudUser, setCloudUser] = useState(() => getCurrentUser());
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [cloudLoading, setCloudLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cloudActionError, setCloudActionError] = useState("");
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [marketplaceThemes, setMarketplaceThemes] = useState([]);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceBusyId, setMarketplaceBusyId] = useState("");
  const [installedThemeIds, setInstalledThemeIds] = useState(new Set());
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [deleteDialogFile, setDeleteDialogFile] = useState(null);
  const [deleteDialogWithAssets, setDeleteDialogWithAssets] = useState(false);
  const [storeLocallyDialogFile, setStoreLocallyDialogFile] = useState(null);
  const [settingsSection, setSettingsSection] = useState("general");
  const [updateStatus, setUpdateStatus] = useState(null); // null | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev'
  const [recordingKey, setRecordingKey] = useState(null);
  const recordingKeyRef = useRef(null);
  const previousViewRef = useRef("home");
  const menuRef = useRef(null);
  const syncingRef = useRef(false);
  const defaultThemeKey = (themeConfig?.activeTheme || "").toLowerCase();
  const bundledThemes = useMemo(() => loadThemeConfig().themes, []);
  const bundledKeys = useMemo(
    () => new Set(Object.keys(bundledThemes || {}).map((key) => key.toLowerCase())),
    [bundledThemes]
  );

  const appThemes = useMemo(() => {
    const entries = Object.entries(themes || {}).filter(([key]) =>
      bundledKeys.has(key.toLowerCase())
    );
    return entries.sort(([aKey], [bKey]) => {
      const aLower = aKey.toLowerCase();
      const bLower = bKey.toLowerCase();
      if (aLower === "parchment" && bLower !== "parchment") return -1;
      if (aLower !== "parchment" && bLower === "parchment") return 1;
      const aIsDefault = aLower === defaultThemeKey;
      const bIsDefault = bLower === defaultThemeKey;
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return aKey.localeCompare(bKey);
    });
  }, [themes, bundledKeys, defaultThemeKey]);

  const userThemes = useMemo(() => {
    const entries = Object.entries(themes || {}).filter(
      ([key]) => !bundledKeys.has(key.toLowerCase())
    );
    return entries.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  }, [themes, bundledKeys]);

  const userThemeIds = useMemo(
    () => new Set(userThemes.map(([key]) => key.toLowerCase())),
    [userThemes]
  );

  const availableFonts = useMemo(() => {
    const seen = new Set();
    const list = [];
    (fonts || []).forEach((font) => {
      const name = font?.name?.trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      list.push(name);
    });
    return list.sort((a, b) => a.localeCompare(b));
  }, [fonts]);

  const fontOptions = useMemo(() => {
    const options = [
      { value: "default", label: "Default (Theme)" },
      { value: "Inter", label: "Inter" },
    ];
    availableFonts.forEach((name) => {
      options.push({ value: name, label: name });
    });
    const values = new Set(options.map((option) => option.value));
    if (appFontFamily && !values.has(appFontFamily)) {
      options.unshift({
        value: appFontFamily,
        label: `${appFontFamily} (Missing)`,
      });
    }
    return options;
  }, [availableFonts, appFontFamily]);

  const MARKETPLACE_BASE =
    "https://raw.githubusercontent.com/sreegjl/timelines-marketplace/refs/heads/main/";

  const loadInstalledThemes = async () => {
    if (!window.electron?.listThemes) return;
    try {
      const themes = await window.electron.listThemes();
      const ids = new Set(Object.keys(themes || {}).map((key) => key.toLowerCase()));
      setInstalledThemeIds(ids);
    } catch (error) {
      console.error("Failed to load installed themes:", error);
    }
  };

  const loadMarketplace = async () => {
    setMarketplaceLoading(true);
    setMarketplaceError("");
    try {
      const response = await fetch(`${MARKETPLACE_BASE}index.json`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load marketplace (${response.status})`);
      }
      const data = await response.json();
      const themes = Array.isArray(data?.themes) ? data.themes : [];
      setMarketplaceThemes(themes);
    } catch (error) {
      console.error("Failed to load marketplace:", error);
      setMarketplaceError("Failed to load marketplace themes.");
      setMarketplaceThemes([]);
    } finally {
      setMarketplaceLoading(false);
    }
  };

  const getPathIssue = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isAbsolute =
      /^[a-zA-Z]:[\\/]/.test(trimmed) ||
      trimmed.startsWith("\\\\") ||
      trimmed.startsWith("/");
    if (!isAbsolute) return "Path should be absolute.";
    const isDrivePath = /^[a-zA-Z]:[\\/]/.test(trimmed);
    const pathToCheck = isDrivePath ? trimmed.slice(2) : trimmed;
    const hasInvalidChar = [...pathToCheck].some((char) => {
      const code = char.charCodeAt(0);
      return '<>:"|?*'.includes(char) || code <= 31;
    });
    if (hasInvalidChar) {
      return "Path contains invalid characters.";
    }
    if (/[. ]$/.test(trimmed)) {
      return "Path cannot end with a dot or space.";
    }
    return null;
  };

  const timelinePathIssue = getPathIssue(timelineStorageDir);
  const notesPathIssue = getPathIssue(notesStorageDir);
  const notesSubfolderIssue = useMemo(() => {
    const value = String(notesSubfolder || "").trim();
    if (!value) return null;
    if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\")) {
      return "Subfolder must be relative to the Notes Folder.";
    }
    if (value.split(/[\\/]+/).includes("..")) {
      return "Subfolder cannot include ..";
    }
    return null;
  }, [notesSubfolder]);

  useEffect(() => {
    if (openSettingsSignal > 0) {
      setView("settings");
      setSettingsSection("general");
    }
  }, [openSettingsSignal]);

  useEffect(() => {
    if (!window.electron?.onUpdaterStatus) return;
    window.electron.onUpdaterStatus((data) => {
      setUpdateStatus(data.status);
    });
    return () => window.electron.offUpdaterStatus?.();
  }, []);

  useEffect(() => {
    if (settingsOnly) {
      setView("settings");
      setSettingsSection("general");
    }
  }, [settingsOnly]);

  useEffect(() => {
    if (openCloudSettingsSignal > 0) {
      setView("settings");
      setSettingsSection("cloud");
    }
  }, [openCloudSettingsSignal]);

  useEffect(() => { recordingKeyRef.current = recordingKey; }, [recordingKey]);

  useEffect(() => {
    const handler = (e) => {
      const id = recordingKeyRef.current;
      if (!id) return;
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key);
      const updated = { ...keybinds, [id]: { ...keybinds[id], keys: parts } };
      setRecordingKey(null);
      recordingKeyRef.current = null;
      onKeybindsChange?.(updated);
      saveKeybinds(updated);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [keybinds, onKeybindsChange]);

  useEffect(() => {
    if (previousViewRef.current === "settings" && view !== "settings") {
      onAppSettingsClosed?.();
    }
    previousViewRef.current = view;
  }, [view, onAppSettingsClosed]);

  useEffect(() => {
    const loadTimelineList = async () => {
      if (window.electron?.listTimelines) {
        try {
          const files = await window.electron.listTimelines();
          setTimelineFiles(files.map(f => ({ ...f, storageType: 'local' })));
        } catch (error) {
          console.error('Failed to list timelines:', error);
          setTimelineFiles([]);
        }
      } else {
        console.warn("Timeline listing is only available in the desktop app.");
        setTimelineFiles([]);
      }
      setLoading(false);
    };

    loadTimelineList();
  }, [timelineStorageDir]);

  // Sync auth state and refresh user data (including plan) when logged in
  useEffect(() => {
    const unsub = onAuthStateChange((user) => setCloudUser(user));
    if (getCurrentUser()) refreshCurrentUser();
    return unsub;
  }, []);

// Fetch cloud timelines when user has a qualifying plan, or show cached when logged out
  useEffect(() => {
    if (!cloudUser || !["DEV", "PRO"].includes(cloudUser.plan?.toUpperCase())) {
      listCloudMetas().then(async (metas) => {
        if (!metas || Object.keys(metas).length === 0) {
          setCloudTimelineFiles([]);
          return;
        }
        const entries = await Promise.all(
          Object.entries(metas).map(async ([backendId, meta]) => {
            const cached = await loadCloudCache(backendId);
            const name = cached?.data?.file?.title ?? `Cloud Timeline ${backendId}`;
            return {
              id: `cloud:${backendId}`,
              name,
              modifiedAt: meta.localUpdatedAt ? new Date(meta.localUpdatedAt).getTime() : null,
              storageType: 'cloud',
              syncStatus: 'unsynced',
            };
          })
        );
        setCloudTimelineFiles(entries);
      });
      return;
    }
    Promise.all([apiListTimelines(), listCloudMetas()]).then(([result, metas]) => {
      if (result.success && Array.isArray(result.data)) {
        setCloudTimelineFiles(result.data.map(t => {
          const backendId = String(t._backendId || t.id);
          const meta = metas?.[backendId];
          return {
            id: `cloud:${backendId}`,
            name: t.title,
            modifiedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : null,
            storageType: 'cloud',
            syncStatus: meta?.syncStatus ?? 'synced',
          };
        }));
      }
    });
  }, [cloudUser]);

  const handleCloudSubmit = async (e) => {
    e.preventDefault();
    setCloudError("");
    setCloudLoading(true);
    const result = await login({ email: cloudEmail, password: cloudPassword });
    if (result.success) {
      setCloudEmail("");
      setCloudPassword("");
    } else {
      setCloudError(result.error || "Something went wrong.");
    }
    setCloudLoading(false);
  };

  const handleCloudLogout = async () => {
    await logout();
    setCloudUser(null);
  };

  const canUseCloud = cloudUser && ["DEV", "PRO"].includes(cloudUser.plan?.toUpperCase());

  const showCloudError = (msg) => {
    setCloudActionError(msg);
    setTimeout(() => setCloudActionError(""), 4000);
  };

  const handleSync = async () => {
    if (!canUseCloud || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    let conflictsFound = 0;
    try {
      const [localResult, cloudResult, metas] = await Promise.all([
        window.electron?.listTimelines?.() ?? [],
        apiListTimelines(),
        listCloudMetas(),
      ]);

      if (!cloudResult.success) {
        showCloudError(`Sync failed: ${cloudResult.error || 'Unknown error'}`);
        return;
      }

      // Retry unsynced timelines and detect conflicts
      const updatedMetas = { ...metas };
      await Promise.all(
        Object.entries(metas)
          .filter(([, m]) => m.syncStatus === 'unsynced')
          .map(async ([backendId, meta]) => {
            const cached = await loadCloudCache(backendId);
            if (!cached.data) return;

            const serverResult = await apiGetTimelineById(backendId);
            if (!serverResult.success) return; // still offline

            const serverUpdatedAt = serverResult.data?.updatedAt;
            // No conflict if either timestamp is absent (can't compare) or they refer to the same instant.
            // Use getTime() to normalize precision differences (e.g. nanoseconds vs microseconds from server).
            const noConflict = !meta.lastServerUpdatedAt || !serverUpdatedAt ||
              new Date(meta.lastServerUpdatedAt).getTime() === new Date(serverUpdatedAt).getTime();
            if (noConflict) {
              // No conflict — upload cached version
              const uploadResult = await apiUpdateTimeline(backendId, {
                title: cached.data.file?.title,
                slug: backendId,
                description: cached.data.file?.description ?? '',
                isPublic: cached.data.file?.isPublic ?? false,
                contentJson: JSON.stringify(cached.data),
              });
              if (uploadResult.success) {
                // Clean up any previously created conflict file for this timeline
                if (meta.conflictFileId && window.electron?.deleteTimeline) {
                  await window.electron.deleteTimeline({ id: meta.conflictFileId, deleteAssets: false }).catch(() => {});
                }
                const syncedMeta = { ...meta, lastServerUpdatedAt: uploadResult.data?.updatedAt ?? serverUpdatedAt, syncStatus: 'synced', conflictFileId: null };
                await updateCloudMeta(backendId, syncedMeta);
                updatedMetas[backendId] = syncedMeta;
              }
            } else {
              // Conflict — save local version as a conflict copy, keep server version in cache
              const conflictTitle = `${meta.title ?? 'Timeline'} (Conflict ${new Date().toLocaleDateString()})`;
              const conflictId = conflictTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              await saveTimelineToFile(cached.data, conflictId);

              const serverContentJson = serverResult.data?.contentJson ?? serverResult.data?.data;
              const serverData = typeof serverContentJson === 'string' ? JSON.parse(serverContentJson) : serverContentJson;
              const conflictMeta = { ...meta, lastServerUpdatedAt: serverUpdatedAt, localUpdatedAt: serverUpdatedAt, syncStatus: 'conflict', conflictFileId: conflictId };
              await saveCloudCache(backendId, serverData ?? cached.data, conflictMeta);
              updatedMetas[backendId] = conflictMeta;
              conflictsFound++;
            }
          })
      );

      // Refresh local file list from disk (picks up any newly created conflict files, no duplicates)
      const freshLocal = await window.electron?.listTimelines?.() ?? localResult ?? [];
      setTimelineFiles(freshLocal.map(f => ({ ...f, storageType: 'local' })));

      // Rebuild cloud list with updated sync statuses
      setCloudTimelineFiles((Array.isArray(cloudResult.data) ? cloudResult.data : []).map(t => {
        const backendId = String(t._backendId || t.id);
        const meta = updatedMetas[backendId];
        return {
          id: `cloud:${backendId}`,
          name: t.title,
          modifiedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : null,
          storageType: 'cloud',
          syncStatus: meta?.syncStatus ?? 'synced',
        };
      }));

      if (conflictsFound > 0) {
        showCloudError(`${conflictsFound} conflict${conflictsFound > 1 ? 's' : ''} detected — local copies saved.`);
      }
    } catch (err) {
      showCloudError(`Sync failed: ${err.message}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  const handleStoreInCloud = async (file) => {
    try {
      const data = await window.electron.loadTimeline(file.id);
      const slug = file.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await apiCreateTimeline({ title: file.name, slug, contentJson: JSON.stringify(data) });
      if (!result.success) throw new Error(result.error || 'Failed to store in cloud.');

      const backendId = result.data?.id ?? result.data?._backendId;
      if (backendId) {
        await window.electron.deleteTimeline({ id: file.id, deleteAssets: false });
        setTimelineFiles(prev => prev.filter(f => f.id !== file.id));
        setCloudTimelineFiles(prev => [...prev, {
          id: `cloud:${backendId}`,
          name: file.name,
          modifiedAt: Date.now(),
          storageType: 'cloud',
          syncStatus: 'synced',
        }]);
      }
    } catch (err) {
      showCloudError(`Could not store in cloud: ${err.message}`);
    }
  };

  const handleConfirmStoreLocally = async () => {
    const file = storeLocallyDialogFile;
    setStoreLocallyDialogFile(null);
    if (file) await handleStoreLocally(file);
  };

  const handleStoreLocally = async (file) => {
    try {
      const backendId = file.id.slice('cloud:'.length);
      const result = await apiGetTimelineById(backendId);
      if (!result.success) throw new Error(result.error || 'Failed to fetch from cloud.');
      const contentJson = result.data?.contentJson ?? result.data?.data;
      if (!contentJson) throw new Error('This cloud timeline has no content.');
      const data = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;

      const localId = file.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await window.electron.saveTimeline(data, localId);

      await Promise.all([
        apiDeleteTimeline(backendId),
        deleteCloudCache(backendId),
      ]);

      setCloudTimelineFiles(prev => prev.filter(f => f.id !== file.id));
      setTimelineFiles(prev => [...prev, {
        id: localId,
        name: file.name,
        modifiedAt: Date.now(),
        storageType: 'local',
      }]);
    } catch (err) {
      showCloudError(`Could not store locally: ${err.message}`);
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  const handleNewTimeline = () => {
    setIsNewTimelineModalOpen(true);
  };

  const handleCreateTimeline = (timelineConfig) => {
    setIsNewTimelineModalOpen(false);
    onCreateTimeline(timelineConfig);
  };

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    const nearRight = e.clientX > window.innerWidth / 2;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nearRight,
      file: file,
    });
  };

  const handleMenuAction = (action) => {
    setContextMenu(null);
    if (action) action();
  };

  const handleOpenMarketplace = () => {
    setIsMarketplaceOpen(true);
    setMarketplaceSearch("");
    loadMarketplace();
    loadInstalledThemes();
  };

  const handleCloseMarketplace = () => {
    setIsMarketplaceOpen(false);
    setMarketplaceThemes([]);
    setMarketplaceError("");
  };

  const handleDownloadTheme = async (theme) => {
    if (!theme?.id || !theme?.paths?.theme) return;
    setMarketplaceBusyId(theme.id);
    try {
      const response = await fetch(`${MARKETPLACE_BASE}${theme.paths.theme}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to download theme (${response.status})`);
      }
      const content = await response.text();
      const result = await saveUserTheme({ id: theme.id, content });
      if (!result?.success) {
        throw new Error(result?.error || "Failed to save theme");
      }
      await onRefreshThemes?.();
      await loadInstalledThemes();
    } catch (error) {
      console.error("Failed to download theme:", error);
      setMarketplaceError("Failed to download theme.");
    } finally {
      setMarketplaceBusyId("");
    }
  };

  const handleDeleteTheme = async (theme) => {
    if (!theme?.id) return;
    setMarketplaceBusyId(theme.id);
    try {
      const result = await deleteUserTheme({ id: theme.id });
      if (!result?.success && result?.error !== "NOT_FOUND") {
        throw new Error(result?.error || "Failed to delete theme");
      }
      await onRefreshThemes?.();
      await loadInstalledThemes();
    } catch (error) {
      console.error("Failed to delete theme:", error);
      setMarketplaceError("Failed to delete theme.");
    } finally {
      setMarketplaceBusyId("");
    }
  };

  const handleDuplicate = async (file) => {
    try {
      if (!window.electron?.loadTimeline || !window.electron?.saveTimeline) {
        throw new Error("Duplicate is only available in the desktop app.");
      }
      // Load the original timeline
      let originalData;
      if (file.storageType === 'cloud') {
        const backendId = file.id.slice('cloud:'.length);
        const result = await apiGetTimelineById(backendId);
        if (!result.success) throw new Error(result.error || 'Failed to load cloud timeline.');
        const contentJson = result.data?.contentJson ?? result.data?.data;
        if (!contentJson) throw new Error('This cloud timeline has no content yet.');
        originalData = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
      } else {
        originalData = await window.electron.loadTimeline(file.id);
      }

      // Create duplicate with new name
      const duplicateName = `${file.name} Copy`;
      const duplicateId = duplicateName.toLowerCase().replace(/\s+/g, '-');

      const duplicateData = {
        ...originalData,
        file: {
          ...originalData.file,
          id: `${duplicateId}-timeline`,
          title: duplicateName,
        },
      };

      // Save the duplicate
      await window.electron.saveTimeline(duplicateData, duplicateId);

      // Reload timeline list
      if (window.electron?.listTimelines) {
        const files = await window.electron.listTimelines();
        setTimelineFiles(files);
      }
    } catch (error) {
      console.error('Failed to duplicate timeline:', error);
      alert(`Failed to duplicate timeline: ${error.message}`);
    }
  };

  const handleDelete = async (file) => {
    setDeleteDialogFile(file);
    setDeleteDialogWithAssets(false);
  };

  const handleConfirmDelete = async () => {
    const file = deleteDialogFile;
    if (!file) return;

    try {
      if (file.storageType === 'cloud') {
        const backendId = file.id.slice('cloud:'.length);
        await apiDeleteTimeline(backendId);
        setCloudTimelineFiles(prev => prev.filter(f => f.id !== file.id));
      } else if (window.electron?.deleteTimeline) {
        await window.electron.deleteTimeline({
          id: file.id,
          deleteAssets: deleteDialogWithAssets,
        });

        // Reload timeline list
        const files = await window.electron.listTimelines();
        setTimelineFiles(files.map(f => ({ ...f, storageType: 'local' })));
      } else {
        alert('Delete is only available in the desktop app');
      }
    } catch (error) {
      console.error('Failed to delete timeline:', error);
      alert(`Failed to delete timeline: ${error.message}`);
    } finally {
      setDeleteDialogFile(null);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const allTimelines = [...timelineFiles, ...cloudTimelineFiles];
  const filteredTimelines = allTimelines
    .filter((file) => {
      const matchesSearch = !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery);
      const matchesFilter = filter === "all" || file.storageType === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));

  if (loading && !settingsOnly) {
    return (
      <div className="homepage">
        <div className="homepage-container">
          <p>Loading timelines...</p>
        </div>
      </div>
    );
  }

  const closeSettings = () => {
    if (settingsOnly) {
      onAppSettingsClosed?.();
      return;
    }
    setView("home");
  };

  return (
    <div className={`homepage${settingsOnly ? " homepage-settings-only" : ""}`}>
      {!settingsOnly && (
        <>
          <div className="homepage-container">
        <div className="homepage-header">
          <div className="homepage-header-left">
            <h1 className="homepage-title">timelines</h1>
            <svg
              className="homepage-logo"
              width="67"
              height="25"
              viewBox="0 0 67 25"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect y="8.89844" width="29.2656" height="6.80469" fill="currentColor" />
              <rect x="34.0703" width="32.9297" height="7.32812" fill="currentColor" />
              <rect x="34.0703" y="16.75" width="32.9297" height="7.32812" fill="currentColor" />
              <path d="M28.2656 5C28.2656 2.23858 30.5042 0 33.2656 0H35.0703V24.0781H33.2656C30.5042 24.0781 28.2656 21.8395 28.2656 19.0781V5Z" fill="currentColor" />
            </svg>
          </div>
          <div className="homepage-header-right">
            <input
              className="homepage-search"
              type="text"
              placeholder="Search timelines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search timelines"
            />
            <button
              className="homepage-settings-icon"
              onClick={handleOpenMarketplace}
              aria-label="Marketplace"
            >
              <Store size={19} />
            </button>
            <button
              className="homepage-settings-icon"
              onClick={() => setView("settings")}
              aria-label="App Settings"
            >
              <Settings size={19} />
            </button>
          </div>
        </div>

        <div className="timeline-view-toolbar">
          <button className="timeline-new-btn" onClick={handleNewTimeline}>
            <FilePlus size={14} strokeWidth={2.5} />
            New Timeline
          </button>
          <div className="timeline-toolbar-right">
            {cloudTimelineFiles.length > 0 && (
              <div className="timeline-filter-tabs">
                {["all", "local", "cloud"].map((tab) => (
                  <button
                    key={tab}
                    className={`timeline-filter-tab${filter === tab ? " active" : ""}`}
                    onClick={() => setFilter(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              {canUseCloud && (
                <button
                  className="timeline-view-toggle"
                  onClick={handleSync}
                  aria-label="Sync timelines"
                  title="Sync"
                  disabled={syncing}
                >
                  <RefreshCw size={15} className={syncing ? "spin" : ""} />
                </button>
              )}
              <button
                className="timeline-view-toggle"
                onClick={() => setViewMode(v => v === "list" ? "grid" : "list")}
                aria-label="Toggle view"
              >
                {viewMode === "list" ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>
            </div>
          </div>
        </div>

        {cloudActionError && (
          <div className="cloud-action-error">{cloudActionError}</div>
        )}

        {viewMode === "list" ? (
          <div className="timeline-list">
            {filteredTimelines.map((file) => (
              <div
                key={file.id}
                className="timeline-item"
                onClick={() => onSelectTimeline(file.id)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="timeline-item-icon">
                  <svg width="20" height="8" viewBox="0 0 67 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect y="8.89844" width="29.2656" height="6.80469" fill="currentColor" />
                    <rect x="34.0703" width="32.9297" height="7.32812" fill="currentColor" />
                    <rect x="34.0703" y="16.75" width="32.9297" height="7.32812" fill="currentColor" />
                    <path d="M28.2656 5C28.2656 2.23858 30.5042 0 33.2656 0H35.0703V24.0781H33.2656C30.5042 24.0781 28.2656 21.8395 28.2656 19.0781V5Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="timeline-item-body">
                  <span className="timeline-item-title">{file.name}</span>
                  <span className="timeline-item-meta">
                    {file.modifiedAt ? `Edited ${relativeTime(file.modifiedAt)}` : ""}
                  </span>
                </div>
                <div className="timeline-item-right">
                  {cloudTimelineFiles.length > 0 && (
                    <span className={`timeline-item-badge${file.storageType === 'cloud' ? ` cloud ${file.syncStatus ?? 'synced'}` : ''}`}>
                      {file.storageType === 'cloud' ? <Cloud size={10} strokeWidth={2} /> : <HardDrive size={10} strokeWidth={2} />}
                      {file.storageType === 'cloud' ? ({ synced: 'Cloud', unsynced: 'Unsynced', offline: 'Offline', conflict: 'Conflict' }[file.syncStatus] ?? 'Cloud') : 'Local'}
                    </span>
                  )}
                  <button
                    className="timeline-item-dots"
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }}
                    aria-label="More options"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="timeline-grid">
            {filteredTimelines.map((file) => (
              <div
                key={file.id}
                className="timeline-card"
                onClick={() => onSelectTimeline(file.id)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="timeline-item-icon">
                  <svg width="20" height="8" viewBox="0 0 67 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect y="8.89844" width="29.2656" height="6.80469" fill="currentColor" />
                    <rect x="34.0703" width="32.9297" height="7.32812" fill="currentColor" />
                    <rect x="34.0703" y="16.75" width="32.9297" height="7.32812" fill="currentColor" />
                    <path d="M28.2656 5C28.2656 2.23858 30.5042 0 33.2656 0H35.0703V24.0781H33.2656C30.5042 24.0781 28.2656 21.8395 28.2656 19.0781V5Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="timeline-card-body">
                  <span className="timeline-item-title">{file.name}</span>
                  <span className="timeline-item-meta">{file.modifiedAt ? `Edited ${relativeTime(file.modifiedAt)}` : ""}</span>
                </div>
                {cloudTimelineFiles.length > 0 && (
                  <span className={`timeline-item-badge${file.storageType === 'cloud' ? ` cloud ${file.syncStatus ?? 'synced'}` : ''}`}>
                    {file.storageType === 'cloud' ? <Cloud size={10} strokeWidth={2} /> : <HardDrive size={10} strokeWidth={2} />}
                    {file.storageType === 'cloud' ? ({ synced: 'Cloud', unsynced: 'Unsynced', offline: 'Offline', conflict: 'Conflict' }[file.syncStatus] ?? 'Cloud') : 'Local'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {filteredTimelines.length === 0 && (
          <div className="no-timelines">
            <p>No timelines found. Create a new one to get started.</p>
          </div>
        )}
          </div>

          <NewTimelineModal
            isOpen={isNewTimelineModalOpen}
            onClose={() => setIsNewTimelineModalOpen(false)}
            onCreate={handleCreateTimeline}
          />
        </>
      )}

      {view === "settings" && (
        <div
          className={`settings-backdrop${reuseExistingBackdrop ? " settings-backdrop-pass-through" : ""}`}
          onClick={closeSettings}
        >
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <button
                className="settings-back-button"
                onClick={closeSettings}
                aria-label="Close settings"
              >
                <ArrowLeft size={18} strokeWidth={2} />
              </button>
              <h2 className="settings-title settings-title-right">APP SETTINGS</h2>
            </div>

            <div className="settings-layout">
              <div className="settings-sidebar">
                <button
                  type="button"
                  className={`settings-sidebar-item${settingsSection === "general" ? " is-active" : ""}`}
                  onClick={() => setSettingsSection("general")}
                >
                  General
                </button>
                <button
                  type="button"
                  className={`settings-sidebar-item${settingsSection === "files" ? " is-active" : ""}`}
                  onClick={() => setSettingsSection("files")}
                >
                  Files
                </button>
                <button
                  type="button"
                  className={`settings-sidebar-item${settingsSection === "hotkeys" ? " is-active" : ""}`}
                  onClick={() => setSettingsSection("hotkeys")}
                >
                  Hotkeys
                </button>
              </div>
              <div className="settings-content">
                {settingsSection === "general" && (
                  <>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Version 0.3.0-alpha.1</div>
                        <div className="settings-row-description">
                          {updateStatus === 'available'
                            ? 'Update available'
                            : updateStatus === 'downloaded'
                            ? 'Ready to install'
                            : updateStatus === 'error'
                            ? 'Update check failed'
                            : 'Up to date'}
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            {updateStatus === 'downloaded' ? (
                              <button
                                className="settings-folder-button"
                                type="button"
                                onClick={() => window.electron?.installUpdate?.()}
                              >
                                Restart & Install
                              </button>
                            ) : updateStatus === 'available' ? (
                              <button
                                className="settings-folder-button"
                                type="button"
                                onClick={() => window.electron?.downloadUpdate?.()}
                              >
                                {updateStatus === 'downloading'
                                  ? `Downloading…`
                                  : 'Download Update'}
                              </button>
                            ) : (
                              <button
                                className="settings-folder-button"
                                type="button"
                                disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                                onClick={() => window.electron?.checkForUpdates?.()}
                              >
                                {updateStatus === 'checking' ? 'Checking…' : updateStatus === 'downloading' ? `Downloading…` : 'Check for Updates'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row settings-row-docs">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Documentation</div>
                        <div className="settings-row-description">
                          Guides, tips, and feature references.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() =>
                                window.electron?.openExternal?.({
                                  url: "https://github.com/sreegjl/timelines",
                                })
                              }
                            >
                              Open Docs
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">App Theme</div>
                        <div className="settings-row-description">
                          Used as the default theme for timelines.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-select-row">
                            <button
                              className="settings-select-icon-button"
                              type="button"
                              onClick={() => window.electron?.openThemesFolder?.()}
                              aria-label="Open theme folder"
                            >
                              <Folder className="settings-select-icon" size={18} />
                            </button>
                            <select
                              className="settings-select"
                              value={appThemeKey || ""}
                              onChange={(e) => onAppThemeChange?.(e.target.value)}
                            >
                              {appThemes.map(([key, theme]) => {
                                const isDefault = key.toLowerCase() === "parchment";
                                const label = `${theme?.name || key}${isDefault ? " (Default)" : ""}`;
                                return (
                                  <option key={key} value={key}>
                                    {label}
                                  </option>
                                );
                              })}
                              {userThemes.map(([key, theme]) => (
                                <option key={key} value={key}>
                                  {theme?.name || key}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">App Font</div>
                        <div className="settings-row-description">
                          Sets the UI font. Add custom fonts in the font folder.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-select-row">
                            <button
                              className="settings-select-icon-button"
                              type="button"
                              onClick={() => onOpenFontsFolder?.()}
                              aria-label="Open font folder"
                            >
                              <Folder className="settings-select-icon" size={18} />
                            </button>
                            <select
                              className="settings-select"
                              value={appFontFamily || "Inter"}
                              onChange={(e) => onAppFontChange?.(e.target.value)}
                            >
                              {fontOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">App Font Size</div>
                        <div className="settings-row-description">
                          Controls the base UI font size.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-font-size">
                          <input
                            className="settings-slider"
                            type="range"
                            min={12}
                            max={18}
                            step={1}
                            value={appFontSize || 14}
                            onChange={(e) => onAppFontSizeChange?.(e.target.value)}
                            aria-label="App font size"
                          />
                          <div
                            className="settings-slider-tooltip"
                            style={{
                              left: `${(((appFontSize || 14) - 12) / 6) * 100}%`,
                            }}
                          >
                            {appFontSize || 14}px
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {settingsSection === "hotkeys" && (
                  <>
                    {Object.entries(keybinds).map(([id, { label, keys }]) => (
                      <div className="settings-row" key={id}>
                        <div className="settings-row-left">
                          <div className="settings-row-label">{label}</div>
                        </div>
                        <div className="settings-row-right">
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {recordingKey === id ? (
                              <span
                                className="hotkey-badge hotkey-badge-recording"
                              >
                                Press a key…
                              </span>
                            ) : (
                              <span className="hotkey-badge">
                                {keys.join(" + ")}
                              </span>
                            )}
                            <button
                              className="hotkey-icon-button"
                              type="button"
                              title={recordingKey === id ? "Cancel" : "Edit"}
                              onClick={() => setRecordingKey(recordingKey === id ? null : id)}
                            >
                              {recordingKey === id ? <X size={13} /> : <Pencil size={13} />}
                            </button>
                            <button
                              className="hotkey-icon-button"
                              type="button"
                              title="Reset to default"
                              onClick={() => {
                                const updated = {
                                  ...keybinds,
                                  [id]: { ...keybinds[id], keys: [...DEFAULT_KEYBINDS[id].keys] },
                                };
                                onKeybindsChange?.(updated);
                                saveKeybinds(updated);
                              }}
                            >
                              <RotateCcw size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {settingsSection === "files" && (
                  <>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Timeline Folder</div>
                        <div
                          className="settings-path-pill"
                          title={timelineStorageDir || "Default app storage"}
                        >
                          <Folder className="settings-path-icon" size={14} />
                          <span className="settings-path-text">
                            {timelineStorageDir || "Default app storage"}
                          </span>
                        </div>
                        {timelinePathIssue && (
                          <div className="settings-path-error">{timelinePathIssue}</div>
                        )}
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onPickTimelinesDir?.()}
                            >
                              Choose...
                            </button>
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onTimelineStorageDirChange?.("")}
                            >
                              Use Default
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Notes Folder</div>
                        <div
                          className="settings-path-pill"
                          title={notesStorageDir || "Default app storage"}
                        >
                          <Folder className="settings-path-icon" size={14} />
                          <span className="settings-path-text">
                            {notesStorageDir || "Default app storage"}
                          </span>
                        </div>
                        {notesPathIssue && (
                          <div className="settings-path-error">{notesPathIssue}</div>
                        )}
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onPickNotesDir?.()}
                            >
                              Choose...
                            </button>
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onNotesStorageDirChange?.("")}
                            >
                              Use Default
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Use Subfolder For New Files</div>
                        <div className="settings-row-description">
                          When enabled, new notes are placed under the default subfolder.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={notesSubfolderEnabled}
                            onChange={(e) =>
                              onNotesSubfolderEnabledChange?.(e.target.checked)
                            }
                          />
                          <span className="settings-toggle-slider" />
                        </label>
                      </div>
                    </div>
                    {notesSubfolderEnabled && (
                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Default Notes Subfolder</div>
                        <div
                          className="settings-path-pill"
                          title={notesSubfolder || "Default (none)"}
                        >
                          <Folder className="settings-path-icon" size={14} />
                          <span className="settings-path-text">
                            {notesSubfolder || "Default (none)"}
                          </span>
                        </div>
                        {notesSubfolderIssue && (
                          <div className="settings-path-error">{notesSubfolderIssue}</div>
                        )}
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onPickNotesSubfolder?.()}
                            >
                              Choose...
                            </button>
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onNotesSubfolderChange?.("")}
                            >
                              Use Default
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </>
                )}

                {settingsSection === "cloud" && (
                  <>
                    {cloudUser ? (
                      <div className="settings-row">
                        <div className="settings-row-left">
                          <div className="settings-row-label">Account</div>
                          <div className="settings-row-description">{cloudUser.email}</div>
                          {cloudUser.verified === false && (
                            <div className="settings-path-error">Email not verified — please verify at our website.</div>
                          )}
                          {cloudUser.plan && (
                            <div className="settings-row-description">{cloudUser.plan} Plan</div>
                          )}
                        </div>
                        <div className="settings-row-right">
                          <button className="settings-folder-button" type="button" onClick={handleCloudLogout}>
                            Log Out
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="settings-row">
                        <div className="settings-row-left">
                          <div className="settings-row-label">Log In</div>
                          <div className="settings-row-description">Sign in to sync your timelines to the cloud.</div>
                          {cloudError && (
                            <div className="settings-path-error">{cloudError}</div>
                          )}
                        </div>
                        <div className="settings-row-right">
                          <form className="settings-cloud-form" onSubmit={handleCloudSubmit}>
                            <input
                              className="settings-input"
                              type="email"
                              placeholder="Email"
                              value={cloudEmail}
                              onChange={(e) => setCloudEmail(e.target.value)}
                              required
                            />
                            <input
                              className="settings-input"
                              type="password"
                              placeholder="Password"
                              value={cloudPassword}
                              onChange={(e) => setCloudPassword(e.target.value)}
                              required
                            />
                            <div className="settings-folder-actions">
                              <button className="settings-folder-button" type="submit" disabled={cloudLoading}>
                                {cloudLoading ? "..." : "Log In"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {deleteDialogFile && (
        <div
          className="settings-backdrop"
          onClick={() => setDeleteDialogFile(null)}
        >
          <div
            className="settings-modal confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-header">
              <h2 className="settings-title">DELETE TIMELINE</h2>
              <button
                className="settings-back-button"
                onClick={() => setDeleteDialogFile(null)}
                aria-label="Close delete dialog"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="confirm-content">
              <p className="confirm-text">
                Are you sure you want to delete "{deleteDialogFile.name}"? This cannot be
                undone.
              </p>
              <label className="confirm-checkbox">
                <input
                  type="checkbox"
                  checked={deleteDialogWithAssets}
                  onChange={(e) => setDeleteDialogWithAssets(e.target.checked)}
                />
                Also delete notes/assets for this timeline
              </label>
            </div>

            <div className="confirm-actions">
              <button
                className="settings-folder-button"
                onClick={() => setDeleteDialogFile(null)}
              >
                Cancel
              </button>
              <button
                className="settings-folder-button confirm-delete-button"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {storeLocallyDialogFile && (
        <div
          className="settings-backdrop"
          onClick={() => setStoreLocallyDialogFile(null)}
        >
          <div
            className="settings-modal confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-header">
              <h2 className="settings-title">STORE LOCALLY</h2>
              <button
                className="settings-back-button"
                onClick={() => setStoreLocallyDialogFile(null)}
                aria-label="Close dialog"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="confirm-content">
              <p className="confirm-text">
                "{storeLocallyDialogFile.name}" will be saved to your device and removed from the cloud. This cannot be undone.
              </p>
            </div>
            <div className="confirm-actions">
              <button
                className="settings-folder-button"
                onClick={() => setStoreLocallyDialogFile(null)}
              >
                Cancel
              </button>
              <button
                className="settings-folder-button confirm-delete-button"
                onClick={handleConfirmStoreLocally}
              >
                Store Locally
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            ...(contextMenu.nearRight
              ? { right: `${window.innerWidth - contextMenu.x}px` }
              : { left: `${contextMenu.x}px` }),
            top: `${contextMenu.y}px`,
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onSelectTimeline(contextMenu.file.id))}
          >
            <File size={16} />
            <span>Open</span>
          </button>

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => handleDuplicate(contextMenu.file))}
          >
            <Copy size={16} />
            <span>Duplicate</span>
          </button>

          {canUseCloud && (
            <>
              <div className="context-menu-separator" />
              {contextMenu.file.storageType === 'cloud' ? (
                <button
                  className="context-menu-item"
                  onClick={() => handleMenuAction(() => setStoreLocallyDialogFile(contextMenu.file))}
                >
                  <HardDrive size={16} />
                  <span>Store Locally</span>
                </button>
              ) : (
                <button
                  className="context-menu-item"
                  onClick={() => handleMenuAction(() => handleStoreInCloud(contextMenu.file))}
                >
                  <Cloud size={16} />
                  <span>Store in Cloud</span>
                </button>
              )}
            </>
          )}

          <div className="context-menu-separator" />

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => handleDelete(contextMenu.file))}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {isMarketplaceOpen && (
        <div className="settings-backdrop" onClick={handleCloseMarketplace}>
          <div className="marketplace-modal" onClick={(e) => e.stopPropagation()}>
            <div className="marketplace-header">
              <button
                className="settings-back-button"
                onClick={handleCloseMarketplace}
                aria-label="Close marketplace"
              >
                <ArrowLeft size={18} strokeWidth={2} />
              </button>
              <h2 className="settings-title">MARKETPLACE</h2>
            </div>

            <div className="marketplace-search-row">
              <input
                className="marketplace-search"
                type="text"
                placeholder="Search themes..."
                value={marketplaceSearch}
                onChange={(e) => setMarketplaceSearch(e.target.value)}
                aria-label="Search marketplace themes"
              />
            </div>

            {marketplaceError && (
              <div className="marketplace-error">{marketplaceError}</div>
            )}

            {marketplaceLoading ? (
              <div className="marketplace-loading">Loading themes...</div>
            ) : (
              <div className="marketplace-grid">
                {marketplaceThemes
                  .filter((theme) => {
                    const query = marketplaceSearch.trim().toLowerCase();
                    if (!query) return true;
                    const haystack = [
                      theme?.name,
                      theme?.id,
                      theme?.author,
                      theme?.description,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase();
                    return haystack.includes(query);
                  })
                  .map((theme) => {
                  const themeId = String(theme.id || "").toLowerCase();
                  const isInstalled =
                    installedThemeIds.has(themeId) || userThemeIds.has(themeId);
                  const isActive =
                    String(appThemeKey || "").toLowerCase() === themeId;
                  const isBusy = marketplaceBusyId === theme.id;
                  const thumbnailUrl = theme?.paths?.thumbnail
                    ? `${MARKETPLACE_BASE}${theme.paths.thumbnail}`
                    : "";
                  return (
                    <div key={theme.id} className="marketplace-card">
                      <div className="marketplace-thumbnail">
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={`${theme.name} preview`} />
                        ) : (
                          <div className="marketplace-thumbnail-empty">No preview</div>
                        )}
                      </div>
                      <div className="marketplace-card-body">
                        <div className="marketplace-card-title">
                          {theme.name || theme.id}
                        </div>
                        <div className="marketplace-card-author">
                          {theme.author ? `by ${theme.author}` : ""}
                        </div>
                        <div className="marketplace-card-description">
                          {theme.description}
                        </div>
                      </div>
                      <div className="marketplace-card-actions">
                        {isInstalled ? (
                          <>
                            <button
                              className="marketplace-button"
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                onAppThemeChange?.(
                                  isActive ? defaultThemeKey || "parchment" : theme.id
                                )
                              }
                            >
                              {isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              className="marketplace-icon-button marketplace-button-danger"
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteTheme(theme)}
                              aria-label="Delete theme"
                              title="Delete theme"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="marketplace-button"
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDownloadTheme(theme)}
                          >
                            {isBusy ? "Downloading..." : "Download"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
