import { useEffect, useRef } from "react";
import {
  pickStep,
  buildSpanChildPlacement,
  calcSpanBandHeight,
  layoutSpans,
  layoutEvents,
  formatYear,
} from "../utils/timelineUtils";
import "../styles/04-timeline.css";

function TimelineView({ selectedId, onSelect, timelineData, onZoomChange, onHeightChange }) {
  const scrollRef = useRef(null);
  const timelineRef = useRef(null);
  const scaleRef = useRef(1);

  const file = timelineData.file;
  const events = timelineData.elements.filter(e => e.type === "event");
  const spans = timelineData.elements.filter(e => e.type === "span");
  const eras = timelineData.elements.filter(e => e.type === "era");

  const PX_PER_YEAR = file?.maxZoom ?? 10;

  const allYears = [
    ...events.map((e) => e.date),
    ...spans.flatMap((s) => [s.start, s.end]),
    ...eras.flatMap((e) => [e.start, e.end]),
  ];

  const rawMin = Math.min(...allYears);
  const rawMax = Math.max(...allYears);

  const minYear = file?.start ?? rawMin;
  const maxYear = file?.end ?? rawMax;
  const range = maxYear - minYear;

  const step = pickStep(range);
  const timelineWidth = range * PX_PER_YEAR;

  const yearToPx = (year) => (year - minYear) * PX_PER_YEAR;

  // spans
  const SPAN_HEIGHT = 23;
  const SPAN_OFFSET = 14;
  const SPAN_GAP = 6;
  const SPAN_VERTICAL_GAP = 0;

  const spanChildPlacement = buildSpanChildPlacement(spans);

  // First pass: calculate with temporary BASE_LINE_Y to determine content extent
  const TEMP_BASE_LINE_Y = 500;

  const { spanLaneEnds } = layoutSpans({
    spans,
    yearToPx,
    BASE_LINE_Y: TEMP_BASE_LINE_Y,
    SPAN_HEIGHT,
    SPAN_OFFSET,
    SPAN_GAP,
    SPAN_VERTICAL_GAP,
    spanChildPlacement,
    PX_PER_YEAR,
  });

  const spanBandHeight = calcSpanBandHeight(
    spanLaneEnds.length,
    SPAN_OFFSET,
    SPAN_HEIGHT,
    SPAN_VERTICAL_GAP
  );

  // events
  const EVENT_WIDTH = 160;
  const EVENT_GAP = 6;
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
  const ERA_OFFSET = 30;

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
    spans,
    yearToPx,
    BASE_LINE_Y,
    SPAN_HEIGHT,
    SPAN_OFFSET,
    SPAN_GAP,
    SPAN_VERTICAL_GAP,
    spanChildPlacement,
    PX_PER_YEAR,
  });

  const finalEvents = layoutEvents({
    events,
    yearToPx,
    BASE_LINE_Y,
    spanBandHeight,
    EVENT_WIDTH,
    EVENT_GAP,
    LANE_SPACING,
    BOX_OFFSET,
  });

  const finalEras = eras.map((era) => {
    const left = yearToPx(era.start);
    const width = (era.end - era.start) * PX_PER_YEAR;
    const top = BASE_LINE_Y + ERA_OFFSET;
    return {
      ...era,
      left,
      width,
      top,
    };
  });

  // ticks
  const ticks = [];
  const startTick = Math.floor(minYear / step) * step;
  for (let y = startTick; y <= maxYear; y += step) {
    ticks.push(y);
  }

  // Notify parent of height changes
  useEffect(() => {
    if (onHeightChange) {
      onHeightChange(calculatedHeight);
    }
  }, [calculatedHeight, onHeightChange]);

  // DPI + zoom effect
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const timelineEl = timelineRef.current;
    if (!scrollEl || !timelineEl) return;

    const updateBackgroundForDPI = () => {
      const dpi = window.devicePixelRatio * 96;
      const size = Math.max(0.5, 1.3 - (dpi - 96) / 400);
      scrollEl.style.backgroundImage = `radial-gradient(var(--active-bg) ${size}px, transparent 0.4px)`;
    };
    updateBackgroundForDPI();
    window.addEventListener("resize", updateBackgroundForDPI);

    // Notify parent of initial zoom
    if (onZoomChange) {
      onZoomChange(scaleRef.current);
    }

    let scale = scaleRef.current;

    const handleWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const oldScale = scale;

      // Get mouse position relative to the scroll container
      const scrollRect = scrollEl.getBoundingClientRect();
      const pointerX = e.clientX - scrollRect.left;
      const pointerY = e.clientY - scrollRect.top;

      const computedStyle = window.getComputedStyle(timelineEl);
      const marginTop = parseFloat(computedStyle.marginTop) || 0;

      const mousePointTo = {
        x: (pointerX + scrollEl.scrollLeft) / oldScale,
        y: (pointerY + scrollEl.scrollTop - marginTop) / oldScale,
      };

      // Calculate & apply the new scale
      const delta = e.deltaY;
      const zoomFactor = delta < 0 ? 1.1 : 0.9;
      const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.25), 5);

      scale = newScale;
      scaleRef.current = newScale;
      timelineEl.style.transformOrigin = "0 0";
      timelineEl.style.transform = `scale(${newScale})`;

      // Calculate new scroll position 
      const newScrollLeft = mousePointTo.x * newScale - pointerX;
      const newScrollTop = mousePointTo.y * newScale + marginTop - pointerY;

      scrollEl.scrollLeft = newScrollLeft;
      scrollEl.scrollTop = newScrollTop;

      if (onZoomChange) {
        onZoomChange(newScale);
      }
    };

    scrollEl.addEventListener("wheel", handleWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener("resize", updateBackgroundForDPI);
      scrollEl.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [onZoomChange]);

  // auto-scroll to selected item
  useEffect(() => {
    if (!selectedId) return;

    const scrollEl = scrollRef.current;
    const timelineEl = timelineRef.current;
    if (!scrollEl || !timelineEl) return;

    const dom = timelineEl.querySelector(`[data-id="${selectedId}"]`);
    if (!dom) return;

    const rect = dom.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;

    const scrollRect = scrollEl.getBoundingClientRect();
    const viewportCenterX = scrollRect.left + scrollRect.width / 2;

    const scale = scaleRef.current || 1;
    const deltaX = (targetX - viewportCenterX) / scale;

    scrollEl.scrollTo({
      left: scrollEl.scrollLeft + deltaX,
      behavior: "smooth",
    });
  }, [selectedId]);

  return (
    <div
      ref={scrollRef}
      className="timeline-scroll"
      onClick={() => onSelect?.(null)} // clear selection on background click
    >
      <div
        ref={timelineRef}
        className="timeline"
        style={{ width: `${timelineWidth}px`, height: `${calculatedHeight * 2}px` }}
      >
        <div className="timeline-line" style={{ top: `${BASE_LINE_Y}px` }} />

        <div className="eras-layer">
          {finalEras.map((era) => {
            const isSelected = selectedId === era.id;
            return (
              <div
                key={era.id}
                data-id={era.id}
                className={`era-item ${isSelected ? "is-selected" : ""}`}
                style={{
                  left: `${era.left}px`,
                  width: `${era.width}px`,
                  top: `${era.top}px`,
                  background: `linear-gradient(
                    rgba(255,255,255,0.6),
                    rgba(255,255,255,0.6)
                  ), ${era.color || "var(--tertiary-bg)"}`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(era.id);
                }}
              >
                <span
                  className="era-title"
                  style={{
                    color: era.color ? era.color : "var(--dark-bg)",
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
                connectorHeight = `${18 + (laneDifference - 1) * 28}px`;
                const extraOffset = (laneDifference - 1) * 24;
                connectorOffset = isBottomChild ? `-${2 + extraOffset}px` : `${2 + extraOffset}px`;
              }
            }

            return (
              <div
                key={`connector-${span.id}`}
                style={{
                  position: 'absolute',
                  left: `${span.left}px`,
                  top: `${span.top}px`,
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

            return (
              <div
                key={span.id}
                data-id={span.id}
                className={`span-item ${isSelected ? "is-selected" : ""}`}
                style={{
                  left: `${span.left}px`,
                  width: `${span.width}px`,
                  top: `${span.top}px`,
                  background: span.color || "var(--element-bg)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(span.id);
                }}
              >
                <span className="span-title">{span.title}</span>
                <span className="span-years">
                  {formatYear(span.start, file.negID, file.posID)} – {formatYear(span.end, file.negID, file.posID)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Event lines layer - behind spans and events */}
        <div className="event-lines-layer">
          {finalEvents.map((event) => {
            const parentId = event.parents?.[0];
            const parentSpan = parentId
              ? finalSpans.find((span) => span.id === parentId)
              : null;

            const fallbackTargetY = BASE_LINE_Y;
            const targetY = parentSpan ? parentSpan.top : fallbackTargetY;

            const EVENT_BOX_HEIGHT = 29;
            const eventBottom = event.top + EVENT_BOX_HEIGHT;

            const lineHeight = Math.abs(eventBottom - targetY);
            const parentColor = parentSpan?.color;

            return (
              <div
                key={`event-line-${event.id}`}
                className="event-line-container"
                style={{
                  position: 'absolute',
                  left: `${event._x}px`,
                  top: `${eventBottom}px`,
                  pointerEvents: 'none',
                }}
              >
                <div
                  className="event-line"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '0',
                    transform: 'translateX(-50%)',
                    width: '2px',
                    height: `${lineHeight}px`,
                    background: parentColor || 'var(--element-bg)',
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
                    background: parentColor || 'var(--element-bg)',
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

            return (
              <div
                key={event.id}
                data-id={event.id}
                className={`event ${isSelected ? "is-selected" : ""}`}
                style={{
                  left: `${event._x}px`,
                  top: `${event.top}px`,
                  position: "absolute",
                  border: parentColor
                    ? `2px solid ${parentColor}`
                    : "2px solid var(--element-bg)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(event.id);
                }}
              >
                <div className="event-title">{event.title}</div>
                <div className="event-date">{formatYear(event.date, file.negID, file.posID)}</div>
              </div>
            );
          })}
        </div>

        {ticks.map((year) => (
          <div
            key={year}
            className="tick"
            style={{
              left: `${yearToPx(year)}px`,
              top: `${BASE_LINE_Y - 5}px`,
            }}
          >
            <div className="tick-line" />
            <div className="tick-label">{formatYear(year, file.negID, file.posID)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimelineView;
