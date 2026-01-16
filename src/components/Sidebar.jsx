import { useMemo, useState, useEffect, useRef } from "react";
import { PanelLeft, PanelRight, ChevronDown, RectangleHorizontal, RectangleEllipsis, SquareSplitHorizontal, ListChevronsDownUp, ListChevronsUpDown, FilePlus, File, Copy, FileJson, Image, Settings, ChevronRight } from "lucide-react";
import "../styles/07-modals-menus.css";

export default function Sidebar({
  isCollapsed,
  onToggle,
  selectedId,
  onSelect,
  timelineData,
  onAddEvent,
  onAddSpan,
  onAddEra,
  onOpenSettings,
  onDownloadJson,
  onDownloadPng,
  onLoadTimeline,
}) {
  const file = timelineData.file;
  const events = timelineData.elements.filter(e => e.type === "event");
  const spans = timelineData.elements.filter(e => e.type === "span");
  const eras = timelineData.elements.filter(e => e.type === "era");

  const [openEras, setOpenEras] = useState(true);
  const [openSpans, setOpenSpans] = useState(true);
  const [openEvents, setOpenEvents] = useState(true);
  const [timelineMenu, setTimelineMenu] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [submenuPosition, setSubmenuPosition] = useState(null);
  const menuRef = useRef(null);
  const submenuRef = useRef(null);
  const openTimelineRef = useRef(null);

  const displayName = useMemo(() => {
    if (!file) return "";
    if (file.id?.endsWith("-timeline")) {
      return file.id.replace("-timeline", ".timeline");
    }
    return file.title || file.id || "";
  }, [file]);

  const fmtYear = (y) => {
    if (!file) return String(y);
    return y < 0 ? `${Math.abs(y)} ${file.negID}` : `${y} ${file.posID}`;
  };

  const eraRows = useMemo(
    () => [...eras].sort((a, b) => a.start - b.start),
    [eras]
  );

  const spanRows = useMemo(
    () =>
      [...spans].sort((a, b) =>
        a.start === b.start ? a.title.localeCompare(b.title) : a.start - b.start
      ),
    [spans]
  );

  const eventRows = useMemo(
    () => [...events].sort((a, b) => a.date - b.date),
    [events]
  );

  const allExpanded = openEras && openSpans && openEvents;
  const allCollapsed = !openEras && !openSpans && !openEvents;

  const handleToggleAll = () => {
    if (allExpanded) {
      // Collapse all
      setOpenEras(false);
      setOpenSpans(false);
      setOpenEvents(false);
    } else {
      // Expand all
      setOpenEras(true);
      setOpenSpans(true);
      setOpenEvents(true);
    }
  };

  const handleTimelineMenuClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTimelineMenu({
      x: rect.left,
      y: rect.bottom + 4,
    });
  };

  const handleMenuAction = (action) => {
    setTimelineMenu(null);
    if (action) action();
  };

  // Fetch timeline files on mount
  useEffect(() => {
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
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!timelineMenu && !openSubmenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          submenuRef.current && !submenuRef.current.contains(e.target)) {
        setTimelineMenu(null);
        setOpenSubmenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [timelineMenu, openSubmenu]);

  const handleOpenSubmenu = (e, submenuType) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenSubmenu(submenuType);
    setSubmenuPosition({
      x: rect.right + 4,
      y: rect.top,
    });
  };

  const handleCloseSubmenu = () => {
    setOpenSubmenu(null);
    setSubmenuPosition(null);
  };

  const Row = ({ item, rightText, level = 0 }) => {
    const isSelected = selectedId && selectedId === item.id;

    return (
      <button
        className={`sb-row ${isSelected ? "is-selected" : ""}`}
        style={{ paddingLeft: 16 + level * 16 }}
        onClick={() => onSelect?.(item.id)}
      >
        <span className="sb-row-title">{item.title}</span>
        <span className="sb-row-right">{rightText}</span>
      </button>
    );
  };

  return (
    <div className="sidebar-root">
      <div className="sidebar-header">
        {!isCollapsed && (
          <>
            <h2 className="timeline-title">{displayName}</h2>
            <ChevronDown
              className="sidebar-menu"
              size={16}
              color="var(--dark-bg)"
              strokeWidth={2}
              onClick={handleTimelineMenuClick}
              style={{ cursor: 'pointer' }}
            />
          </>
        )}

        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <PanelRight size={18} color="var(--dark-bg)" strokeWidth={2} />
          ) : (
            <PanelLeft size={18} color="var(--dark-bg)" strokeWidth={2} />
          )}
        </button>
      </div>

      {timelineMenu && (
        <div
          ref={menuRef}
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: `${timelineMenu.x}px`,
            top: `${timelineMenu.y}px`,
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => console.log('New Timeline'))}
          >
            <FilePlus size={16} />
            <span>New Timeline</span>
          </button>

          <button
            ref={openTimelineRef}
            className="context-menu-item"
            onMouseEnter={(e) => handleOpenSubmenu(e, 'open-timeline')}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenSubmenu(e, 'open-timeline');
            }}
          >
            <File size={16} />
            <span>Open Timeline</span>
            <ChevronRight size={16} style={{ marginLeft: 'auto' }} />
          </button>

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => console.log('Save Duplicate'))}
          >
            <Copy size={16} />
            <span>Save Duplicate</span>
          </button>

          <div className="context-menu-separator" />

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onDownloadJson?.())}
          >
            <FileJson size={16} />
            <span>Download .json</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onDownloadPng?.())}
          >
            <Image size={16} />
            <span>Download .png</span>
          </button>

          <div className="context-menu-separator" />

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onOpenSettings?.())}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      )}

      {openSubmenu === 'open-timeline' && submenuPosition && (
        <div
          ref={submenuRef}
          className="timeline-context-menu timeline-submenu"
          style={{
            position: 'fixed',
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
          }}
          onMouseLeave={handleCloseSubmenu}
        >
          {timelineFiles.map((file) => (
            <button
              key={file.id}
              className="context-menu-item"
              onClick={() => {
                handleMenuAction(() => onLoadTimeline?.(file.id));
                handleCloseSubmenu();
              }}
            >
              <File size={16} />
              <span>{file.name}</span>
            </button>
          ))}
          {timelineFiles.length === 0 && (
            <div className="context-menu-item" style={{ opacity: 0.5, cursor: 'default' }}>
              <span>No timelines found</span>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && file && (
        <div className="sidebar-info">
          <h3 className="sidebar-info-title">{file.title}</h3>
        </div>
      )}

      {!isCollapsed && (
        <div className="sidebar-add-container">
          <div className="sidebar-add-buttons">
            <button
              className="sidebar-add-button"
              onClick={onAddEvent}
              title="Add Event"
            >
              <RectangleHorizontal size={17} />
            </button>
            <button
              className="sidebar-add-button"
              onClick={onAddSpan}
              title="Add Span"
            >
              <RectangleEllipsis size={17} />
            </button>
            <button
              className="sidebar-add-button"
              onClick={onAddEra}
              title="Add Era"
            >
              <SquareSplitHorizontal size={17} />
            </button>
            <button
              className="sidebar-add-button"
              onClick={handleToggleAll}
              title={allExpanded ? "Collapse All" : "Expand All"}
            >
              {allExpanded ? (
                <ListChevronsDownUp size={17} strokeWidth={2} />
              ) : (
                <ListChevronsUpDown size={17} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="sidebar-content">
          {/* ERAS */}
          <div className="sb-section">
            <button
              className="sb-section-head"
              onClick={() => setOpenEras((v) => !v)}
            >
              <ChevronDown
                className={`sb-caret ${openEras ? "open" : ""}`}
                size={16}
                strokeWidth={2}
              />
              <span className="sb-section-label">Eras</span>
            </button>
            {openEras && (
              <div className="sb-section-body">
                {eraRows.map((e) => (
                  <Row
                    key={e.id}
                    item={e}
                    rightText={`${fmtYear(e.start)} – ${fmtYear(e.end)}`}
                    level={0}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="sb-section">
            <button
              className="sb-section-head"
              onClick={() => setOpenSpans((v) => !v)}
            >
              <ChevronDown
                className={`sb-caret ${openSpans ? "open" : ""}`}
                size={16}
                strokeWidth={2}
              />
              <span className="sb-section-label">Spans</span>
            </button>
            {openSpans && (
              <div className="sb-section-body">
                {spanRows.map((s) => (
                  <Row
                    key={s.id}
                    item={s}
                    rightText={`${fmtYear(s.start)} – ${fmtYear(s.end)}`}
                    level={0}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="sb-section">
            <button
              className="sb-section-head"
              onClick={() => setOpenEvents((v) => !v)}
            >
              <ChevronDown
                className={`sb-caret ${openEvents ? "open" : ""}`}
                size={16}
                strokeWidth={2}
              />
              <span className="sb-section-label">Events</span>
            </button>
            {openEvents && (
              <div className="sb-section-body">
                {eventRows.map((ev) => (
                  <Row
                    key={ev.id}
                    item={ev}
                    rightText={fmtYear(ev.date)}
                    level={0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}




    </div>
  );
}
