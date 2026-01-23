import { useState, useRef, useEffect } from "react";
import TimelineView from "./components/TimelineView";
import Sidebar from "./components/Sidebar";
import RightPanel from "./components/RightPanel";
import SettingsModal from "./components/SettingsModal";
import NewTimelineModal from "./components/NewTimelineModal";
import TopBar from "./components/TopBar";
import HomePage from "./components/HomePage";
import { saveTimelineToFile } from "./utils/electronApi";
import { updateElementWithNewId } from "./utils/idUtils";
import { generateIdFromTitle } from "./utils/idUtils";
import themeConfig from "./config/theme.json";
import { applyTheme, getInitialThemeKey } from "./utils/theme";
import { getAppSettings, saveAppSettings } from "./utils/appSettings";
import { parseTimelineInput, snapToMonthGrid } from "./utils/dateUtils";
import "./index.css";

function App() {
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 455;
  const COLLAPSED_WIDTH = 44;
  const DEFAULT_LEFT_WIDTH = 350;
  const DEFAULT_RIGHT_WIDTH = 385;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [downloadPngTrigger, setDownloadPngTrigger] = useState(0);
  const [timelineData, setTimelineData] = useState(null);
  const [currentTimelineId, setCurrentTimelineId] = useState(null);
  const [isNewTimelineModalOpen, setIsNewTimelineModalOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState(null);
  const defaultThemeKey = getInitialThemeKey(themeConfig);
  const [themeKey, setThemeKey] = useState(defaultThemeKey);
  const [appThemeKey, setAppThemeKey] = useState(defaultThemeKey);

  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  useEffect(() => {
    function handleMouseMove(e) {
      if (isDraggingLeft.current && !isLeftCollapsed) {
        e.preventDefault();
        const next = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
        setSidebarWidth(next);
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
    function handleKeyDown(e) {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();

        const element = timelineData.elements.find(el => el.id === selectedId);
        if (!element) return;

        const confirmMessage = `Are you sure you want to delete this ${element.type}?\n\nTitle: ${element.title}\nID: ${element.id}\n\nThis action cannot be undone.`;

        if (window.confirm(confirmMessage)) {
          handleDelete(selectedId);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, timelineData]);

  const currentLeftWidth = isLeftCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleEditElement = (id) => {
    setSelectedId(id);
    setEditRequestId(id);
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

      const newId = updatedData.elements.find(el =>
        el.title === updatedElement.title && el.type === updatedElement.type
      )?.id;

      if (newId && newId !== originalId) {
        setSelectedId(newId);
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
    const newEvent = {
      id: generateIdFromTitle("New Event", "event"),
      type: "event",
      title: "New Event",
      date: timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2),
      parents: [],
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
  };

  const handleAddSpan = () => {
    const midpoint = timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const duration = Math.floor((timelineData.file.end - timelineData.file.start) / 4);

    const newSpan = {
      id: generateIdFromTitle("New Span", "span"),
      type: "span",
      title: "New Span",
      start: midpoint - duration / 2,
      end: midpoint + duration / 2,
      color: "#A6977E",
      branches: [],
      forks: [],
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
  };

  const handleAddEra = () => {
    const midpoint = timelineData.file.start + Math.floor((timelineData.file.end - timelineData.file.start) / 2);
    const duration = Math.floor((timelineData.file.end - timelineData.file.start) / 3);

    const newEra = {
      id: generateIdFromTitle("New Era", "era"),
      type: "era",
      title: "New Era",
      start: midpoint - duration / 2,
      end: midpoint + duration / 2,
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
  };

  const makeUniqueId = (baseId, elements) => {
    let nextId = baseId;
    let counter = 2;
    while (elements.some((el) => el.id === nextId)) {
      nextId = `${baseId}-${counter}`;
      counter += 1;
    }
    return nextId;
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
        baseCopy.forks = [];
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

        if (el.type === "span" && el.forks?.includes(elementId)) {
          return {
            ...el,
            forks: el.forks.filter(id => id !== elementId),
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

  const handleUpdateTimeline = ({
    title,
    start,
    end,
    detailLevel,
    negID,
    posID,
    theme,
    startLabel,
    endLabel,
    useMonths,
    eventLineStyle,
    layout,
  }) => {
    const parsedStart = parseTimelineInput(start);
    const parsedEnd = parseTimelineInput(end);
    setTimelineData((prevData) => {
      const applyMonthSnap = useMonths === true;
      const startValue = parsedStart.value ?? prevData.file.start;
      const endValue = parsedEnd.value ?? prevData.file.end;
      const nextFile = {
        ...prevData.file,
        title,
        start: applyMonthSnap ? snapToMonthGrid(startValue) : startValue,
        end: applyMonthSnap ? snapToMonthGrid(endValue) : endValue,
        detailLevel,
        negID,
        posID,
        theme,
        startLabel,
        endLabel,
        useMonths,
        eventLineStyle,
        layout,
      };

      if (!startLabel) delete nextFile.startLabel;
      if (!endLabel) delete nextFile.endLabel;
      if (useMonths === undefined) delete nextFile.useMonths;
      if (!eventLineStyle) delete nextFile.eventLineStyle;
      if (!layout) delete nextFile.layout;

      const updatedData = {
        ...prevData,
        file: nextFile,
      };

      
      // Get the timeline ID from the file, removing the '-timeline' suffix if present
      const timelineId = prevData.file?.id?.replace('-timeline', '') || 'timeline';
      saveTimelineToFile(updatedData, timelineId).catch(console.error);

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
    // Trigger the PNG download in TimelineView
    setDownloadPngTrigger(prev => prev + 1);
  };

  const handleLoadTimeline = async (timelineId) => {
    try {
      let loadedTimeline;

      // Try to load from Electron first (if available)
      if (window.electron?.loadTimeline) {
        try {
          loadedTimeline = await window.electron.loadTimeline(timelineId);
          console.log('Loaded timeline from Electron file system');
        } catch (electronError) {
          console.log('Electron load failed, falling back to static import');
        }
      }

      // Fall back to static import if Electron load failed or not available
      if (!loadedTimeline) {
        const module = await import(`./data/${timelineId}.timeline`);
        loadedTimeline = module.default || module;
      }

      // Update the timeline data
      setTimelineData(loadedTimeline);
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
    const timelineId = timelineConfig.title.toLowerCase().replace(/\s+/g, '-');
    const newTimeline = {
      file: {
        id: `${timelineId}-timeline`,
        type: "timeline",
        title: timelineConfig.title,
        start: timelineConfig.start,
        end: timelineConfig.end,
        detailLevel: timelineConfig.detailLevel,
        negID: timelineConfig.negID,
        posID: timelineConfig.posID,
        theme: timelineConfig.theme || defaultThemeKey,
        startLabel: timelineConfig.startLabel,
        endLabel: timelineConfig.endLabel,
        eventLineStyle: timelineConfig.eventLineStyle || "solid",
        layout: timelineConfig.layout || "Horizontal",
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
      const duplicateId = duplicateName.toLowerCase().replace(/\s+/g, '-');

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

  useEffect(() => {
    let isMounted = true;

    const loadAppSettings = async () => {
      const settings = await getAppSettings();
      if (!isMounted) return;
      const nextTheme = resolveThemeKey(settings?.theme);
      setAppThemeKey(nextTheme);
    };

    loadAppSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!timelineData) {
      setThemeKey(appThemeKey);
    }
  }, [appThemeKey, timelineData]);

  useEffect(() => {
    applyTheme(themeConfig, themeKey);
  }, [themeKey]);

  useEffect(() => {
    if (timelineData?.file) {
      setThemeKey(resolveThemeKey(timelineData.file.theme, appThemeKey));
      return;
    }
    setThemeKey(appThemeKey);
  }, [timelineData?.file, appThemeKey]);

  const handleAppThemeChange = async (nextThemeKey) => {
    const resolved = resolveThemeKey(nextThemeKey);
    setAppThemeKey(resolved);
    await saveAppSettings({ theme: resolved });
  };

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
      <aside
        className="app-sidebar overlay-sidebar"
        style={{ width: currentLeftWidth }}
      >
        <Sidebar
          isCollapsed={isLeftCollapsed}
          onToggle={() => setIsLeftCollapsed((v) => !v)}
          selectedId={selectedId}
          onSelect={handleSelect}
          timelineData={timelineData}
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
        />
      </aside>

      {!isLeftCollapsed && (
        <div
          className="sidebar-resizer overlay-resizer"
          style={{ left: `${currentLeftWidth - 3}px` }}
          onMouseDown={(e) => {
            e.preventDefault();
            isDraggingLeft.current = true;
            document.body.classList.add("dragging");
          }}
        />
      )}

      <main className="app-content">
        <TimelineView
          selectedId={selectedId}
          onSelect={handleSelect}
          timelineData={timelineData}
          onAddEvent={handleAddEvent}
          onAddSpan={handleAddSpan}
          onAddEra={handleAddEra}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDelete={handleDelete}
          onDuplicateElement={handleDuplicateElement}
          onEditElement={handleEditElement}
          downloadPngTrigger={downloadPngTrigger}
          rightPanelWidth={rightWidth}
          isRightPanelOpen={Boolean(selectedId)}
          leftPanelWidth={currentLeftWidth}
          isLeftPanelOpen={!isLeftCollapsed}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        timelineData={timelineData}
        onUpdateTimeline={handleUpdateTimeline}
        themeKey={themeKey}
        defaultThemeKey={defaultThemeKey}
        themes={themeConfig.themes}
        onThemeChange={setThemeKey}
      />

      {selectedId && (
        <>
          <div
            className="right-resizer overlay-resizer"
            style={{ right: `${Math.max(rightWidth, MIN_WIDTH) - 3}px` }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingRight.current = true;
              document.body.classList.add("dragging");
            }}
          />

          <aside
            className="app-right overlay-right"
            style={{ width: rightWidth }}
          >
            <RightPanel
              onSelect={handleSelect}
              selectedElement={selectedElement}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              timelineData={timelineData}
              editRequestId={editRequestId}
              onEditRequestHandled={() => setEditRequestId(null)}
            />
          </aside>
        </>
      )}

      <NewTimelineModal
        isOpen={isNewTimelineModalOpen}
        onClose={() => setIsNewTimelineModalOpen(false)}
        onCreate={handleCreateTimeline}
      />
      </div>
    </>
  );
}

export default App;
