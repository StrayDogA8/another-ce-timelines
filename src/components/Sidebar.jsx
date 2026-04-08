import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { PanelLeft, PanelRight, ChevronDown, FilePlus, File, Copy, FileJson, Image, Video, Settings, ChevronRight, ArrowLeft, Edit2, Trash2, Plus, Tag, Eye, EyeOff, List, Layers3, GripVertical, Palette } from "lucide-react";
import { formatYear } from "../utils/timelineUtils";
import "../styles/07-modals-menus.css";

const DEFAULT_GROUP_COLOR = "#d9d9d9";

const expandShortHex = (value) =>
  value
    .split("")
    .map((char) => char + char)
    .join("");

const normalizeHexColor = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) return `#${expandShortHex(short[1]).toLowerCase()}`;
  const full = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (full) return `#${full[1].toLowerCase()}`;
  return null;
};

const rgbToHex = (value) => {
  if (typeof value !== "string") return null;
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  const channels = match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null;
  const [r, g, b] = channels.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel)))
  );
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
};

const normalizeColorForInput = (value) => normalizeHexColor(value) || rgbToHex(value);

const resolveThemeGroupColor = () => {
  if (typeof window === "undefined") return null;
  const computed = getComputedStyle(document.documentElement).getPropertyValue("--active-bg");
  return normalizeColorForInput(computed);
};

function SidebarRow({ item, rightText, level = 0, selectedId, onSelect, listRef, lastScrollTopRef, setElementMenu }) {
  const isSelected = selectedId && selectedId === item.id;
  const leftIndent = 16 + level * 16;

  return (
    <button
      className={`sb-row ${isSelected ? "is-selected" : ""}`}
      style={{
        marginLeft: "5px",
        paddingLeft: `${Math.max(0, leftIndent - 5)}px`,
      }}
      onClick={() => {
        if (listRef.current) {
          lastScrollTopRef.current = listRef.current.scrollTop;
        }
        onSelect?.(item.id);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = lastScrollTopRef.current;
          }
        });
      }}
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
}

export default function Sidebar({
  isCollapsed,
  onToggle,
  selectedId,
  onSelect,
  timelineData,
  allElements,
  activeTags = [],
  hiddenTags = [],
  onToggleTag,
  onToggleHiddenTag,
  pinnedTags = [],
  onTogglePinnedTag,
  tagColors = {},
  onUpdateTagColor,
  onAddGroup,
  onUpdateGroup,
  onUpdateGroups,
  onDeleteGroup,
  onAddEvent,
  onAddSpan,
  onAddEra,
  onAddSubEra,
  onOpenSettings,
  onDownloadJson,
  onDownloadPng,
  onDownloadVideo,
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
  const [sidebarTab, setSidebarTab] = useState("timeline");
  const [elementMenu, setElementMenu] = useState(null);
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [submenuPosition, setSubmenuPosition] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");
  const [draggedGroupId, setDraggedGroupId] = useState(null);
  const [dragOverPlacement, setDragOverPlacement] = useState(null);
  const [openGroupContents, setOpenGroupContents] = useState({});
  const menuRef = useRef(null);
  const submenuRef = useRef(null);
  const openTimelineRef = useRef(null);
  const submenuCloseTimer = useRef(null);
  const listRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const groupColorInputRefs = useRef({});
  const tagColorInputRefs = useRef({});
  const themeGroupColor = resolveThemeGroupColor() || DEFAULT_GROUP_COLOR;

  const displayName = useMemo(() => {
    if (!file) return "";
    if (file.id?.endsWith("-timeline")) {
      return file.id.replace("-timeline", ".timeline");
    }
    return file.title || file.id || "";
  }, [file]);

  const fmtYear = (y) => {
    if (!file) return String(y);
    return formatYear(y, file.negID, file.posID, file.useMonths === true, file.hideDecimals);
  };

  const eraRows = useMemo(() => {
    const childrenOf = (parentId) =>
      eras.filter((e) => e.parentId === parentId).sort((a, b) => a.start - b.start);
    const flatten = (list, level) =>
      list.flatMap((e) => [{ ...e, level }, ...flatten(childrenOf(e.id), level + 1)]);
    const roots = eras.filter((e) => !e.parentId).sort((a, b) => a.start - b.start);
    return flatten(roots, 0);
  }, [eras]);

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

  const groups = useMemo(() => {
    const fallback = [{ id: "g-main", title: "Main", order: 0, stack: 0, visible: true, locked: false }];
    const raw = Array.isArray(file?.groups) && file.groups.length > 0 ? file.groups : fallback;
    return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [file]);

  const displayGroups = useMemo(
    () => [...groups].sort((a, b) => {
      const stackDiff = (b.stack ?? 0) - (a.stack ?? 0); // top to bottom
      if (stackDiff !== 0) return stackDiff;
      return (a.order ?? 0) - (b.order ?? 0);
    }),
    [groups]
  );

  const commitDisplayGroupOrder = (nextDisplayGroups) => {
    if (!Array.isArray(nextDisplayGroups) || nextDisplayGroups.length === 0) return;
    const total = nextDisplayGroups.length;
    const patchedById = new Map(
      nextDisplayGroups.map((group, index) => [
        group.id,
        {
          stack: total - index - 1,
          order: index,
        },
      ])
    );

    const nextGroups = groups.map((group) => (
      patchedById.has(group.id)
        ? { ...group, ...patchedById.get(group.id) }
        : group
    ));

    if (typeof onUpdateGroups === "function") {
      onUpdateGroups(nextGroups);
      return;
    }
    nextGroups.forEach((group) => onUpdateGroup?.(group.id, {
      stack: group.stack,
      order: group.order,
    }));
  };

  const updateGroupPatch = (groupId, updates) => {
    if (!groupId || !updates || typeof updates !== "object") return;
    if (typeof onUpdateGroups === "function") {
      const nextGroups = groups.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      );
      onUpdateGroups(nextGroups);
      return;
    }
    onUpdateGroup?.(groupId, updates);
  };

  const groupCounts = useMemo(() => {
    const counts = new Map();
    (allElements || []).forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      const groupId = element.groupId;
      if (!groupId) return;
      counts.set(groupId, (counts.get(groupId) || 0) + 1);
    });
    return counts;
  }, [allElements]);

  const groupElements = useMemo(() => {
    const grouped = new Map();
    (allElements || []).forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      if (!element.groupId) return;
      const current = grouped.get(element.groupId) || [];
      current.push(element);
      grouped.set(element.groupId, current);
    });

    grouped.forEach((elements, groupId) => {
      const sorted = [...elements].sort((a, b) => {
        if (a.type !== b.type) return a.type === "span" ? -1 : 1;
        const aStart = a.type === "event" ? a.date : a.start;
        const bStart = b.type === "event" ? b.date : b.start;
        if (aStart !== bStart) return aStart - bStart;
        return (a.title || a.id).localeCompare(b.title || b.id);
      });
      grouped.set(groupId, sorted);
    });

    return grouped;
  }, [allElements]);

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

  // Close menu when clicking outside or pressing Escape
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
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setTimelineMenu(null);
        setOpenSubmenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
    const handleKeyDown = (e) => { if (e.key === "Escape") setElementMenu(null); };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [elementMenu]);

  useLayoutEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = lastScrollTopRef.current;
  }, [selectedId]);

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

  const rowProps = { selectedId, onSelect, listRef, lastScrollTopRef, setElementMenu };

  const startGroupTitleEdit = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupTitle(group.title || group.id || "");
  };

  const cancelGroupTitleEdit = () => {
    setEditingGroupId(null);
    setEditingGroupTitle("");
  };

  const commitGroupTitleEdit = (groupId) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      cancelGroupTitleEdit();
      return;
    }
    const trimmedTitle = editingGroupTitle.trim();
    if (trimmedTitle && trimmedTitle !== (group.title || group.id)) {
      updateGroupPatch(groupId, { title: trimmedTitle });
    }
    cancelGroupTitleEdit();
  };

  const openGroupColorPicker = (groupId) => {
    const input = groupColorInputRefs.current[groupId];
    if (input) input.click();
  };

  const openTagColorPicker = (tag) => {
    const input = tagColorInputRefs.current[tag];
    if (input) input.click();
  };

  const toggleGroupContents = (groupId) => {
    setOpenGroupContents((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onDownloadVideo?.())}
          >
            <Video size={16} />
            <span>Export Video</span>
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
        <>
        <div className="sidebar-add-container">
          <div className="sidebar-tabs">
            <button
              type="button"
              className={`sidebar-tab-button${sidebarTab === "timeline" ? " is-active" : ""}`}
              onClick={() => setSidebarTab("timeline")}
              aria-label="Timeline tab"
              title="Timeline"
            >
              <List size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`sidebar-tab-button${sidebarTab === "tags" ? " is-active" : ""}`}
              onClick={() => setSidebarTab("tags")}
              aria-label="Tags tab"
              title="Tags"
            >
              <Tag size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`sidebar-tab-button${sidebarTab === "groups" ? " is-active" : ""}`}
              onClick={() => setSidebarTab("groups")}
              aria-label="Groups tab"
              title="Groups"
            >
              <Layers3 size={15} strokeWidth={2.2} />
            </button>
          </div>
          <div className="sidebar-add-buttons">
          </div>
        </div>

      <div className={`sidebar-content${sidebarTab === "tags" ? " is-tags-tab" : ""}`} ref={listRef}>
        {sidebarTab === "timeline" ? (
        <>
          {/* ERAS */}
          <div className="sb-section">
            <div className="sb-section-head">
              <button
                className="sb-section-toggle"
                onClick={() => setOpenEras((v) => !v)}
              >
                <ChevronDown
                  className={`sb-caret ${openEras ? "open" : ""}`}
                  size={16}
                  strokeWidth={2}
                />
                <span className="sb-section-label">Eras</span>
              </button>
              <button
                className="sb-section-add"
                type="button"
                title="Add Era"
                aria-label="Add Era"
                onClick={() => onAddEra?.()}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
            {openEras && (
              <div className="sb-section-body">
                {eraRows.map((e) => (
                  <SidebarRow
                    key={e.id}
                    item={e}
                    rightText={formatRange(e.start, e.end, e.startLabel, e.endLabel)}
                    level={e.level}
                    {...rowProps}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="sb-section">
            <div className="sb-section-head">
              <button
                className="sb-section-toggle"
                onClick={() => setOpenSpans((v) => !v)}
              >
                <ChevronDown
                  className={`sb-caret ${openSpans ? "open" : ""}`}
                  size={16}
                  strokeWidth={2}
                />
                <span className="sb-section-label">Spans</span>
              </button>
              <button
                className="sb-section-add"
                type="button"
                title="Add Span"
                aria-label="Add Span"
                onClick={() => onAddSpan?.()}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
            {openSpans && (
              <div className="sb-section-body">
                {spanRows.map((s) => (
                  <SidebarRow
                    key={s.id}
                    item={s}
                    rightText={formatRange(s.start, s.end, s.startLabel, s.endLabel)}
                    level={0}
                    {...rowProps}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="sb-section">
            <div className="sb-section-head">
              <button
                className="sb-section-toggle"
                onClick={() => setOpenEvents((v) => !v)}
              >
                <ChevronDown
                  className={`sb-caret ${openEvents ? "open" : ""}`}
                  size={16}
                  strokeWidth={2}
                />
                <span className="sb-section-label">Events</span>
              </button>
              <button
                className="sb-section-add"
                type="button"
                title="Add Event"
                aria-label="Add Event"
                onClick={() => onAddEvent?.()}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
            {openEvents && (
              <div className="sb-section-body">
                {eventRows.map((ev) => (
                  <SidebarRow
                    key={ev.id}
                    item={ev}
                    rightText={ev.dateLabel ?? fmtYear(ev.date)}
                    level={0}
                    {...rowProps}
                  />
                ))}
              </div>
            )}
          </div>
        </>
        ) : sidebarTab === "tags" ? (
          <div className="sidebar-tags-panel">
            <div className="sidebar-tags-dropdown">
              {allTags.length === 0 && (
                <div className="filter-menu-empty">No tags found</div>
              )}
              {allTags.map((tag) => {
                const isShown = activeTags.includes(tag);
                const isHidden = hiddenTags.includes(tag);
                const isPinned = pinnedTags.includes(tag);
                const tagColor = tagColors[tag];
                return (
                  <div key={tag} className="filter-menu-item filter-menu-item-with-pin">
                    <span className="filter-menu-label">
                      {tagColor && <span className="tag-sidebar-color-dot" style={{ background: tagColor }} />}
                      {tag}
                    </span>
                    <div className="filter-menu-actions">
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-show-btn${isShown ? " is-active" : ""}`}
                        onClick={() => onToggleTag?.(tag)}
                        aria-label={isShown ? "Disable show filter for tag" : "Enable show filter for tag"}
                        title={isShown ? "Disable show filter for tag" : "Enable show filter for tag"}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-hide-btn${isHidden ? " is-active" : ""}`}
                        onClick={() => onToggleHiddenTag?.(tag)}
                        aria-label={isHidden ? "Disable hide filter for tag" : "Enable hide filter for tag"}
                        title={isHidden ? "Disable hide filter for tag" : "Enable hide filter for tag"}
                      >
                        <EyeOff size={12} />
                      </button>
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-pin-btn${isPinned ? " is-pinned" : ""}`}
                        onClick={() => onTogglePinnedTag?.(tag)}
                        aria-label={isPinned ? "Remove label" : "Use as label"}
                        title={isPinned ? "Remove label" : "Use as label"}
                      >
                        <Tag size={12} />
                      </button>
                      <button
                        type="button"
                        className={`filter-menu-icon-btn${tagColor ? " is-active" : ""}`}
                        onClick={() => openTagColorPicker(tag)}
                        aria-label="Set tag color"
                        title="Set tag color"
                      >
                        <Palette size={12} />
                        <input
                          ref={(node) => { tagColorInputRefs.current[tag] = node; }}
                          className="sidebar-group-inline-color-input"
                          type="color"
                          value={tagColor || "#808080"}
                          onChange={(e) => onUpdateTagColor?.(tag, e.target.value)}
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="sidebar-groups-panel">
            <div className="sidebar-groups-toolbar">
              <button
                className="sidebar-group-add-btn"
                type="button"
                onClick={() => onAddGroup?.()}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Add Group</span>
              </button>
            </div>
            <div className="sidebar-groups-list">
              {displayGroups.map((group) => {
                const count = groupCounts.get(group.id) || 0;
                const canDelete = displayGroups.length > 1;
                const groupTint = normalizeColorForInput(group.bgColor) || themeGroupColor;
                const itemsInGroup = groupElements.get(group.id) || [];
                const isGroupOpen = !!openGroupContents[group.id];
                return (
                  <div
                    key={group.id}
                    className={`sidebar-group-item${draggedGroupId === group.id ? " is-dragging" : ""}${dragOverPlacement?.id === group.id ? ` is-drag-over-${dragOverPlacement.position}` : ""}`}
                    style={{ "--group-tint": groupTint }}
                    draggable={editingGroupId !== group.id}
                    onDragStart={(e) => {
                      setDraggedGroupId(group.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", group.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedGroupId && draggedGroupId !== group.id) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
                        setDragOverPlacement({ id: group.id, position });
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setDragOverPlacement((prev) => (prev?.id === group.id ? null : prev));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sourceId = draggedGroupId || e.dataTransfer.getData("text/plain");
                      const targetId = group.id;
                      const position = dragOverPlacement?.id === group.id ? dragOverPlacement.position : "top";
                      if (!sourceId || sourceId === targetId) {
                        setDraggedGroupId(null);
                        setDragOverPlacement(null);
                        return;
                      }
                      const fromIndex = displayGroups.findIndex((item) => item.id === sourceId);
                      const toIndex = displayGroups.findIndex((item) => item.id === targetId);
                      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
                        setDraggedGroupId(null);
                        setDragOverPlacement(null);
                        return;
                      }
                      const reordered = [...displayGroups];
                      const [moved] = reordered.splice(fromIndex, 1);
                      let insertIndex = toIndex + (position === "bottom" ? 1 : 0);
                      if (fromIndex < insertIndex) insertIndex -= 1;
                      reordered.splice(insertIndex, 0, moved);
                      commitDisplayGroupOrder(reordered);
                      setDraggedGroupId(null);
                      setDragOverPlacement(null);
                    }}
                    onDragEnd={() => {
                      setDraggedGroupId(null);
                      setDragOverPlacement(null);
                    }}
                  >
                    <div className="sidebar-group-main">
                      <div className="sidebar-group-title-row">
                        <GripVertical size={13} className="sidebar-group-drag-handle" />
                        {editingGroupId === group.id ? (
                          <input
                            className="sidebar-group-title-input"
                            type="text"
                            value={editingGroupTitle}
                            onChange={(e) => setEditingGroupTitle(e.target.value)}
                            onBlur={() => commitGroupTitleEdit(group.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitGroupTitleEdit(group.id);
                              if (e.key === "Escape") cancelGroupTitleEdit();
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="sidebar-group-title">{group.title || group.id}</div>
                        )}
                        <div className="sidebar-group-inline-actions">
                          <button
                            type="button"
                            className="filter-menu-icon-btn"
                            title="Rename group"
                            aria-label="Rename group"
                            onClick={() => startGroupTitleEdit(group)}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className="filter-menu-icon-btn"
                            title="Group color"
                            aria-label="Group color"
                            onClick={() => openGroupColorPicker(group.id)}
                          >
                            <Palette size={12} />
                            <input
                              ref={(node) => { groupColorInputRefs.current[group.id] = node; }}
                              className="sidebar-group-inline-color-input"
                              type="color"
                              value={normalizeColorForInput(group.bgColor) || themeGroupColor}
                              onChange={(e) => updateGroupPatch(group.id, { bgColor: e.target.value })}
                              tabIndex={-1}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            className="filter-menu-icon-btn"
                            title={canDelete ? "Delete group" : "Cannot delete the last group"}
                            aria-label={canDelete ? "Delete group" : "Cannot delete the last group"}
                            disabled={!canDelete}
                            onClick={() => onDeleteGroup?.(group.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="sidebar-group-meta-row">
                        <button
                          type="button"
                          className="sidebar-group-expand-btn"
                          aria-label={isGroupOpen ? "Collapse group items" : "Expand group items"}
                          title={isGroupOpen ? "Collapse" : "Expand"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupContents(group.id);
                          }}
                          disabled={itemsInGroup.length === 0}
                        >
                          {isGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        <div className="sidebar-group-meta">{count} item{count === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                    {isGroupOpen && itemsInGroup.length > 0 && (
                      <div className="sidebar-group-elements">
                        {itemsInGroup.map((element) => (
                          <button
                            key={element.id}
                            type="button"
                            className={`sidebar-group-element-row${selectedId === element.id ? " is-selected" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (listRef.current) {
                                lastScrollTopRef.current = listRef.current.scrollTop;
                              }
                              onSelect?.(element.id);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setElementMenu({
                                x: e.clientX,
                                y: e.clientY,
                                element,
                              });
                            }}
                          >
                            <span className="sidebar-group-element-title">{element.title || element.id}</span>
                            <span className="sidebar-group-element-range">
                              {element.type === "event"
                                ? (element.dateLabel ?? fmtYear(element.date))
                                : formatRange(element.start, element.end, element.startLabel, element.endLabel)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
        </>
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
          {elementMenu.element.type === "era" && (
            <button
              className="context-menu-item"
              onClick={() => handleElementMenuAction(() => onAddSubEra?.(elementMenu.element.id))}
            >
              <Plus size={16} />
              <span>Add Sub-Era</span>
            </button>
          )}
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
