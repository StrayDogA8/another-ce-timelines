import { useState, useEffect, useRef, useMemo } from "react";
import { File, FilePlus, Copy, Trash2, Settings, ArrowLeft, Folder, FolderPlus, FolderOpen, Store, X, LayoutGrid, List, MoreVertical, Pencil, RotateCcw, ArrowUpAZ, ArrowDownAZ, Clock, ChevronRight, Search } from "lucide-react";
import { createFolder, listFolders, moveTimeline, renameFolder, updateTimelineTitle, deleteFolder, moveFolder } from "../utils/electronApi.js";
import { getAppSettings, saveAppSettings } from "../utils/appSettings.js";

function MovePicker({ folders, currentFolder, onConfirm, onCancel }) {
  const [dest, setDest] = useState(null);
  return (
    <div className="folder-modal folder-modal-pick" onClick={(e) => e.stopPropagation()}>
      <FolderTree folders={folders} currentFolder={currentFolder} selected={dest} onSelect={setDest} />
      <div className="folder-modal-actions">
        <button className="folder-modal-btn" onClick={onCancel}>Cancel</button>
        <button className="folder-modal-btn folder-modal-btn-primary" disabled={dest === null} onClick={() => onConfirm(dest)}>OK</button>
      </div>
    </div>
  );
}

function FolderTree({ folders, currentFolder, selected, onSelect }) {
  const [collapsed, setCollapsed] = useState({});

  const toggle = (path) => setCollapsed(prev => ({ ...prev, [path]: !prev[path] }));

  const hasChildren = (path) => folders.some(f => f.startsWith(path + '/') && f.split('/').length === path.split('/').length + 1);

  const renderLevel = (parentPath, depth) => {
    const prefix = parentPath ? parentPath + '/' : '';
    const items = folders.filter(f => {
      const parts = f.split('/');
      const parentParts = parentPath ? parentPath.split('/') : [];
      return parts.length === parentParts.length + 1 && f.startsWith(prefix);
    });

    return items.map((f) => {
      const label = f.split('/').pop();
      const isOpen = !collapsed[f];
      const children = hasChildren(f);
      return (
        <div key={f}>
          <div className={`timeline-folder-option${selected === f ? ' is-selected' : ''}${currentFolder === f ? ' is-current' : ''}`} style={{ paddingLeft: 8 + depth * 16 }}>
            <button
              type="button"
              className="folder-tree-toggle"
              onClick={() => children && toggle(f)}
              style={{ visibility: children ? 'visible' : 'hidden' }}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight size={11} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            <button type="button" className="folder-tree-label" onClick={() => onSelect(f)}>
              <Folder size={13} />
              <span>{label}</span>
            </button>
          </div>
          {children && isOpen && renderLevel(f, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="timeline-folder-list">
      <div className={`timeline-folder-option${selected === '' ? ' is-selected' : ''}${currentFolder === '' ? ' is-current' : ''}`} style={{ paddingLeft: 8 }}>
        <span className="folder-tree-toggle" style={{ visibility: 'hidden' }} />
        <button type="button" className="folder-tree-label" onClick={() => onSelect('')}>
          <Folder size={13} />
          <span>Home</span>
        </button>
      </div>
      {renderLevel('', 0)}
    </div>
  );
}

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
import { DEFAULT_KEYBINDS, cloneDefaultKeybinds, saveKeybinds } from "../utils/keybinds";
import MarketplaceModal from "./MarketplaceModal";

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
  oldFormatThemeCount = 0,
  onMigrateOldThemes,
  onAppFontChange,
  onAppFontSizeChange,
  timelineStorageDir,
  notesStorageDir,
  assetsStorageDir,
  onAssetsStorageDirChange,
  onTimelineStorageDirChange,
  onNotesStorageDirChange,
  onPickTimelinesDir,
  onPickNotesDir,
  onPickAssetsDir,
  onOpenFontsFolder,
  onOpenTimelinesFolder,
  onOpenNotesFolder,
  onOpenAssetsFolder,
  hardwareAcceleration = true,
  onHardwareAccelerationChange,
  startMaximized = false,
  onStartMaximizedChange,
  onRefreshThemes,
  openSettingsSignal = 0,
  onAppSettingsClosed,
  keybinds = cloneDefaultKeybinds(),
  onKeybindsChange,
}) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [view, setView] = useState(settingsOnly ? "settings" : "home");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [sortMode, setSortMode] = useState("date");
  useEffect(() => { getAppSettings().then(s => { if (s.homeSortMode) setSortMode(s.homeSortMode); }); }, []);
  const [currentFolder, setCurrentFolder] = useState("");
  const [allFolders, setAllFolders] = useState([]);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveDialogFile, setMoveDialogFile] = useState(null);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [folderContextMenu, setFolderContextMenu] = useState(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [deleteDialogFile, setDeleteDialogFile] = useState(null);
  const [deleteDialogWithAssets, setDeleteDialogWithAssets] = useState(false);
  const [settingsSection, setSettingsSection] = useState("general");
  const [updateStatus, setUpdateStatus] = useState(null); // null | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev'
  const [themeMigrationStatus, setThemeMigrationStatus] = useState(null); // null | 'migrating' | { count }
  const [recordingKey, setRecordingKey] = useState(null);
  const recordingKeyRef = useRef(null);
  const previousViewRef = useRef("home");
  const menuRef = useRef(null);
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
      if (aLower === "parchment_v2" && bLower !== "parchment_v2") return -1;
      if (aLower !== "parchment_v2" && bLower === "parchment_v2") return 1;
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
      if (window.electron?.listFolders) {
        try {
          const folders = await window.electron.listFolders();
          setAllFolders(folders);
        } catch { setAllFolders([]); }
      }
      setLoading(false);
    };

    loadTimelineList();
    setCurrentFolder("");
    setShowAllFolders(false);
  }, [timelineStorageDir]);

  // Close context menus when clicking outside
  useEffect(() => {
    if (!contextMenu && !folderContextMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
        setFolderContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu, folderContextMenu]);

  const handleNewTimeline = () => {
    setIsNewTimelineModalOpen(true);
  };

  const handleCreateTimeline = (timelineConfig) => {
    setIsNewTimelineModalOpen(false);
    onCreateTimeline({ ...timelineConfig, folder: currentFolder || '' });
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
  };

  const handleMigrateOldThemes = async () => {
    if (!onMigrateOldThemes) return;
    setThemeMigrationStatus("migrating");
    const count = await onMigrateOldThemes();
    setThemeMigrationStatus({ count });
    setTimeout(() => setThemeMigrationStatus(null), 3000);
  };

  const handleDuplicate = async (file) => {
    try {
      if (!window.electron?.loadTimeline || !window.electron?.saveTimeline) {
        throw new Error("Duplicate is only available in the desktop app.");
      }
      // Load the original timeline
      const originalData = await window.electron.loadTimeline(file.id);

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

  const refreshLocal = async () => {
    if (window.electron?.listTimelines) {
      const files = await window.electron.listTimelines();
      setTimelineFiles(files.map(f => ({ ...f, storageType: 'local' })));
    }
    if (window.electron?.listFolders) {
      const folders = await window.electron.listFolders();
      setAllFolders(folders);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name, currentFolder || undefined);
    setNewFolderName("");
    setNewFolderDialogOpen(false);
    await refreshLocal();
  };

  const handleOpenMoveDialog = async (file) => {
    setMoveDialogFile(file);
    const folders = await listFolders();
    setAvailableFolders(folders.filter(f => !f.split('/').some(part => part.startsWith('.') || part.endsWith('.assets'))));
  };

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    const name = renameName.trim();
    if (renameTarget.type === 'folder') {
      await renameFolder(renameTarget.id, name);
      if (currentFolder === renameTarget.id) {
        const parts = renameTarget.id.split('/');
        parts[parts.length - 1] = name;
        setCurrentFolder(parts.join('/'));
      }
    } else {
      await updateTimelineTitle(renameTarget.id, name);
    }
    setRenameTarget(null);
    setRenameName("");
    await refreshLocal();
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    await deleteFolder(deleteFolderTarget.folderPath);
    if (currentFolder.startsWith(deleteFolderTarget.folderPath)) setCurrentFolder("");
    setDeleteFolderTarget(null);
    await refreshLocal();
  };

  const handleMoveFolder = async (targetFolder) => {
    if (!moveFolderTarget) return;
    await moveFolder(moveFolderTarget.folderPath, targetFolder || '');
    setMoveFolderTarget(null);
    await refreshLocal();
  };

  const handleMoveTimeline = async (targetFolder) => {
    if (!moveDialogFile) return;
    const result = await moveTimeline(moveDialogFile.id, targetFolder);
    setMoveDialogFile(null);
    if (result.success) await refreshLocal();
  };

  const handleDelete = async (file) => {
    setDeleteDialogFile(file);
    setDeleteDialogWithAssets(false);
  };

  const handleConfirmDelete = async () => {
    const file = deleteDialogFile;
    if (!file) return;

    try {
      if (window.electron?.deleteTimeline) {
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
  const allTimelines = timelineFiles;

  const visibleSubfolders = useMemo(() => {
    if (normalizedQuery) return [];
    const depth = currentFolder ? currentFolder.split('/').length : 0;
    return allFolders
      .filter(f => {
        if (!f) return false;
        const parts = f.split('/');
        if (parts.length !== depth + 1) return false;
        if (currentFolder && !f.startsWith(currentFolder + '/')) return false;
        if (!currentFolder && parts.length !== 1) return false;
        return true;
      })
      .map(f => f.split('/').pop())
      .filter(name => !name.startsWith('.') && !name.endsWith('.assets'))
      .sort((a, b) => a.localeCompare(b));
  }, [allFolders, currentFolder, normalizedQuery]);

  const filteredTimelines = allTimelines
    .filter((file) => {
      const matchesSearch = !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery);
      const fileFolder = file.folder ?? '';
      const matchesFolder = currentFolder
        ? fileFolder === currentFolder || fileFolder.startsWith(currentFolder + '/')
        : normalizedQuery
          ? true
          : fileFolder === '';
      return matchesSearch && matchesFolder;
    })
    .sort((a, b) =>
      sortMode === "name" ? a.name.localeCompare(b.name)
      : sortMode === "name-desc" ? b.name.localeCompare(a.name)
      : (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0)
    );

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
            <div className="homepage-search-wrap">
              <Search size={14} className="homepage-search-icon" />
              <input
                className="homepage-search"
                type="text"
                placeholder="Search timelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search timelines"
              />
            </div>
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
          <div style={{ display: "flex", gap: "6px" }}>
            <button className="timeline-new-btn toolbar-btn-equal" onClick={handleNewTimeline}>
              <FilePlus size={14} strokeWidth={2.5} />
              New Timeline
            </button>
            <button className="timeline-new-btn timeline-new-btn-secondary toolbar-btn-equal" onClick={() => { setNewFolderName(""); setNewFolderDialogOpen(true); }}>
              <FolderPlus size={14} strokeWidth={2.5} />
              New Folder
            </button>
          </div>
          <div className="timeline-toolbar-right">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                className="timeline-view-toggle timeline-sort-btn"
                onClick={() => setSortMode(s => { const next = s === "date" ? "name" : s === "name" ? "name-desc" : "date"; saveAppSettings({ homeSortMode: next }); return next; })}
                aria-label="Toggle sort"
                title={sortMode === "date" ? "Sort: Date modified" : sortMode === "name" ? "Sort: A–Z" : "Sort: Z–A"}
              >
                {sortMode === "date" ? <Clock size={15} /> : sortMode === "name" ? <ArrowDownAZ size={15} /> : <ArrowUpAZ size={15} />}
                <span>{sortMode === "date" ? "Date" : sortMode === "name" ? "A–Z" : "Z–A"}</span>
              </button>
              <div className="view-mode-pill">
                <button
                  className={`view-mode-pill-btn${viewMode === "list" ? " is-active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  title="List"
                >
                  <List size={15} />
                </button>
                <button
                  className={`view-mode-pill-btn${viewMode === "grid" ? " is-active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  title="Grid"
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {currentFolder && (
          <div className="timeline-breadcrumb">
            <button className="timeline-breadcrumb-item" onClick={() => setCurrentFolder("")}>Home</button>
            {currentFolder.split('/').map((part, i, arr) => {
              const path = arr.slice(0, i + 1).join('/');
              return (
                <span key={path} className="timeline-breadcrumb-sep-wrap">
                  <ChevronRight size={12} className="timeline-breadcrumb-sep" />
                  <button className="timeline-breadcrumb-item" onClick={() => setCurrentFolder(path)}>{part}</button>
                </span>
              );
            })}
          </div>
        )}

        {currentFolder && (() => {
          const folderName = currentFolder.split('/').pop();
          const timelineCount = timelineFiles.filter(f => f.folder === currentFolder).length;
          const subfolderCount = visibleSubfolders.length;
          const lastModified = timelineFiles
            .filter(f => f.folder === currentFolder && f.modifiedAt)
            .reduce((max, f) => Math.max(max, f.modifiedAt), 0);
          return (
            <div className="folder-hero">
              <h2 className="folder-hero-title"><FolderOpen size={30} className="folder-hero-icon" />{folderName}</h2>
              <p className="folder-hero-meta">
                {timelineCount} {timelineCount === 1 ? 'timeline' : 'timelines'}
                {subfolderCount > 0 && <> · {subfolderCount} {subfolderCount === 1 ? 'folder' : 'folders'}</>}
                {lastModified > 0 && <> · Updated {relativeTime(lastModified)}</>}
              </p>
            </div>
          );
        })()}

        {visibleSubfolders.length > 0 && (
          <div className="homepage-section">
            <span className="homepage-section-label">Folders</span>
            <div className="timeline-folders-row">
              {(showAllFolders ? visibleSubfolders : visibleSubfolders.slice(0, 9)).map((folderName) => {
                const fullPath = currentFolder ? `${currentFolder}/${folderName}` : folderName;
                const count = timelineFiles.filter(f => (f.folder ?? '').startsWith(fullPath) && (f.folder === fullPath || f.folder.startsWith(fullPath + '/'))).length;
                return (
                  <div key={fullPath} className="timeline-folder-chip-wrap">
                    <div className="timeline-folder-chip" onClick={() => setCurrentFolder(fullPath)}>
                      <div className="timeline-folder-chip-icon"><FolderOpen size={16} /></div>
                      <div className="timeline-folder-chip-body">
                        <span className="timeline-folder-chip-name">{folderName}</span>
                        <span className={`timeline-folder-chip-meta${count === 0 ? ' is-empty' : ''}`}>{count === 0 ? 'Empty' : `${count} ${count === 1 ? 'timeline' : 'timelines'}`}</span>
                      </div>
                      <button
                        className="timeline-folder-chip-dots"
                        onClick={(e) => { e.stopPropagation(); setFolderContextMenu({ x: e.clientX, y: e.clientY, nearRight: e.clientX > window.innerWidth / 2, folderPath: fullPath, folderName }); }}
                        aria-label="More options"
                      >
                        <MoreVertical size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {visibleSubfolders.length > 9 && (
              <button className="folders-show-more" onClick={() => setShowAllFolders(v => !v)}>
                {showAllFolders ? 'Show less' : `Show ${visibleSubfolders.length - 9} more`}
              </button>
            )}
          </div>
        )}

        <div className="homepage-section">
          <span className="homepage-section-label">
            {normalizedQuery ? 'Results' : 'Timelines'}
            <span className="homepage-section-count">{filteredTimelines.length}</span>
          </span>
        {viewMode === "list" ? (
          <div className="timeline-list">
            {filteredTimelines.map((file) => (
              <div
                key={file.id}
                className="timeline-item"
                onClick={() => onSelectTimeline(file.id)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="timeline-item-body">
                  <span className="timeline-item-title">{file.name}</span>
                  {normalizedQuery && file.folder && (
                    <span className="timeline-item-folder">{file.folder}</span>
                  )}
                </div>
                <div className="timeline-item-right">
                  {file.modifiedAt && (
                    <span className="timeline-item-meta">{relativeTime(file.modifiedAt)}</span>
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
                  {normalizedQuery && file.folder && (
                    <span className="timeline-item-folder">{file.folder}</span>
                  )}
                  <span className="timeline-item-meta">{file.modifiedAt ? `Edited ${relativeTime(file.modifiedAt)}` : ""}</span>
                </div>
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
                        <div className="settings-row-label">Version 0.6.0-alpha.1</div>
                        <div className="settings-row-description">
                          {updateStatus === 'available'
                            ? 'A new update is available. Would you like to download it?'
                            : updateStatus === 'downloaded'
                            ? 'Ready to install'
                            : updateStatus === 'error'
                            ? 'Update check failed'
                            : updateStatus === 'not-available'
                            ? 'You have the latest version installed.'
                            : <>See what's new in <a href="https://github.com/sreegjl/timelines/releases/tag/v0.6.0-alpha.1" target="_blank" rel="noopener noreferrer">v0.6.0-alpha.1</a>.</>}
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            {window.electron?.platform === 'darwin' ? (
                              updateStatus === 'available' ? (
                                <>
                                  <button
                                    className="settings-folder-button"
                                    type="button"
                                    onClick={() => window.electron?.openExternal?.({ url: 'https://github.com/sreegjl/timelines/releases/latest' })}
                                  >
                                    Download Latest Release
                                  </button>
                                  <button
                                    className="settings-folder-button"
                                    type="button"
                                    onClick={() => setUpdateStatus(null)}
                                  >
                                    Not Now
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="settings-folder-button"
                                  type="button"
                                  disabled={updateStatus === 'checking'}
                                  onClick={() => window.electron?.checkForUpdates?.()}
                                >
                                  {updateStatus === 'checking' ? 'Checking…' : 'Check for Updates'}
                                </button>
                              )
                            ) : updateStatus === 'downloaded' ? (
                              <button
                                className="settings-folder-button"
                                type="button"
                                onClick={() => window.electron?.installUpdate?.()}
                              >
                                Restart & Install
                              </button>
                            ) : updateStatus === 'available' ? (
                              <>
                                <button
                                  className="settings-folder-button"
                                  type="button"
                                  onClick={() => window.electron?.downloadUpdate?.()}
                                >
                                  Download Update
                                </button>
                                <button
                                  className="settings-folder-button"
                                  type="button"
                                  onClick={() => setUpdateStatus(null)}
                                >
                                  Not Now
                                </button>
                              </>
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
                                  url: "https://www.timelines.studio/wiki",
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
                                const isDefault = key.toLowerCase() === "parchment_v2";
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
                          {themeMigrationStatus?.count != null ? (
                            <div className="theme-migration-notice">
                              {themeMigrationStatus.count} theme{themeMigrationStatus.count === 1 ? "" : "s"} updated.
                            </div>
                          ) : oldFormatThemeCount > 0 ? (
                            <div className="theme-migration-notice">
                              <span>
                                {oldFormatThemeCount} theme{oldFormatThemeCount === 1 ? "" : "s"} are using an older format. Update all?
                              </span>
                              <button
                                type="button"
                                className="theme-migration-button"
                                onClick={handleMigrateOldThemes}
                                disabled={themeMigrationStatus === "migrating"}
                              >
                                {themeMigrationStatus === "migrating" ? "Updating..." : "Update All"}
                              </button>
                            </div>
                          ) : null}
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

                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Start App Maximized</div>
                        <div className="settings-row-description">
                          Launch the app in a maximized window.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={startMaximized}
                            onChange={(e) => onStartMaximizedChange?.(e.target.checked)}
                          />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>
                    </div>

                    <div className="settings-row">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Hardware Acceleration</div>
                        <div className="settings-row-description">
                          Disable if you experience visual glitches. Requires restart.
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={hardwareAcceleration}
                            onChange={(e) => onHardwareAccelerationChange?.(e.target.checked)}
                          />
                          <span className="settings-toggle-slider"></span>
                        </label>
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
                          className="settings-path-pill settings-path-pill-clickable"
                          title={timelineStorageDir || "Default app storage"}
                          onClick={() => onOpenTimelinesFolder?.()}
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
                          className="settings-path-pill settings-path-pill-clickable"
                          title={notesStorageDir || "Default app storage"}
                          onClick={() => onOpenNotesFolder?.()}
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
                        <div className="settings-row-label">Assets Folder</div>
                        <div
                          className="settings-path-pill settings-path-pill-clickable"
                          title={assetsStorageDir || "Default app storage"}
                          onClick={() => onOpenAssetsFolder?.()}
                        >
                          <Folder className="settings-path-icon" size={14} />
                          <span className="settings-path-text">
                            {assetsStorageDir || "Default app storage"}
                          </span>
                        </div>
                      </div>
                      <div className="settings-row-right">
                        <div className="settings-folder settings-folder-column">
                          <div className="settings-folder-actions">
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onPickAssetsDir?.()}
                            >
                              Choose...
                            </button>
                            <button
                              className="settings-folder-button"
                              type="button"
                              onClick={() => onAssetsStorageDirChange?.("")}
                            >
                              Use Default
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => { setRenameTarget({ type: 'timeline', id: contextMenu.file.id, currentName: contextMenu.file.name }); setRenameName(contextMenu.file.name); })}
          >
            <Pencil size={16} />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => handleOpenMoveDialog(contextMenu.file))}
          >
            <Folder size={16} />
            <span>Move to Folder</span>
          </button>

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

      <MarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        appThemes={appThemes}
        userThemes={userThemes}
        userThemeIds={userThemeIds}
        bundledThemes={bundledThemes}
        defaultThemeKey={defaultThemeKey}
        appThemeKey={appThemeKey}
        onAppThemeChange={onAppThemeChange}
        onRefreshThemes={onRefreshThemes}
      />
      {folderContextMenu && (
        <div
          ref={menuRef}
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            ...(folderContextMenu.nearRight
              ? { right: `${window.innerWidth - folderContextMenu.x}px` }
              : { left: `${folderContextMenu.x}px` }),
            top: `${folderContextMenu.y}px`,
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => { setRenameTarget({ type: 'folder', id: folderContextMenu.folderPath, currentName: folderContextMenu.folderName }); setRenameName(folderContextMenu.folderName); setFolderContextMenu(null); }}
          >
            <Pencil size={16} />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item"
            onClick={async () => { const fc = folderContextMenu; setFolderContextMenu(null); const folders = await listFolders(); setAvailableFolders(folders.filter(f => f !== fc.folderPath && !f.startsWith(fc.folderPath + '/') && !f.split('/').some(part => part.startsWith('.') || part.endsWith('.assets')))); setMoveFolderTarget(fc); }}
          >
            <Folder size={16} />
            <span>Move to Folder</span>
          </button>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => { const fc = folderContextMenu; setFolderContextMenu(null); const fileCount = timelineFiles.filter(f => (f.folder ?? '').startsWith(fc.folderPath)).length; setDeleteFolderTarget({ ...fc, fileCount }); }}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {renameTarget && (
        <div className="settings-backdrop" onClick={() => setRenameTarget(null)}>
          <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
            <input
              className="folder-modal-input"
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="folder-modal-actions">
              <button className="folder-modal-btn" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="folder-modal-btn folder-modal-btn-primary" onClick={handleRename} disabled={!renameName.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {deleteFolderTarget && (
        <div className="settings-backdrop" onClick={() => setDeleteFolderTarget(null)}>
          <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
            <p className="folder-modal-text">
              <strong>{deleteFolderTarget.folderName}</strong>
              {deleteFolderTarget.fileCount > 0
                ? ` contains ${deleteFolderTarget.fileCount} timeline${deleteFolderTarget.fileCount !== 1 ? 's' : ''}. This cannot be undone.`
                : ' will be permanently deleted.'}
            </p>
            <div className="folder-modal-actions">
              <button className="folder-modal-btn" onClick={() => setDeleteFolderTarget(null)}>Cancel</button>
              <button className="folder-modal-btn folder-modal-btn-danger" onClick={handleDeleteFolder}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {moveFolderTarget && (
        <div className="settings-backdrop" onClick={() => setMoveFolderTarget(null)}>
          <MovePicker folders={availableFolders} currentFolder={null} onConfirm={handleMoveFolder} onCancel={() => setMoveFolderTarget(null)} />
        </div>
      )}

      {newFolderDialogOpen && (
        <div className="settings-backdrop" onClick={() => setNewFolderDialogOpen(false)}>
          <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
            <input
              className="folder-modal-input"
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <div className="folder-modal-actions">
              <button className="folder-modal-btn" onClick={() => setNewFolderDialogOpen(false)}>Cancel</button>
              <button className="folder-modal-btn folder-modal-btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {moveDialogFile && (
        <div className="settings-backdrop" onClick={() => setMoveDialogFile(null)}>
          <MovePicker folders={availableFolders} currentFolder={moveDialogFile.folder ?? ''} onConfirm={handleMoveTimeline} onCancel={() => setMoveDialogFile(null)} />
        </div>
      )}
    </div>
  );
}
