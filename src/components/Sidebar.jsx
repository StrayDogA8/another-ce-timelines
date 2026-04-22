import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { PanelLeft, PanelRight, ChevronDown, FilePlus, File, Copy, FileJson, Image, Video, Settings, ChevronRight, ArrowLeft, Edit2, Trash2, Plus, Tag, Eye, EyeOff, Target, List, Layers3, Search, MoreVertical } from "lucide-react";
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

const resolveSecondaryBg = () => {
  if (typeof window === "undefined") return null;
  const computed = getComputedStyle(document.documentElement).getPropertyValue("--secondary-bg");
  return normalizeColorForInput(computed);
};

// Returns a version of eraColor that reads well on bgHex while keeping the hue recognizable.
function getEraLabelColor(eraColor, bgHex) {
  const hex = normalizeHexColor(eraColor);
  if (!hex) return null;
  const eR = parseInt(hex.slice(1, 3), 16);
  const eG = parseInt(hex.slice(3, 5), 16);
  const eB = parseInt(hex.slice(5, 7), 16);
  const eraLum = (0.2126 * eR + 0.7152 * eG + 0.0722 * eB) / 255;

  let bgLum = 0.93; // assume light sidebar by default
  if (bgHex) {
    const bR = parseInt(bgHex.slice(1, 3), 16);
    const bG = parseInt(bgHex.slice(3, 5), 16);
    const bB = parseInt(bgHex.slice(5, 7), 16);
    bgLum = (0.2126 * bR + 0.7152 * bG + 0.0722 * bB) / 255;
  }

  const lightBg = bgLum > 0.4;
  // Push toward dark on light bg, light on dark bg
  const target = lightBg ? 0 : 255;
  // Blend more aggressively for colors that clash (very light on light bg, very dark on dark bg)
  const clash = lightBg ? eraLum : (1 - eraLum);
  const blendAmount = 0.2 + clash * 0.25; // 0.2–0.45 range

  const outR = Math.round(eR + (target - eR) * blendAmount);
  const outG = Math.round(eG + (target - eG) * blendAmount);
  const outB = Math.round(eB + (target - eB) * blendAmount);
  return `#${outR.toString(16).padStart(2, "0")}${outG.toString(16).padStart(2, "0")}${outB.toString(16).padStart(2, "0")}`;
}

function compareEraGroupItems(a, b) {
  const aDate = a.type === "event" ? a.date : a.start;
  const bDate = b.type === "event" ? b.date : b.start;
  if (aDate !== bDate) return aDate - bDate;
  if (a.type !== b.type) return a.type === "span" ? -1 : 1;
  return (a.title || a.id).localeCompare(b.title || b.id);
}

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

function ElementRow({ element, selectedId, onSelect, listRef, lastScrollTopRef, setElementMenu, tagColors = {}, spanById, fmtYear }) {
  const isSelected = selectedId === element.id;
  const isSpan = element.type === "span";
  const isEra = element.type === "era";
  const firstTag = element.tags?.[0];
  const tagColor = (firstTag && tagColors[firstTag]) || null;
  const parentSpanColor = (!isSpan && !isEra && element.parents?.[0])
    ? spanById?.get(element.parents[0])?.color
    : null;
  const glyphColor = isEra || isSpan
    ? (element.color || tagColor || "var(--element-bg)")
    : (parentSpanColor || tagColor || "var(--element-bg)");
  const dateText = (isSpan || isEra)
    ? `${element.startLabel ?? fmtYear(element.start)}–${element.endLabel ?? fmtYear(element.end)}`
    : (element.dateLabel ?? fmtYear(element.date));
  return (
    <button
      className={`sb-el-row${isSelected ? " is-selected" : ""}`}
      onClick={() => {
        if (listRef.current) lastScrollTopRef.current = listRef.current.scrollTop;
        onSelect?.(element.id);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = lastScrollTopRef.current;
        });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setElementMenu({ x: e.clientX, y: e.clientY, element });
      }}
    >
      <span className="sb-el-glyph" style={{ color: isSelected ? "var(--dark-bg)" : glyphColor }}>
        {isSpan
          ? <span className="sb-el-glyph-span-bar" style={{ background: isSelected ? "var(--dark-bg)" : glyphColor }} />
          : isEra
            ? <span className="sb-el-glyph-era-box" style={{ borderColor: isSelected ? "var(--dark-bg)" : glyphColor }} />
            : "●"}
      </span>
      <span className="sb-el-name">{element.title || element.id}</span>
      <span className="sb-el-date">{dateText}</span>
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
  const [openEraGroups, setOpenEraGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);
  const [timelineMenu, setTimelineMenu] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("timeline");
  const [elementMenu, setElementMenu] = useState(null);
  const [timelineFiles, setTimelineFiles] = useState([]);
  const [submenuPosition, setSubmenuPosition] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupMenuOpenId, setGroupMenuOpenId] = useState(null);
  const groupMenuRef = useRef(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");
  const [pendingNewGroupEditId, setPendingNewGroupEditId] = useState(null);
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
  const sidebarBgHex = resolveSecondaryBg();

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

  const spanById = useMemo(() => new Map(spans.map((s) => [s.id, s])), [spans]);

  const eraGroups = useMemo(() => {
    const sortedEras = [...eras].sort((a, b) => a.start - b.start);
    const allItems = [...events, ...spans].sort(compareEraGroupItems);
    if (sortedEras.length === 0) return { groups: [], ungrouped: allItems };
    const allDates = [
      ...sortedEras.flatMap((e) => [e.start, e.end]),
      ...allItems.map((el) => el.type === "event" ? el.date : el.start),
      ...allItems.filter((el) => el.type === "span").map((el) => el.end),
    ];
    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);

    // Build compressYear using the same scale sections logic as the timeline
    const rawSections = Array.isArray(file?.scaleSections) && file.scaleSections.length > 0
      ? file.scaleSections
      : Array.isArray(file?.breaks) && file.breaks.length > 0
        ? file.breaks.map((b) => ({ ...b, scale: 0 }))
        : [];
    const normalizedSections = rawSections
      .map((item) => {
        const s = typeof item?.start === "number" ? item.start : Number(item?.start);
        const e = typeof item?.end === "number" ? item.end : Number(item?.end);
        if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
        const start = Math.max(minDate, Math.min(s, e));
        const end = Math.min(maxDate, Math.max(s, e));
        if (end <= start) return null;
        return { start, end, scale: Math.max(0, Math.min(2, Number(item?.scale) || 0)) };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
    const compressYear = (year) => {
      let adjustment = 0;
      for (const section of normalizedSections) {
        const duration = section.end - section.start;
        if (year >= section.end) { adjustment += duration * (1 - section.scale); continue; }
        if (year > section.start) {
          const partial = year - section.start;
          return year - adjustment - partial * (1 - section.scale);
        }
        break;
      }
      return year - adjustment;
    };
    const cMin = compressYear(minDate);
    const range = (compressYear(maxDate) - cMin) || 1;

    // Build era parent map: each era's smallest containing era
    const eraParentMap = new Map();
    sortedEras.forEach((era) => {
      let bestParent = null, bestRange = Infinity;
      sortedEras.forEach((candidate) => {
        if (candidate.id === era.id) return;
        if (candidate.start <= era.start && era.end <= candidate.end) {
          const r = candidate.end - candidate.start;
          if (r < bestRange) { bestRange = r; bestParent = candidate; }
        }
      });
      if (bestParent) eraParentMap.set(era.id, bestParent.id);
    });

    const rootEras = sortedEras.filter((e) => !eraParentMap.has(e.id));
    const subEras = sortedEras.filter((e) => eraParentMap.has(e.id));

    // Find root ancestor for any sub-era
    const getRootAncestorId = (eraId) => {
      let current = eraId;
      while (eraParentMap.has(current)) current = eraParentMap.get(current);
      return current;
    };

    // Assign items to their most specific era (any era, including sub-eras)
    const elementToAnyEraId = new Map();
    allItems.forEach((el) => {
      const elDate = el.type === "event" ? el.date : el.start;
      let bestEra = null, bestRange = Infinity;
      sortedEras.forEach((era) => {
        if (elDate >= era.start && elDate <= era.end) {
          const r = era.end - era.start;
          if (r < bestRange) { bestRange = r; bestEra = era; }
        }
      });
      if (bestEra) elementToAnyEraId.set(el.id, bestEra.id);
    });

    const sortItems = (items) => [...items].sort(compareEraGroupItems);

    // Build groups: root eras with nested sub-era subGroups
    const groups = rootEras.map((era) => {
      const directItems = sortItems(allItems.filter((el) => elementToAnyEraId.get(el.id) === era.id));
      const childSubEras = subEras
        .filter((se) => getRootAncestorId(se.id) === era.id)
        .sort((a, b) => a.start - b.start);
      const subGroups = childSubEras.map((subEra) => ({
        era: subEra,
        items: sortItems(allItems.filter((el) => elementToAnyEraId.get(el.id) === subEra.id)),
      }));
      return {
        era,
        items: directItems,
        subGroups,
        barLeft: ((compressYear(era.start) - cMin) / range) * 100,
        barWidth: Math.max(1, ((compressYear(era.end) - compressYear(era.start)) / range) * 100),
      };
    });

    const ungrouped = sortItems(allItems.filter((el) => !elementToAnyEraId.has(el.id)));
    return { groups, ungrouped };
  }, [eras, events, spans]);

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

  const { allTags, tagCounts } = useMemo(() => {
    const counts = new Map();
    (allElements || []).forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      if (Array.isArray(element.tags)) {
        element.tags.forEach((tag) => {
          if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
        });
      }
    });
    const tags = Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
    return { allTags: tags, tagCounts: counts };
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

  useEffect(() => {
    if (!newMenuOpen) return;
    const handleClick = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setNewMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [newMenuOpen]);

  useEffect(() => {
    if (!groupMenuOpenId) return;
    const handleClick = (e) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target)) setGroupMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [groupMenuOpenId]);

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

  const startGroupTitleEdit = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupTitle(group.title || group.id || "");
  };

  const handleAddGroupAndEdit = () => {
    if (typeof onAddGroup !== "function") return;
    const existingIds = new Set(groups.map((group) => group?.id).filter(Boolean));
    let nextIndex = groups.length + 1;
    let nextId = `g-${nextIndex}`;
    while (existingIds.has(nextId)) {
      nextIndex += 1;
      nextId = `g-${nextIndex}`;
    }
    setPendingNewGroupEditId(nextId);
    onAddGroup();
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

  useEffect(() => {
    if (!pendingNewGroupEditId) return;
    const newGroup = groups.find((group) => group.id === pendingNewGroupEditId);
    if (!newGroup) return;
    setEditingGroupId(newGroup.id);
    setEditingGroupTitle(newGroup.title || newGroup.id || "");
    setPendingNewGroupEditId(null);
  }, [groups, pendingNewGroupEditId]);

  const eraRoots = useMemo(
    () => [...eras].sort((a, b) => a.start - b.start),
    [eras]
  );
  const spanRows = useMemo(
    () => [...spans].sort((a, b) => a.start === b.start ? a.title.localeCompare(b.title) : a.start - b.start),
    [spans]
  );
  const eventRows = useMemo(
    () => [...events].sort((a, b) => a.date - b.date),
    [events]
  );

  const searchActive = searchQuery.trim().length > 0;
  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (value) => (value || "").toLowerCase().includes(q);
  const searchPlaceholder = sidebarTab === "timeline"
    ? "Search spans, events, eras..."
    : sidebarTab === "tags"
      ? "Search tags..."
      : "Search groups...";

  const visibleEras = searchActive ? eraRoots.filter((e) => matchesSearch(e.title || e.id)) : eraRoots;
  const visibleSpans = searchActive ? spanRows.filter((s) => matchesSearch(s.title || s.id)) : spanRows;
  const visibleEvents = searchActive ? eventRows.filter((ev) => matchesSearch(ev.title || ev.id)) : eventRows;

  const visibleGroups = searchActive
    ? eraGroups.groups
        .map((group) => {
          const eraMatches = matchesSearch(group.era.title || group.era.id);
          const filteredItems = eraMatches
            ? group.items
            : group.items.filter((el) => matchesSearch(el.title || el.id));
          const filteredSubGroups = (group.subGroups || [])
            .map((subGroup) => {
              const subEraMatches = matchesSearch(subGroup.era.title || subGroup.era.id);
              return {
                ...subGroup,
                items: subEraMatches
                  ? subGroup.items
                  : subGroup.items.filter((el) => matchesSearch(el.title || el.id)),
              };
            })
            .filter((subGroup) => subGroup.items.length > 0 || matchesSearch(subGroup.era.title || subGroup.era.id));

          if (!eraMatches && filteredItems.length === 0 && filteredSubGroups.length === 0) {
            return null;
          }

          return {
            ...group,
            items: filteredItems,
            subGroups: filteredSubGroups,
          };
        })
        .filter(Boolean)
    : eraGroups.groups;
  const visibleUngrouped = searchActive
    ? eraGroups.ungrouped.filter((el) => (el.title || el.id || "").toLowerCase().includes(q))
    : eraGroups.ungrouped;
  const visibleTags = searchActive
    ? allTags.filter((tag) => matchesSearch(tag))
    : allTags;
  const visibleDisplayGroups = searchActive
    ? displayGroups
        .map((group) => {
          const groupMatches = matchesSearch(group.title || group.id);
          const items = groupElements.get(group.id) || [];
          const visibleItems = groupMatches
            ? items
            : items.filter((element) => matchesSearch(element.title || element.id));
          if (!groupMatches && visibleItems.length === 0) return null;
          return {
            ...group,
            visibleItems,
            visibleCount: visibleItems.length,
          };
        })
        .filter(Boolean)
    : displayGroups.map((group) => ({
        ...group,
        visibleItems: groupElements.get(group.id) || [],
        visibleCount: groupCounts.get(group.id) || 0,
      }));

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
        <div className="sidebar-controls">
          <div className="sidebar-tabs">
            <button type="button" className={`sidebar-tab-button${sidebarTab === "timeline" ? " is-active" : ""}`} onClick={() => setSidebarTab("timeline")} aria-label="Timeline tab" title="Timeline">
              <List size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className={`sidebar-tab-button${sidebarTab === "tags" ? " is-active" : ""}`} onClick={() => setSidebarTab("tags")} aria-label="Tags tab" title="Tags">
              <Tag size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className={`sidebar-tab-button${sidebarTab === "groups" ? " is-active" : ""}`} onClick={() => setSidebarTab("groups")} aria-label="Groups tab" title="Groups">
              <Layers3 size={15} strokeWidth={2.2} />
            </button>
          </div>
          <div className="sb-new-wrapper" ref={newMenuRef}>
            <button className="sb-new-btn" onClick={() => setNewMenuOpen((v) => !v)}>
              <Plus size={13} strokeWidth={2.5} />
              <span>New</span>
              <ChevronDown size={11} strokeWidth={2.5} />
            </button>
            {newMenuOpen && (
              <div className="sb-new-menu">
                <button className="sb-new-menu-item" onClick={() => { setNewMenuOpen(false); onAddEra?.(); }}>
                  <span className="sb-new-menu-icon"><span style={{ display: "inline-block", width: 9, height: 9, border: "2px solid currentColor", borderRadius: 2 }} /></span>
                  Era
                </button>
                <button className="sb-new-menu-item" onClick={() => { setNewMenuOpen(false); onAddSpan?.(); }}>
                  <span className="sb-new-menu-icon"><span style={{ display: "inline-block", width: 12, height: 2, borderRadius: 1, background: "currentColor" }} /></span>
                  Span
                </button>
                <button className="sb-new-menu-item" onClick={() => { setNewMenuOpen(false); onAddEvent?.(); }}>
                  <span className="sb-new-menu-icon"><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} /></span>
                  Event
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sb-search-row">
          <Search size={12} strokeWidth={2} className="sb-search-icon" />
          <input
            className="sb-search-input"
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      <div className={`sidebar-content${sidebarTab !== "timeline" ? " is-tags-tab" : ""}`} ref={listRef}>
        {sidebarTab === "timeline" ? (
        !file?.useEraGroupsInPanel ? (
          <>
            <div className="sb-section">
              <div className="sb-section-head">
                <button className="sb-section-toggle" onClick={() => setOpenEras((v) => !v)}>
                  <ChevronDown className={`sb-caret ${openEras ? "open" : ""}`} size={16} strokeWidth={2} />
                  <span className="sb-section-label">Eras</span>
                </button>
              </div>
              {(openEras || searchActive) && (
                <div className="sb-section-body">
                  {visibleEras.map((e) => (
                    <SidebarRow key={e.id} item={e} rightText={formatRange(e.start, e.end, e.startLabel, e.endLabel)} level={0} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} />
                  ))}
                </div>
              )}
            </div>
            <div className="sb-section">
              <div className="sb-section-head">
                <button className="sb-section-toggle" onClick={() => setOpenSpans((v) => !v)}>
                  <ChevronDown className={`sb-caret ${openSpans ? "open" : ""}`} size={16} strokeWidth={2} />
                  <span className="sb-section-label">Spans</span>
                </button>
              </div>
              {(openSpans || searchActive) && (
                <div className="sb-section-body">
                  {visibleSpans.map((s) => (
                    <SidebarRow key={s.id} item={s} rightText={formatRange(s.start, s.end, s.startLabel, s.endLabel)} level={0} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} />
                  ))}
                </div>
              )}
            </div>
            <div className="sb-section">
              <div className="sb-section-head">
                <button className="sb-section-toggle" onClick={() => setOpenEvents((v) => !v)}>
                  <ChevronDown className={`sb-caret ${openEvents ? "open" : ""}`} size={16} strokeWidth={2} />
                  <span className="sb-section-label">Events</span>
                </button>
              </div>
              {(openEvents || searchActive) && (
                <div className="sb-section-body">
                  {visibleEvents.map((ev) => (
                    <SidebarRow key={ev.id} item={ev} rightText={ev.dateLabel ?? fmtYear(ev.date)} level={0} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
        <div className="sb-era-groups">
          {visibleGroups.map(({ era, items, subGroups, barLeft, barWidth }) => {
            const isOpen = searchActive || openEraGroups[era.id] !== false;
            const eraColor = era.color || "var(--element-bg)";
            const totalCount = items.length + (subGroups?.reduce((s, sg) => s + sg.items.length, 0) ?? 0);
            return (
              <div key={era.id} className="sb-era-group">
                <div className="sb-era-header">
                  <button
                    className="sb-era-toggle"
                    onClick={() => setOpenEraGroups((prev) => ({ ...prev, [era.id]: !isOpen }))}
                  >
                    <ChevronDown className={`sb-caret ${isOpen ? "open" : ""}`} size={11} strokeWidth={2.5} />
                  </button>
                  <button
                    className="sb-era-title-btn"
                    onClick={() => {
                      if (listRef.current) lastScrollTopRef.current = listRef.current.scrollTop;
                      onSelect?.(era.id);
                      requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = lastScrollTopRef.current; });
                    }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setElementMenu({ x: e.clientX, y: e.clientY, element: era }); }}
                  >
                    <span
                      className={`sb-era-name${selectedId === era.id ? " is-selected" : ""}`}
                      style={selectedId === era.id ? undefined : { color: getEraLabelColor(era.color, sidebarBgHex) || undefined }}
                    >
                      {(era.title || era.id).toUpperCase()}
                    </span>
                  </button>
                  <span className="sb-era-count">{totalCount}</span>
                </div>
                {eraGroups.groups.length > 1 && (
                  <div className="sb-era-bar-track">
                    <div className="sb-era-bar" style={{ left: `${barLeft}%`, width: `${barWidth}%`, background: getEraLabelColor(era.color, sidebarBgHex) || eraColor }} />
                  </div>
                )}
                {isOpen && (
                  <div className="sb-era-items">
                    {items.map((el) => (
                      <ElementRow key={el.id} element={el} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} tagColors={tagColors} spanById={spanById} fmtYear={fmtYear} />
                    ))}
                    {subGroups?.map(({ era: subEra, items: subItems }) => {
                      const isSubOpen = searchActive || openEraGroups[subEra.id] !== false;
                      return (
                        <div key={subEra.id} className="sb-sub-era-group">
                          <div className="sb-sub-era-header">
                            <button
                              className="sb-era-toggle"
                              onClick={() => setOpenEraGroups((prev) => ({ ...prev, [subEra.id]: !isSubOpen }))}
                            >
                              <ChevronDown className={`sb-caret ${isSubOpen ? "open" : ""}`} size={10} strokeWidth={2.5} />
                            </button>
                            <button
                              className="sb-era-title-btn"
                              onClick={() => {
                                if (listRef.current) lastScrollTopRef.current = listRef.current.scrollTop;
                                onSelect?.(subEra.id);
                                requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = lastScrollTopRef.current; });
                              }}
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setElementMenu({ x: e.clientX, y: e.clientY, element: subEra }); }}
                            >
                              <span
                                className={`sb-sub-era-name${selectedId === subEra.id ? " is-selected" : ""}`}
                                style={selectedId === subEra.id ? undefined : { color: getEraLabelColor(subEra.color, sidebarBgHex) || undefined }}
                              >
                                {(subEra.title || subEra.id).toUpperCase()}
                              </span>
                            </button>
                            <span className="sb-sub-era-range">
                              {formatRange(subEra.start, subEra.end, subEra.startLabel, subEra.endLabel)}
                            </span>
                          </div>
                          {isSubOpen && subItems.length > 0 && (
                            <div className="sb-sub-era-items">
                              {subItems.map((el) => (
                                <ElementRow key={el.id} element={el} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} tagColors={tagColors} spanById={spanById} fmtYear={fmtYear} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {visibleUngrouped.length > 0 && (
            <div className="sb-era-group">
              {eraGroups.groups.length > 0 && (
                <div className="sb-era-header">
                  <span className="sb-era-name">OTHER</span>
                  <span className="sb-era-count">{visibleUngrouped.length}</span>
                </div>
              )}
              <div className="sb-era-items">
                {visibleUngrouped.map((el) => (
                  <ElementRow key={el.id} element={el} selectedId={selectedId} onSelect={onSelect} listRef={listRef} lastScrollTopRef={lastScrollTopRef} setElementMenu={setElementMenu} tagColors={tagColors} spanById={spanById} fmtYear={fmtYear} />
                ))}
              </div>
            </div>
          )}
        </div>
        )
        ) : sidebarTab === "tags" ? (
          <div className="sidebar-tags-panel">
            <div className="sidebar-tags-dropdown">
              <div className="sb-tag-list-header">
                <span className="sb-tag-list-title">All Tags</span>
                <span className="sb-tag-list-separator">·</span>
                <span className="sb-tag-list-count">{visibleTags.length}</span>
              </div>
              {visibleTags.length === 0 && (
                <div className="filter-menu-empty">{searchActive ? "No matching tags" : "No tags found"}</div>
              )}
              {visibleTags.map((tag) => {
                const isShown = activeTags.includes(tag);
                const isHidden = hiddenTags.includes(tag);
                const isPinned = pinnedTags.includes(tag);
                const tagColor = tagColors[tag];
                const count = tagCounts.get(tag) || 0;
                return (
                  <div
                    key={tag}
                    className={`sb-tag-row${isHidden ? " is-hidden" : ""}`}
                    onClick={() => onToggleTag?.(tag)}
                    title={isShown ? "Disable spotlight filter" : "Spotlight this tag"}
                  >
                    <button
                      type="button"
                      className="sb-tag-swatch"
                      style={{ background: tagColor || "var(--active-bg)" }}
                      onClick={(e) => { e.stopPropagation(); openTagColorPicker(tag); }}
                      title="Set tag color"
                    >
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
                    <span className="sb-tag-name"><span className="sb-tag-hash">#</span>{tag}</span>
                    <span className="sb-tag-count">{count}</span>
                    <div className="sb-tag-actions">
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-hide-btn${isHidden ? " is-active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleHiddenTag?.(tag); }}
                        title={isHidden ? "Show tag" : "Hide tag"}
                      >
                        {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-show-btn${isShown ? " is-active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onToggleTag?.(tag); }}
                        title={isShown ? "Disable spotlight filter" : "Spotlight this tag"}
                      >
                        <Target size={12} />
                      </button>
                      <button
                        type="button"
                        className={`filter-menu-icon-btn filter-menu-pin-btn${isPinned ? " is-pinned" : ""}`}
                        onClick={(e) => { e.stopPropagation(); onTogglePinnedTag?.(tag); }}
                        title={isPinned ? "Remove label" : "Use as label"}
                      >
                        <Tag size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="sidebar-groups-panel">
            <div className="sidebar-groups-list">
              <div className="sb-group-list-header">
                <div className="sb-group-list-meta">
                  <span className="sb-group-list-title">All Groups</span>
                  <span className="sb-group-list-separator">·</span>
                  <span className="sb-group-list-count">{visibleDisplayGroups.length}</span>
                </div>
                <button
                  className="sidebar-group-add-btn"
                  type="button"
                  onClick={handleAddGroupAndEdit}
                >
                  <Plus size={10} strokeWidth={2.5} />
                  <span>Add Group</span>
                </button>
              </div>
              {visibleDisplayGroups.length === 0 && (
                <div className="filter-menu-empty">{searchActive ? "No matching groups" : "No groups found"}</div>
              )}
              {visibleDisplayGroups.map((group) => {
                const count = group.visibleCount;
                const canDelete = displayGroups.length > 1;
                const groupTint = normalizeColorForInput(group.bgColor) || themeGroupColor;
                const itemsInGroup = group.visibleItems;
                const isGroupOpen = searchActive || !!openGroupContents[group.id];
                return (
                  <div
                    key={group.id}
                    className={`sb-group-item${draggedGroupId === group.id ? " is-dragging" : ""}${dragOverPlacement?.id === group.id ? ` is-drag-over-${dragOverPlacement.position}` : ""}`}
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
                    <div
                      className={`sb-group-header${isGroupOpen ? " is-open" : ""}`}
                      onClick={() => itemsInGroup.length > 0 && toggleGroupContents(group.id)}
                      style={{ cursor: itemsInGroup.length > 0 ? "pointer" : "default" }}
                    >
                      <button
                        type="button"
                        className="sb-group-swatch"
                        style={{ background: groupTint }}
                        onClick={(e) => { e.stopPropagation(); openGroupColorPicker(group.id); }}
                        title="Group color"
                      >
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
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className="sb-group-title">{group.title || group.id}</span>
                      )}
                      <span className="sb-group-count">{count}</span>
                      <div className="sb-group-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`filter-menu-icon-btn${group.visible === false ? " filter-menu-hide-btn is-active" : ""}`}
                          title={group.visible === false ? "Show group" : "Hide group"}
                          onClick={() => updateGroupPatch(group.id, { visible: group.visible === false ? true : false })}
                        >
                          {group.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <div className="sb-group-kebab-wrap" ref={groupMenuOpenId === group.id ? groupMenuRef : null}>
                          <button
                            type="button"
                            className="filter-menu-icon-btn"
                            title="More options"
                            onClick={(e) => { e.stopPropagation(); setGroupMenuOpenId(groupMenuOpenId === group.id ? null : group.id); }}
                          >
                            <MoreVertical size={15} />
                          </button>
                          {groupMenuOpenId === group.id && (
                            <div className="sb-group-kebab-menu">
                              <button
                                className="sb-group-kebab-item"
                                onClick={(e) => { e.stopPropagation(); setGroupMenuOpenId(null); startGroupTitleEdit(group); }}
                              >
                                <Edit2 size={13} />
                                <span>Rename</span>
                              </button>
                              <button
                                className="sb-group-kebab-item sb-group-kebab-item-danger"
                                disabled={!canDelete}
                                onClick={(e) => { e.stopPropagation(); setGroupMenuOpenId(null); onDeleteGroup?.(group.id); }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
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
                              if (listRef.current) lastScrollTopRef.current = listRef.current.scrollTop;
                              onSelect?.(element.id);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setElementMenu({ x: e.clientX, y: e.clientY, element });
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
          <button
            className="context-menu-item"
            onClick={() => handleElementMenuAction(() => onDuplicateElement?.(elementMenu.element.id))}
          >
            <Copy size={16} />
            <span>Duplicate {elementMenu.element.type.charAt(0).toUpperCase() + elementMenu.element.type.slice(1)}</span>
          </button>
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
