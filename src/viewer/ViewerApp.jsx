import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TimelineView from "../components/TimelineView";
import SpreadsheetView from "../components/SpreadsheetView";
import Sidebar from "../components/Sidebar";
import RightPanel from "../components/RightPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import { applyTheme, getInitialThemeKey } from "../utils/theme";
import { loadThemeConfig } from "../utils/themeLoader";

const DEFAULT_GROUP_ID = "g-main";
const SIDEBAR_WIDTH = 350;
const SIDEBAR_COLLAPSED_WIDTH = 44;
const RIGHT_PANEL_WIDTH = 340;

// Written by the site's theme picker (same origin); only the landing screen follows it
const WEBSITE_THEME_KEY = "timelines-website-theme";
const MARKETPLACE_BASE = "https://raw.githubusercontent.com/sreegjl/timelines-marketplace/refs/heads/main/";
const FONT_FALLBACK = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Colors plus the font handling App.jsx does outside applyTheme (theme font
// stylesheet + --app-font-family, overridable by file.font)
function applyViewerTheme(themes, key, fileFont) {
  applyTheme({ themes, activeTheme: key }, key);

  const themeFont = themes[key]?.font;
  const useFileFont = fileFont && String(fileFont).toLowerCase() !== "default";
  const family = useFileFont ? String(fileFont) : themeFont?.family;
  const cssUrl = useFileFont ? null : themeFont?.cssUrl;

  const linkId = "theme-font-css";
  const existing = document.getElementById(linkId);
  if (cssUrl) {
    if (existing) {
      if (existing.getAttribute("href") !== cssUrl) existing.setAttribute("href", cssUrl);
    } else {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = cssUrl;
      document.head.appendChild(link);
    }
  } else if (existing) {
    existing.remove();
  }

  let stack = FONT_FALLBACK;
  if (family && String(family).toLowerCase() === "system") {
    stack = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  } else if (family) {
    stack = `"${String(family).replace(/([\\"])/g, "\\$1")}", ${FONT_FALLBACK}`;
  }
  document.documentElement.style.setProperty("--app-font-family", stack);
}

// Local thumbnails and notes live in desktop-only folders and can't resolve in
// the browser, so drop those references. Remote thumbnails and wiki links work.
function sanitizeForBrowser(data) {
  const elements = (data.elements ?? []).map((el) => {
    let next = el;
    const thumb = next.thumbnail ? String(next.thumbnail) : "";
    if (thumb && !/^https?:\/\//i.test(thumb) && !thumb.startsWith("data:")) {
      const { thumbnail: _thumbnail, ...rest } = next;
      next = rest;
    }
    if (next.noteFile) {
      const { noteFile: _noteFile, ...rest } = next;
      next = rest;
    }
    return next;
  });
  return { ...data, file: data.file ?? {}, elements };
}

export default function ViewerApp() {
  const [timelineData, setTimelineData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState("timeline");
  const [activeTags, setActiveTags] = useState([]);
  const [hiddenTags, setHiddenTags] = useState([]);
  const [pinnedTags, setPinnedTags] = useState([]);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightMaximized, setIsRightMaximized] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const themeConfig = loadThemeConfig();
    const bundled = themeConfig.themes || {};
    const defaultKey = getInitialThemeKey(themeConfig);

    if (!timelineData) {
      let siteTheme = null;
      try {
        siteTheme = window.localStorage.getItem(WEBSITE_THEME_KEY);
      } catch { /* storage unavailable */ }
      applyViewerTheme(bundled, siteTheme && bundled[siteTheme] ? siteTheme : defaultKey, null);
      return;
    }

    const fileFont = timelineData.file?.font;
    const requested = timelineData.file?.theme;
    const lower = requested ? String(requested).toLowerCase() : "";
    const bundledMatch = Object.keys(bundled).find((k) => k.toLowerCase() === lower);
    if (!requested || lower === "default" || bundledMatch) {
      applyViewerTheme(bundled, bundledMatch || defaultKey, fileFont);
      return;
    }

    // Marketplace themes aren't bundled; fetch by id from the marketplace repo
    let cancelled = false;
    (async () => {
      try {
        const index = await (await fetch(`${MARKETPLACE_BASE}index.json`)).json();
        const entry = (index.themes || []).find((t) => String(t.id).toLowerCase() === lower);
        if (!entry?.paths?.theme) throw new Error("not in marketplace");
        const theme = await (await fetch(MARKETPLACE_BASE + entry.paths.theme)).json();
        if (!theme?.colors) throw new Error("unsupported theme format");
        if (!cancelled) applyViewerTheme({ [requested]: theme }, requested, fileFont);
      } catch {
        if (!cancelled) applyViewerTheme(bundled, defaultKey, fileFont);
      }
    })();
    return () => { cancelled = true; };
  }, [timelineData]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!/\.(timeline|json)$/i.test(file.name)) {
      setLoadError("Unsupported file type — drop a .timeline file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.elements)) {
          throw new Error("no elements array found");
        }
        setTimelineData(sanitizeForBrowser(data));
        setSelectedId(null);
        setViewMode("timeline");
        setActiveTags([]);
        setHiddenTags([]);
        setPinnedTags([]);
        setIsRightMaximized(false);
        setLoadError("");
      } catch (err) {
        setLoadError(`Could not read timeline: ${err.message}`);
      }
    };
    reader.onerror = () => setLoadError("Could not read the dropped file.");
    reader.readAsText(file);
  }, []);

  // preventDefault on window keeps the browser from navigating to dropped files
  useEffect(() => {
    const onDragOver = (e) => {
      e.preventDefault();
      setIsDragOver(true);
    };
    const onDragLeave = (e) => {
      if (!e.relatedTarget) setIsDragOver(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFile(e.dataTransfer?.files?.[0]);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  const handleSelect = useCallback((id) => setSelectedId(id), []);

  const handleToggleTag = useCallback((tag) => {
    setActiveTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }, []);

  const handleToggleHiddenTag = useCallback((tag) => {
    setHiddenTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }, []);

  const handleTogglePinnedTag = useCallback((tag) => {
    setPinnedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }, []);

  const handleClearTags = useCallback(() => {
    setActiveTags([]);
    setHiddenTags([]);
  }, []);

  const filteredElements = useMemo(() => {
    if (!timelineData) return [];
    if (activeTags.length === 0 && hiddenTags.length === 0) return timelineData.elements;
    const showSet = new Set(activeTags);
    const hideSet = new Set(hiddenTags);
    return timelineData.elements.filter((element) => {
      if (element.type !== "event" && element.type !== "span") return true;
      const tags = Array.isArray(element.tags) ? element.tags : [];
      if (tags.some((tag) => hideSet.has(tag))) return false;
      if (showSet.size === 0) return true;
      return tags.some((tag) => showSet.has(tag));
    });
  }, [timelineData, activeTags, hiddenTags]);

  // Keep in sync with filteredTimelineData in App.jsx
  const filteredTimelineData = useMemo(() => {
    if (!timelineData) return null;
    const groups = timelineData.file?.groups ?? [];
    const groupIdSet = new Set(groups.map((g) => g.id).filter(Boolean));
    const defaultGroupId = groups[0]?.id || DEFAULT_GROUP_ID;
    const spanGroupById = Object.fromEntries(
      filteredElements
        .filter((el) => el.type === "span" && groupIdSet.has(el.groupId))
        .map((el) => [el.id, el.groupId])
    );
    const resolvedElements = filteredElements.map((el) => {
      if ((el.type !== "event" && el.type !== "span") || groupIdSet.has(el.groupId)) return el;
      const parentGroupId = el.type === "event" && Array.isArray(el.parents)
        ? el.parents.map((pid) => spanGroupById[pid]).find(Boolean)
        : undefined;
      return { ...el, groupId: parentGroupId ?? defaultGroupId };
    });
    return { ...timelineData, elements: resolvedElements };
  }, [timelineData, filteredElements]);

  const allTags = useMemo(() => {
    if (!timelineData?.elements) return [];
    const tags = new Set();
    timelineData.elements.forEach((element) => {
      if (element.type !== "event" && element.type !== "span") return;
      if (Array.isArray(element.tags)) {
        element.tags.forEach((tag) => { if (tag) tags.add(tag); });
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [timelineData]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredElements.some((el) => el.id === selectedId)) setSelectedId(null);
  }, [filteredElements, selectedId]);

  useEffect(() => {
    if (viewMode === "spreadsheet" && !timelineData?.file?.useSpreadsheet) {
      setViewMode("timeline");
    }
  }, [viewMode, timelineData?.file?.useSpreadsheet]);

  const compareElementsByTimelineOrder = useCallback((a, b) => {
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
  }, []);

  const selectionNavigation = useMemo(() => {
    if (!selectedId) return { selectedElement: null, prevElement: null, nextElement: null };
    const selectedElement = filteredElements.find((el) => el.id === selectedId);
    if (!selectedElement) return { selectedElement: null, prevElement: null, nextElement: null };
    const sameTypeElements = filteredElements
      .filter((el) => el.type === selectedElement.type)
      .sort(compareElementsByTimelineOrder);
    const currentIndex = sameTypeElements.findIndex((el) => el.id === selectedId);
    return {
      selectedElement,
      prevElement: currentIndex > 0 ? sameTypeElements[currentIndex - 1] : null,
      nextElement: currentIndex >= 0 && currentIndex < sameTypeElements.length - 1
        ? sameTypeElements[currentIndex + 1]
        : null,
    };
  }, [selectedId, filteredElements, compareElementsByTimelineOrder]);

  const handleSelectPrevious = useCallback(() => {
    if (selectionNavigation.prevElement) setSelectedId(selectionNavigation.prevElement.id);
  }, [selectionNavigation.prevElement]);

  const handleSelectNext = useCallback(() => {
    if (selectionNavigation.nextElement) setSelectedId(selectionNavigation.nextElement.id);
  }, [selectionNavigation.nextElement]);

  if (!timelineData) {
    return (
      <div className="viewer-landing">
        <div className={`viewer-landing-card${isDragOver ? " is-drag-over" : ""}`}>
          <h1 className="viewer-landing-title">Timelines Viewer</h1>
          <p className="viewer-landing-subtitle">
            Drop a <strong>.timeline</strong> file anywhere on this page to view it.
            Nothing is uploaded — the file stays in your browser.
          </p>
          <button
            type="button"
            className="viewer-landing-browse"
            onClick={() => fileInputRef.current?.click()}
          >
            Browse for file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".timeline,.json"
            style={{ display: "none" }}
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          {loadError && <div className="viewer-landing-error">{loadError}</div>}
        </div>
      </div>
    );
  }

  const selectedElement = timelineData.elements.find((el) => el.id === selectedId);
  const isRightPanelVisible = Boolean(selectedElement) && viewMode !== "spreadsheet";
  const currentLeftWidth = isLeftCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const tagColors = timelineData.file?.tagColors || {};

  return (
    <div className="app-shell">
      {viewMode !== "spreadsheet" && (
        <aside className="app-sidebar overlay-sidebar" style={{ width: currentLeftWidth }}>
          <ErrorBoundary name="Sidebar">
            <Sidebar
              readOnly
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
              tagColors={tagColors}
            />
          </ErrorBoundary>
        </aside>
      )}

      <main className="app-content" style={{ display: isRightMaximized ? "none" : "block" }}>
        {viewMode === "spreadsheet" ? (
          <ErrorBoundary name="Spreadsheet">
            <SpreadsheetView
              readOnly
              timelineData={filteredTimelineData}
              selectedId={selectedId}
              onSelect={handleSelect}
              onUpdate={() => {}}
              leftPanelWidth={0}
              rightPanelWidth={0}
              isRightPanelOpen={false}
              onSetViewMode={setViewMode}
              activeTags={activeTags}
              hiddenTags={hiddenTags}
              allTags={allTags}
              onToggleTag={handleToggleTag}
              onToggleHiddenTag={handleToggleHiddenTag}
              onClearTags={handleClearTags}
              pinnedTags={pinnedTags}
              onTogglePinnedTag={handleTogglePinnedTag}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary name="Timeline">
            <TimelineView
              readOnly
              selectedId={selectedId}
              onSelect={handleSelect}
              timelineData={filteredTimelineData}
              rightPanelWidth={isRightPanelVisible ? RIGHT_PANEL_WIDTH : 0}
              isRightPanelOpen={isRightPanelVisible}
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
              tagColors={tagColors}
              onSetViewMode={timelineData.file?.useSpreadsheet ? setViewMode : undefined}
            />
          </ErrorBoundary>
        )}
      </main>

      {isRightPanelVisible && (
        <aside
          className="app-right overlay-right"
          style={{
            width: isRightMaximized ? `calc(100% - ${currentLeftWidth}px)` : RIGHT_PANEL_WIDTH,
          }}
        >
          <ErrorBoundary name="Right panel">
            <RightPanel
              readOnly
              onSelect={handleSelect}
              selectedElement={selectedElement}
              onUpdate={() => {}}
              timelineData={timelineData}
              isMaximized={isRightMaximized}
              onToggleMaximize={() => setIsRightMaximized((prev) => !prev)}
              activeTags={activeTags}
              onToggleTag={handleToggleTag}
              tagColors={tagColors}
              onSelectPrevious={handleSelectPrevious}
              onSelectNext={handleSelectNext}
              prevElement={selectionNavigation.prevElement}
              nextElement={selectionNavigation.nextElement}
            />
          </ErrorBoundary>
        </aside>
      )}

      <div className="viewer-badge">Read-only viewer — drop a .timeline file to open another</div>
    </div>
  );
}
