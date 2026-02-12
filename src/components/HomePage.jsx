import { useState, useEffect, useRef, useMemo } from "react";
import { File, FilePlus, Copy, Trash2, Settings, ArrowLeft, Folder, Store, X } from "lucide-react";
import NewTimelineModal from "./NewTimelineModal";
import "../styles/02-homepage.css";
import "../styles/07-modals-menus.css";
import themeConfig from "../config/theme.json";
import { loadThemeConfig } from "../utils/themeLoader";
import { deleteUserTheme, saveUserTheme } from "../utils/electronApi";

export default function HomePage({
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
}) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [view, setView] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [marketplaceThemes, setMarketplaceThemes] = useState([]);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceBusyId, setMarketplaceBusyId] = useState("");
  const [installedThemeIds, setInstalledThemeIds] = useState(new Set());
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [deleteDialogFile, setDeleteDialogFile] = useState(null);
  const [deleteDialogWithAssets, setDeleteDialogWithAssets] = useState(false);
  const [settingsSection, setSettingsSection] = useState("general");
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
    const invalidCharPattern = /[<>:"|?*\x00-\x1F]/;
    const isDrivePath = /^[a-zA-Z]:[\\/]/.test(trimmed);
    const pathToCheck = isDrivePath ? trimmed.slice(2) : trimmed;
    if (invalidCharPattern.test(pathToCheck)) {
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
    const loadTimelineList = async () => {
      if (window.electron?.listTimelines) {
        try {
          const files = await window.electron.listTimelines();
          setTimelineFiles(files);
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
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
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
        setTimelineFiles(files);
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
  const filteredTimelines = normalizedQuery
    ? timelineFiles.filter((file) => file.name.toLowerCase().includes(normalizedQuery))
    : timelineFiles;

  if (loading) {
    return (
      <div className="homepage">
        <div className="homepage-container">
          <p>Loading timelines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <div className="homepage-header-left">
            <h1 className="homepage-title">timelines</h1>
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
              <Store size={26} />
            </button>
            <button
              className="homepage-settings-icon"
              onClick={() => setView("settings")}
              aria-label="App Settings"
            >
              <Settings size={26} />
            </button>
          </div>
        </div>

        <div className="timeline-grid">
          <button className="timeline-card timeline-card-new" onClick={handleNewTimeline}>
            <FilePlus size={32} strokeWidth={1.5} />
            <span>New Timeline</span>
          </button>

          {filteredTimelines.map((file) => (
            <button
              key={file.id}
              className="timeline-card"
              onClick={() => onSelectTimeline(file.id)}
              onContextMenu={(e) => handleContextMenu(e, file)}
            >
              <File size={32} strokeWidth={1.5} />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

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

      {view === "settings" && (
        <div className="settings-backdrop" onClick={() => setView("home")}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <button
                className="settings-back-button"
                onClick={() => setView("home")}
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
                  className={`settings-sidebar-item${settingsSection === "appearance" ? " is-active" : ""}`}
                  onClick={() => setSettingsSection("appearance")}
                >
                  Appearance
                </button>
                <button
                  type="button"
                  className={`settings-sidebar-item${settingsSection === "files" ? " is-active" : ""}`}
                  onClick={() => setSettingsSection("files")}
                >
                  Files
                </button>
              </div>
              <div className="settings-content">
                {settingsSection === "general" && (
                  <>
                    <div className="settings-row settings-row-docs">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Documentation</div>
                        <div className="settings-row-description">
                          Timelines 0.2.0 (Alpha)
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
                  </>
                )}

                {settingsSection === "appearance" && (
                  <>
                    <div className="settings-row no-border-bottom">
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
                    <div className="settings-row settings-row-section">
                      <div className="settings-row-left">
                        <div className="settings-row-label">Font</div>
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

                {settingsSection === "files" && (
                  <>
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
            left: `${contextMenu.x}px`,
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
