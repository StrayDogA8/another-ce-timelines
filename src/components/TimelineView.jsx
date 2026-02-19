import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import {
  pickStep,
  buildSpanChildPlacement,
  calcSpanBandHeight,
  layoutSpans,
  layoutEvents,
  formatYear,
  calculateDetailLevel,
  getReadableTextColor,
} from "../utils/timelineUtils";
import { parseTimelineInput, snapToMonthGrid } from "../utils/dateUtils";
import { FileJson, Image, Settings, RectangleHorizontal, RectangleEllipsis, SquareSplitHorizontal, Plus, Minus, MoveVertical, Copy, Trash2, Edit2, ListFilter, Play, Pause, Tag, Eye, EyeOff } from "lucide-react";
import "../styles/04-timeline.css";
import "../styles/07-modals-menus.css";

const TimelineView = forwardRef(function TimelineView({
  selectedId,
  onSelect,
  timelineData,
  onZoomChange,
  onHeightChange,
  onAddEvent,
  onAddSpan,
  onAddEra,
  onOpenSettings,
  onDelete,
  onDuplicateElement,
  onEditElement,
  downloadPngTrigger,
  exportPngOptions,
  onExportPng,
  rightPanelWidth = 0,
  isRightPanelOpen = false,
  leftPanelWidth = 0,
  isLeftPanelOpen = false,
  filterScope,
  onToggleFilterScope,
  activeTags = [],
  hiddenTags = [],
  allTags = [],
  onToggleTag,
  onToggleHiddenTag,
  onClearTags,
  pinnedTags = [],
  onTogglePinnedTag,
  onViewportYearChange,
}, ref) {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [filterMenu, setFilterMenu] = useState(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [sliderYearLabel, setSliderYearLabel] = useState("");
  const [currentScale, setCurrentScale] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const filterMenuRef = useRef(null);
  const filterButtonRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastPlayTimeRef = useRef(null);
  const sliderInputRef = useRef(false);
  const lastViewportYearRef = useRef(null);
  const lastSliderLabelRef = useRef("");
  const sliderRafRef = useRef(null);
  const pendingSliderValueRef = useRef(null);
  const sliderValueRef = useRef(0);
  const sliderElementRef = useRef(null);
  const yearLabelRef = useRef(null);
  const viewportIndicatorRef = useRef(null);
  const zoomButtonOffset = isRightPanelOpen ? rightPanelWidth + 20 : 20;
  const sliderOffset = (isLeftPanelOpen ? leftPanelWidth : 0) - (isRightPanelOpen ? rightPanelWidth : 0);

  const {
    file,
    spanChildPlacement,
    finalSpans,
    finalEvents,
    finalEras,
    PX_PER_YEAR,
    timelineWidth,
    yearToPx,
    calculatedHeight,
    BASE_LINE_Y,
    ticks,
    normalizedScaleSections,
    compressedMin,
    compressedMax,
    TIMELINE_PADDING,
    decompressYear,
  } = useMemo(() => {
    const file = timelineData.file;
    const events = timelineData.elements.filter(e => e.type === "event");
    const spans = timelineData.elements.filter(e => e.type === "span");
    const eras = timelineData.elements.filter(e => e.type === "era");
    const useMonths = file?.useMonths === true;
    const hasDayPrecision = (label) => {
      if (!label || typeof label !== "string") return false;
      const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
      return parts.length === 3;
    };
    const adjustDate = (value, label) => {
      if (!useMonths) return value;
      if (!Number.isFinite(value)) return value;
      if (hasDayPrecision(label)) return value;
      const scaled = value * 12;
      const isOnMonthGrid = Math.abs(scaled - Math.round(scaled)) < 1e-6;
      if (!isOnMonthGrid) return value;
      return snapToMonthGrid(value);
    };
    const resolveDate = (value, label) => {
      if (!label || typeof label !== "string") {
        return adjustDate(value, label);
      }
      const parsed = parseTimelineInput(label);
      if (Number.isFinite(parsed.value)) {
        return adjustDate(parsed.value, label);
      }
      return adjustDate(value, label);
    };

    const adjustedEvents = events.map((event) => ({
      ...event,
      date: resolveDate(event.date, event.dateLabel),
    }));
    const adjustedSpans = spans.map((span) => ({
      ...span,
      start: resolveDate(span.start, span.startLabel),
      end: resolveDate(span.end, span.endLabel),
    }));
    const adjustedEras = eras.map((era) => ({
      ...era,
      start: resolveDate(era.start, era.startLabel),
      end: resolveDate(era.end, era.endLabel),
    }));

    const allYears = [
      ...adjustedEvents.map((e) => e.date),
      ...adjustedSpans.flatMap((s) => [s.start, s.end]),
      ...adjustedEras.flatMap((e) => [e.start, e.end]),
    ];

    const rawMin = Math.min(...allYears);
    const rawMax = Math.max(...allYears);

    const minYear = file?.start ?? rawMin;
    const maxYear = file?.end ?? rawMax;

    const parseScaleValue = (value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = parseTimelineInput(value);
        return Number.isFinite(parsed.value) ? parsed.value : null;
      }
      return null;
    };

    const normalizeScaleSections = (sections, legacyBreaks, min, max) => {
      // Support old breaks format as scale=0 sections
      let raw = Array.isArray(sections) && sections.length > 0
        ? sections
        : Array.isArray(legacyBreaks) && legacyBreaks.length > 0
          ? legacyBreaks.map((b) => ({ ...b, scale: 0 }))
          : [];
      if (raw.length === 0) return [];

      const cleaned = raw
        .map((item) => {
          const startRaw = parseScaleValue(item?.start);
          const endRaw = parseScaleValue(item?.end);
          if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw)) return null;
          const start = Math.min(startRaw, endRaw);
          const end = Math.max(startRaw, endRaw);
          if (start === end) return null;
          const clippedStart = Math.max(min, start);
          const clippedEnd = Math.min(max, end);
          if (clippedEnd <= clippedStart) return null;
          const scale = Math.max(0, Math.min(2, Number(item?.scale) || 0));
          return { start: clippedStart, end: clippedEnd, scale };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

      // Merge overlapping sections with the same scale
      const merged = [];
      cleaned.forEach((current) => {
        const last = merged[merged.length - 1];
        if (!last || current.start > last.end || current.scale !== last.scale) {
          merged.push({ ...current });
        } else {
          last.end = Math.max(last.end, current.end);
        }
      });
      return merged;
    };

    const normalizedScaleSections = normalizeScaleSections(
      file?.scaleSections, file?.breaks, minYear, maxYear
    );

    const compressYear = (year) => {
      let adjustment = 0;
      for (const section of normalizedScaleSections) {
        const duration = section.end - section.start;
        if (year >= section.end) {
          adjustment += duration * (1 - section.scale);
          continue;
        }
        if (year > section.start) {
          const partial = year - section.start;
          return year - adjustment - partial * (1 - section.scale);
        }
        break;
      }
      return year - adjustment;
    };

    const isYearInZeroScale = (year) =>
      normalizedScaleSections.some((s) => s.scale === 0 && year > s.start && year < s.end);

    const isZeroScaleBoundary = (year) =>
      normalizedScaleSections.some(
        (s) => s.scale === 0 && (Math.abs(year - s.start) < 0.0001 || Math.abs(year - s.end) < 0.0001)
      );

    const compressedMin = compressYear(minYear);
    const compressedMax = compressYear(maxYear);
    const range = Math.max(1, compressedMax - compressedMin);
    const decompressYear = (compressedYear) => {
      let adjustment = 0;
      for (const section of normalizedScaleSections) {
        const duration = section.end - section.start;
        const sectionStartCompressed = section.start - adjustment;
        const sectionCompressedWidth = duration * section.scale;
        if (compressedYear >= sectionStartCompressed + sectionCompressedWidth) {
          adjustment += duration * (1 - section.scale);
          continue;
        }
        if (compressedYear > sectionStartCompressed) {
          const offset = compressedYear - sectionStartCompressed;
          return section.start + (section.scale > 0 ? offset / section.scale : 0);
        }
        break;
      }
      return compressedYear + adjustment;
    };

    // Calculate detail level automatically based on range
    // The detailLevel setting will be used as a multiplier later
    const baseDetailLevel = calculateDetailLevel(range);
    const detailMultiplier = file?.detailLevel ?? 1;
    const PX_PER_YEAR = baseDetailLevel * detailMultiplier;

    const zoomInScale = Math.max(currentScale, 1);
    const step = pickStep(range / (detailMultiplier * zoomInScale * 2));
    const TIMELINE_PADDING = 200; // px padding on each end
    const timelineWidth = range * PX_PER_YEAR + (TIMELINE_PADDING * 2);

    const yearToPx = (year) =>
      (compressYear(year) - compressedMin) * PX_PER_YEAR + TIMELINE_PADDING;

    // spans
    const SPAN_HEIGHT = 23;
    const SPAN_OFFSET = 14;
    const SPAN_GAP = 6;
    const SPAN_VERTICAL_GAP = 0;

    const spanChildPlacement = buildSpanChildPlacement(
      adjustedSpans,
      timelineData?.file?.branchOrdering || "later-first"
    );

    // First pass: calculate with temporary BASE_LINE_Y to determine content extent
    const TEMP_BASE_LINE_Y = 500;

    const { spanLaneEnds } = layoutSpans({
      spans: adjustedSpans,
      yearToPx,
      BASE_LINE_Y: TEMP_BASE_LINE_Y,
      SPAN_HEIGHT,
      SPAN_OFFSET,
      SPAN_GAP,
      SPAN_VERTICAL_GAP,
      spanChildPlacement,
      timelineStart: file.start,
      timelineEnd: file.end,
    });

    const spanBandHeight = calcSpanBandHeight(
      spanLaneEnds.length,
      SPAN_OFFSET,
      SPAN_HEIGHT,
      SPAN_VERTICAL_GAP
    );

    // events
    const EVENT_WIDTH = 160;
    const EVENT_GAP = 15;
    const LANE_SPACING = 37;
    const BOX_OFFSET = 50;

    const tempEvents = layoutEvents({
      events,
      yearToPx,
      BASE_LINE_Y: TEMP_BASE_LINE_Y,
      spanBandHeight,
      EVENT_WIDTH,
      EVENT_GAP,
      LANE_SPACING,
      BOX_OFFSET,
    });

    // eras
    const ERA_OFFSET = 34;

    // Calculate dynamic timeline height based on temporary layout
    const maxEventTop = tempEvents.length > 0 ? Math.min(...tempEvents.map(e => e.top)) : TEMP_BASE_LINE_Y;
    const tempEraTop = TEMP_BASE_LINE_Y + ERA_OFFSET;
    const maxEraTop = eras.length > 0 ? tempEraTop : TEMP_BASE_LINE_Y;

    const topExtent = Math.min(maxEventTop, maxEraTop);
    const aboveBaseline = TEMP_BASE_LINE_Y - topExtent;
    const belowBaseline = ERA_OFFSET + 30; // Era height + some padding

    const calculatedHeight = aboveBaseline + belowBaseline;

    const BASE_LINE_Y = calculatedHeight;

    const { finalSpans } = layoutSpans({
      spans: adjustedSpans,
      yearToPx,
      BASE_LINE_Y,
      SPAN_HEIGHT,
      SPAN_OFFSET,
      SPAN_GAP,
      SPAN_VERTICAL_GAP,
      spanChildPlacement,
      timelineStart: file.start,
      timelineEnd: file.end,
    });

    // Resolve the font for event measurement (file.font overrides theme/default)
    const fileFontSetting = file.font;
    const fallbackFont = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    let resolvedFont;
    if (fileFontSetting && String(fileFontSetting).toLowerCase() !== "default") {
      const safeName = String(fileFontSetting).replace(/"/g, '\\"');
      resolvedFont = `"${safeName}", ${fallbackFont}`;
    } else {
      resolvedFont = getComputedStyle(document.documentElement).getPropertyValue("--app-font-family").trim() || fallbackFont;
    }

    const finalEvents = layoutEvents({
      events: adjustedEvents,
      yearToPx,
      BASE_LINE_Y,
      spanBandHeight,
      EVENT_WIDTH,
      EVENT_GAP,
      LANE_SPACING,
      BOX_OFFSET,
      fixedEventHeight: Boolean(file.fixedEventHeight),
      fontFamily: resolvedFont,
    });

    const tlStartPx = yearToPx(file.start);
    const tlEndPx = yearToPx(file.end);
    const finalEras = adjustedEras.map((era) => {
      const clampedLeft = Math.max(yearToPx(era.start), tlStartPx);
      const clampedRight = Math.min(yearToPx(era.end), tlEndPx);
      const top = BASE_LINE_Y + ERA_OFFSET;
      return {
        ...era,
        left: clampedLeft,
        width: clampedRight - clampedLeft,
        top,
      };
    });

    // ticks
    const ticks = [];
    const monthMode = useMonths && minYear >= 0 && maxYear <= 9999 && step < 1;
    const monthLabels = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    if (monthMode) {
      const startYear = Math.floor(minYear);
      const endYear = Math.floor(maxYear);
      const startMonthIndex = Math.max(
        0,
        Math.min(11, Math.floor((minYear - startYear) * 12))
      );
      const endMonthIndex = Math.max(
        0,
        Math.min(11, Math.floor((maxYear - endYear) * 12))
      );
      const startAbsMonth = startYear * 12 + startMonthIndex;
      const endAbsMonth = endYear * 12 + endMonthIndex;

      for (let m = startAbsMonth; m <= endAbsMonth; m += 1) {
        const y = Math.floor(m / 12);
        const monthIndex = m % 12;
        const value = Number((y + monthIndex / 12).toFixed(6));
        if (isYearInZeroScale(value) || isZeroScaleBoundary(value)) {
          continue;
        }
        ticks.push({
          value,
          label: `${monthLabels[monthIndex]} ${y}`,
        });
      }
    } else {
      const startTick = Math.ceil(minYear / step) * step;
      for (let y = startTick; y <= maxYear; y += step) {
        if (isYearInZeroScale(y) || isZeroScaleBoundary(y)) {
          continue;
        }
        ticks.push({
          value: Number(y.toFixed(6)),
        });
      }
    }

    return {
      file,
      events,
      adjustedEvents,
      adjustedSpans,
      adjustedEras,
      spanChildPlacement,
      spanBandHeight,
      finalSpans,
      finalEvents,
      finalEras,
      minYear,
      maxYear,
      range,
      PX_PER_YEAR,
      step,
      timelineWidth,
      yearToPx,
      calculatedHeight,
      BASE_LINE_Y,
      ticks,
      normalizedScaleSections,
      compressedMin,
      compressedMax,
      TIMELINE_PADDING,
      decompressYear,
    };
  }, [timelineData, currentScale]);


  // Notify parent of height changes
  useEffect(() => {
    if (onHeightChange) {
      onHeightChange(calculatedHeight);
    }
  }, [calculatedHeight, onHeightChange]);

  useEffect(() => {
    // Skip during animation - year label is updated directly via DOM
    if (isPlaying) return;

    const container = containerRef.current;
    if (!container) return;
    const scale = scaleRef.current;
    const { maxX, range } = getPanBounds(container);
    const panPosition = maxX - (sliderValue / 100) * range;
    const viewportWidth = container.clientWidth;
    const centerPx = -panPosition + viewportWidth / 2;
    const timelineX = centerPx / scale;
    const compressedYear =
      (timelineX - TIMELINE_PADDING) / PX_PER_YEAR + compressedMin;
    const clampedCompressed = Math.min(
      Math.max(compressedYear, compressedMin),
      compressedMax
    );
    const rawYear = decompressYear(clampedCompressed);
    const showMonths = file.useMonths === true;
    const snappedYear = showMonths ? snapToMonthGrid(rawYear) : Math.round(rawYear);
    if (snappedYear !== lastViewportYearRef.current) {
      lastViewportYearRef.current = snappedYear;
      onViewportYearChange?.(snappedYear);
    }
    const displayYear = showMonths ? snappedYear : Math.round(snappedYear);
    const nextLabel = formatYear(displayYear, file.negID, file.posID, showMonths);
    if (nextLabel !== lastSliderLabelRef.current) {
      lastSliderLabelRef.current = nextLabel;
      setSliderYearLabel(nextLabel);
    }
  }, [
    sliderValue,
    isPlaying,
    currentScale,
    timelineWidth,
    PX_PER_YEAR,
    compressedMin,
    compressedMax,
    TIMELINE_PADDING,
    decompressYear,
    file,
  ]);

  // Helper function to apply transform
  const applyTransform = () => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const { x, y } = translateRef.current;
    const scale = scaleRef.current;
    timelineEl.style.transformOrigin = "0 0";
    timelineEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  };

  const queueSliderValue = (nextValue) => {
    pendingSliderValueRef.current = nextValue;
    if (sliderRafRef.current) return;
    sliderRafRef.current = requestAnimationFrame(() => {
      sliderRafRef.current = null;
      const value = pendingSliderValueRef.current;
      pendingSliderValueRef.current = null;
      if (typeof value === "number") {
        const delta = Math.abs(value - sliderValueRef.current);
        if (delta >= 0.01) {
          setSliderValue(value);
        }
      }
    });
  };

  const getPanBounds = (container) => {
    const scale = scaleRef.current;
    const scaledTimelineWidth = timelineWidth * scale;
    const viewportWidth = container.clientWidth;
    const baseMaxPan = Math.max(0, scaledTimelineWidth - viewportWidth);
    const extra = Math.max(0, viewportWidth / 2 - TIMELINE_PADDING * scale);
    return {
      minX: -baseMaxPan - extra,
      maxX: extra,
      range: baseMaxPan + extra * 2,
    };
  };

  const centerVertical = () => {
    const container = containerRef.current;
    if (!container) return;
    translateRef.current.y = container.clientHeight * 0.25;
    applyTransform();
  };

  const zoomToPoint = (zoomFactor, mouseX, mouseY) => {
    const container = containerRef.current;
    if (!container) return;

    const oldScale = scaleRef.current;
    const rect = container.getBoundingClientRect();
    const localX = mouseX - rect.left;
    const localY = mouseY - rect.top;

    const canvasX = (localX - translateRef.current.x) / oldScale;
    const canvasY = (localY - translateRef.current.y) / oldScale;

    const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.5), 5);
    scaleRef.current = newScale;

    translateRef.current.x = localX - canvasX * newScale;
    translateRef.current.y = localY - canvasY * newScale;

    const { minX, maxX } = getPanBounds(container);
    translateRef.current.x = Math.min(maxX, Math.max(minX, translateRef.current.x));

    applyTransform();
    setCurrentScale(newScale);
    if (onZoomChange) {
      onZoomChange(newScale);
    }
  };

  const handleZoomIn = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomToPoint(1.1, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleZoomOut = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomToPoint(0.9, rect.left + rect.width / 2, rect.top + rect.height / 2);
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
      y: rect.bottom + 4,
      align: "left",
      anchorLeft: rect.left,
      ready: false,
    });
  };

  useEffect(() => {
    if (!filterMenu || !filterMenuRef.current) return;
    const menuRect = filterMenuRef.current.getBoundingClientRect();
    const padding = 8;
    const maxX = window.innerWidth - menuRect.width - padding;
    const maxY = window.innerHeight - menuRect.height - padding;
    const preferredX = filterMenu.align === "left" && Number.isFinite(filterMenu.anchorLeft)
      ? filterMenu.anchorLeft - menuRect.width
      : filterMenu.x;
    const nextX = Math.min(Math.max(padding, preferredX), Math.max(padding, maxX));
    const nextY = Math.min(Math.max(padding, filterMenu.y), Math.max(padding, maxY));
    if (nextX !== filterMenu.x || nextY !== filterMenu.y || !filterMenu.ready) {
      setFilterMenu((prev) =>
        prev ? { ...prev, x: nextX, y: nextY, ready: true } : prev
      );
    }
  }, [filterMenu]);

  // Close filter menu when clicking outside
  useEffect(() => {
    if (!filterMenu) return;

    const handleClickOutside = (e) => {
      const clickedInsideMenu = filterMenuRef.current?.contains(e.target);
      const clickedFilterButton = filterButtonRef.current?.contains(e.target);
      if (!clickedInsideMenu && !clickedFilterButton) {
        setFilterMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterMenu]);

  // DPI + zoom/pan effect
  useEffect(() => {
    const container = containerRef.current;
    const timelineEl = timelineRef.current;
    if (!container || !timelineEl) return;

    // Initialize with vertical centering (similar to margin-top: 25vh)
    if (translateRef.current.x === 0 && translateRef.current.y === 0) {
      translateRef.current.y = container.clientHeight * 0.25;
      applyTransform();
    }

    // Notify parent of initial zoom
    if (onZoomChange) {
      onZoomChange(scaleRef.current);
    }

    // Zoom to cursor with transforms
      const handleWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        e.preventDefault();

        // Shift + scroll = vertical pan only
        if (e.shiftKey) {
          translateRef.current.y -= e.deltaY;
        }
        // Horizontal scroll (trackpad swipe) = horizontal pan only
        else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          translateRef.current.x -= e.deltaX;
        }
        // Regular scroll = horizontal pan (main timeline movement)
        else {
          translateRef.current.x -= e.deltaY;
        }

        // Clamp horizontal pan to timeline bounds
        const { minX, maxX, range } = getPanBounds(container);
        translateRef.current.x = Math.min(maxX, Math.max(minX, translateRef.current.x));

        applyTransform();

        if (!isPlaying && range > 0) {
          const panPercentage = ((maxX - translateRef.current.x) / range) * 100;
          queueSliderValue(Math.min(100, Math.max(0, panPercentage)));
        }

        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      const zoomFactor = delta < 0 ? 1.1 : 0.9;
      zoomToPoint(zoomFactor, e.clientX, e.clientY);
    };

    // Pan with mouse drag
    const handleMouseDown = (e) => {
      const isMiddleClick = e.button === 1;
      const isLeftClick = e.button === 0;
      const isShiftPan = isLeftClick && e.shiftKey;
      const interactiveSelector = [
        ".event",
        ".span-item",
        ".era-item",
        ".timeline-canvas-bar",
        ".timeline-canvas-button",
        ".timeline-slider",
        ".timeline-slider-container",
        ".timeline-context-menu",
      ].join(", ");
      const clickedInteractive = e.target.closest(interactiveSelector);
      const clickedFormControl = e.target.closest("input, textarea, button, select, a");
      const allowLeftDrag = isLeftClick && !clickedInteractive && !clickedFormControl;

      // Allow middle mouse, shift+left, or left-drag on empty canvas.
      if (isMiddleClick || isShiftPan || allowLeftDrag) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e) => {
      if (!isPanningRef.current) return;

      const dx = e.clientX - lastPanPositionRef.current.x;
      const dy = e.clientY - lastPanPositionRef.current.y;

      translateRef.current.x += dx;
      translateRef.current.y += dy;

      // Clamp horizontal pan to timeline bounds
      const { minX, maxX, range } = getPanBounds(container);
      translateRef.current.x = Math.min(maxX, Math.max(minX, translateRef.current.x));

      lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
      applyTransform();

      // Update slider when panning horizontally
      if (!isPlaying && range > 0) {
        const panPercentage = ((maxX - translateRef.current.x) / range) * 100;
        queueSliderValue(Math.min(100, Math.max(0, panPercentage)));
      }
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        container.style.cursor = '';
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onZoomChange, timelineWidth, isPlaying]);

  // Pan to selected item with smooth animation
  useEffect(() => {
    if (!selectedId) return;

    const container = containerRef.current;
    const timelineEl = timelineRef.current;
    if (!container || !timelineEl) return;

    const dom = timelineEl.querySelector(`[data-id="${selectedId}"]`);
    if (!dom) return;

    // Get element position in timeline coordinates
    const rect = dom.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Find the selected element to check its type
    const selectedElement = timelineData.elements.find(el => el.id === selectedId);
    const isSpan = selectedElement?.type === 'span';

    // Calculate target position
    let elementTargetX, elementTargetY;

    if (isSpan) {
      // For spans, go to the start (left edge)
      elementTargetX = rect.left - containerRect.left;
      elementTargetY = rect.top + rect.height / 2 - containerRect.top;
    } else {
      // For events and eras, center the element
      elementTargetX = rect.left + rect.width / 2 - containerRect.left;
      elementTargetY = rect.top + rect.height / 2 - containerRect.top;
    }

    const viewportCenterX = containerRect.width / 2;
    const viewportCenterY = containerRect.height / 2;

    // Calculate target translate values
    let targetX = translateRef.current.x + (viewportCenterX - elementTargetX);
    const targetY = translateRef.current.y + (viewportCenterY - elementTargetY);

    // Clamp target position to scroll bounds
    const { minX, maxX } = getPanBounds(container);
    targetX = Math.min(maxX, Math.max(minX, targetX));

    // Animate to target position
    const startX = translateRef.current.x;
    const startY = translateRef.current.y;
    const duration = 500; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      translateRef.current.x = startX + (targetX - startX) * easeProgress;
      translateRef.current.y = startY + (targetY - startY) * easeProgress;

      applyTransform();

      // Update scrollbar during animation
      if (!isPlaying) {
        const { maxX, range } = getPanBounds(container);

        if (range > 0) {
          const panPercentage = ((maxX - translateRef.current.x) / range) * 100;
          queueSliderValue(Math.min(100, Math.max(0, panPercentage)));
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [selectedId, timelineData.elements]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e) => {
      const menu = document.querySelector('.timeline-context-menu');
      if (menu && !menu.contains(e.target)) {
        setContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  const handleContextMenu = (e) => {
    const target = e.target;
    const elementNode = target.closest('.event, .span-item, .era-item');
    const elementId = elementNode?.getAttribute('data-id');
    const element = elementId
      ? timelineData.elements.find((el) => el.id === elementId)
      : null;

    e.preventDefault();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      element,
    });
  };

  const handleMenuAction = (action) => {
    setContextMenu(null);
    action();
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(timelineData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${file?.id || 'timeline'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = async () => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;

      // Store the current transform
      const currentTransform = timelineEl.style.transform;
      const currentTransformOrigin = timelineEl.style.transformOrigin;

      const root = document.documentElement;
      const originalPrimaryBg = getComputedStyle(root).getPropertyValue('--primary-bg').trim();

      // Temporarily remove transform
      timelineEl.style.transform = 'none';
      timelineEl.style.transformOrigin = '';

      // Set --primary-bg to transparent or custom color if requested
      if (exportPngOptions?.transparentBg) {
        root.style.setProperty('--primary-bg', 'transparent');
      } else if (exportPngOptions?.customBg) {
        root.style.setProperty('--primary-bg', exportPngOptions.customBg);
      }

      const requestedStartYear = Number(exportPngOptions?.exportStartYear);
      const requestedEndYear = Number(exportPngOptions?.exportEndYear);
      const hasCustomRange = Number.isFinite(requestedStartYear) && Number.isFinite(requestedEndYear);
      const targetW = exportPngOptions?.targetWidth;
      const minRequestedYear = hasCustomRange ? Math.min(requestedStartYear, requestedEndYear) : null;
      const maxRequestedYear = hasCustomRange ? Math.max(requestedStartYear, requestedEndYear) : null;
      const sourceStartPxBase = hasCustomRange ? yearToPx(minRequestedYear) : 0;
      const sourceEndPxBase = hasCustomRange ? yearToPx(maxRequestedYear) : timelineEl.scrollWidth;
      const sourceWidthPxBase = Math.max(1, sourceEndPxBase - sourceStartPxBase);

      let scale = 2;
      if (targetW) {
        // For fixed export presets, use range width as the zoom window so output width stays at targetW.
        scale = hasCustomRange
          ? targetW / sourceWidthPxBase
          : targetW / timelineEl.scrollWidth;
      }

      const bgColor = exportPngOptions?.transparentBg
        ? null
        : (exportPngOptions?.customBg || originalPrimaryBg);

      const canvas = await html2canvas(timelineEl, {
        backgroundColor: bgColor,
        scale,
        logging: false,
        height: calculatedHeight + 100,
        windowHeight: calculatedHeight + 100,
      });

      if (exportPngOptions?.transparentBg || exportPngOptions?.customBg) {
        root.style.setProperty('--primary-bg', originalPrimaryBg);
      }

      timelineEl.style.transform = currentTransform;
      timelineEl.style.transformOrigin = currentTransformOrigin;

      let finalCanvas = canvas;
      const fillColor = exportPngOptions?.customBg || originalPrimaryBg;
      if (hasCustomRange) {
        const pxStart = sourceStartPxBase * scale;
        const pxEnd = sourceEndPxBase * scale;
        const sourceStart = Math.max(0, Math.min(finalCanvas.width, Math.round(pxStart)));
        const sourceEnd = Math.max(0, Math.min(finalCanvas.width, Math.round(pxEnd)));
        const sourceWidth = Math.max(1, sourceEnd - sourceStart);

        if (sourceWidth > 0) {
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = sourceWidth;
          croppedCanvas.height = finalCanvas.height;
          const cropCtx = croppedCanvas.getContext('2d');
          cropCtx.drawImage(
            finalCanvas,
            sourceStart,
            0,
            sourceWidth,
            finalCanvas.height,
            0,
            0,
            sourceWidth,
            finalCanvas.height
          );
          finalCanvas = croppedCanvas;
        }
      }

      // In fixed presets, custom-range capture already maps to target width (zoom behavior).
      // Keep a fallback resize for non-range exports and rounding differences.
      if (targetW && (!hasCustomRange || Math.abs(finalCanvas.width - targetW) > 1)) {
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = targetW;
        resizedCanvas.height = Math.max(1, Math.round((finalCanvas.height * targetW) / finalCanvas.width));
        const resizedCtx = resizedCanvas.getContext('2d');

        if (exportPngOptions?.transparentBg) {
          resizedCtx.clearRect(0, 0, resizedCanvas.width, resizedCanvas.height);
        } else {
          resizedCtx.fillStyle = fillColor;
          resizedCtx.fillRect(0, 0, resizedCanvas.width, resizedCanvas.height);
        }

        resizedCtx.drawImage(finalCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
        finalCanvas = resizedCanvas;
      }

      // If target height is taller than the rendered canvas, pad and center vertically
      const targetH = exportPngOptions?.targetHeight;
      if (targetH && finalCanvas.height < targetH) {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = finalCanvas.width;
        outCanvas.height = targetH;
        const ctx = outCanvas.getContext('2d');

        if (exportPngOptions?.transparentBg) {
          ctx.clearRect(0, 0, finalCanvas.width, targetH);
        } else {
          ctx.fillStyle = fillColor;
          ctx.fillRect(0, 0, finalCanvas.width, targetH);
        }

        // Center the timeline vertically
        const yOffset = Math.round((targetH - finalCanvas.height) / 2);
        ctx.drawImage(finalCanvas, 0, yOffset);
        finalCanvas = outCanvas;
      }

      // Draw title watermark if requested
      const titleStyle = exportPngOptions?.titleStyle || 'title-logo';
      const canRenderTitleWatermark =
        exportPngOptions?.showTitle &&
        (titleStyle === 'logo-only' || Boolean(exportPngOptions?.title));
      if (canRenderTitleWatermark) {
        const w = finalCanvas.width;
        const h = finalCanvas.height;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(finalCanvas, 0, 0);

        const fontSize = Math.max(14, Math.round(w * 0.018));
        const padding = Math.round(fontSize * 1.5);
        const computedStyle = getComputedStyle(document.documentElement);
        const themeFont = computedStyle.getPropertyValue('--app-font-family').trim() || 'Inter, system-ui, sans-serif';
        const themeColor = computedStyle.getPropertyValue('--dark-bg').trim() || '#888';
        ctx.font = `700 ${fontSize}px ${themeFont}`;
        ctx.fillStyle = themeColor;

        const pos = exportPngOptions.titlePosition || 'bottom-right';
        const showText = titleStyle !== 'logo-only';
        const showLogo = titleStyle !== 'title-only';
        const titleText = showText ? exportPngOptions.title : '';
        const metrics = ctx.measureText(titleText);
        const logoHeight = Math.round(fontSize * 0.8);
        const logoWidth = (67 / 25) * logoHeight;
        const logoGap = Math.round(fontSize * 0.35);
        const logoBaselineOffset = fontSize * 0.08;
        const totalWidth = metrics.width + (showLogo ? ((showText ? logoGap : 0) + logoWidth) : 0);
        let x, y;

        if (pos.includes('left')) x = padding;
        else if (pos.includes('center')) x = (w - totalWidth) / 2;
        else x = w - totalWidth - padding;

        if (pos.includes('top')) y = padding + fontSize;
        else y = h - padding;

        if (showText) {
          ctx.fillText(titleText, x, y);
        }

        if (showLogo) {
          const logoX = x + metrics.width + (showText ? logoGap : 0);
          const logoY = y - logoHeight + logoBaselineOffset;
          const scale = logoHeight / 25;
          ctx.save();
          ctx.translate(logoX, logoY);
          ctx.scale(scale, scale);
          ctx.fillRect(0, 8.89844, 28.2656, 6.80469);
          ctx.fillRect(35.0703, 0, 31.9297, 7.32812);
          ctx.fillRect(35.0703, 16.75, 31.9297, 7.32812);
          ctx.beginPath();
          ctx.moveTo(35.0703, 0);
          ctx.lineTo(35.0703, 24.0781);
          ctx.lineTo(33.2656, 24.0781);
          ctx.bezierCurveTo(30.5042, 24.0781, 28.2656, 21.8395, 28.2656, 19.0781);
          ctx.lineTo(28.2656, 5);
          ctx.bezierCurveTo(28.2656, 2.23858, 30.5042, 0, 33.2656, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        finalCanvas = outCanvas;
      }

      finalCanvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to generate PNG — canvas may be too large for this resolution.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const exportFilename = exportPngOptions?.filename || file?.id || 'timeline';
        link.download = `${exportFilename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Error generating PNG:', error);
    }
  };

  const handleSliderChange = (e) => {
    if (e?.nativeEvent && e.nativeEvent.isTrusted === false) return;
    const value = parseFloat(e.target.value);
    if (!Number.isFinite(value)) return;
    if (Math.abs(value - sliderValueRef.current) < 0.01) return;
    sliderInputRef.current = true;
    setSliderValue(value);

    const container = containerRef.current;
    if (!container) return;

    const { minX: _minX, maxX, range } = getPanBounds(container);
    const panPosition = maxX - (value / 100) * range;

    translateRef.current.x = panPosition;
    applyTransform();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      // Sync React state with current DOM values when pausing
      setSliderValue(sliderValueRef.current);
      if (yearLabelRef.current) {
        setSliderYearLabel(yearLabelRef.current.textContent || "");
      }
      if (lastViewportYearRef.current !== null) {
        onViewportYearChange?.(lastViewportYearRef.current);
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Stop animation and select an element
  const handleSelect = (id) => {
    if (isPlaying) {
      // Stop animation and sync state
      setSliderValue(sliderValueRef.current);
      if (yearLabelRef.current) {
        setSliderYearLabel(yearLabelRef.current.textContent || "");
      }
      if (lastViewportYearRef.current !== null) {
        onViewportYearChange?.(lastViewportYearRef.current);
      }
      setIsPlaying(false);
    }
    onSelect?.(id);
  };

  // Animation effect
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastPlayTimeRef.current = null;
      return;
    }

    // Capture values at animation start to avoid dependency issues
    const capturedPxPerYear = PX_PER_YEAR;
    const capturedPadding = TIMELINE_PADDING;
    const capturedMin = compressedMin;
    const capturedMax = compressedMax;
    const capturedDecompress = decompressYear;
    const capturedFile = file;
    const capturedTimelineWidth = timelineWidth;

    const animate = (time) => {
      const container = containerRef.current;
      if (!container) return;

      const { minX, maxX, range } = getPanBounds(container);

      if (range <= 0) {
        setIsPlaying(false);
        return;
      }

      if (lastPlayTimeRef.current === null) {
        lastPlayTimeRef.current = time;
      }

      const deltaMs = time - lastPlayTimeRef.current;
      lastPlayTimeRef.current = time;

      const speedPxPerSec = 220;
      const deltaPx = (speedPxPerSec * deltaMs) / 1000;

      let nextX = translateRef.current.x - deltaPx;
      nextX = Math.min(maxX, Math.max(minX, nextX));
      translateRef.current.x = nextX;
      applyTransform();

      const panPercentage = ((maxX - nextX) / range) * 100;
      const clampedPercentage = Math.min(100, Math.max(0, panPercentage));

      // Update slider directly via DOM during animation
      if (sliderElementRef.current) {
        sliderElementRef.current.value = clampedPercentage;
      }
      sliderValueRef.current = clampedPercentage;

      // Update viewport indicator position directly via DOM
      if (viewportIndicatorRef.current) {
        const scale = scaleRef.current;
        const viewportWidth = container.clientWidth;
        const scaledTimelineWidth = capturedTimelineWidth * scale;
        const extra = Math.max(0, viewportWidth / 2 - capturedPadding * scale);
        const totalScrollable = scaledTimelineWidth + extra * 2;
        const viewportWidthPercent = Math.min(100, (viewportWidth / totalScrollable) * 100);
        const halfWidth = viewportWidthPercent / 2;
        const safeRange = 100 - viewportWidthPercent;
        const mappedPosition = halfWidth + (clampedPercentage / 100) * safeRange;
        viewportIndicatorRef.current.style.left = `${mappedPosition}%`;
      }

      // Update year label directly via DOM during animation
      const scale = scaleRef.current;
      const viewportWidth = container.clientWidth;
      const centerPx = -nextX + viewportWidth / 2;
      const timelineX = centerPx / scale;
      const compressedYear = (timelineX - capturedPadding) / capturedPxPerYear + capturedMin;
      const clampedCompressed = Math.min(Math.max(compressedYear, capturedMin), capturedMax);
      const rawYear = capturedDecompress(clampedCompressed);
      const showMonths = capturedFile.useMonths === true;
      const snappedYear = showMonths ? snapToMonthGrid(rawYear) : Math.round(rawYear);
      const displayYear = showMonths ? snappedYear : Math.round(snappedYear);
      const nextLabel = formatYear(displayYear, capturedFile.negID, capturedFile.posID, showMonths);

      if (yearLabelRef.current && nextLabel !== lastSliderLabelRef.current) {
        lastSliderLabelRef.current = nextLabel;
        yearLabelRef.current.textContent = nextLabel;
      }

      // Track viewport year for sync when animation ends (don't call during animation to avoid jitter)
      lastViewportYearRef.current = snappedYear;

      if (nextX <= minX + 0.5) {
        // Sync React state when animation ends
        setSliderValue(clampedPercentage);
        setSliderYearLabel(nextLabel);
        onViewportYearChange?.(snappedYear);
        setIsPlaying(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Update pan position when slider value changes during animation
  useEffect(() => {
    if (isPlaying) return;
    if (!sliderInputRef.current) return;
    sliderInputRef.current = false;

    const container = containerRef.current;
    if (!container) return;

    const { maxX, range } = getPanBounds(container);
    const panPosition = maxX - (sliderValue / 100) * range;

    translateRef.current.x = panPosition;
    applyTransform();
  }, [sliderValue, isPlaying, timelineWidth]);

  // Update slider based on current pan position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isPlaying) return; // Don't update if playing to avoid conflicts

    const { maxX, range } = getPanBounds(container);

    if (range <= 0) {
      queueSliderValue(0);
      return;
    }

    // Calculate current pan percentage (translateRef.x is negative when panned right)
    const panPercentage = ((maxX - translateRef.current.x) / range) * 100;
    queueSliderValue(Math.min(100, Math.max(0, panPercentage)));
  }, [currentScale, isPlaying, timelineWidth]);

  // Trigger PNG download when requested from outside (e.g., Sidebar)
  const lastPngTriggerRef = useRef(downloadPngTrigger);
  useEffect(() => {
    if (downloadPngTrigger > 0 && downloadPngTrigger !== lastPngTriggerRef.current) {
      lastPngTriggerRef.current = downloadPngTrigger;
      handleDownloadPNG();
    }
  }, [downloadPngTrigger]);

  useImperativeHandle(ref, () => ({
    generatePreview: async (options) => {
      const timelineEl = timelineRef.current;
      if (!timelineEl) return null;

      try {
        const html2canvas = (await import('html2canvas')).default;

        const currentTransform = timelineEl.style.transform;
        const currentTransformOrigin = timelineEl.style.transformOrigin;

        // Store original --primary-bg and set to transparent if needed
        const root = document.documentElement;
        const originalPrimaryBg = getComputedStyle(root).getPropertyValue('--primary-bg').trim();

        timelineEl.style.transform = 'none';
        timelineEl.style.transformOrigin = '';

        if (options?.transparentBg) {
          root.style.setProperty('--primary-bg', 'transparent');
        } else if (options?.customBg) {
          root.style.setProperty('--primary-bg', options.customBg);
        }

        const elWidth = timelineEl.scrollWidth;
        const elHeight = calculatedHeight + 100;

        const previewBgColor = options?.transparentBg
          ? null
          : (options?.customBg || originalPrimaryBg);

        const canvas = await html2canvas(timelineEl, {
          backgroundColor: previewBgColor,
          scale: 1,
          logging: false,
          height: elHeight,
          windowHeight: elHeight,
        });

        // Restore original --primary-bg
        if (options?.transparentBg || options?.customBg) {
          root.style.setProperty('--primary-bg', originalPrimaryBg);
        }

        timelineEl.style.transform = currentTransform;
        timelineEl.style.transformOrigin = currentTransformOrigin;

        const minYear = file?.start ?? 0;
        const maxYear = file?.end ?? 2024;

        return {
          imageUrl: canvas.toDataURL('image/png'),
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          elementWidth: elWidth,
          elementHeight: elHeight,
          timelineWidth,
          minYear,
          maxYear,
          yearToPercent: (year) => {
            const px = yearToPx(year);
            return (px / canvas.width) * 100;
          },
          percentToYear: (percent) => {
            const px = (percent / 100) * canvas.width;
            const compressedYear = (px - TIMELINE_PADDING) / PX_PER_YEAR + compressedMin;
            const clampedCompressed = Math.min(Math.max(compressedYear, compressedMin), compressedMax);
            const year = decompressYear(clampedCompressed);
            return Math.round(year * 100) / 100;
          },
        };
      } catch (error) {
        console.error('Error generating preview:', error);
        return null;
      }
    }
  }), [calculatedHeight, yearToPx, timelineWidth, file, TIMELINE_PADDING, PX_PER_YEAR, compressedMin, compressedMax, decompressYear]);

  // Sync slider element with state (for non-animation updates like panning)
  useEffect(() => {
    sliderValueRef.current = sliderValue;
    if (sliderElementRef.current && !isPlaying) {
      sliderElementRef.current.value = sliderValue;
    }
  }, [sliderValue, isPlaying]);

  useEffect(() => {
    return () => {
      if (sliderRafRef.current) {
        cancelAnimationFrame(sliderRafRef.current);
        sliderRafRef.current = null;
      }
      pendingSliderValueRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="timeline-scroll"
      onClick={() => handleSelect(null)} // clear selection on background click
      onContextMenu={handleContextMenu}
    >
      <div
        ref={timelineRef}
        className="timeline"
        style={{ width: `${timelineWidth}px`, height: `${calculatedHeight * 2}px` }}
      >
        {/* Timeline line with scale section gaps */}
        {normalizedScaleSections.filter((s) => s.scale === 0).length === 0 ? (
          <div className="timeline-line" style={{ top: `${BASE_LINE_Y}px` }} />
        ) : (
          <div className="timeline-line-segments" style={{ top: `${BASE_LINE_Y}px` }}>
            {(() => {
              const segments = [];
              const GAP_WIDTH = 24;
              const GAP_OVERLAP = 2;
              let lastEnd = -100;

              normalizedScaleSections
                .filter((s) => s.scale === 0)
                .forEach((section, index) => {
                  const sectionPx = yearToPx(section.start);

                  segments.push(
                    <div
                      key={`segment-${index}`}
                      className="timeline-line-segment"
                      style={{
                        left: `${lastEnd}px`,
                        width: `${sectionPx - lastEnd - GAP_WIDTH / 2 + GAP_OVERLAP}px`,
                      }}
                    />
                  );

                  const startLabel = formatYear(section.start, file.negID, file.posID, false);
                  const endLabel = formatYear(section.end, file.negID, file.posID, false);
                  segments.push(
                    <div
                      key={`break-${index}`}
                      className="timeline-scale-break-indicator"
                      style={{
                        left: `${sectionPx - GAP_WIDTH / 2}px`,
                        width: `${GAP_WIDTH}px`,
                      }}
                    >
                      <svg viewBox="0 0 20 10" preserveAspectRatio="none">
                        <path
                          d="M0,5 L4,5 L7,1 L10,9 L13,1 L16,5 L20,5"
                          stroke="var(--dark-bg)"
                          strokeWidth="3"
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                          fill="none"
                        />
                      </svg>
                      <div className="timeline-scale-break-label">{startLabel} – {endLabel}</div>
                    </div>
                  );

                  lastEnd = sectionPx + GAP_WIDTH / 2 - GAP_OVERLAP;
                });

              segments.push(
                <div
                  key="segment-final"
                  className="timeline-line-segment"
                  style={{
                    left: `${lastEnd}px`,
                    right: '0',
                  }}
                />
              );

              return segments;
            })()}
          </div>
        )}

        <div className="eras-layer">
          {finalEras.map((era) => {
            const isSelected = selectedId === era.id;
            const eraTextColor = getReadableTextColor(era.color || "var(--tertiary-bg)");
            return (
              <div
                key={era.id}
                data-id={era.id}
                className={`era-item ${isSelected ? "is-selected" : ""}`}
                style={{
                  left: `${era.left}px`,
                  width: `${era.width}px`,
                  top: `${era.top}px`,
                  background: `${era.color || "var(--tertiary-bg)"}`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(era.id);
                }}
              >
                <span
                  className="era-title"
                  style={{
                    color: eraTextColor,
                    opacity: 1,
                  }}
                >
                  {era.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Connectors layer - behind everything */}
        <div className="connectors-layer">
          {finalSpans.map((span) => {
            const SPAN_HEIGHT = 23;
            const placement = spanChildPlacement[span.id];
            const isChild = !!placement;
            const isTopChild = isChild && placement.offset > 0;
            const isBottomChild = isChild && placement.offset < 0;

            if (!isChild) return null;

            // Calculate actual visual distance for connector height and offset
            let connectorHeight = undefined;
            let connectorOffset = undefined;
            const parentSpan = finalSpans.find(s => s.id === placement.parentId);
            if (parentSpan) {
              const laneDifference = Math.abs(span.lane - parentSpan.lane);
              if (laneDifference > 1) {
                const SPAN_HEIGHT = 23;
                const childTop = span.top;
                const parentTop = parentSpan.top;
                const deltaTop = parentTop - childTop;
                const extraTrim = 12;
                const height = Math.max(0, Math.abs(deltaTop) + SPAN_HEIGHT - extraTrim);
                connectorHeight = `${height}px`;
                connectorOffset = deltaTop < 0 ? `${deltaTop + extraTrim - 3}px` : `0px`;
              }
            }

            const CONNECTOR_OFFSET_X = 19;
            const laneDifference = parentSpan ? Math.abs(span.lane - parentSpan.lane) : 0;
            const connectorLeft =
              span.left - (laneDifference === 1 ? CONNECTOR_OFFSET_X : 0);

            return (
              <div
                key={`connector-${span.id}`}
                style={{
                  position: 'absolute',
                  left: `${connectorLeft}px`,
                  top: `${span.top}px`,
                  zIndex: 1000 - laneDifference,
                  pointerEvents: 'none',
                }}
              >
                {isTopChild && (
                  <div
                    className="span-connector-top"
                    style={{
                      backgroundColor: span.color || "var(--element-bg)",
                      paddingTop: connectorHeight,
                      transform: connectorOffset
                        ? `translate(-19px, ${connectorOffset})`
                        : undefined,
                    }}
                  />
                )}
                {isBottomChild && (
                  <div
                    className="span-connector-bottom"
                    style={{
                      backgroundColor: span.color || "var(--element-bg)",
                      paddingTop: connectorHeight,
                      transform: connectorOffset
                        ? `translate(-19px, ${connectorOffset})`
                        : undefined,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="spans-layer">
          {finalSpans.map((span) => {
            const isSelected = selectedId === span.id;
            const spanTextColor = getReadableTextColor(span.color || "var(--element-bg)");

            return (
              <div
                key={span.id}
                data-id={span.id}
                className={`span-item ${isSelected ? "is-selected" : ""}`}
                style={{
                  left: `${span.left + (spanChildPlacement[span.id] ? -2 : 0)}px`,
                  width: `${span.width + (spanChildPlacement[span.id] ? 2 : 0)}px`,
                  top: `${span.top}px`,
                  background: span.color || "var(--element-bg)"
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(span.id);
                }}
              >
                <span className="span-title" style={{ color: spanTextColor }}>{span.title}</span>
                <span className="span-years" style={{ color: spanTextColor, opacity: 0.7 }}>
                  {span.startLabel ?? formatYear(span.start, file.negID, file.posID, file.useMonths === true)} - {span.endLabel ?? formatYear(span.end, file.negID, file.posID, file.useMonths === true)}
                </span>
                {(() => {
                  const visiblePinnedTags = (Array.isArray(span.tags) ? span.tags : [])
                    .filter((tag) => pinnedTags.includes(tag));
                  if (visiblePinnedTags.length === 0) return null;
                  return (
                    <span className="pinned-tags" style={{ color: spanTextColor }}>
                      {visiblePinnedTags.map((tag) => (
                        <span key={tag} className="pinned-tag">
                          {tag}
                        </span>
                      ))}
                    </span>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Event lines layer - behind spans and events */}
        <div className="event-lines-layer">
          {finalEvents.map((event) => {
            const eventLineStyle = event.eventLineStyle || "solid";
            if (eventLineStyle === "none") return null;

            const parentId = event.parents?.[0];
            const parentSpan = parentId
              ? finalSpans.find((span) => span.id === parentId)
              : null;

            const fallbackTargetY = BASE_LINE_Y;
            const targetY = parentSpan ? parentSpan.top : fallbackTargetY;

            const eventBottom = event.top + (event._boxHeight || 29);

            const lineHeight = Math.abs(eventBottom - targetY);
            const parentColor = parentSpan?.color;
            const lineColor = parentColor || 'var(--element-bg)';
            const isDashed = eventLineStyle === "dashed";
            const isDotted = eventLineStyle === "dotted";

            return (
              <div
                key={`event-line-${event.id}`}
                className="event-line-container"
                style={{
                  position: 'absolute',
                  left: `${event._x}px`,
                  top: `${eventBottom}px`,
                  pointerEvents: 'none',
                  zIndex: Math.round(event.top),
                }}
              >
                <div
                  className="event-line"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '0',
                    transform: 'translateX(-50%)',
                    width: isDashed || isDotted ? '0' : '2px',
                    height: `${lineHeight}px`,
                    background: isDashed || isDotted ? 'transparent' : lineColor,
                    borderLeft: isDashed
                      ? `2px dashed ${lineColor}`
                      : isDotted
                        ? `2px dotted ${lineColor}`
                        : 'none',
                  }}
                />
                <div
                  className="event-dot"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: `${lineHeight}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '8px',
                    height: '8px',
                    background: lineColor,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="events-layer">
          {finalEvents.map((event) => {
            const parentId = event.parents?.[0];
            const parentSpan = parentId
              ? finalSpans.find((span) => span.id === parentId)
              : null;

            const parentColor = parentSpan?.color;
            const isSelected = selectedId === event.id;
            const eventBorderStyle = event.eventBorderStyle || "solid";
            const borderColor = parentColor || "var(--element-bg)";
            const borderValue =
              eventBorderStyle === "none"
                ? "none"
                : `2px ${eventBorderStyle} ${borderColor}`;
            return (
              <div
                key={event.id}
                data-id={event.id}
                className={`event ${isSelected ? "is-selected" : ""}${event._isMultiLine ? " multi-lane" : ""}`}
                style={{
                  left: `${event._x}px`,
                  top: `${event.top}px`,
                  position: "absolute",
                  border: borderValue,
                  height: event._isMultiLine ? "auto" : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(event.id);
                }}
              >
                <div className="event-title">{event.title}</div>
                <div className="event-date">
                  {event.dateLabel ?? formatYear(event.date, file.negID, file.posID, file.useMonths === true)}
                  {(() => {
                    const visiblePinnedTags = (Array.isArray(event.tags) ? event.tags : [])
                      .filter((tag) => pinnedTags.includes(tag));
                    if (visiblePinnedTags.length === 0) return null;
                    return (
                      <span className="pinned-tags">
                        {visiblePinnedTags.map((tag) => (
                          <span key={tag} className="pinned-tag">
                            {tag}
                          </span>
                        ))}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {(() => {
          // Per-tick label visibility based on actual pixel distance from last shown label
          const MIN_LABEL_GAP = 8;
          const CHAR_WIDTH = 5.5; // approximate at 9px font
          let lastLabelRight = -Infinity;
          return ticks.map((tick) => {
            const px = yearToPx(tick.value);
            const label = tick.label ?? formatYear(tick.value, file.negID, file.posID, false);
            const halfWidth = (label.length * CHAR_WIDTH) / 2;
            const labelLeft = px - halfWidth;
            const showLabel = labelLeft >= lastLabelRight + MIN_LABEL_GAP;
            if (showLabel) {
              lastLabelRight = px + halfWidth;
            }
            if (!showLabel) return null;
            return (
              <div
                key={tick.value}
                className="tick"
                style={{
                  left: `${yearToPx(tick.value)}px`,
                  top: `${BASE_LINE_Y - 5}px`,
                }}
              >
                <div className="tick-line" />
                <div className="tick-label">{label}</div>
              </div>
            );
          });
        })()}
      </div>

      {contextMenu && contextMenu.element && (
        <div
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onEditElement?.(contextMenu.element.id))}
          >
            <Edit2 size={16} />
            <span>Edit {contextMenu.element.type.charAt(0).toUpperCase() + contextMenu.element.type.slice(1)}</span>
          </button>
          {contextMenu.element.type !== "era" && (
            <button
              className="context-menu-item"
              onClick={() => handleMenuAction(() => onDuplicateElement?.(contextMenu.element.id))}
            >
              <Copy size={16} />
              <span>Duplicate {contextMenu.element.type.charAt(0).toUpperCase() + contextMenu.element.type.slice(1)}</span>
            </button>
          )}
          <div className="context-menu-separator" />
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => handleMenuAction(() => onDelete?.(contextMenu.element.id))}
          >
            <Trash2 size={16} />
            <span>Delete {contextMenu.element.type.charAt(0).toUpperCase() + contextMenu.element.type.slice(1)}</span>
          </button>
        </div>
      )}

      {contextMenu && !contextMenu.element && (
        <div
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(onAddEvent)}
          >
            <RectangleHorizontal size={16} />
            <span>Add Event</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(onAddSpan)}
          >
            <RectangleEllipsis size={16} />
            <span>Add Span</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(onAddEra)}
          >
            <SquareSplitHorizontal size={16} />
            <span>Add Era</span>
          </button>

          <div className="context-menu-separator" />

          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(handleDownloadJSON)}
          >
            <FileJson size={16} />
            <span>Download .json</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleMenuAction(() => onExportPng?.())}
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

      <div className="timeline-canvas-bar" style={{ right: `${zoomButtonOffset}px` }}>
        <button
          type="button"
          className="timeline-canvas-button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="timeline-canvas-button"
          onClick={centerVertical}
          aria-label="Center vertically"
          title="Center vertically"
        >
          <MoveVertical size={16} />
        </button>
        <button
          type="button"
          className="timeline-canvas-button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={16} />
        </button>
        <div className="timeline-canvas-divider" />
        <button
          type="button"
          className={`timeline-canvas-button${(activeTags.length > 0 || hiddenTags.length > 0) ? ' timeline-canvas-button-active' : ''}`}
          onClick={handleToggleFilterMenu}
          aria-label="Filter"
          title="Filter"
          ref={filterButtonRef}
        >
          <ListFilter size={16} />
        </button>
        <button
          type="button"
          className="timeline-canvas-button"
          onClick={onOpenSettings}
          aria-label="Timeline settings"
          title="Timeline settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {filterMenu && (
        <div
          ref={filterMenuRef}
          className="timeline-context-menu sidebar-filter-menu"
          style={{
            position: 'fixed',
            left: `${filterMenu.x}px`,
            top: `${filterMenu.y}px`,
            opacity: filterMenu.ready ? 1 : 0,
            pointerEvents: filterMenu.ready ? "auto" : "none",
          }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onWheelCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="filter-menu-dropdown">
            {allTags.length === 0 && (
              <div className="filter-menu-empty">No tags found</div>
            )}
            {allTags.map((tag) => {
              const isShown = activeTags.includes(tag);
              const isHidden = hiddenTags.includes(tag);
              const isPinned = pinnedTags.includes(tag);
              return (
                <div key={tag} className="context-menu-item filter-menu-item filter-menu-item-with-pin">
                  <span className="filter-menu-label">{tag}</span>
                  <div className="filter-menu-actions">
                    <button
                      type="button"
                      className={`filter-menu-icon-btn filter-menu-show-btn${isShown ? " is-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTag?.(tag);
                      }}
                      aria-label={isShown ? "Disable show filter for tag" : "Enable show filter for tag"}
                      title={isShown ? "Disable show filter for tag" : "Enable show filter for tag"}
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      className={`filter-menu-icon-btn filter-menu-hide-btn${isHidden ? " is-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHiddenTag?.(tag);
                      }}
                      aria-label={isHidden ? "Disable hide filter for tag" : "Enable hide filter for tag"}
                      title={isHidden ? "Disable hide filter for tag" : "Enable hide filter for tag"}
                    >
                      <EyeOff size={12} />
                    </button>
                  <button
                    type="button"
                    className={`filter-menu-icon-btn filter-menu-pin-btn${isPinned ? " is-pinned" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinnedTag?.(tag);
                    }}
                    aria-label={isPinned ? "Remove label" : "Use as label"}
                    title={isPinned ? "Remove label" : "Use as label"}
                  >
                    <Tag size={12} />
                  </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="filter-menu-divider" />
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
          <button
            className="context-menu-item"
            type="button"
            onClick={() => onClearTags?.()}
          >
            Clear
          </button>
        </div>
      )}

      <div
        className="timeline-slider-container"
        style={{ left: `calc(50% + ${sliderOffset / 2}px)` }}
      >
        <button
          className="slider-play-button"
          onClick={handlePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={16} strokeWidth={2} />
          ) : (
            <Play size={16} strokeWidth={2} />
          )}
        </button>
        <div className="slider-track">
          <input
            ref={sliderElementRef}
            type="range"
            min="0"
            max="100"
            step="0.1"
            defaultValue={0}
            onChange={handleSliderChange}
            className="timeline-slider"
          />
          <div
            ref={viewportIndicatorRef}
            className="slider-viewport-indicator"
            style={{
              left: (() => {
                if (!containerRef.current) return '50%';
                const scale = scaleRef.current;
                const viewportWidth = containerRef.current.clientWidth;
                const scaledTimelineWidth = timelineWidth * scale;
                const extra = Math.max(0, viewportWidth / 2 - TIMELINE_PADDING * scale);
                const totalScrollable = scaledTimelineWidth + extra * 2;
                const viewportWidthPercent = Math.min(100, (viewportWidth / totalScrollable) * 100);
                const halfWidth = viewportWidthPercent / 2;
                // Map sliderValue (0-100) to the safe range (halfWidth to 100-halfWidth)
                const safeRange = 100 - viewportWidthPercent;
                const mappedPosition = halfWidth + (sliderValue / 100) * safeRange;
                return `${mappedPosition}%`;
              })(),
              width: (() => {
                if (!containerRef.current) return '10%';
                const scale = scaleRef.current;
                const viewportWidth = containerRef.current.clientWidth;
                const scaledTimelineWidth = timelineWidth * scale;
                const extra = Math.max(0, viewportWidth / 2 - TIMELINE_PADDING * scale);
                const totalScrollable = scaledTimelineWidth + extra * 2;
                const widthPercent = Math.min(100, (viewportWidth / totalScrollable) * 100);
                return `${widthPercent}%`;
              })()
            }}
          />
        </div>
        <div ref={yearLabelRef} className="slider-year">{sliderYearLabel}</div>
      </div>
    </div>
  );
});

export default TimelineView;
