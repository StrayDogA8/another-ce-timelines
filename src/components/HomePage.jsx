import { useState, useEffect, useRef, useMemo } from "react";
import { File, FilePlus, Copy, Trash2, Settings, ArrowLeft, Folder } from "lucide-react";
import NewTimelineModal from "./NewTimelineModal";
import "../styles/02-homepage.css";
import "../styles/07-modals-menus.css";
import themeConfig from "../config/theme.json";
import { loadThemeConfig } from "../utils/themeLoader";

export default function HomePage({
  onSelectTimeline,
  onCreateTimeline,
  appThemeKey,
  appFontFamily,
  fonts,
  themes,
  onAppThemeChange,
  onAppFontChange,
  timelineStorageDir,
  notesStorageDir,
  fontStorageDir,
  onTimelineStorageDirChange,
  onNotesStorageDirChange,
  onFontStorageDirChange,
  onPickTimelinesDir,
  onPickNotesDir,
  onPickFontsDir,
  onOpenFontsFolder,
}) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [view, setView] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
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
    const options = [{ value: "Inter", label: "Inter (Default)" }];
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
  const fontPathIssue = getPathIssue(fontStorageDir);

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
    const confirmed = confirm(`Are you sure you want to delete "${file.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      if (window.electron?.deleteTimeline) {
        await window.electron.deleteTimeline(file.id);

        // Reload timeline list
        const files = await window.electron.listTimelines();
        setTimelineFiles(files);
      } else {
        alert('Delete is only available in the desktop app');
      }
    } catch (error) {
      console.error('Failed to delete timeline:', error);
      alert(`Failed to delete timeline: ${error.message}`);
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
              onClick={() => setView("settings")}
              aria-label="App Settings"
            >
              <Settings size={22} />
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

            <div className="settings-content">
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-row-label">App Theme</div>
                  <div className="settings-row-description">
                    Used on the homepage and as the default theme for timelines.
                  </div>
                </div>
                <div className="settings-row-right">
                  <div className="settings-folder settings-folder-column">
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
                    <div className="settings-folder-actions">
                      <button
                        className="settings-folder-button"
                        type="button"
                        onClick={() => window.electron?.openThemesFolder?.()}
                      >
                        Open Theme Folder
                      </button>
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
                    <div className="settings-folder-actions">
                      <button
                        className="settings-folder-button"
                        type="button"
                        onClick={() => onOpenFontsFolder?.()}
                      >
                        Open Font Folder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-row-label">Timeline Folder</div>
                  <div className="settings-row-description">
                    Where .timeline files are stored. Leave blank to use the default app folder.
                  </div>
                </div>
                <div className="settings-row-right">
                  <div className="settings-folder settings-folder-column">
                    <div className="settings-path-pill" title={timelineStorageDir || "Default app storage"}>
                      <Folder className="settings-path-icon" size={14} />
                      <span className="settings-path-text">
                        {timelineStorageDir || "Default app storage"}
                      </span>
                    </div>
                    {timelinePathIssue && (
                      <div className="settings-path-error">{timelinePathIssue}</div>
                    )}
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
                    <div className="settings-row-description">
                      Where .md notes are stored. Notes are saved under a folder per timeline.
                    </div>
                  </div>
                <div className="settings-row-right">
                  <div className="settings-folder settings-folder-column">
                    <div className="settings-path-pill" title={notesStorageDir || "Default app storage"}>
                      <Folder className="settings-path-icon" size={14} />
                      <span className="settings-path-text">
                        {notesStorageDir || "Default app storage"}
                      </span>
                    </div>
                    {notesPathIssue && (
                      <div className="settings-path-error">{notesPathIssue}</div>
                    )}
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
                  <div className="settings-row-label">Font Folder</div>
                  <div className="settings-row-description">
                    Where custom font files are stored. Leave blank to use the default app folder.
                  </div>
                </div>
                <div className="settings-row-right">
                  <div className="settings-folder settings-folder-column">
                    <div className="settings-path-pill" title={fontStorageDir || "Default app storage"}>
                      <Folder className="settings-path-icon" size={14} />
                      <span className="settings-path-text">
                        {fontStorageDir || "Default app storage"}
                      </span>
                    </div>
                    {fontPathIssue && (
                      <div className="settings-path-error">{fontPathIssue}</div>
                    )}
                    <div className="settings-folder-actions">
                      <button
                        className="settings-folder-button"
                        type="button"
                        onClick={() => onPickFontsDir?.()}
                      >
                        Choose...
                      </button>
                      <button
                        className="settings-folder-button"
                        type="button"
                        onClick={() => onFontStorageDirChange?.("")}
                      >
                        Use Default
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
    </div>
  );
}
