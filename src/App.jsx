import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import TimelineView from "./components/TimelineView";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import SettingsModal from "./components/SettingsModal";
import NewTimelineModal from "./components/NewTimelineModal";
import ExportPngModal from "./components/ExportPngModal";
import ExportVideoModal from "./components/ExportVideoModal";
import TopBar from "./components/TopBar";
import HomePage from "./components/HomePage";
import SearchOverlay from "./components/SearchOverlay";
import {
  saveTimelineToFile,
  chooseTimelinesDir,
  chooseNotesDir,
  chooseNotesSubfolder,
  listFonts,
  openFontsFolder,
  deleteNote,
  renameTimeline,
  saveCloudCache,
  loadCloudCache,
  updateCloudMeta,
} from "./utils/electronApi";
import { updateElementWithNewId, generateUniqueRandomElementId, generateIdFromTitle } from "./utils/idUtils";
import { applyTheme, getInitialThemeKey } from "./utils/theme";
import { loadThemeConfig } from "./utils/themeLoader";
import { getAppSettings, saveAppSettings } from "./utils/appSettings";
import { cloneDefaultKeybinds, loadKeybinds, matchesKeybind } from "./utils/keybinds";
import { apiGetTimelineById, apiUpdateTimeline } from "./lib/api.js";
import { onAuthStateChange } from "./lib/auth.js";
import { parseTimelineInput, snapToMonthGrid } from "./utils/dateUtils";
import "./index.css";

const DEFAULT_GROUP_ID = "g-main";
const DEFAULT_GROUP = {
  id: DEFAULT_GROUP_ID,
  title: "Main",
  order: 0,
  stack: 0,
  visible: true,
  locked: false,
};

function App() {
  const normalizeTimelineData = useCallback((data) => {
    if (!data || typeof data !== "object") return data;

    const elements = Array.isArray(data.elements) ? data.elements : [];
    const groupsRaw = Array.isArray(data.file?.groups) ? data.file.groups : [];
    const sourceGroups = groupsRaw.length > 0 ? groupsRaw : [DEFAULT_GROUP];
    const groups = sourceGroups.map((group, index) => {
      const fallbackId = index === 0 ? DEFAULT_GROUP_ID : `g-${index + 1}`;
      return {
        ...DEFAULT_GROUP,
        ...group,
        id: group?.id || fallbackId,
        title: group?.title || (index === 0 ? "Main" : `Group ${index + 1}`),
        order: Number.isFinite(group?.order) ? group.order : index,
        stack: Number.isFinite(group?.stack) ? group.stack : index,
        visible: group?.visible !== false,
        locked: group?.locked === true,
      };
    });
    const groupIdSet = new Set(groups.map((group) => group?.id).filter(Boolean));
    const defaultGroupId = groups[0]?.id || DEFAULT_GROUP_ID;

    // Migrate old parent-defined branches/forks/merges to child-defined parent/mergeParent.
    const branchParentMap = {};
    const mergeParentMap = {};
    for (const el of elements) {
      if (el.type !== "span") continue;
      const branches = Array.isArray(el.branches) ? el.branches : [];
      const forks = Array.isArray(el.forks) ? el.forks : [];
      const allBranches = Array.from(new Set([...branches, ...forks]));
      for (const childId of allBranches) {
        branchParentMap[childId] = el.id;
      }
      const merges = Array.isArray(el.merges) ? el.merges : [];
      for (const childId of merges) {
        mergeParentMap[childId] = el.id;
      }
    }

    const nextElements = elements.map((element) => {
      const next = { ...element };
      const needsGroupId = next.type === "event" || next.type === "span";
      if (needsGroupId && !groupIdSet.has(next.groupId)) {
        next.groupId = defaultGroupId;
      }

      if (next.type !== "span") return next;

      const { branches: _b, forks: _f, merges: _m, ...rest } = next;
      if (!rest.parent && branchParentMap[element.id]) {
        rest.parent = branchParentMap[element.id];
      }
      if (!rest.mergeParent && mergeParentMap[element.id]) {
        rest.mergeParent = mergeParentMap[element.id];
      }
      return rest;
    });

    return {
      ...data,
      file: {
        ...(data.file || {}),
        groups,
      },
      elements: nextElements,
    };
  }, []);

  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handler = () => setSessionExpired(true);
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, []);

  useEffect(() => {
    return onAuthStateChange((user) => { if (user) setSessionExpired(false); });
  }, []);

  const [themeConfig, setThemeConfig] = useState(loadThemeConfig());
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 600;
  const COLLAPSED_WIDTH = 44;
  const DEFAULT_LEFT_WIDTH = 350;
  const DEFAULT_RIGHT_WIDTH = 385;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isRightMaximized, setIsRightMaximized] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteElementDialog, setDeleteElementDialog] = useState(null);
  const [deleteElementWithNotes, setDeleteElementWithNotes] = useState(false);
  const [downloadPngTrigger, setDownloadPngTrigger] = useState(0);
  const [timelineData, setTimelineData] = useState(null);
  const [currentTimelineId, setCurrentTimelineId] = useState(null);
  const currentTimelineIdRef = useRef(null);
  const cloudMetaRef = useRef(null);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [isExportPngModalOpen, setIsExportPngModalOpen] = useState(false);
  const [exportPngOptions, setExportPngOptions] = useState(null);
  const [isExportVideoModalOpen, setIsExportVideoModalOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);
  const defaultThemeKey = getInitialThemeKey(themeConfig);
  const [themeKey, setThemeKey] = useState(defaultThemeKey);
  const [appThemeKey, setAppThemeKey] = useState(defaultThemeKey);
  const [appThemePreference, setAppThemePreference] = useState(defaultThemeKey);
  const [timelineStorageDir, setTimelineStorageDir] = useState("");
  const [notesStorageDir, setNotesStorageDir] = useState("");
  const [notesSubfolder, setNotesSubfolder] = useState("");
  const [notesSubfolderEnabled, setNotesSubfolderEnabled] = useState(false);
  const [appFontFamily, setAppFontFamily] = useState("Inter");
  const [appFontSize, setAppFontSize] = useState(14);
  const [keybinds, setKeybinds] = useState(() => cloneDefaultKeybinds());
  const [availableFonts, setAvailableFonts] = useState([]);
  const [activeTags, setActiveTags] = useState([]);
  const [hiddenTags, setHiddenTags] = useState([]);
  const [pinnedTags, setPinnedTags] = useState([]);
  const [viewportYear, setViewportYear] = useState(null);
  const [homeSettingsSignal, setHomeSettingsSignal] = useState(0);
  const [openCloudSettingsSignal, setOpenCloudSettingsSignal] = useState(0);
  const [isAppSettingsOverlayOpen, setIsAppSettingsOverlayOpen] = useState(false);
  const [returnToProjectSettings, setReturnToProjectSettings] = useState(false);
  const [isProjectSettingsCovered, setIsProjectSettingsCovered] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const HISTORY_LIMIT = 100;
  const historyRef = useRef({ past: [], future: [] });
  const historyLockRef = useRef(false);
  const prevTimelineRef = useRef(null);
  const lastTimelineIdRef = useRef(null);
  const timelineDataRef = useRef(null);
  const selectedIdRef = useRef(null);
  const leftWidthRef = useRef(DEFAULT_LEFT_WIDTH);
  const rightWidthRef = useRef(DEFAULT_RIGHT_WIDTH);
  const leftCollapsedRef = useRef(false);
  const rightCollapsedRef = useRef(false);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const rightMaxReachedRef = useRef(false);
  const rightReversedAfterMaxRef = useRef(false);
  const rightLastDistanceRef = useRef(null);
  const timelineViewRef = useRef(null);
  const currentLeftWidth = isLeftCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  useEffect(() => {
    function handleMouseMove(e) {
      if (isDraggingLeft.current) {
        e.preventDefault();
        const dragX = e.clientX;
        if (isLeftCollapsed && dragX > 30) {
          setIsLeftCollapsed(false);
          setSidebarWidth(Math.min(Math.max(dragX, MIN_WIDTH), MAX_WIDTH));
        } else if (!isLeftCollapsed && dragX < 50) {
          setIsLeftCollapsed(true);
        } else if (!isLeftCollapsed) {
          setSidebarWidth(Math.min(Math.max(dragX, MIN_WIDTH), MAX_WIDTH));
        }
      } else if (isDraggingRight.current) {
        e.preventDefault();
        if (!selectedIdRef.current) return;
        const windowWidth = window.innerWidth;
        const distanceFromRight = windowWidth - e.clientX;
        const maximizeThreshold = MAX_WIDTH + 24;
        if (!Number.isFinite(rightLastDistanceRef.current)) {
          rightLastDistanceRef.current = distanceFromRight;
        }
        if (isRightCollapsed && distanceFromRight > 30) {
          const next = Math.min(Math.max(distanceFromRight, MIN_WIDTH), MAX_WIDTH);
          setIsRightCollapsed(false);
          setRightWidth(next);
          setIsRightMaximized(false);
          rightLastDistanceRef.current = distanceFromRight;
        } else if (!isRightCollapsed && distanceFromRight < 50) {
          setIsRightCollapsed(true);
          setIsRightMaximized(false);
        } else if (!isRightCollapsed && distanceFromRight > maximizeThreshold) {
          if (rightMaxReachedRef.current && rightReversedAfterMaxRef.current) {
            setIsRightMaximized(true);
          }
        } else if (!isRightCollapsed) {
          const lastDistance = rightLastDistanceRef.current;
          if (
            rightMaxReachedRef.current &&
            Number.isFinite(lastDistance) &&
            distanceFromRight < lastDistance - 4
          ) {
            rightReversedAfterMaxRef.current = true;
          }
          const next = Math.min(Math.max(distanceFromRight, MIN_WIDTH), MAX_WIDTH);
          if (isRightMaximized) setIsRightMaximized(false);
          setRightWidth(next);
          if (next >= MAX_WIDTH) {
            rightMaxReachedRef.current = true;
          }
          rightLastDistanceRef.current = distanceFromRight;
        }
      }
    }

    function handleMouseUp() {
      if (isDraggingLeft.current || isDraggingRight.current) {
        isDraggingLeft.current = false;
        isDraggingRight.current = false;
        rightMaxReachedRef.current = false;
        rightReversedAfterMaxRef.current = false;
        rightLastDistanceRef.current = null;
        document.body.classList.remove("dragging");
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isLeftCollapsed, isRightCollapsed, isRightMaximized]);

  useEffect(() => {
    timelineDataRef.current = timelineData;
  }, [timelineData]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    leftWidthRef.current = currentLeftWidth;
  }, [currentLeftWidth]);

  useEffect(() => {
    rightWidthRef.current = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    leftCollapsedRef.current = isLeftCollapsed;
  }, [isLeftCollapsed]);

  useEffect(() => {
    rightCollapsedRef.current = isRightCollapsed;
  }, [isRightCollapsed]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!selectedId) return;
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const deleteBind = keybinds.delete;
      const altDeleteBind = { keys: ["Backspace"] };
      if (!matchesKeybind(e, deleteBind) && !matchesKeybind(e, altDeleteBind)) return;
      e.preventDefault();
      if (!timelineData?.elements) return;
      const element = timelineData.elements.find(el => el.id === selectedId);
      if (!element) return;
      handleRequestDelete(element.id);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, timelineData, keybinds]);


  const refreshUserThemes = async () => {
    if (!window.electron?.listThemes) return;
    try {
      const bundledThemes = loadThemeConfig().themes || {};
      const userThemes = await window.electron.listThemes();
      setThemeConfig((prev) => ({
        ...prev,
        themes: {
          ...bundledThemes,
          ...(userThemes || {}),
        },
      }));
    } catch (error) {
      console.error('Failed to load user themes:', error);
    }
  };

  useEffect(() => {
    refreshUserThemes();
  }, []);

  useEffect(() => {
    const loadFonts = async () => {
      const result = await listFonts();
      if (!result?.success) return;
      setAvailableFonts(result.fonts || []);
    };

    loadFonts();
  }, []);

  useEffect(() => {
    const resolvedDefault = getInitialThemeKey(themeConfig);
    setThemeKey((current) =>
      themeConfig.themes?.[current] ? current : resolvedDefault
    );
  }, [themeConfig]);

  useEffect(() => {
    const fileId = timelineData?.file?.id || null;
    if (fileId !== lastTimelineIdRef.current) {
      historyRef.current = { past: [], future: [] };
      prevTimelineRef.current = timelineData;
      lastTimelineIdRef.current = fileId;
    }
  }, [timelineData?.file?.id, timelineData]);

  useEffect(() => {
    if (!timelineData) {
      historyRef.current = { past: [], future: [] };
      prevTimelineRef.current = null;
      return;
    }

    if (historyLockRef.current) {
      historyLockRef.current = false;
      prevTimelineRef.current = timelineData;
      return;
    }

    if (prevTimelineRef.current && timelineData !== prevTimelineRef.current) {
      const nextPast = [...historyRef.current.past, prevTimelineRef.current];
      if (nextPast.length > HISTORY_LIMIT) {
        nextPast.shift();
      }
      historyRef.current = { past: nextPast, future: [] };
    }

    prevTimelineRef.current = timelineData;
  }, [timelineData]);

  // Keep ref in sync so saveTimeline can read it inside stale closures
  useEffect(() => { currentTimelineIdRef.current = currentTimelineId; }, [currentTimelineId]);

  const saveTimeline = async (data, localId) => {
    const id = currentTimelineIdRef.current;
    if (id?.startsWith('cloud:')) {
      const backendId = id.slice('cloud:'.length);
      const now = new Date().toISOString();
      const currentMeta = cloudMetaRef.current ?? { backendId, lastServerUpdatedAt: null };

      // 1. Always write to cache first
      const unsyncedMeta = { ...currentMeta, localUpdatedAt: now, syncStatus: 'unsynced' };
      await saveCloudCache(backendId, data, unsyncedMeta);
      cloudMetaRef.current = unsyncedMeta;

      // 2. Try to push to backend
      try {
        const result = await apiUpdateTimeline(backendId, {
          title: data.file?.title,
          slug: localId,
          description: data.file?.description ?? '',
          isPublic: data.file?.isPublic ?? false,
          contentJson: JSON.stringify(data),
        });
        if (result.success) {
          const serverUpdatedAt = result.data?.updatedAt ?? now;
          const syncedMeta = { ...unsyncedMeta, lastServerUpdatedAt: serverUpdatedAt, syncStatus: 'synced' };
          await updateCloudMeta(backendId, syncedMeta);
          cloudMetaRef.current = syncedMeta;
        }
      } catch {
        // remains unsynced — already written to cache
      }
      return;
    }
    return saveTimelineToFile(data, localId);
  };

  const undoTimeline = () => {
    if (!timelineData) return;
    const { past, future } = historyRef.current;
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    historyRef.current = {
      past: past.slice(0, -1),
      future: [timelineData, ...future],
    };

    historyLockRef.current = true;
    setTimelineData(previous);

    const timelineId =
      previous.file?.id?.replace("-timeline", "") || currentTimelineId || "timeline";
    saveTimeline(previous, timelineId).catch(console.error);
  };

  const redoTimeline = () => {
    if (!timelineData) return;
    const { past, future } = historyRef.current;
    if (future.length === 0) return;

    const next = future[0];
    historyRef.current = {
      past: [...past, timelineData].slice(-HISTORY_LIMIT),
      future: future.slice(1),
    };

    historyLockRef.current = true;
    setTimelineData(next);

    const timelineId =
      next.file?.id?.replace("-timeline", "") || currentTimelineId || "timeline";
    saveTimeline(next, timelineId).catch(console.error);
  };

  useEffect(() => {
    const handleUndoRedo = (e) => {
      if (!timelineData) return;
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;
      if (matchesKeybind(e, keybinds.undo)) {
        e.preventDefault();
        undoTimeline();
      } else if (matchesKeybind(e, keybinds.redo)) {
        e.preventDefault();
        redoTimeline();
      }
    };

    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [timelineData, currentTimelineId, keybinds]);

  useEffect(() => {
    if (!timelineData) return;
    const handleSearchKey = (e) => {
      if (!matchesKeybind(e, keybinds.search)) return;
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      setIsSearchOpen(true);
    };
    window.addEventListener("keydown", handleSearchKey);
    return () => window.removeEventListener("keydown", handleSearchKey);
  }, [timelineData, keybinds]);

  useEffect(() => {
    if (!timelineData) return;
    const handleAddShortcuts = (e) => {
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;

      if (matchesKeybind(e, keybinds.newEvent)) {
        e.preventDefault();
        handleAddEvent();
      } else if (matchesKeybind(e, keybinds.newSpan)) {
        e.preventDefault();
        handleAddSpan();
      } else if (matchesKeybind(e, keybinds.newEra)) {
        e.preventDefault();
        handleAddEra();
      }
    };

    window.addEventListener("keydown", handleAddShortcuts);
    return () => window.removeEventListener("keydown", handleAddShortcuts);
  }, [timelineData, keybinds, viewportYear]);

  const handleSelect = (id) => {
    setSelectedId(id);
    if (id) setIsRightCollapsed(false);
  };

  const handleSearchSelect = (id) => {
    handleSelect(id);
    requestAnimationFrame(() => {
      timelineViewRef.current?.scrollToElement(id);
    });
  };

  useEffect(() => {
    if (!selectedId && isRightMaximized) {
      setIsRightMaximized(false);
    }
    if (!selectedId && isRightCollapsed) {
      setIsRightCollapsed(false);
    }
  }, [selectedId, isRightMaximized, isRightCollapsed]);

  const handleToggleTag = (tag) => {
    setActiveTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((value) => value !== tag);
      }
      return [...prev, tag];
    });
    setHiddenTags((prev) => prev.filter((value) => value !== tag));
  };

  const handleToggleHiddenTag = (tag) => {
    setHiddenTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((value) => value !== tag);
      }
      return [...prev, tag];
    });
    setActiveTags((prev) => prev.filter((value) => value !== tag));
  };

  const handleClearTags = () => {
    setActiveTags([]);
    setHiddenTags([]);
  };

  const handleAddGroup = () => {
    setTimelineData((prevData) => {
      const existing = Array.isArray(prevData.file?.groups) ? prevData.file.groups : [];
      const existingIds = new Set(existing.map((group) => group?.id).filter(Boolean));
      let nextIndex = existing.length + 1;
      let nextId = `g-${nextIndex}`;
      while (existingIds.has(nextId)) {
        nextIndex += 1;
        nextId = `g-${nextIndex}`;
      }

      const nextGroup = {
        id: nextId,
        title: `Group ${nextIndex}`,
        order: existing.length,
        stack: existing.length,
        visible: true,
        locked: false,
      };

      const updatedData = {
        ...prevData,
        file: {
          ...prevData.file,
          groups: [...existing, nextGroup],
        },
      };

      const timelineId = prevData.file?.id?.replace("-timeline", "") || "timeline";
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleUpdateGroup = (groupId, updates) => {
    if (!groupId || !updates || typeof updates !== "object") return;
    setTimelineData((prevData) => {
      const existing = Array.isArray(prevData.file?.groups) ? prevData.file.groups : [];
      const baseGroups = existing.length > 0 ? existing : [DEFAULT_GROUP];
      const nextGroups = baseGroups.map((group) => (
        group.id === groupId ? { ...group, ...updates } : group
      ));
      const hasMatch = baseGroups.some((group) => group.id === groupId);
      const finalGroups = hasMatch
        ? nextGroups
        : [...nextGroups, { ...DEFAULT_GROUP, id: groupId, ...updates }];
      const updatedData = {
        ...prevData,
        file: {
          ...prevData.file,
          groups: finalGroups,
        },
      };
      const timelineId = prevData.file?.id?.replace("-timeline", "") || "timeline";
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleUpdateTagColor = (tag, color) => {
    if (!tag) return;
    setTimelineData((prevData) => {
      const prevTagColors = prevData.file?.tagColors || {};
      const nextTagColors = color
        ? { ...prevTagColors, [tag]: color }
        : Object.fromEntries(Object.entries(prevTagColors).filter(([k]) => k !== tag));
      const updatedData = {
        ...prevData,
        file: { ...prevData.file, tagColors: nextTagColors },
      };
      const timelineId = prevData.file?.id?.replace("-timeline", "") || "timeline";
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleDeleteGroup = (groupId) => {
    if (!groupId) return;
    setTimelineData((prevData) => {
      const existing = Array.isArray(prevData.file?.groups) ? prevData.file.groups : [];
      const baseGroups = existing.length > 0 ? existing : [DEFAULT_GROUP];
      if (baseGroups.length <= 1) return prevData;

      const remainingGroups = baseGroups.filter((group) => group.id !== groupId);
      if (remainingGroups.length === 0) return prevData;
      const fallbackGroupId = remainingGroups[0].id;

      const nextElements = (prevData.elements || []).map((element) => {
        if ((element.type === "event" || element.type === "span") && element.groupId === groupId) {
          return { ...element, groupId: fallbackGroupId };
        }
        return element;
      });

      const normalizedGroups = remainingGroups.map((group, index) => ({
        ...group,
        order: index,
      }));

      const updatedData = {
        ...prevData,
        file: {
          ...prevData.file,
          groups: normalizedGroups,
        },
        elements: nextElements,
      };
      const timelineId = prevData.file?.id?.replace("-timeline", "") || "timeline";
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleFilterByTag = (tag) => {
    setActiveTags([tag]);
    setHiddenTags((prev) => prev.filter((value) => value !== tag));
  };

  const handleTogglePinnedTag = (tag) => {
    if (!tag) return;
    const nextPinnedTags = pinnedTags.includes(tag)
      ? pinnedTags.filter((value) => value !== tag)
      : [...pinnedTags, tag];
    setPinnedTags(nextPinnedTags);
    setTimelineData((prevData) => {
      if (!prevData?.file) return prevData;
      const nextFile = { ...prevData.file };
      if (nextPinnedTags.length > 0) {
        nextFile.pinnedTags = nextPinnedTags;
      } else {
        delete nextFile.pinnedTags;
      }
      const updatedData = { ...prevData, file: nextFile };
      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleEditElement = (id) => {
    setSelectedId(id);
    setEditRequestId(id);
  };

  const handleRequestDelete = (elementId) => {
    if (!timelineData?.elements) return;
    const element = timelineData.elements.find((el) => el.id === elementId);
    if (!element) return;
    setDeleteElementDialog(element);
    setDeleteElementWithNotes(false);
  };

  const handleConfirmDeleteElement = async () => {
    const element = deleteElementDialog;
    if (!element) return;
    if (deleteElementWithNotes && element.noteFile) {
      const timelineId = timelineData?.file?.id?.replace('-timeline', '') || 'timeline';
      await deleteNote({ timelineId, filename: element.noteFile }).catch(console.error);
    }
    handleDelete(element.id);
    if (selectedId === element.id) {
      setSelectedId(null);
    }
    setDeleteElementDialog(null);
  };

  const handleUpdate = async (updatedElement) => {
    const originalId = updatedElement.id;

    setTimelineData((prevData) => {
      const nextElement = { ...updatedElement };
      if (!nextElement.dateLabel) delete nextElement.dateLabel;
      if (!nextElement.startLabel) delete nextElement.startLabel;
      if (!nextElement.endLabel) delete nextElement.endLabel;
      delete nextElement.dateInput;
      delete nextElement.startInput;
      delete nextElement.endInput;

      const updatedData = updateElementWithNewId(prevData, nextElement, originalId);

      
      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId)
        .then(() => {
          console.log('Timeline saved to file successfully');
        })
        .catch((error) => {
          console.error('Failed to save timeline to file:', error);
        });

      return updatedData;
    });
  };

  const handleAddEvent = (groupId, clickYear) => {
    if (!timelineData?.file) return;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const fallbackMid =
      timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const baseYear = Number.isFinite(clickYear) ? clickYear : Number.isFinite(viewportYear) ? viewportYear : fallbackMid;
    const clampedYear = clamp(baseYear, timelineData.file.start, timelineData.file.end);
    const eventId = generateUniqueRandomElementId(timelineData.elements, "event");
    const defaultGroupId = groupId || timelineData.file?.groups?.[0]?.id || DEFAULT_GROUP_ID;
    const newEvent = {
      id: eventId,
      type: "event",
      title: "New Event",
      date: clampedYear,
      groupId: defaultGroupId,
      parents: [],
      eventLineStyle: "solid",
      eventBorderStyle: "solid",
      color: "#EDE6DA",
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newEvent],
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(newEvent.id);
    setEditRequestId(newEvent.id);
  };

  const handleAddSpan = (groupId, clickYear) => {
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const range = timelineData.file.end - timelineData.file.start;
    const duration = Math.max(1, Math.floor(range / 4));
    const fallbackStart = timelineData.file.start + Math.floor(range / 2);
    const baseStart = Number.isFinite(clickYear) ? clickYear : Number.isFinite(viewportYear) ? viewportYear : fallbackStart;
    const start = clamp(baseStart, timelineData.file.start, timelineData.file.end);
    const end = clamp(start + duration, timelineData.file.start, timelineData.file.end);

    const spanId = generateUniqueRandomElementId(timelineData.elements, "span");
    const defaultGroupId = groupId || timelineData.file?.groups?.[0]?.id || DEFAULT_GROUP_ID;
    const newSpan = {
      id: spanId,
      type: "span",
      title: "New Span",
      start,
      end,
      groupId: defaultGroupId,
      color: "#A6977E",
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newSpan],
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(newSpan.id);
    setEditRequestId(newSpan.id);
  };

  const handleAddEra = () => {
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const tlStart = timelineData.file.start;
    const tlEnd = timelineData.file.end;
    const range = tlEnd - tlStart;
    const duration = Math.max(1, Math.floor(range / 3));

    const topLevelEras = timelineData.elements
      .filter((el) => el.type === "era")
      .sort((a, b) => a.start - b.start);

    const isFree = (s, e) => !topLevelEras.some((era) => s < era.end && e > era.start);

    // Try placing after each existing top-level era, then at timeline start
    const candidates = [tlStart, ...topLevelEras.map((era) => era.end)];
    let start = tlStart;
    let end = clamp(tlStart + duration, tlStart, tlEnd);
    for (const candidate of candidates) {
      const s = clamp(candidate, tlStart, tlEnd);
      const e = clamp(s + duration, tlStart, tlEnd);
      if (e > s && isFree(s, e)) {
        start = s;
        end = e;
        break;
      }
    }

    const eraId = generateUniqueRandomElementId(timelineData.elements, "era");
    const newEra = {
      id: eraId,
      type: "era",
      title: "New Era",
      start,
      end,
      color: "#F4D05A",
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newEra],
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(newEra.id);
    setEditRequestId(newEra.id);
  };

  const handleDuplicateElement = (elementId) => {
    setTimelineData((prevData) => {
      const original = prevData.elements.find((el) => el.id === elementId);
      if (!original) return prevData;

      const nextTitle = `${original.title} Copy`;
      const nextId = generateUniqueRandomElementId(prevData.elements, original.type);

      const baseCopy = {
        ...original,
        id: nextId,
        title: nextTitle,
      };

      if (original.type === "span") {
        delete baseCopy.parent;
        delete baseCopy.extendFrom;
        delete baseCopy.mergeParent;
      }

      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, baseCopy],
      };

      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);

      return updatedData;
    });
  };

  const handleDelete = (elementId) => {
    setTimelineData((prevData) => {
      const toDelete = new Set([elementId]);
      const filteredElements = prevData.elements.filter((el) => !toDelete.has(el.id));

      const cleanedElements = filteredElements.map(el => {
        if (el.type === "event" && el.parents?.includes(elementId)) {
          return {
            ...el,
            parents: el.parents.filter(id => id !== elementId),
          };
        }

        if (el.type === "span" && (el.parent === elementId || el.extendFrom === elementId || el.mergeParent === elementId)) {
          const cleaned = { ...el };
          if (cleaned.parent === elementId) delete cleaned.parent;
          if (cleaned.extendFrom === elementId) delete cleaned.extendFrom;
          if (cleaned.mergeParent === elementId) delete cleaned.mergeParent;
          return cleaned;
        }

        return el;
      });

      const updatedData = {
        ...prevData,
        elements: cleanedElements,
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(null);
  };

  const handleUpdateTimeline = ({
    title,
    start,
    end,
    detailLevel,
    negID,
    posID,
    theme,
    font,
    startLabel,
    endLabel,
    useMonths,
    scaleSections,
    layout,
    branchOrdering,
    fixedEventHeight,
    compactEvents,
    thinConnectors,
    eventLinesToGroupBottom,
    hideDecimals,
    showGrid,
    useWikipedia,
    useMaps,
    mapTileUrl,
  }) => {
    const parsedStart = parseTimelineInput(start);
    const parsedEnd = parseTimelineInput(end);
    setTimelineData((prevData) => {
      const oldTimelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      const nextTimelineId = title
        ? generateIdFromTitle(title, "timeline").replace(/^timeline-/, "")
        : oldTimelineId;
      const applyMonthSnap = useMonths === true;
      const startValue = parsedStart.value ?? prevData.file.start;
      const endValue = parsedEnd.value ?? prevData.file.end;
      const nextFile = {
        ...prevData.file,
        id: `${nextTimelineId}-timeline`,
        title,
        start:
          applyMonthSnap && parsedStart.precision !== "day"
            ? snapToMonthGrid(startValue)
            : startValue,
        end:
          applyMonthSnap && parsedEnd.precision !== "day"
            ? snapToMonthGrid(endValue)
            : endValue,
        detailLevel,
        negID,
        posID,
        theme,
        font,
        startLabel,
        endLabel,
        useMonths,
        scaleSections,
        layout,
        branchOrdering,
        fixedEventHeight,
        compactEvents,
        thinConnectors,
        eventLinesToGroupBottom,
        hideDecimals,
        showGrid,
        useWikipedia,
        useMaps,
        mapTileUrl,
      };

      // Clean up legacy breaks field when saving with new scaleSections
      delete nextFile.breaks;
      if (!startLabel) delete nextFile.startLabel;
      if (!endLabel) delete nextFile.endLabel;
      if (useMonths === undefined) delete nextFile.useMonths;
      if (!scaleSections || scaleSections.length === 0) delete nextFile.scaleSections;
      if (!layout) delete nextFile.layout;
      if (!branchOrdering) delete nextFile.branchOrdering;
      if (!fixedEventHeight) delete nextFile.fixedEventHeight;
      if (!compactEvents) delete nextFile.compactEvents;
      if (!thinConnectors) delete nextFile.thinConnectors;
      if (!eventLinesToGroupBottom) delete nextFile.eventLinesToGroupBottom;
      if (!hideDecimals) delete nextFile.hideDecimals;
      if (!showGrid) delete nextFile.showGrid;
      if (!useWikipedia) delete nextFile.useWikipedia;
      if (!useMaps) delete nextFile.useMaps;
      if (!mapTileUrl) delete nextFile.mapTileUrl;
      if (!font || String(font).toLowerCase() === "default") delete nextFile.font;

      const updatedData = {
        ...prevData,
        file: nextFile,
      };

      if (nextTimelineId !== oldTimelineId) {
        renameTimeline({ oldId: oldTimelineId, newId: nextTimelineId }).catch(console.error);
        setCurrentTimelineId(nextTimelineId);
      }

      saveTimeline(updatedData, nextTimelineId).catch(console.error);

      return updatedData;
    });
  };

  const handleUpdateGroups = (nextGroups) => {
    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        file: {
          ...prevData.file,
          groups: nextGroups,
        },
      };
      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimeline(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(timelineData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${timelineData.file?.id || 'timeline'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = () => {
    // Open the export PNG modal
    setIsExportPngModalOpen(true);
  };

  const handleExportPng = (options) => {
    setExportPngOptions(options);
    setDownloadPngTrigger(prev => prev + 1);
  };

  const handleDownloadVideo = () => {
    setIsExportVideoModalOpen(true);
  };

  const handleLoadTimeline = async (timelineId) => {
    try {
      let loadedTimeline;

      if (timelineId.startsWith('cloud:')) {
        const backendId = timelineId.slice('cloud:'.length);
        let serverData = null;
        let serverUpdatedAt = null;

        try {
          const result = await apiGetTimelineById(backendId);
          if (result.success) {
            const contentJson = result.data?.contentJson ?? result.data?.data;
            if (contentJson) {
              serverData = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
              serverUpdatedAt = result.data?.updatedAt ?? null;
            }
          }
        } catch { /* offline */ }

        if (serverData) {
          // Don't overwrite unsynced local changes with server data — the user's
          // edits would be silently lost if they reopen the timeline before syncing.
          const existingCached = await loadCloudCache(backendId);
          const existingMeta = existingCached?.meta;
          if (existingMeta?.syncStatus === 'unsynced' && existingCached.data) {
            cloudMetaRef.current = existingMeta;
            loadedTimeline = existingCached.data;
          } else {
            const meta = {
              backendId,
              title: serverData.file?.title,
              lastServerUpdatedAt: serverUpdatedAt,
              localUpdatedAt: serverUpdatedAt,
              syncStatus: 'synced',
              conflictFileId: existingMeta?.conflictFileId ?? null,
            };
            await saveCloudCache(backendId, serverData, meta);
            cloudMetaRef.current = meta;
            loadedTimeline = serverData;
          }
        } else {
          // Offline fallback
          const cached = await loadCloudCache(backendId);
          if (!cached.data) throw new Error('Offline and no cached version available.');
          const offlineMeta = { ...(cached.meta ?? { backendId }), syncStatus: 'offline' };
          await updateCloudMeta(backendId, offlineMeta);
          cloudMetaRef.current = offlineMeta;
          loadedTimeline = cached.data;
        }
      } else {
        if (!window.electron?.loadTimeline) {
          throw new Error("Timeline loading is only available in the desktop app.");
        }
        loadedTimeline = await window.electron.loadTimeline(timelineId);
      }

      setTimelineData(normalizeTimelineData(loadedTimeline));
      setPinnedTags(Array.isArray(loadedTimeline.file?.pinnedTags) ? loadedTimeline.file.pinnedTags : []);
      setCurrentTimelineId(timelineId);
      setSelectedId(null);
    } catch (error) {
      console.error('Failed to load timeline:', error);
      alert(`Failed to load timeline: ${error.message}`);
    }
  };

  const handleBackToHome = () => {
    setTimelineData(null);
    setCurrentTimelineId(null);
    setSelectedId(null);
    setPinnedTags([]);
    setIsSettingsOpen(false);
    setIsAppSettingsOverlayOpen(false);
    setReturnToProjectSettings(false);
    setIsProjectSettingsCovered(false);
    setHomeSettingsSignal(0);
  };

  const handleNewTimeline = () => {
    setIsNewTimelineModalOpen(true);
  };

  const handleCreateTimeline = async (timelineConfig) => {
    setIsNewTimelineModalOpen(false);

    // Create new timeline data structure
    const timelineId = generateIdFromTitle(timelineConfig.title, "timeline").replace(/^timeline-/, "");
    const newTimeline = {
      file: {
        id: `${timelineId}-timeline`,
        type: "timeline",
        title: timelineConfig.title,
        appVersion: "0.3.0-alpha.1",
        start: timelineConfig.start,
        end: timelineConfig.end,
        detailLevel: timelineConfig.detailLevel,
        theme: timelineConfig.theme || defaultThemeKey,
        startLabel: timelineConfig.startLabel,
        endLabel: timelineConfig.endLabel,
        layout: timelineConfig.layout || "Horizontal",
        branchOrdering: timelineConfig.branchOrdering || "later-first",
        groups: [DEFAULT_GROUP],
      },
      elements: []
    };

    if (!timelineConfig.startLabel) delete newTimeline.file.startLabel;
    if (!timelineConfig.endLabel) delete newTimeline.file.endLabel;

    // Save to file system
    try {
      await saveTimelineToFile(newTimeline, timelineId);

      // Load the newly created timeline
      setTimelineData(newTimeline);
      setCurrentTimelineId(timelineId);
      setSelectedId(null);
    } catch (error) {
      console.error('Failed to create timeline:', error);
      alert(`Failed to create timeline: ${error.message}`);
    }
  };

  const handleDuplicateTimeline = async () => {
    if (!timelineData || !currentTimelineId) return;

    try {
      // Create duplicate with new name
      const duplicateName = `${timelineData.file.title} Copy`;
      const duplicateId = generateIdFromTitle(duplicateName, "timeline").replace(/^timeline-/, "");

      const duplicateData = {
        ...timelineData,
        file: {
          ...timelineData.file,
          id: `${duplicateId}-timeline`,
          title: duplicateName,
        },
      };

      // Save the duplicate
      await saveTimeline(duplicateData, duplicateId);

      // Load the newly created duplicate
      setTimelineData(duplicateData);
      setCurrentTimelineId(duplicateId);
      setSelectedId(null);
    } catch (error) {
      console.error('Failed to duplicate timeline:', error);
      alert(`Failed to duplicate timeline: ${error.message}`);
    }
  };

  const isElectron = window.electron !== undefined;

  const resolveThemeKey = useCallback((value, fallback = defaultThemeKey) => {
    if (!value) return fallback;
    const lower = String(value).toLowerCase();
    if (lower === "default") return fallback;
    const match = Object.keys(themeConfig.themes || {}).find(
      (key) => key.toLowerCase() === lower
    );
    return match || fallback;
  }, [defaultThemeKey, themeConfig]);

  const resolveFontStack = (family) => {
    const fallback =
      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    if (!family) return fallback;
    const normalized = String(family);
    const lower = normalized.toLowerCase();
    if (lower === "default") return fallback;
    if (lower === "system") {
      return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }
    const safeName = normalized.replace(/"/g, '\\"');
    return `"${safeName}", ${fallback}`;
  };

  const getThemeFont = useCallback((themeKeyValue) => {
    const theme = themeConfig.themes?.[themeKeyValue];
    if (!theme?.font?.family) return null;
    return {
      family: theme.font.family,
      cssUrl: theme.font.cssUrl,
    };
  }, [themeConfig]);

  const resolveFontChoice = (setting, themeFont) => {
    const normalized = String(setting || "").trim();
    const lower = normalized.toLowerCase();
    if (!normalized || lower === "default") {
      if (themeFont?.family) {
        return {
          family: themeFont.family,
          source: "theme",
          cssUrl: themeFont.cssUrl,
        };
      }
      return { family: "Inter", source: "inter" };
    }
    if (lower === "system") {
      return { family: "system", source: "system" };
    }
    return { family: normalized, source: "user" };
  };

  useEffect(() => {
    let isMounted = true;

    const loadAppSettings = async () => {
      const [settings, savedKeybinds] = await Promise.all([getAppSettings(), loadKeybinds()]);
      if (!isMounted) return;
      setAppThemePreference(settings?.theme || defaultThemeKey);
      const storedTimelineDir = settings?.timelineStorageDir ?? settings?.storageDir ?? "";
      const storedNotesDir = settings?.notesStorageDir ?? "";
      const storedNotesSubfolder = settings?.notesSubfolder ?? "";
      const storedNotesSubfolderEnabled = settings?.notesSubfolderEnabled ?? false;
      const storedFontFamily = settings?.appFontFamily ?? "Inter";
      const storedFontSize = settings?.appFontSize ?? 14;
      setTimelineStorageDir(storedTimelineDir);
      setNotesStorageDir(storedNotesDir);
      setNotesSubfolder(storedNotesSubfolder);
      setNotesSubfolderEnabled(storedNotesSubfolderEnabled);
      setAppFontFamily(storedFontFamily);
      setAppFontSize(storedFontSize);
      setKeybinds(savedKeybinds);
    };

    loadAppSettings();
    return () => {
      isMounted = false;
    };
  }, [defaultThemeKey]);

  useEffect(() => {
    const resolved = resolveThemeKey(appThemePreference);
    setAppThemeKey(resolved);
  }, [appThemePreference, resolveThemeKey]);

  useEffect(() => {
    if (!timelineData) {
      setThemeKey(appThemeKey);
    }
  }, [appThemeKey, timelineData]);

  useEffect(() => {
    applyTheme(themeConfig, themeKey);
  }, [themeKey, themeConfig]);

  useEffect(() => {
    const styleId = "user-fonts";
    const style =
      document.getElementById(styleId) || document.createElement("style");
    style.id = styleId;
    const css = (availableFonts || [])
      .map((font) => {
        const name = String(font.name || "").replace(/"/g, '\\"');
        if (!name || !font.fileUrl) return "";
        const isItalic = /italic/i.test(name);
        return `@font-face{font-family:"${name}";src:url("${font.fileUrl}") format("${font.format}");font-weight:normal;font-style:${isItalic ? "italic" : "normal"};font-display:swap;}`;
      })
      .filter(Boolean)
      .join("\n");
    style.textContent = css;
    if (!style.parentNode) {
      document.head.appendChild(style);
    }
  }, [availableFonts]);

  useEffect(() => {
    const themeFont = getThemeFont(themeKey);
    const appChoice = resolveFontChoice(appFontFamily, themeFont);
    const timelineSetting = timelineData?.file?.font;
    const useAppFont =
      !timelineSetting || String(timelineSetting).toLowerCase() === "default";
    const timelineChoice = useAppFont
      ? appChoice
      : resolveFontChoice(timelineSetting, null);
    const finalChoice = timelineData ? timelineChoice : appChoice;

    document.documentElement.style.setProperty(
      "--app-font-family",
      resolveFontStack(finalChoice.family)
    );
    document.documentElement.style.setProperty(
      "--app-font-size",
      `${Number(appFontSize) || 14}px`
    );
    document.documentElement.style.setProperty(
      "--app-font-scale",
      String((Number(appFontSize) || 14) / 14)
    );

    const linkId = "theme-font-css";
    const existing = document.getElementById(linkId);
    if (finalChoice.source === "theme" && finalChoice.cssUrl) {
      if (existing) {
        if (existing.getAttribute("href") !== finalChoice.cssUrl) {
          existing.setAttribute("href", finalChoice.cssUrl);
        }
      } else {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = finalChoice.cssUrl;
        document.head.appendChild(link);
      }
    } else if (existing) {
      existing.remove();
    }
  }, [
    appFontFamily,
    appFontSize,
    timelineData,
    timelineData?.file?.font,
    themeKey,
    themeConfig,
    getThemeFont,
  ]);

  useEffect(() => {
    if (timelineData?.file) {
      setThemeKey(resolveThemeKey(timelineData.file.theme, appThemeKey));
      return;
    }
    setThemeKey(appThemeKey);
  }, [timelineData?.file, appThemeKey, resolveThemeKey]);

  const handleAppThemeChange = async (nextThemeKey) => {
    setAppThemePreference(nextThemeKey);
    const resolved = resolveThemeKey(nextThemeKey);
    setAppThemeKey(resolved);
    await saveAppSettings({
      theme: nextThemeKey,
      timelineStorageDir,
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled,
      appFontFamily,
      appFontSize,
    });
  };

  const handleOpenAppSettingsFromProject = () => {
    setReturnToProjectSettings(true);
    setIsProjectSettingsCovered(true);
    setIsAppSettingsOverlayOpen(true);
    setIsSettingsOpen(true);
    setHomeSettingsSignal((value) => value + 1);
  };

  const handleOpenCloudSettings = () => {
    if (timelineData) {
      setIsAppSettingsOverlayOpen(true);
    }
    setOpenCloudSettingsSignal((v) => v + 1);
  };

  const handleAppSettingsClosedFromHome = () => {
    setIsProjectSettingsCovered(false);
    setIsAppSettingsOverlayOpen(false);
    setIsSettingsOpen(returnToProjectSettings);
    setReturnToProjectSettings(false);
    setOpenCloudSettingsSignal(0);
  };

  const handleTimelineStorageDirChange = async (nextDir) => {
    setTimelineStorageDir(nextDir || "");
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir: nextDir || "",
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled,
      appFontFamily,
      appFontSize,
    });
  };

  const handleNotesStorageDirChange = async (nextDir) => {
    setNotesStorageDir(nextDir || "");
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir,
      notesStorageDir: nextDir || "",
      notesSubfolder,
      notesSubfolderEnabled,
      appFontFamily,
      appFontSize,
    });
  };

  const handleNotesSubfolderChange = async (nextValue) => {
    const next = nextValue || "";
    setNotesSubfolder(next);
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir,
      notesStorageDir,
      notesSubfolder: next,
      notesSubfolderEnabled,
      appFontFamily,
      appFontSize,
    });
  };

  const handleNotesSubfolderEnabledChange = async (nextEnabled) => {
    setNotesSubfolderEnabled(nextEnabled);
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir,
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled: nextEnabled,
      appFontFamily,
      appFontSize,
    });
  };

  const handleAppFontSizeChange = async (nextSize) => {
    const next = Number(nextSize) || 14;
    setAppFontSize(next);
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir,
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled,
      appFontFamily,
      appFontSize: next,
    });
  };

  const handleAppFontChange = async (nextFont) => {
    setAppFontFamily(nextFont);
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir,
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled,
      appFontFamily: nextFont,
      appFontSize,
    });
  };

  const handlePickTimelinesDir = async () => {
    const result = await chooseTimelinesDir();
    if (result?.success && result.path) {
      await handleTimelineStorageDirChange(result.path);
    }
  };

  const handlePickNotesDir = async () => {
    const result = await chooseNotesDir();
    if (result?.success && result.path) {
      await handleNotesStorageDirChange(result.path);
    }
  };

  const handlePickNotesSubfolder = async () => {
    const result = await chooseNotesSubfolder();
    if (result?.success && result.subfolder) {
      await handleNotesSubfolderChange(result.subfolder);
    }
  };

  const handleOpenFontsFolder = async () => {
    await openFontsFolder();
  };

  const filteredElements = useMemo(() => {
    if (!timelineData) return [];
    if (activeTags.length === 0 && hiddenTags.length === 0) return timelineData.elements;
    const showSet = new Set(activeTags);
    const hideSet = new Set(hiddenTags);
    return timelineData.elements.filter((element) => {
      if (element.type !== "event" && element.type !== "span") {
        return true;
      }
      const tags = Array.isArray(element.tags) ? element.tags : [];

      if (tags.some((tag) => hideSet.has(tag))) {
        return false;
      }

      if (showSet.size === 0) {
        return true;
      }

      return tags.some((tag) => showSet.has(tag));
    });
  }, [timelineData, activeTags, hiddenTags]);

  const filteredTimelineData = useMemo(() => ({
    ...timelineData,
    elements: filteredElements,
  }), [timelineData, filteredElements]);

  const allTags = useMemo(() => {
    if (!timelineData?.elements) return [];
    const tags = new Set();
    timelineData.elements.forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      if (Array.isArray(element.tags)) {
        element.tags.forEach((tag) => {
          if (tag) tags.add(tag);
        });
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [timelineData]);

  useEffect(() => {
    setPinnedTags((prev) => prev.filter((tag) => allTags.includes(tag)));
  }, [allTags]);

  useEffect(() => {
    setHiddenTags((prev) => prev.filter((tag) => allTags.includes(tag)));
  }, [allTags]);

  useEffect(() => {
    if (!selectedId) return;
    const isVisible = filteredElements.some((el) => el.id === selectedId);
    if (!isVisible) {
      setSelectedId(null);
    }
  }, [filteredElements, selectedId]);

  useEffect(() => {
    if (!selectedId || !timelineData) return;

    const compareElementsByTimelineOrder = (a, b) => {
      if (a.type === "event" && b.type === "event") {
        if ((a.date ?? 0) !== (b.date ?? 0)) return (a.date ?? 0) - (b.date ?? 0);
        return String(a.id).localeCompare(String(b.id));
      }
      if (a.type === "span" && b.type === "span") {
        if ((a.start ?? 0) !== (b.start ?? 0)) return (a.start ?? 0) - (b.start ?? 0);
        if ((a.end ?? 0) !== (b.end ?? 0)) return (a.end ?? 0) - (b.end ?? 0);
        return String(a.id).localeCompare(String(b.id));
      }
      if (a.type === "era" && b.type === "era") {
        if ((a.start ?? 0) !== (b.start ?? 0)) return (a.start ?? 0) - (b.start ?? 0);
        if ((a.end ?? 0) !== (b.end ?? 0)) return (b.end ?? 0) - (a.end ?? 0);
        return String(a.id).localeCompare(String(b.id));
      }
      return 0;
    };

    const handleSelectionNavigation = (e) => {
      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;

      const selectedElement = filteredElements.find((element) => element.id === selectedId);
      if (!selectedElement) return;

      const sameTypeElements = filteredElements
        .filter((element) => element.type === selectedElement.type)
        .sort(compareElementsByTimelineOrder);
      const currentIndex = sameTypeElements.findIndex((element) => element.id === selectedId);
      if (currentIndex === -1) return;

      if (matchesKeybind(e, keybinds.selectPrevious)) {
        const previous = sameTypeElements[currentIndex - 1];
        if (!previous) return;
        e.preventDefault();
        handleSelect(previous.id);
      } else if (matchesKeybind(e, keybinds.selectNext)) {
        const next = sameTypeElements[currentIndex + 1];
        if (!next) return;
        e.preventDefault();
        handleSelect(next.id);
      }
    };

    window.addEventListener("keydown", handleSelectionNavigation);
    return () => window.removeEventListener("keydown", handleSelectionNavigation);
  }, [selectedId, timelineData, filteredElements, keybinds]);

  // Show HomePage if no timeline is loaded
  if (!timelineData) {
    return (
      <>
        <TopBar title="Timelines" />
        <div className={`app-shell ${isElectron ? 'with-title-bar' : ''}`}>
          <HomePage
            onSelectTimeline={handleLoadTimeline}
            onCreateTimeline={handleCreateTimeline}
            appThemeKey={appThemeKey}
            themes={themeConfig.themes}
            onAppThemeChange={handleAppThemeChange}
            appFontFamily={appFontFamily}
            appFontSize={appFontSize}
            fonts={availableFonts}
            timelineStorageDir={timelineStorageDir}
            notesStorageDir={notesStorageDir}
            notesSubfolder={notesSubfolder}
            notesSubfolderEnabled={notesSubfolderEnabled}
            onTimelineStorageDirChange={handleTimelineStorageDirChange}
            onNotesStorageDirChange={handleNotesStorageDirChange}
            onNotesSubfolderChange={handleNotesSubfolderChange}
            onNotesSubfolderEnabledChange={handleNotesSubfolderEnabledChange}
            onPickNotesSubfolder={handlePickNotesSubfolder}
            onPickTimelinesDir={handlePickTimelinesDir}
            onPickNotesDir={handlePickNotesDir}
            onOpenFontsFolder={handleOpenFontsFolder}
            onAppFontChange={handleAppFontChange}
            onAppFontSizeChange={handleAppFontSizeChange}
            onRefreshThemes={refreshUserThemes}
            openSettingsSignal={homeSettingsSignal}
            openCloudSettingsSignal={openCloudSettingsSignal}
            onAppSettingsClosed={handleAppSettingsClosedFromHome}
            keybinds={keybinds}
            onKeybindsChange={setKeybinds}
          />
        </div>
        {sessionExpired && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#c0392b', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999, fontSize: 'var(--text-sm)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <span>Session expired. <button onClick={handleOpenCloudSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', textDecoration: 'underline', fontSize: 'inherit' }}>Log back in</button> to sync.</span>
            <button onClick={() => setSessionExpired(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#fff', opacity: 0.7 }}>✕</button>
          </div>
        )}
      </>
    );
  }

  const selectedElement = timelineData.elements.find((el) => el.id === selectedId);

  return (
    <>
      <TopBar
        title={timelineData.file?.title || "Timelines"}
        isLeftCollapsed={isLeftCollapsed}
        onToggleLeft={() => setIsLeftCollapsed((v) => !v)}
        showRightToggle={Boolean(selectedId)}
        isRightCollapsed={isRightCollapsed}
        onToggleRight={() => setIsRightCollapsed((v) => !v)}
      />
      <div className={`app-shell ${isElectron ? 'with-title-bar' : ''}`}>
      <div
        className="sidebar-resizer overlay-resizer"
        style={{ left: `${currentLeftWidth - 3}px` }}
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingLeft.current = true;
          document.body.classList.add("dragging");
        }}
      />

      <aside
        className="app-sidebar overlay-sidebar"
        style={{ width: isLeftCollapsed ? COLLAPSED_WIDTH : sidebarWidth }}
      >
        <ErrorBoundary name="Sidebar">
        <Sidebar
          isCollapsed={isLeftCollapsed}
          onToggle={() => setIsLeftCollapsed((v) => !v)}
          selectedId={selectedId}
          onSelect={handleSelect}
          timelineData={filteredTimelineData}
          allElements={timelineData.elements}
          activeTags={activeTags}
          hiddenTags={hiddenTags}
          onToggleTag={handleToggleTag}
          onToggleHiddenTag={handleToggleHiddenTag}
          onClearTags={handleClearTags}
          pinnedTags={pinnedTags}
          onTogglePinnedTag={handleTogglePinnedTag}
          onAddGroup={handleAddGroup}
          onUpdateGroup={handleUpdateGroup}
          onUpdateGroups={handleUpdateGroups}
          onDeleteGroup={handleDeleteGroup}
          tagColors={timelineData.file?.tagColors || {}}
          onUpdateTagColor={handleUpdateTagColor}
          onAddEvent={handleAddEvent}
          onAddSpan={handleAddSpan}
          onAddEra={handleAddEra}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDownloadJson={handleDownloadJSON}
          onDownloadPng={handleDownloadPNG}
          onDownloadVideo={handleDownloadVideo}
          onLoadTimeline={handleLoadTimeline}
          onNewTimeline={handleNewTimeline}
          onDuplicateTimeline={handleDuplicateTimeline}
          onBackToHome={handleBackToHome}
          onDelete={handleRequestDelete}
          onDuplicateElement={handleDuplicateElement}
          onEditElement={handleEditElement}
        />
        </ErrorBoundary>
      </aside>

      <main
        className="app-content"
        style={{ display: isRightMaximized ? "none" : "block" }}
      >
          <ErrorBoundary name="Timeline">
          <TimelineView
            ref={timelineViewRef}
            selectedId={selectedId}
            onSelect={handleSelect}
            timelineData={filteredTimelineData}
            onAddEvent={handleAddEvent}
            onAddSpan={handleAddSpan}
            onAddEra={handleAddEra}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDelete={handleRequestDelete}
            onDuplicateElement={handleDuplicateElement}
            onEditElement={handleEditElement}
            downloadPngTrigger={downloadPngTrigger}
            exportPngOptions={exportPngOptions}
            onExportPng={handleDownloadPNG}
            onExportVideo={handleDownloadVideo}
            rightPanelWidth={rightWidth}
            isRightPanelOpen={Boolean(selectedId) && !isRightCollapsed}
            leftPanelWidth={currentLeftWidth}
            isLeftPanelOpen={!isLeftCollapsed}
            activeTags={activeTags}
            hiddenTags={hiddenTags}
            allTags={allTags}
            onToggleTag={handleToggleTag}
            onToggleHiddenTag={handleToggleHiddenTag}
            onClearTags={handleClearTags}
            pinnedTags={pinnedTags}
            onTogglePinnedTag={handleTogglePinnedTag}
            onViewportYearChange={setViewportYear}
            tagColors={timelineData.file?.tagColors || {}}
            keybinds={keybinds}
          />
          </ErrorBoundary>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenAppSettings={handleOpenAppSettingsFromProject}
        isCovered={isProjectSettingsCovered}
        timelineData={timelineData}
        onUpdateTimeline={handleUpdateTimeline}
        themeKey={themeKey}
        defaultThemeKey={defaultThemeKey}
        themes={themeConfig.themes}
        fonts={availableFonts}
        onThemeChange={setThemeKey}
      />

      {isAppSettingsOverlayOpen && (
        <HomePage
          settingsOnly
          reuseExistingBackdrop={returnToProjectSettings}
          onSelectTimeline={handleLoadTimeline}
          onCreateTimeline={handleCreateTimeline}
          appThemeKey={appThemeKey}
          themes={themeConfig.themes}
          onAppThemeChange={handleAppThemeChange}
          appFontFamily={appFontFamily}
          appFontSize={appFontSize}
          fonts={availableFonts}
          timelineStorageDir={timelineStorageDir}
          notesStorageDir={notesStorageDir}
          notesSubfolder={notesSubfolder}
          notesSubfolderEnabled={notesSubfolderEnabled}
          onTimelineStorageDirChange={handleTimelineStorageDirChange}
          onNotesStorageDirChange={handleNotesStorageDirChange}
          onNotesSubfolderChange={handleNotesSubfolderChange}
          onNotesSubfolderEnabledChange={handleNotesSubfolderEnabledChange}
          onPickNotesSubfolder={handlePickNotesSubfolder}
          onPickTimelinesDir={handlePickTimelinesDir}
          onPickNotesDir={handlePickNotesDir}
          onOpenFontsFolder={handleOpenFontsFolder}
          onAppFontChange={handleAppFontChange}
          onAppFontSizeChange={handleAppFontSizeChange}
          onRefreshThemes={refreshUserThemes}
          openSettingsSignal={homeSettingsSignal}
          openCloudSettingsSignal={openCloudSettingsSignal}
          onAppSettingsClosed={handleAppSettingsClosedFromHome}
          keybinds={keybinds}
          onKeybindsChange={setKeybinds}
        />
      )}

      {selectedId && (
        <>
          {!isRightMaximized && !isRightCollapsed && (
            <div
              className="right-resizer overlay-resizer"
              style={{ right: `${Math.max(rightWidth, MIN_WIDTH) - 3}px` }}
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingRight.current = true;
                rightMaxReachedRef.current = false;
                rightReversedAfterMaxRef.current = false;
                rightLastDistanceRef.current = null;
                document.body.classList.add("dragging");
              }}
            />
          )}

          {isRightCollapsed && (
            <div
              className="right-resizer overlay-resizer"
              style={{ right: "-3px" }}
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingRight.current = true;
                rightMaxReachedRef.current = false;
                rightReversedAfterMaxRef.current = false;
                rightLastDistanceRef.current = null;
                document.body.classList.add("dragging");
              }}
            />
          )}

          {!isRightCollapsed && (
            <aside
              className="app-right overlay-right"
              style={{
                width: isRightMaximized
                  ? `calc(100% - ${currentLeftWidth}px)`
                  : rightWidth
              }}
            >
              <ErrorBoundary name="Right panel">
              <RightPanel
                onSelect={handleSelect}
                selectedElement={selectedElement}
                onUpdate={handleUpdate}
                timelineData={timelineData}
                editRequestId={editRequestId}
                onEditRequestHandled={() => setEditRequestId(null)}
                isMaximized={isRightMaximized}
                onToggleMaximize={() => setIsRightMaximized((prev) => !prev)}
                onFilterByTag={handleFilterByTag}
                activeTags={activeTags}
                onToggleTag={handleToggleTag}
                onUpdateGroups={handleUpdateGroups}
                tagColors={timelineData.file?.tagColors || {}}
              />
              </ErrorBoundary>
            </aside>
          )}
        </>
      )}

      {deleteElementDialog && (
        <div
          className="settings-backdrop"
          onClick={() => setDeleteElementDialog(null)}
        >
          <div
            className="settings-modal confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-header">
              <h2 className="settings-title">DELETE {deleteElementDialog.type?.toUpperCase()}</h2>
              <button
                className="settings-back-button"
                onClick={() => setDeleteElementDialog(null)}
                aria-label="Close delete dialog"
              >
                Close
              </button>
            </div>

            <div className="confirm-content">
              <p className="confirm-text">
                Are you sure you want to delete "{deleteElementDialog.title}"? This cannot be
                undone.
              </p>
              <label className="confirm-checkbox">
                <input
                  type="checkbox"
                  checked={deleteElementWithNotes}
                  disabled={!deleteElementDialog.noteFile}
                  onChange={(e) => setDeleteElementWithNotes(e.target.checked)}
                />
                Also delete linked note file
              </label>
            </div>

            <div className="confirm-actions">
              <button
                className="settings-folder-button"
                onClick={() => setDeleteElementDialog(null)}
              >
                Cancel
              </button>
              <button
                className="settings-folder-button confirm-delete-button"
                onClick={handleConfirmDeleteElement}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <NewTimelineModal
        isOpen={isNewTimelineModalOpen}
        onClose={() => setIsNewTimelineModalOpen(false)}
        onCreate={handleCreateTimeline}
      />

      <ExportPngModal
        isOpen={isExportPngModalOpen}
        onClose={() => setIsExportPngModalOpen(false)}
        onExport={handleExportPng}
        timelineData={timelineData}
        timelineViewRef={timelineViewRef}
      />

      <ExportVideoModal
        isOpen={isExportVideoModalOpen}
        onClose={() => setIsExportVideoModalOpen(false)}
        timelineData={timelineData}
        timelineViewRef={timelineViewRef}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        elements={timelineData?.elements ?? []}
        onSelect={handleSearchSelect}
        fileSettings={timelineData?.file}
      />
      </div>
      {sessionExpired && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#c0392b', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999, fontSize: 'var(--text-sm)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <span>Session expired. <button onClick={handleOpenCloudSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', textDecoration: 'underline', fontSize: 'inherit' }}>Log back in</button> to sync.</span>
          <button onClick={() => setSessionExpired(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#fff', opacity: 0.7 }}>✕</button>
        </div>
      )}
    </>
  );
}

export default App;


