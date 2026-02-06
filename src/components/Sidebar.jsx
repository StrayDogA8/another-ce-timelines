import { useMemo, useState, useEffect, useRef } from "react";
import { PanelLeft, PanelRight, ChevronDown, RectangleHorizontal, RectangleEllipsis, SquareSplitHorizontal, ListChevronsDownUp, ListChevronsUpDown, FilePlus, File, Copy, FileJson, Image, Settings, ChevronRight, ArrowLeft, ListFilter, Edit2, Trash2 } from "lucide-react";
import { formatYear } from "../utils/timelineUtils";
import "../styles/07-modals-menus.css";

export default function Sidebar({
  isCollapsed,
  onToggle,
  selectedId,
  onSelect,
  timelineData,
  allElements,
  activeTags = [],
  onToggleTag,
  filterScope,
  onToggleFilterScope,
  onClearTags,
  onAddEvent,
  onAddSpan,
  onAddEra,
  onOpenSettings,
  onDownloadJson,
  onDownloadPng,
  onLoadTimeline,
  onNewTimeline,
  onDuplicateTimeline,
  onBackToHome,
  onDelete,
  onDuplicateElement,
  onEditElement,
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
  const [filterMenu, setFilterMenu] = useState(null);
  const [elementMenu, setElementMenu] = useState(null);
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [submenuPosition, setSubmenuPosition] = useState(null);
  const menuRef = useRef(null);
  const submenuRef = useRef(null);
  const openTimelineRef = useRef(null);
  const submenuCloseTimer = useRef(null);
  const filterMenuRef = useRef(null);
  const filterButtonRef = useRef(null);

  const displayName = useMemo(() => {
    if (!file) return "";
    if (file.id?.endsWith("-timeline")) {
      return file.id.replace("-timeline", ".timeline");
    }
    return file.title || file.id || "";
  }, [file]);

  const fmtYear = (y) => {
    if (!file) return String(y);
    return formatYear(y, file.negID, file.posID, file.useMonths === true);
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

  const allTags = useMemo(() => {
    const tags = new Set();
    (allElements || []).forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      if (Array.isArray(element.tags)) {
        element.tags.forEach((tag) => {
          if (tag) tags.add(tag);
        });
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [allElements]);

  const formatRange = (start, end, startLabel, endLabel) => {
    const left = startLabel ?? fmtYear(start);
    const right = endLabel ?? fmtYear(end);
    return `${left} - ${right}`;
  };

  const allExpanded = openEras && openSpans && openEvents;

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

  const handleElementMenuAction = (action) => {
    setElementMenu(null);
    if (action) action();
  };

  const handleToggleFilterMenu = (e) => {
    e.stopPropagation();
    if (filterMenu) {
      setFilterMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterMenu({
      x: rect.left,
      y: rect.bottom + 6,
    });
  };

  // Fetch timeline files on mount
  useEffect(() => {
    const loadTimelineList = async () => {
      if (window.electron?.listTimelines) {
        // Load from Electron (AppData)
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
    };

    loadTimelineList();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!timelineMenu && !openSubmenu) return;

    const handleClickOutside = (e) => {
      const clickedInsideMenu = menuRef.current?.contains(e.target);
      const clickedInsideSubmenu = submenuRef.current?.contains(e.target);

      if (!clickedInsideMenu && !clickedInsideSubmenu) {
        // Clear any pending close timer
        if (submenuCloseTimer.current) {
          clearTimeout(submenuCloseTimer.current);
          submenuCloseTimer.current = null;
        }
        setTimelineMenu(null);
        setOpenSubmenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Clean up timer on unmount
      if (submenuCloseTimer.current) {
        clearTimeout(submenuCloseTimer.current);
      }
    };
  }, [timelineMenu, openSubmenu]);

  useEffect(() => {
    if (!elementMenu) return;

    const handleClickOutside = (e) => {
      const menu = document.querySelector('.timeline-context-menu');
      if (menu && !menu.contains(e.target)) {
        setElementMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [elementMenu]);

  useEffect(() => {
    if (!filterMenu) return;

    const handleClickOutside = (e) => {
      const clickedInsideMenu = filterMenuRef.current?.contains(e.target);
      const clickedFilterButton = filterButtonRef.current?.contains(e.target);
      if (!clickedInsideMenu && !clickedFilterButton) {
        setFilterMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterMenu]);

  const handleOpenSubmenu = (e, submenuType) => {
    e.stopPropagation();
    // Clear any pending close timer
    if (submenuCloseTimer.current) {
      clearTimeout(submenuCloseTimer.current);
      submenuCloseTimer.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenSubmenu(submenuType);
    setSubmenuPosition({
      x: rect.right + 4,
      y: rect.top,
    });
  };

  const handleCloseSubmenu = () => {
    // Delay closing to allow mouse to move to submenu
    submenuCloseTimer.current = setTimeout(() => {
      setOpenSubmenu(null);
      setSubmenuPosition(null);
    }, 150);
  };

  const handleSubmenuMouseEnter = () => {
    // Cancel closing if mouse enters submenu
    if (submenuCloseTimer.current) {
      clearTimeout(submenuCloseTimer.current);
      submenuCloseTimer.current = null;
    }
  };

  const Row = ({ item, rightText, level = 0 }) => {
    const isSelected = selectedId && selectedId === item.id;

    return (
      <button
        className={`sb-row ${isSelected ? "is-selected" : ""}`}
        style={{ paddingLeft: 16 + level * 16 }}
        onClick={() => onSelect?.(item.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setElementMenu({
            x: e.clientX,
            y: e.clientY,
            element: item,
          });
        }}
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
            onClick={() => handleMenuAction(() => onBackToHome?.())}
          >
            <ArrowLeft size={16} />
            <span>Back to Files</span>
          </button>

          <div className="context-menu-separator" />

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onNewTimeline?.())}
          >
            <FilePlus size={16} />
            <span>New Timeline</span>
          </button>

          <button
            ref={openTimelineRef}
            className="context-menu-item"
            onMouseEnter={(e) => handleOpenSubmenu(e, 'open-timeline')}
            onMouseLeave={handleCloseSubmenu}
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
            onClick={() => handleMenuAction(() => onDuplicateTimeline?.())}
          >
            <Copy size={16} />
            <span>Duplicate</span>
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
          onMouseEnter={handleSubmenuMouseEnter}
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
            <button
              className="sidebar-add-button"
              type="button"
              aria-label="Filter list"
              title="Filter list"
              onClick={handleToggleFilterMenu}
              ref={filterButtonRef}
            >
              <ListFilter size={17} strokeWidth={2} />
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
                    rightText={formatRange(e.start, e.end, e.startLabel, e.endLabel)}
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
                    rightText={formatRange(s.start, s.end, s.startLabel, s.endLabel)}
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
                    rightText={ev.dateLabel ?? fmtYear(ev.date)}
                    level={0}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {filterMenu && (
        <div
          ref={filterMenuRef}
          className="timeline-context-menu sidebar-filter-menu"
          style={{
            position: 'fixed',
            left: `${filterMenu.x}px`,
            top: `${filterMenu.y}px`,
          }}
        >
          <label className="context-menu-item filter-menu-item">
            <input
              type="checkbox"
              checked={filterScope?.events ?? true}
              onChange={() => onToggleFilterScope?.("events")}
            />
            <span>Apply to events</span>
          </label>
          <label className="context-menu-item filter-menu-item">
            <input
              type="checkbox"
              checked={filterScope?.spans ?? true}
              onChange={() => onToggleFilterScope?.("spans")}
            />
            <span>Apply to spans</span>
          </label>
          <div className="filter-menu-divider" />
          <div className="filter-menu-dropdown">
            {allTags.length === 0 && (
              <div className="filter-menu-empty">No tags found</div>
            )}
            {allTags.map((tag) => {
              const isChecked = activeTags.includes(tag);
              return (
                <label key={tag} className="context-menu-item filter-menu-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleTag?.(tag)}
                  />
                  <span className="filter-menu-label">{tag}</span>
                </label>
              );
            })}
          </div>
          <div className="filter-menu-divider" />
          <button
            className="context-menu-item"
            type="button"
            onClick={() => onClearTags?.()}
          >
            Clear
          </button>
        </div>
      )}

      {elementMenu?.element && (
        <div
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: `${elementMenu.x}px`,
            top: `${elementMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleElementMenuAction(() => onEditElement?.(elementMenu.element.id))}
          >
            <Edit2 size={16} />
            <span>Edit {elementMenu.element.type.charAt(0).toUpperCase() + elementMenu.element.type.slice(1)}</span>
          </button>
          {elementMenu.element.type !== "era" && (
            <button
              className="context-menu-item"
              onClick={() => handleElementMenuAction(() => onDuplicateElement?.(elementMenu.element.id))}
            >
              <Copy size={16} />
              <span>Duplicate {elementMenu.element.type.charAt(0).toUpperCase() + elementMenu.element.type.slice(1)}</span>
            </button>
          )}
          <div className="context-menu-separator" />
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => handleElementMenuAction(() => onDelete?.(elementMenu.element.id))}
          >
            <Trash2 size={16} />
            <span>Delete {elementMenu.element.type.charAt(0).toUpperCase() + elementMenu.element.type.slice(1)}</span>
          </button>
        </div>
      )}




    </div>
  );
}
