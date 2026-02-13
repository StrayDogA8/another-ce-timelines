import * as ReactRuntime from "react";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import TimelineView from "./components/TimelineView";
import TimelineScrollbar from "./components/TimelineScrollbar";
import ActivityBar from "./components/ActivityBar";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import SettingsModal from "./components/SettingsModal";
import NewTimelineModal from "./components/NewTimelineModal";
import ExportPngModal from "./components/ExportPngModal";
import TopBar from "./components/TopBar";
import HomePage from "./components/HomePage";
import {
  saveTimelineToFile,
  chooseTimelinesDir,
  chooseNotesDir,
  chooseNotesSubfolder,
  listFonts,
  openFontsFolder,
  renameNote,
  deleteNote,
  renameTimeline,
  listPlugins,
  openPluginsFolder,
  readPluginModule,
} from "./utils/electronApi";
import { updateElementWithNewId, makeUniqueId, generateIdFromTitle } from "./utils/idUtils";
import { applyTheme, getInitialThemeKey } from "./utils/theme";
import { loadThemeConfig } from "./utils/themeLoader";
import { getAppSettings, saveAppSettings } from "./utils/appSettings";
import { parseTimelineInput, snapToMonthGrid } from "./utils/dateUtils";
import { createPluginApi } from "./plugins/pluginApi";
import "./index.css";

class PluginErrorBoundary extends ReactRuntime.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return ReactRuntime.createElement("div", {
        style: {
          padding: "24px",
          color: "var(--dark-bg)",
          fontFamily: "inherit",
        },
      },
        ReactRuntime.createElement("h3", { style: { margin: "0 0 8px" } }, "Plugin crashed"),
        ReactRuntime.createElement("pre", {
          style: { fontSize: "12px", opacity: 0.7, whiteSpace: "pre-wrap" },
        }, String(this.state.error))
      );
    }
    return this.props.children;
  }
}

const BUILTIN_PLUGINS = [];

function App() {
  const [themeConfig, setThemeConfig] = useState(loadThemeConfig());
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 600;
  const ACTIVITY_BAR_WIDTH = 44;
  const DEFAULT_LEFT_WIDTH = 350;
  const DEFAULT_RIGHT_WIDTH = 385;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightMaximized, setIsRightMaximized] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteElementDialog, setDeleteElementDialog] = useState(null);
  const [deleteElementWithNotes, setDeleteElementWithNotes] = useState(false);
  const [downloadPngTrigger, setDownloadPngTrigger] = useState(0);
  const [timelineData, setTimelineData] = useState(null);
  const [currentTimelineId, setCurrentTimelineId] = useState(null);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [isExportPngModalOpen, setIsExportPngModalOpen] = useState(false);
  const [exportPngOptions, setExportPngOptions] = useState(null);
  const [editRequestId, setEditRequestId] = useState(null);
  const defaultThemeKey = getInitialThemeKey(themeConfig);
  const [themeKey, setThemeKey] = useState(defaultThemeKey);
  const [appThemeKey, setAppThemeKey] = useState(defaultThemeKey);
  const [appThemePreference, setAppThemePreference] = useState(defaultThemeKey);
  const [timelineStorageDir, setTimelineStorageDir] = useState("");
  const [notesStorageDir, setNotesStorageDir] = useState("");
  const [notesSubfolder, setNotesSubfolder] = useState("");
  const [notesSubfolderEnabled, setNotesSubfolderEnabled] = useState(false);
  const [pluginsRoot, setPluginsRoot] = useState("");
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [enabledPlugins, setEnabledPlugins] = useState({});
  const [pluginViews, setPluginViews] = useState([]);
  const [pluginActions, setPluginActions] = useState([]);
  const [pluginFields, setPluginFields] = useState([]);
  const [enabledBuiltinPlugins, setEnabledBuiltinPlugins] = useState(() => {
    const defaults = {};
    BUILTIN_PLUGINS.forEach((plugin) => {
      defaults[plugin.id] = true;
    });
    return defaults;
  });
  const [appFontFamily, setAppFontFamily] = useState("Inter");
  const [appFontSize, setAppFontSize] = useState(14);
  const [availableFonts, setAvailableFonts] = useState([]);
  const [activeTags, setActiveTags] = useState([]);
  const [viewportYear, setViewportYear] = useState(null);
  const [filterScope, setFilterScope] = useState({
    events: true,
    spans: true,
  });

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
  const loadedPluginsRef = useRef(new Map());

  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const timelineViewRef = useRef(null);
  const currentLeftWidth = ACTIVITY_BAR_WIDTH + (isLeftCollapsed ? 0 : sidebarWidth);

  const registerView = useCallback((view) => {
    if (!view?.id || !view?.component) return;
    setPluginViews((prev) => {
      const next = prev.filter((item) => item.id !== view.id);
      return [...next, view];
    });
  }, []);

  const unregisterView = useCallback((viewId) => {
    if (!viewId) return;
    setPluginViews((prev) => prev.filter((item) => item.id !== viewId));
  }, []);

  const registerAction = useCallback((action) => {
    if (!action?.id || !action?.icon) return;
    setPluginActions((prev) => {
      const next = prev.filter((item) => item.id !== action.id);
      return [...next, action];
    });
  }, []);

  const unregisterAction = useCallback((actionId) => {
    if (!actionId) return;
    setPluginActions((prev) => prev.filter((item) => item.id !== actionId));
  }, []);

  const RESERVED_FIELD_IDS = new Set([
    "id", "type", "title", "date", "dateLabel", "start", "startLabel",
    "end", "endLabel", "tags", "color", "textColor", "style", "noteFile",
    "parent", "image", "imageSize", "imagePosition",
    "__proto__", "constructor", "prototype", "toString", "valueOf",
  ]);

  const registerField = useCallback((field) => {
    if (!field?.id || !field?.label) return;
    if (typeof field.id !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(field.id)) {
      console.warn(`Plugin field id "${field.id}" rejected: must be alphanumeric`);
      return;
    }
    if (RESERVED_FIELD_IDS.has(field.id)) {
      console.warn(`Plugin field id "${field.id}" rejected: reserved property name`);
      return;
    }
    setPluginFields((prev) => {
      const next = prev.filter((item) => item.id !== field.id);
      return [...next, field];
    });
  }, []);

  const unregisterField = useCallback((fieldId) => {
    if (!fieldId) return;
    setPluginFields((prev) => prev.filter((item) => item.id !== fieldId));
  }, []);

  useEffect(() => {
    function handleMouseMove(e) {
      if (isDraggingLeft.current) {
        e.preventDefault();
        const dragX = e.clientX - ACTIVITY_BAR_WIDTH;
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
        const windowWidth = window.innerWidth;
        const distanceFromRight = windowWidth - e.clientX;
        const next = Math.min(
          Math.max(distanceFromRight, MIN_WIDTH),
          MAX_WIDTH
        );
        setRightWidth(next);
      }
    }

    function handleMouseUp() {
      if (isDraggingLeft.current || isDraggingRight.current) {
        isDraggingLeft.current = false;
        isDraggingRight.current = false;
        document.body.classList.remove("dragging");
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isLeftCollapsed]);

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
    function handleKeyDown(e) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();

        if (!timelineData?.elements) return;
        const element = timelineData.elements.find(el => el.id === selectedId);
        if (!element) return;

        handleRequestDelete(element.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedId, timelineData]);

  const pluginApi = useMemo(() => createPluginApi({
    getTimeline: () => timelineDataRef.current,
    setTimeline: (next) => setTimelineData(next),
    saveTimeline: async (data) => {
      const target = data ?? timelineDataRef.current;
      if (!target?.file) {
        return { success: false, error: "NO_TIMELINE" };
      }
      const timelineId = target.file?.id?.replace('-timeline', '') || 'timeline';
      return saveTimelineToFile(target, timelineId);
    },
    getSelectedId: () => selectedIdRef.current,
    setSelectedId: (next) => setSelectedId(next),
    getViewportInsets: () => ({
      leftOpen: !leftCollapsedRef.current,
      rightOpen: Boolean(selectedIdRef.current),
      leftWidth: leftWidthRef.current,
      rightWidth: rightWidthRef.current,
    }),
    registerView,
    unregisterView,
    registerAction,
    unregisterAction,
    registerField,
    unregisterField,
  }), [registerView, unregisterView, registerAction, unregisterAction, registerField, unregisterField]);

  useEffect(() => {
    window.timelinePluginApi = pluginApi;
    return () => {
      if (window.timelinePluginApi === pluginApi) {
        delete window.timelinePluginApi;
      }
    };
  }, [pluginApi]);

  useEffect(() => {
    window.TimelinesReact = ReactRuntime;
    return () => {
      if (window.TimelinesReact === ReactRuntime) {
        delete window.TimelinesReact;
      }
    };
  }, []);

  const loadInstalledPlugins = useCallback(async () => {
    const result = await listPlugins();
    if (result?.success) {
      setPluginsRoot(result.root || "");
      const plugins = Array.isArray(result.plugins) ? result.plugins : [];
      setInstalledPlugins(plugins);
      setEnabledPlugins((prev) => {
        const next = { ...prev };
        let changed = false;
        plugins.forEach((plugin) => {
          if (next[plugin.id] === undefined) {
            next[plugin.id] = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      return;
    }
    setInstalledPlugins([]);
    if (result?.root) {
      setPluginsRoot(result.root);
    }
  }, []);

  useEffect(() => {
    loadInstalledPlugins();
  }, [loadInstalledPlugins]);

  useEffect(() => {
    let cancelled = false;
    const loaded = loadedPluginsRef.current;

    const unloadPlugin = async (pluginId) => {
      const record = loaded.get(pluginId);
      if (!record) return;
      record.views.forEach((viewId) => unregisterView(viewId));
      if (record.actions) record.actions.forEach((actionId) => unregisterAction(actionId));
      if (record.fields) record.fields.forEach((fieldId) => unregisterField(fieldId));
      if (record.instance?.onunload) {
        try {
          await record.instance.onunload();
        } catch (error) {
          console.error("Failed to unload plugin:", pluginId, error);
        }
      }
      loaded.delete(pluginId);
    };

    const run = async () => {
      for (const plugin of installedPlugins) {
        if (cancelled) return;
        const enabled = enabledPlugins?.[plugin.id] !== false;
        const alreadyLoaded = loaded.has(plugin.id);
        if (enabled && !alreadyLoaded) {
          const views = new Set();
          const actions = new Set();
          const fields = new Set();
          loaded.set(plugin.id, { instance: null, views, actions, fields });
          try {
            const readResult = await readPluginModule(plugin.entryPath);
            if (!readResult?.success || !readResult.code) {
              throw new Error(readResult?.error || "Failed to read plugin module.");
            }
            const source = `${readResult.code}\n//# sourceURL=${readResult.entryPath || plugin.entryPath}`;
            const moduleUrl = URL.createObjectURL(
              new Blob([source], { type: "text/javascript" })
            );
            let module;
            try {
              module = await import(/* @vite-ignore */ moduleUrl);
            } finally {
              URL.revokeObjectURL(moduleUrl);
            }
            const scopedApi = {
              ...pluginApi,
              registerView: (view) => {
                if (!view?.id || !view?.component) return;
                const withMeta = { ...view, pluginId: plugin.id };
                registerView(withMeta);
                views.add(withMeta.id);
              },
              unregisterView: (viewId) => {
                unregisterView(viewId);
                views.delete(viewId);
              },
              registerAction: (action) => {
                if (!action?.id || !action?.icon) return;
                const withMeta = { ...action, pluginId: plugin.id };
                registerAction(withMeta);
                actions.add(withMeta.id);
              },
              unregisterAction: (actionId) => {
                unregisterAction(actionId);
                actions.delete(actionId);
              },
              registerField: (field) => {
                if (!field?.id || !field?.label) return;
                const withMeta = { ...field, pluginId: plugin.id };
                registerField(withMeta);
                fields.add(withMeta.id);
              },
              unregisterField: (fieldId) => {
                unregisterField(fieldId);
                fields.delete(fieldId);
              },
            };

            let instance = null;
            if (module?.default && typeof module.default === "function") {
              instance = new module.default();
              if (typeof instance.onload === "function") {
                await instance.onload(scopedApi);
              }
            } else if (typeof module?.onload === "function") {
              await module.onload(scopedApi);
            }

            const record = loaded.get(plugin.id);
            if (record) {
              record.instance = instance;
              record.module = module;
              record.views = views;
              record.actions = actions;
              record.fields = fields;
            }
          } catch (error) {
            console.error("Failed to load plugin:", plugin.id, error);
            loaded.delete(plugin.id);
          }
        }
      }

      for (const [pluginId] of loaded.entries()) {
        const stillInstalled = installedPlugins.some((plugin) => plugin.id === pluginId);
        const enabled = enabledPlugins?.[pluginId] !== false;
        if (!stillInstalled || !enabled) {
          await unloadPlugin(pluginId);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [installedPlugins, enabledPlugins, pluginApi, registerView, unregisterView, registerAction, unregisterAction, registerField, unregisterField]);

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
  }, [timelineData?.file?.id]);

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
    saveTimelineToFile(previous, timelineId).catch(console.error);
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
    saveTimelineToFile(next, timelineId).catch(console.error);
  };

  useEffect(() => {
    const handleUndoRedo = (e) => {
      if (!timelineData) return;
      const isMac = navigator.platform.includes("Mac");
      const isMod = isMac ? e.metaKey : e.ctrlKey;
      if (!isMod) return;

      const target = e.target;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (isEditable) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) {
          redoTimeline();
        } else {
          undoTimeline();
        }
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redoTimeline();
      }
    };

    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [timelineData, currentTimelineId]);


  const handleSelect = (id) => {
    setSelectedId(id);
  };

  useEffect(() => {
    if (!selectedId && isRightMaximized) {
      setIsRightMaximized(false);
    }
  }, [selectedId, isRightMaximized]);

  const handleToggleTag = (tag) => {
    setActiveTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((value) => value !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleToggleFilterScope = (key) => {
    setFilterScope((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleClearTags = () => {
    setActiveTags([]);
  };

  const handleFilterByTag = (tag) => {
    setActiveTags([tag]);
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
      const originalElement = prevData.elements.find((el) => el.id === originalId);
      const nextElement = { ...updatedElement };
      if (!nextElement.dateLabel) delete nextElement.dateLabel;
      if (!nextElement.startLabel) delete nextElement.startLabel;
      if (!nextElement.endLabel) delete nextElement.endLabel;
      delete nextElement.dateInput;
      delete nextElement.startInput;
      delete nextElement.endInput;

      const updatedData = updateElementWithNewId(prevData, nextElement, originalId);

      const newId = updatedData.elements.find(el =>
        el.title === updatedElement.title && el.type === updatedElement.type
      )?.id;

      if (newId && newId !== originalId) {
        setSelectedId(newId);
        if (originalElement?.noteFile) {
          const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
          const oldFilename = originalElement.noteFile;
          const newFilename = `${newId}.md`;
          renameNote({ timelineId, oldFilename, newFilename }).catch(console.error);
        }
      }

      
      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimelineToFile(updatedData, timelineId)
        .then(() => {
          console.log('Timeline saved to file successfully');
        })
        .catch((error) => {
          console.error('Failed to save timeline to file:', error);
        });

      return updatedData;
    });
  };

  const handleAddEvent = () => {
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const fallbackMid =
      timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const baseYear = Number.isFinite(viewportYear) ? viewportYear : fallbackMid;
    const clampedYear = clamp(baseYear, timelineData.file.start, timelineData.file.end);
    const eventBaseId = generateIdFromTitle("New Event", "event");
    const eventId = makeUniqueId(eventBaseId, timelineData.elements);
    const newEvent = {
      id: eventId,
      type: "event",
      title: "New Event",
      date: clampedYear,
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
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(newEvent.id);
    setEditRequestId(newEvent.id);
  };

  const handleAddSpan = () => {
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const range = timelineData.file.end - timelineData.file.start;
    const duration = Math.max(1, Math.floor(range / 4));
    const fallbackStart = timelineData.file.start + Math.floor(range / 2);
    const baseStart = Number.isFinite(viewportYear) ? viewportYear : fallbackStart;
    const start = clamp(baseStart, timelineData.file.start, timelineData.file.end);
    const end = clamp(start + duration, timelineData.file.start, timelineData.file.end);

    const spanBaseId = generateIdFromTitle("New Span", "span");
    const spanId = makeUniqueId(spanBaseId, timelineData.elements);
    const newSpan = {
      id: spanId,
      type: "span",
      title: "New Span",
      start,
      end,
      color: "#A6977E",
      branches: [],
    };

    setTimelineData((prevData) => {
      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, newSpan],
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(newSpan.id);
    setEditRequestId(newSpan.id);
  };

  const handleAddEra = () => {
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const range = timelineData.file.end - timelineData.file.start;
    const duration = Math.max(1, Math.floor(range / 3));
    const fallbackStart = timelineData.file.start + Math.floor(range / 2);
    const baseStart = Number.isFinite(viewportYear) ? viewportYear : fallbackStart;
    const start = clamp(baseStart, timelineData.file.start, timelineData.file.end);
    const end = clamp(start + duration, timelineData.file.start, timelineData.file.end);

    const eraBaseId = generateIdFromTitle("New Era", "era");
    const eraId = makeUniqueId(eraBaseId, timelineData.elements);
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
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

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
      const baseId = generateIdFromTitle(nextTitle, original.type);
      const nextId = makeUniqueId(baseId, prevData.elements);

      const baseCopy = {
        ...original,
        id: nextId,
        title: nextTitle,
      };

      if (original.type === "span") {
        baseCopy.branches = [];
      }

      const updatedData = {
        ...prevData,
        elements: [...prevData.elements, baseCopy],
      };

      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

      return updatedData;
    });
  };

  const handleDelete = (elementId) => {
    setTimelineData((prevData) => {
      const filteredElements = prevData.elements.filter(el => el.id !== elementId);

      const cleanedElements = filteredElements.map(el => {
        if (el.type === "event" && el.parents?.includes(elementId)) {
          return {
            ...el,
            parents: el.parents.filter(id => id !== elementId),
          };
        }

        if (el.type === "span" && el.branches?.includes(elementId)) {
          return {
            ...el,
            branches: el.branches.filter(id => id !== elementId),
          };
        }

        return el;
      });

      const updatedData = {
        ...prevData,
        elements: cleanedElements,
      };

            const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

      return updatedData;
    });

    setSelectedId(null);
  };

  const handleLayoutChange = useCallback((layoutId) => {
    setTimelineData((prev) => {
      if (!prev) return prev;
      const nextLayout = layoutId === "Horizontal" ? undefined : layoutId;
      const nextFile = { ...prev.file };
      if (nextLayout) {
        nextFile.layout = nextLayout;
      } else {
        delete nextFile.layout;
      }
      const updatedData = { ...prev, file: nextFile };
      const timelineId = nextFile.id?.replace("-timeline", "") || "timeline";
      saveTimelineToFile(updatedData, timelineId).catch(console.error);
      return updatedData;
    });
  }, []);

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
    breaks,
    layout,
    branchOrdering,
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
        breaks,
        layout,
        branchOrdering,
      };

      if (!startLabel) delete nextFile.startLabel;
      if (!endLabel) delete nextFile.endLabel;
      if (useMonths === undefined) delete nextFile.useMonths;
      if (!breaks || breaks.length === 0) delete nextFile.breaks;
      if (!layout) delete nextFile.layout;
      if (!branchOrdering) delete nextFile.branchOrdering;
      if (!font || String(font).toLowerCase() === "default") delete nextFile.font;

      const updatedData = {
        ...prevData,
        file: nextFile,
      };

      if (nextTimelineId !== oldTimelineId) {
        renameTimeline({ oldId: oldTimelineId, newId: nextTimelineId }).catch(console.error);
        setCurrentTimelineId(nextTimelineId);
      }

      saveTimelineToFile(updatedData, nextTimelineId).catch(console.error);

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

  const handleLoadTimeline = async (timelineId) => {
    try {
      if (!window.electron?.loadTimeline) {
        throw new Error("Timeline loading is only available in the desktop app.");
      }

      const loadedTimeline = await window.electron.loadTimeline(timelineId);
      console.log('Loaded timeline from Electron file system');

      const normalizeTimelineData = (data) => {
        const nextElements = (data.elements || []).map((element) => {
          if (element.type !== "span") return element;
          const branches = Array.isArray(element.branches) ? element.branches : [];
          const forks = Array.isArray(element.forks) ? element.forks : [];
          if (forks.length === 0) {
            const { forks: _forks, ...rest } = element;
            return rest;
          }
          const merged = [...branches, ...forks];
          const unique = Array.from(new Set(merged));
          const { forks: _forks, ...rest } = element;
          return {
            ...rest,
            branches: unique,
          };
        });
        return {
          ...data,
          elements: nextElements,
        };
      };

      // Update the timeline data
      setTimelineData(normalizeTimelineData(loadedTimeline));
      setCurrentTimelineId(timelineId);

      // Clear selection when loading new timeline
      setSelectedId(null);

      console.log(`Loaded timeline: ${timelineId}`);
    } catch (error) {
      console.error('Failed to load timeline:', error);
      alert(`Failed to load timeline: ${error.message}`);
    }
  };

  const handleBackToHome = () => {
    setTimelineData(null);
    setCurrentTimelineId(null);
    setSelectedId(null);
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
        appVersion: "0.2.0-alpha.1",
        start: timelineConfig.start,
        end: timelineConfig.end,
        detailLevel: timelineConfig.detailLevel,
        theme: timelineConfig.theme || defaultThemeKey,
        startLabel: timelineConfig.startLabel,
        endLabel: timelineConfig.endLabel,
        layout: timelineConfig.layout || "Horizontal",
        branchOrdering: timelineConfig.branchOrdering || "later-first",
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
      await saveTimelineToFile(duplicateData, duplicateId);

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

  const resolveThemeKey = (value, fallback = defaultThemeKey) => {
    if (!value) return fallback;
    const lower = String(value).toLowerCase();
    if (lower === "default") return fallback;
    const match = Object.keys(themeConfig.themes || {}).find(
      (key) => key.toLowerCase() === lower
    );
    return match || fallback;
  };

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

  const getThemeFont = (themeKeyValue) => {
    const theme = themeConfig.themes?.[themeKeyValue];
    if (!theme?.font?.family) return null;
    return {
      family: theme.font.family,
      cssUrl: theme.font.cssUrl,
    };
  };

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
      const settings = await getAppSettings();
      if (!isMounted) return;
      setAppThemePreference(settings?.theme || defaultThemeKey);
      const storedTimelineDir = settings?.timelineStorageDir ?? settings?.storageDir ?? "";
      const storedNotesDir = settings?.notesStorageDir ?? "";
      const storedNotesSubfolder = settings?.notesSubfolder ?? "";
      const storedNotesSubfolderEnabled = settings?.notesSubfolderEnabled ?? false;
      const storedEnabledPlugins = settings?.enabledBuiltinPlugins ?? {};
      const storedEnabledUserPlugins = settings?.enabledPlugins ?? {};
      const storedFontFamily = settings?.appFontFamily ?? "Inter";
      const storedFontSize = settings?.appFontSize ?? 14;
      setTimelineStorageDir(storedTimelineDir);
      setNotesStorageDir(storedNotesDir);
      setNotesSubfolder(storedNotesSubfolder);
      setNotesSubfolderEnabled(storedNotesSubfolderEnabled);
      setEnabledBuiltinPlugins((prev) => {
        const merged = { ...prev, ...(storedEnabledPlugins || {}) };
        BUILTIN_PLUGINS.forEach((plugin) => {
          if (merged[plugin.id] === undefined) merged[plugin.id] = true;
        });
        return merged;
      });
      setEnabledPlugins(storedEnabledUserPlugins || {});
      setAppFontFamily(storedFontFamily);
      setAppFontSize(storedFontSize);
    };

    loadAppSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const resolved = resolveThemeKey(appThemePreference);
    setAppThemeKey(resolved);
  }, [appThemePreference, themeConfig]);

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
  ]);

  useEffect(() => {
    if (timelineData?.file) {
      setThemeKey(resolveThemeKey(timelineData.file.theme, appThemeKey));
      return;
    }
    setThemeKey(appThemeKey);
  }, [timelineData?.file, appThemeKey]);

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
      enabledBuiltinPlugins,
      enabledPlugins,
      appFontFamily,
      appFontSize,
    });
  };

  const handleReplaceTimelineData = (nextData) => {
    if (!nextData) return;
    setTimelineData(nextData);
    const timelineId =
      nextData.file?.id?.replace("-timeline", "") ||
      timelineData?.file?.id?.replace("-timeline", "") ||
      "timeline";
    saveTimelineToFile(nextData, timelineId).catch(console.error);
    if (selectedId && !nextData.elements?.some((el) => el.id === selectedId)) {
      setSelectedId(null);
    }
  };

  const handleTimelineStorageDirChange = async (nextDir) => {
    setTimelineStorageDir(nextDir || "");
    await saveAppSettings({
      theme: appThemePreference,
      timelineStorageDir: nextDir || "",
      notesStorageDir,
      notesSubfolder,
      notesSubfolderEnabled,
      enabledBuiltinPlugins,
      enabledPlugins,
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
      enabledBuiltinPlugins,
      enabledPlugins,
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
      enabledBuiltinPlugins,
      enabledPlugins,
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
      enabledBuiltinPlugins,
      enabledPlugins,
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
      enabledBuiltinPlugins,
      enabledPlugins,
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
      enabledBuiltinPlugins,
      enabledPlugins,
      appFontFamily: nextFont,
      appFontSize,
    });
  };

  const handleToggleBuiltinPlugin = async (pluginId, nextEnabled) => {
    setEnabledBuiltinPlugins((prev) => {
      const updated = { ...prev, [pluginId]: nextEnabled };
      saveAppSettings({
        theme: appThemePreference,
        timelineStorageDir,
        notesStorageDir,
        notesSubfolder,
        notesSubfolderEnabled,
        enabledBuiltinPlugins: updated,
        enabledPlugins,
        appFontFamily,
        appFontSize,
      }).catch(console.error);
      return updated;
    });
  };

  const handleTogglePlugin = async (pluginId, nextEnabled) => {
    setEnabledPlugins((prev) => {
      const updated = { ...prev, [pluginId]: nextEnabled };
      saveAppSettings({
        theme: appThemePreference,
        timelineStorageDir,
        notesStorageDir,
        notesSubfolder,
        notesSubfolderEnabled,
        enabledBuiltinPlugins,
        enabledPlugins: updated,
        appFontFamily,
        appFontSize,
      }).catch(console.error);
      return updated;
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

  const handleOpenPluginsFolder = async () => {
    await openPluginsFolder();
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
    if (activeTags.length === 0) return timelineData.elements;
    const tagSet = new Set(activeTags);
    return timelineData.elements.filter((element) => {
      if (element.type !== "event" && element.type !== "span") {
        return true;
      }
      if (element.type === "event" && !filterScope.events) {
        return true;
      }
      if (element.type === "span" && !filterScope.spans) {
        return true;
      }
      const tags = Array.isArray(element.tags) ? element.tags : [];
      return tags.some((tag) => tagSet.has(tag));
    });
  }, [timelineData, activeTags, filterScope]);

  const filteredTimelineData = useMemo(() => ({
    ...timelineData,
    elements: filteredElements,
  }), [timelineData, filteredElements]);

  const layoutOptions = useMemo(() => {
    const options = [{ value: "Horizontal", label: "Horizontal" }];
    pluginViews.forEach((view) => {
      options.push({ value: view.id, label: view.name || view.id, icon: view.icon });
    });
    return options;
  }, [pluginViews]);

  const layoutValue = filteredTimelineData?.file?.layout || "Horizontal";
  const activePluginView = pluginViews.find((view) => view.id === layoutValue);

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
    if (!selectedId) return;
    const isVisible = filteredElements.some((el) => el.id === selectedId);
    if (!isVisible) {
      setSelectedId(null);
    }
  }, [filteredElements, selectedId]);

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
            pluginsRoot={pluginsRoot}
            builtinPlugins={BUILTIN_PLUGINS}
            enabledBuiltinPlugins={enabledBuiltinPlugins}
            installedPlugins={installedPlugins}
            enabledPlugins={enabledPlugins}
            onTimelineStorageDirChange={handleTimelineStorageDirChange}
            onNotesStorageDirChange={handleNotesStorageDirChange}
            onNotesSubfolderChange={handleNotesSubfolderChange}
            onNotesSubfolderEnabledChange={handleNotesSubfolderEnabledChange}
            onPickNotesSubfolder={handlePickNotesSubfolder}
            onPickTimelinesDir={handlePickTimelinesDir}
            onPickNotesDir={handlePickNotesDir}
            onToggleBuiltinPlugin={handleToggleBuiltinPlugin}
            onTogglePlugin={handleTogglePlugin}
            onOpenPluginsFolder={handleOpenPluginsFolder}
            onOpenFontsFolder={handleOpenFontsFolder}
            onAppFontChange={handleAppFontChange}
            onAppFontSizeChange={handleAppFontSizeChange}
            onRefreshThemes={refreshUserThemes}
          />
        </div>
      </>
    );
  }

  const selectedElement = timelineData.elements.find((el) => el.id === selectedId);

  return (
    <>
      <TopBar title={timelineData.file?.title || "Timelines"} />
      <div className={`app-shell ${isElectron ? 'with-title-bar' : ''}`}>
      <ActivityBar
        layouts={layoutOptions}
        activeLayout={layoutValue}
        onLayoutChange={handleLayoutChange}
        isCollapsed={isLeftCollapsed}
        onToggle={() => setIsLeftCollapsed((v) => !v)}
      />

      <div
        className="sidebar-resizer overlay-resizer"
        style={{ left: `${currentLeftWidth - 3}px` }}
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingLeft.current = true;
          document.body.classList.add("dragging");
        }}
      />

      {!isLeftCollapsed && (
        <aside
          className="app-sidebar overlay-sidebar"
          style={{ width: sidebarWidth, left: ACTIVITY_BAR_WIDTH }}
        >
          <Sidebar
            onToggle={() => setIsLeftCollapsed(true)}
            selectedId={selectedId}
            onSelect={handleSelect}
            timelineData={filteredTimelineData}
            allElements={timelineData.elements}
            activeTags={activeTags}
            onToggleTag={handleToggleTag}
            filterScope={filterScope}
            onToggleFilterScope={handleToggleFilterScope}
            onClearTags={handleClearTags}
            onAddEvent={handleAddEvent}
            onAddSpan={handleAddSpan}
            onAddEra={handleAddEra}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onDownloadJson={handleDownloadJSON}
            onDownloadPng={handleDownloadPNG}
            onLoadTimeline={handleLoadTimeline}
            onNewTimeline={handleNewTimeline}
            onDuplicateTimeline={handleDuplicateTimeline}
            onBackToHome={handleBackToHome}
            onDelete={handleRequestDelete}
            onDuplicateElement={handleDuplicateElement}
            onEditElement={handleEditElement}
            pluginActions={pluginActions}
            pluginApi={pluginApi}
          />
        </aside>
      )}

      <main
        className="app-content"
        style={{ display: isRightMaximized ? "none" : "block" }}
      >
        {activePluginView?.component ? (
          <>
            {(() => {
              const ViewComponent = activePluginView.component;
              const leftOffset =
                activePluginView.respectLeftPanel === false
                  ? 0
                  : currentLeftWidth;
              const rightOffset =
                activePluginView.respectRightPanel === false
                  ? 0
                  : Boolean(selectedId)
                    ? rightWidth
                    : 0;
              return (
                <PluginErrorBoundary key={activePluginView.id}>
                  <ViewComponent
                    pluginApi={pluginApi}
                    timelineData={timelineData}
                    onApplyJson={handleReplaceTimelineData}
                    leftOffset={leftOffset}
                    rightOffset={rightOffset}
                    viewportInsets={{
                      leftOpen: !isLeftCollapsed,
                      rightOpen: Boolean(selectedId),
                      leftWidth: currentLeftWidth,
                      rightWidth,
                    }}
                  />
                </PluginErrorBoundary>
              );
            })()}
            {activePluginView.showScrollbar && (
              <TimelineScrollbar
                timelineData={filteredTimelineData}
                onYearChange={setViewportYear}
                viewportPercent={activePluginView.scrollbarViewportPercent}
                leftPanelWidth={currentLeftWidth}
                isLeftPanelOpen={!isLeftCollapsed}
                rightPanelWidth={rightWidth}
                isRightPanelOpen={Boolean(selectedId)}
              />
            )}
          </>
        ) : (
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
            rightPanelWidth={rightWidth}
            isRightPanelOpen={Boolean(selectedId)}
            leftPanelWidth={currentLeftWidth}
            isLeftPanelOpen={!isLeftCollapsed}
            filterScope={filterScope}
            onToggleFilterScope={handleToggleFilterScope}
            activeTags={activeTags}
            allTags={allTags}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearTags}
            onViewportYearChange={setViewportYear}
          />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        timelineData={timelineData}
        onUpdateTimeline={handleUpdateTimeline}
        themeKey={themeKey}
        defaultThemeKey={defaultThemeKey}
        themes={themeConfig.themes}
        fonts={availableFonts}
        onThemeChange={setThemeKey}
        layoutOptions={layoutOptions}
      />

      {selectedId && (
        <>
          {!isRightMaximized && (
            <div
              className="right-resizer overlay-resizer"
              style={{ right: `${Math.max(rightWidth, MIN_WIDTH) - 3}px` }}
              onMouseDown={(e) => {
                e.preventDefault();
                isDraggingRight.current = true;
                document.body.classList.add("dragging");
              }}
            />
          )}

          <aside
            className="app-right overlay-right"
            style={{
              width: isRightMaximized
                ? `calc(100% - ${currentLeftWidth}px)`
                : rightWidth
            }}
          >
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
              pluginFields={pluginFields}
            />
          </aside>
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
      </div>
    </>
  );
}

export default App;
