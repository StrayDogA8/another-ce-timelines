import { useState, useEffect, useRef } from "react";
import { File, FilePlus, Copy, Trash2, Settings, ArrowLeft, Folder } from "lucide-react";
import NewTimelineModal from "./NewTimelineModal";
import "../styles/09-homepage.css";
import "../styles/07-modals-menus.css";

export default function HomePage({
  onSelectTimeline,
  onCreateTimeline,
  appThemeKey,
  themes,
  onAppThemeChange,
  timelineStorageDir,
  notesStorageDir,
  onTimelineStorageDirChange,
  onNotesStorageDirChange,
  onPickTimelinesDir,
  onPickNotesDir,
}) {
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [view, setView] = useState("home");
  const menuRef = useRef(null);

  useEffect(() => {
    const loadTimelineList = async () => {
      if (window.electron?.listTimelines) {
        try {
          const files = await window.electron.listTimelines();
          setTimelineFiles(files);
        } catch (error) {
          console.error('Failed to list timelines:', error);
        }
      } else {
        // Fallback to static imports for web version
        const timelineModules = import.meta.glob('../data/*.timeline', { eager: true });

        const files = Object.keys(timelineModules).map(path => {
          const filename = path.split('/').pop().replace('.timeline', '');
          const module = timelineModules[path];
          const data = module.default || module;

          return {
            id: filename,
            name: data.file?.title || filename
          };
        });

        setTimelineFiles(files);
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
      // Load the original timeline
      let originalData;
      if (window.electron?.loadTimeline) {
        originalData = await window.electron.loadTimeline(file.id);
      } else {
        const module = await import(`../data/${file.id}.timeline`);
        originalData = module.default || module;
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
      if (window.electron?.saveTimeline) {
        await window.electron.saveTimeline(duplicateData, duplicateId);
      }

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

  if (loading) {
    return (
      <div className="homepage">
        <div className="homepage-container">
          <p>Loading timelines...</p>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="homepage">
        <div className="homepage-container homepage-settings">
          <div className="homepage-settings-header">
            <button
              className="homepage-settings-back"
              onClick={() => setView("home")}
              aria-label="Back to home"
            >
              <ArrowLeft size={18} strokeWidth={2} />
              Back
            </button>
            <h1 className="homepage-title">App Settings</h1>
          </div>

          <div className="homepage-settings-content">
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Theme</div>
                <div className="settings-row-description">Used on the homepage and when no timeline is open.</div>
              </div>
              <div className="settings-row-right">
                <select
                  className="settings-select"
                  value={appThemeKey || ""}
                  onChange={(e) => onAppThemeChange?.(e.target.value)}
                >
                  {Object.entries(themes || {}).map(([key, theme]) => (
                    <option key={key} value={key}>
                      {theme?.name || key}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Timeline Folder</div>
                <div className="settings-row-description">
                  Where .timeline files are stored. Leave blank to use the default app folder.
                  Changing this will hide timelines stored in the previous folder until you switch back.
                </div>
              </div>
              <div className="settings-row-right">
                <div className="settings-folder">
                  <div className="settings-path-pill" title={timelineStorageDir || "Default app storage"}>
                    <Folder className="settings-path-icon" size={14} />
                    <span className="settings-path-text">
                      {timelineStorageDir || "Default app storage"}
                    </span>
                  </div>
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
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">Notes Folder</div>
                <div className="settings-row-description">
                  Where .md notes are stored. Leave blank to store notes next to timelines.
                  Changing this will hide notes stored in the previous folder until you switch back.
                </div>
              </div>
              <div className="settings-row-right">
                <div className="settings-folder">
                  <div className="settings-path-pill" title={notesStorageDir || "Default app storage"}>
                    <Folder className="settings-path-icon" size={14} />
                    <span className="settings-path-text">
                      {notesStorageDir || "Default app storage"}
                    </span>
                  </div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <div>
            <h1 className="homepage-title">timelines</h1>
            <p className="homepage-subtitle">Select a timeline to open</p>
          </div>
          <button className="homepage-settings-button" onClick={() => setView("settings")}>
            <Settings size={16} />
            App Settings
          </button>
        </div>

        <div className="timeline-grid">
          <button className="timeline-card timeline-card-new" onClick={handleNewTimeline}>
            <FilePlus size={32} strokeWidth={1.5} />
            <span>New Timeline</span>
          </button>

          {timelineFiles.map((file) => (
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

        {timelineFiles.length === 0 && (
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
