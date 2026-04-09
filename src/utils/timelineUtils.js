export function formatYear(year, negID, posID, useMonths = false, hideDecimals = false) {
  if (year < 0) {
    const display = hideDecimals ? Math.round(Math.abs(year)) : Math.abs(year);
    return negID ? `${display} ${negID}` : `${hideDecimals ? -Math.round(Math.abs(year)) : year}`;
  }
  if (year > 0) {
    const yearInt = Math.floor(year);
    const fraction = year - yearInt;
    const hasFraction = Math.abs(fraction) > 1e-9;
    const hasShortYear = yearInt <= 9999;

    if (useMonths && hasShortYear && !hideDecimals) {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const monthIndex = hasFraction
        ? Math.min(11, Math.max(0, Math.floor((fraction + 1e-9) * 12)))
        : 0;
      const label = `${months[monthIndex]} ${yearInt}`;
      return posID ? `${label} ${posID}` : label;
    }

    const display = hideDecimals ? Math.round(year) : (hasFraction ? year : yearInt);
    const label = `${display}`;
    return posID ? `${label} ${posID}` : label;
  }
  return "0";
}

const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));

const mixColor = (base, target, amount) => clampChannel(base + (target - base) * amount);

const toHex = (value) => value.toString(16).padStart(2, "0");

export function getReadableTextColor(background) {
  if (!background || typeof background !== "string") return "#1A1A1A";
  const hex = background.replace("#", "").trim();
  if (hex.length !== 6) return "#1A1A1A";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "#1A1A1A";

  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const amount = luminance < 0.7 ? 0.7 : 0.45;
  const target = luminance < 0.7 ? 255 : 0;

  const outR = mixColor(r, target, amount);
  const outG = mixColor(g, target, amount);
  const outB = mixColor(b, target, amount);

  return `#${toHex(outR)}${toHex(outG)}${toHex(outB)}`;
}

 // Scrollbar Width = (viewport width / (range * detail * scale)) * 100
 // (1200 / (range × detail × 0.5)) × 100 = 20 (Solving for detail: detail = 12000 / range)

export function calculateDetailLevel(range) {
  const absRange = Math.abs(range);
  if (absRange === 0) return 1;

  // Calculate detail level so scrollbar is 20% at min zoom (0.5) with 1200px viewport
  const detailLevel = 12000 / absRange;

  return detailLevel;
}

export function pickStep(range) {
  const absRange = Math.abs(range);
  if (absRange === 0) return 1;
  const targetTicks = 10;
  const roughStep = absRange / targetTicks;
  const exponent = Math.floor(Math.log10(roughStep));
  const base = roughStep / Math.pow(10, exponent);

  let niceBase;
  if (base < 1.5) niceBase = 1;
  else if (base < 3.5) niceBase = 2;
  else if (base < 7.5) niceBase = 5;
  else niceBase = 10;

  return niceBase * Math.pow(10, exponent);
}

// build child -> { parentId, offset } from spans
// Each child span declares its parent via span.parent (string ID).
// Children of the same parent alternate above/below with increasing offset.
// Pattern: -1, +1, -2, +2, -3, +3, ...
export function buildSpanChildPlacement(spans, branchOrdering = "later-first") {
  const placement = {};
  const spanById = Object.fromEntries(spans.map((span) => [span.id, span]));
  const isContiguous = (left, right) =>
    Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6;

  // Extension links: child starts exactly when parent ends.
  for (const span of spans) {
    if (!span.extendFrom) continue;
    const parent = spanById[span.extendFrom];
    if (!parent) continue;
    if (!isContiguous(parent.end, span.start)) continue;
    placement[span.id] = {
      parentId: parent.id,
      offset: 0,
      priority: -1,
      mode: "extend",
    };
  }

  // Group children by their parent
  const childrenByParent = {};
  for (const span of spans) {
    if (placement[span.id]?.mode === "extend") continue;
    if (span.parent) {
      if (!childrenByParent[span.parent]) childrenByParent[span.parent] = [];
      childrenByParent[span.parent].push(span.id);
    }
  }

  for (const [parentId, childIds] of Object.entries(childrenByParent)) {
    // offset -1 = lower lane number = larger Y = BELOW parent (lower on screen)
    // offset +1 = higher lane number = smaller Y = ABOVE parent (higher on screen)
    const orderedChildren =
      branchOrdering === "original"
        ? [...childIds]
        : [...childIds].sort((aId, bId) => {
            const a = spans.find(s => s.id === aId);
            const b = spans.find(s => s.id === bId);
            const aHasChildren = spans.some(s => s.parent === aId);
            const bHasChildren = spans.some(s => s.parent === bId);
            if (aHasChildren !== bHasChildren) return aHasChildren ? -1 : 1;
            const aStart = a?.start ?? 0;
            const bStart = b?.start ?? 0;
            if (aStart !== bStart) return bStart - aStart;
            return String(aId).localeCompare(String(bId));
          });
    // Alternate offsets around the parent: -1, +1, -2, +2, ...
    // Negative offsets appear lower on screen, positive offsets higher.
    orderedChildren.forEach((childId, index) => {
      const magnitude = Math.ceil((index + 1) / 2);
      const offset = index % 2 === 0 ? -magnitude : +magnitude;
      placement[childId] = {
        parentId,
        offset,
        priority: index,
      };
    });
  }
  return placement;
}

// build child -> { parentId } for merge connections (visual only, no lane changes)
// Each child span declares its merge target via span.mergeParent (string ID).
export function buildSpanMergePlacement(spans) {
  const placement = {};
  for (const span of spans) {
    if (span.mergeParent) {
      placement[span.id] = { parentId: span.mergeParent };
    }
  }
  return placement;
}

export function calcSpanBandHeight(rows, offset, height, gap) {
  if (rows === 0) return 0;
  return offset + height + (rows - 1) * (height + gap);
}

export function layoutSpans({
  spans,
  yearToPx,
  BASE_LINE_Y,
  SPAN_HEIGHT,
  SPAN_OFFSET,
  SPAN_GAP,
  SPAN_VERTICAL_GAP,
  spanChildPlacement,
  timelineStart,
  timelineEnd,
}) {
  const spanLaneEnds = [];
  const spanLaneIntervals = [];
  const spanLaneById = {};
  const spanById = Object.fromEntries(spans.map(s => [s.id, s]));
  const finalSpans = [];
  const familyBands = new Map();

  const childToParent = {};
  const parentToChildren = {};
  Object.entries(spanChildPlacement).forEach(([childId, { parentId }]) => {
    childToParent[childId] = parentId;
    if (!parentToChildren[parentId]) parentToChildren[parentId] = [];
    parentToChildren[parentId].push(childId);
  });

  const getRootId = (id) => {
    let current = id;
    while (childToParent[current]) {
      current = childToParent[current];
    }
    return current;
  };

  const CSS_SPAN_HEIGHT = 20;

  const sizeRank = (size) => size === "thick" ? 2 : size === "thin" ? 0 : 1;
  const getEffectiveSize = (s) => {
    if (!s) return "normal";
    const maxRank = sizeRank(s.spanSize);
    return maxRank === 2 ? "thick" : maxRank === 0 ? "thin" : "normal";
  };
  const isThickSpan = (s) => getEffectiveSize(s) === "thick";
  const isThinSpan = (s) => getEffectiveSize(s) === "thin";

  function spanFitsAllNeededLanes(lane, span, rootId) {
    if (!spanFitsInLane(lane, span.start, span.end, rootId)) return false;
    if (isThickSpan(span) && !spanFitsInLane(lane + 1, span.start, span.end, rootId)) return false;
    return true;
  }

  // Check a span AND its entire extend chain at the given lane.
  // Extend children inherit the same lane as their parent, so they must also fit there.
  function spanWithExtendsFitsAtLane(spanId, lane, rootId) {
    const s = spanById[spanId];
    if (!s || !spanFitsAllNeededLanes(lane, s, rootId)) return false;
    const stk = [spanId];
    while (stk.length > 0) {
      const cur = stk.pop();
      for (const childId of (parentToChildren[cur] || [])) {
        const cp = spanChildPlacement[childId];
        if (cp?.mode === "extend") {
          const es = spanById[childId];
          if (!es || !spanFitsAllNeededLanes(lane, es, rootId)) return false;
          stk.push(childId);
        }
      }
    }
    return true;
  }

  const familyOffsetsCache = new Map();
  const getFamilyOffsets = (rootId) => {
    if (familyOffsetsCache.has(rootId)) return familyOffsetsCache.get(rootId);
    const root = spanById[rootId];
    if (!root) return { minOffset: 0, maxOffset: 0 };
    const stack = [{ id: rootId, offset: 0 }];
    let minOffset = 0;
    let maxOffset = 0;
    while (stack.length > 0) {
      const { id, offset } = stack.pop();
      minOffset = Math.min(minOffset, offset);
      maxOffset = Math.max(maxOffset, offset);

      if (isThickSpan(spanById[id])) {
        maxOffset = Math.max(maxOffset, offset + 1);
      }
      const children = parentToChildren[id] || [];
      children.forEach((childId) => {
        const placement = spanChildPlacement[childId];
        if (!placement) return;
        stack.push({ id: childId, offset: offset + placement.offset });
      });
    }
    const result = { minOffset, maxOffset };
    familyOffsetsCache.set(rootId, result);
    return result;
  };

  const familyRangeCache = new Map();
  // Computes the overall time range covered by a family (root + descendants).
  // Used to prevent other families from taking lanes that overlap in time.
  const getFamilyRange = (rootId) => {
    if (familyRangeCache.has(rootId)) return familyRangeCache.get(rootId);
    const root = spanById[rootId];
    if (!root) return { start: 0, end: 0 };
    let minStart = root.start;
    let maxEnd = root.end;
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop();
      const span = spanById[id];
      if (!span) continue;
      minStart = Math.min(minStart, span.start);
      maxEnd = Math.max(maxEnd, span.end);
      const children = parentToChildren[id] || [];
      children.forEach((childId) => stack.push(childId));
    }
    const result = { start: minStart, end: maxEnd };
    familyRangeCache.set(rootId, result);
    return result;
  };

  const spansOverlap = (startA, endA, startB, endB) =>
    startA < endB && endA > startB;

  const rootSpans = spans.filter(span => !childToParent[span.id]);
  const familyRoots = rootSpans.filter(span => parentToChildren[span.id]?.length > 0);
  const otherRoots = rootSpans.filter(span => !parentToChildren[span.id]?.length);

  familyRoots.sort((a, b) => a.start - b.start);
  otherRoots.sort((a, b) => a.start - b.start);

  const processed = new Set();

  function spanFitsInLane(lane, start, end, rootId) {
    const startPx = yearToPx(start);
    const endPx = yearToPx(end);
    const intervals = spanLaneIntervals[lane] || [];
    const hasCollision = intervals.some(({ startPx: existingStartPx, endPx: existingEndPx }) => {
      return !(existingEndPx + SPAN_GAP <= startPx || endPx + SPAN_GAP <= existingStartPx);
    });
    if (hasCollision) {
      return false;
    }
    if (!rootId) return true;
    for (const [familyRoot, band] of familyBands.entries()) {
      if (familyRoot === rootId) continue;
      if (!spansOverlap(start, end, band.start, band.end)) continue;
      if (lane >= band.minLane && lane <= band.maxLane) {
        return false;
      }
    }
    return true;
  }

  function familyFitsAtLane(span, baseLane) {
    const rootId = span.id;
    const { minOffset, maxOffset } = getFamilyOffsets(rootId);

    if (baseLane + minOffset < 0) return false;

    // Check root span + its extend chain (all at baseLane, offset=0).
    // The loop below skips offset=0, so we check the extend chain separately.
    if (!spanWithExtendsFitsAtLane(span.id, baseLane, rootId)) return false;

    for (let offset = minOffset; offset <= maxOffset; offset++) {
      if (offset === 0) continue;

      if (offset === 1 && isThickSpan(span)) continue;
      const childLane = baseLane + offset;

      const childIds = parentToChildren[span.id] || [];
      for (const childId of childIds) {
        const childPlacement = spanChildPlacement[childId];
        if (childPlacement && childPlacement.offset === offset) {
          // Check the branch child AND its extend chain at childLane.
          if (!spanWithExtendsFitsAtLane(childId, childLane, rootId)) {
            return false;
          }
        }
      }
    }

    const familyRange = getFamilyRange(rootId);
    for (const [, band] of familyBands.entries()) {
      if (!spansOverlap(familyRange.start, familyRange.end, band.start, band.end)) continue;
      const candidateMin = baseLane + minOffset;
      const candidateMax = baseLane + maxOffset;
      const overlapsBand =
        candidateMin <= band.maxLane && candidateMax >= band.minLane;
      if (overlapsBand) return false;
    }

    return true;
  }

  function placeSpan(span) {
    if (processed.has(span.id)) return;
    processed.add(span.id);

    const rawLeft = yearToPx(span.start);
    const rawRight = yearToPx(span.end);
    const clampedLeft = timelineStart != null ? Math.max(rawLeft, yearToPx(timelineStart)) : rawLeft;
    const clampedRight = timelineEnd != null ? Math.min(rawRight, yearToPx(timelineEnd)) : rawRight;
    const left = clampedLeft;
    const width = clampedRight - clampedLeft;
    const right = clampedRight;
    const placement = spanChildPlacement[span.id];

    let lane;

    const rootId = getRootId(span.id);

    const thick = isThickSpan(span);
    const thin = isThinSpan(span);

    if (placement?.mode === "extend") {
      const parentLane = spanLaneById[placement.parentId];
      if (parentLane !== undefined) {
        lane = parentLane;
      } else {
        lane = 0;
        while (!spanFitsAllNeededLanes(lane, span, rootId)) {
          lane++;
        }
      }
    } else if (placement) {
      const parentLane = spanLaneById[placement.parentId];
      if (parentLane !== undefined) {
        const direction = placement.offset > 0 ? 1 : -1;
        let searchLane = parentLane + direction;

        while (true) {
          if (searchLane < 0) {
            searchLane = parentLane + 1;
            while (!spanWithExtendsFitsAtLane(span.id, searchLane, rootId)) {
              searchLane++;
            }
            break;
          }

          if (spanWithExtendsFitsAtLane(span.id, searchLane, rootId)) {
            break;
          }

          searchLane += direction;
        }

        lane = searchLane;
      } else {
        lane = 0;
        while (!spanFitsAllNeededLanes(lane, span, rootId)) {
          lane++;
        }
      }
    } else {
      lane = 0;
      while (!familyFitsAtLane(span, lane)) {
        lane++;
      }
    }

    spanLaneEnds[lane] = right;
    if (!spanLaneIntervals[lane]) spanLaneIntervals[lane] = [];
    spanLaneIntervals[lane].push({ startPx: left, endPx: right });

    if (thick) {
      spanLaneEnds[lane + 1] = right;
      if (!spanLaneIntervals[lane + 1]) spanLaneIntervals[lane + 1] = [];
      spanLaneIntervals[lane + 1].push({ startPx: left, endPx: right });
    }

    spanLaneById[span.id] = lane;

    if (!placement) {
      const { minOffset, maxOffset } = getFamilyOffsets(span.id);
      const familyRange = getFamilyRange(span.id);
      familyBands.set(span.id, {
        minLane: lane + minOffset,
        maxLane: lane + maxOffset,
        start: familyRange.start,
        end: familyRange.end,
      });
    }

    const topLane = thick ? lane + 1 : lane;
    const top = BASE_LINE_Y - SPAN_OFFSET - SPAN_HEIGHT - topLane * (SPAN_HEIGHT + SPAN_VERTICAL_GAP);
    const spanHeight = thick
      ? CSS_SPAN_HEIGHT + SPAN_HEIGHT + SPAN_VERTICAL_GAP
      : thin ? Math.round(CSS_SPAN_HEIGHT / 2) : CSS_SPAN_HEIGHT;
    const topOffset = thin ? Math.round((CSS_SPAN_HEIGHT - spanHeight) / 2) : 0;

    finalSpans.push({
      ...span,
      left,
      width,
      top: top + topOffset,
      lane,
      spanHeight,
    });

    const children = [];
    (parentToChildren[span.id] || []).forEach((childId) => {
      if (spanById[childId]) children.push(spanById[childId]);
    });
    children
      .sort((a, b) => {
        const aPriority = spanChildPlacement[a.id]?.priority ?? 0;
        const bPriority = spanChildPlacement[b.id]?.priority ?? 0;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aStart = a.start ?? 0;
        const bStart = b.start ?? 0;
        if (aStart !== bStart) return bStart - aStart;
        return String(a.id).localeCompare(String(b.id));
      })
      .forEach(child => placeSpan(child));
  }

  familyRoots.forEach(span => placeSpan(span));
  otherRoots.forEach(span => placeSpan(span));
  // Place any remaining spans that weren't reached via a root (safety net).
  spans.forEach(span => placeSpan(span));

  if (finalSpans.length > 0) {
    const minLane = Math.min(...finalSpans.map((span) => span.lane));
    if (minLane > 0) {
      const laneShift = minLane;
      finalSpans.forEach((span) => {
        span.lane -= laneShift;
        span.top += laneShift * (SPAN_HEIGHT + SPAN_VERTICAL_GAP);
        spanLaneById[span.id] = span.lane;
      });
      const shiftedLaneEnds = [];
      spanLaneEnds.forEach((end, index) => {
        if (end === undefined) return;
        shiftedLaneEnds[index - laneShift] = end;
      });
      spanLaneEnds.length = 0;
      shiftedLaneEnds.forEach((end, index) => {
        spanLaneEnds[index] = end;
      });
    }

    // Densify lane indexes to remove empty gaps between used lanes.
    // This prevents visual blank rows when some lane numbers end up unused.
    const usedLaneSet = new Set();
    finalSpans.forEach((span) => {
      usedLaneSet.add(span.lane);
      if (isThickSpan(span)) usedLaneSet.add(span.lane + 1);
    });
    const usedLanes = Array.from(usedLaneSet).sort((a, b) => a - b);
    const denseLaneByOldLane = new Map(usedLanes.map((lane, idx) => [lane, idx]));

    if (usedLanes.some((lane, idx) => lane !== idx)) {
      finalSpans.forEach((span) => {
        const denseLane = denseLaneByOldLane.get(span.lane);
        if (denseLane === undefined) return;
        span.lane = denseLane;
        const thick = isThickSpan(span);
        const thin = isThinSpan(span);
        const topLane = thick ? denseLane + 1 : denseLane;
        const baseTop = BASE_LINE_Y - SPAN_OFFSET - SPAN_HEIGHT - topLane * (SPAN_HEIGHT + SPAN_VERTICAL_GAP);
        const topOffset = thin ? Math.round((CSS_SPAN_HEIGHT - span.spanHeight) / 2) : 0;
        span.top = baseTop + topOffset;
        spanLaneById[span.id] = denseLane;
      });

      const rebuiltLaneEnds = [];
      finalSpans.forEach((span) => {
        const lane = span.lane;
        const right = span.left + span.width;
        if (rebuiltLaneEnds[lane] === undefined || right > rebuiltLaneEnds[lane]) {
          rebuiltLaneEnds[lane] = right;
        }
        if (isThickSpan(span)) {
          const extraLane = lane + 1;
          if (rebuiltLaneEnds[extraLane] === undefined || right > rebuiltLaneEnds[extraLane]) {
            rebuiltLaneEnds[extraLane] = right;
          }
        }
      });

      spanLaneEnds.length = 0;
      rebuiltLaneEnds.forEach((end, index) => {
        spanLaneEnds[index] = end;
      });
    }
  }

  return { finalSpans, spanLaneEnds, spanLaneById, spanChildPlacement };
}

export function layoutEvents({
  events,
  yearToPx,
  BASE_LINE_Y,
  spanBandHeight,
  EVENT_WIDTH,
  EVENT_GAP,
  LANE_SPACING,
  BOX_OFFSET,
  fixedEventHeight,
  compactEvents = false,
  fontFamily,
  pinnedTags = [],
  negID,
  posID,
  useMonths = false,
  hideDecimals = false,
}) {
  const laidOut = [...events]
    .sort((a, b) => a.date - b.date)
    .map((ev) => ({ ...ev, _x: yearToPx(ev.date) }));

  // Create an offscreen probe matching .event styling for accurate height measurement
  const probe = document.createElement("div");
  probe.className = "event";
  if (compactEvents) {
    probe.classList.add("event-compact");
  }
  const probeTitle = document.createElement("div");
  probeTitle.className = "event-title";
  const probeDate = document.createElement("div");
  probeDate.className = "event-date";
  const probeYearSpan = document.createElement("span");
  probeYearSpan.className = "event-year";
  probeYearSpan.textContent = "0000";
  probeDate.appendChild(probeYearSpan);
  const probePinnedTagsSpan = document.createElement("span");
  probePinnedTagsSpan.className = "pinned-tags";
  probeDate.appendChild(probePinnedTagsSpan);
  probe.appendChild(probeTitle);
  probe.appendChild(probeDate);

  const setProbeTags = (tags) => {
    probePinnedTagsSpan.innerHTML = "";
    const visible = (Array.isArray(tags) ? tags : []).filter((t) => pinnedTags.includes(t));
    visible.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "pinned-tag";
      span.textContent = tag;
      probePinnedTagsSpan.appendChild(span);
    });
  };
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    left: "-9999px",
  });
  if (fontFamily) {
    probe.style.fontFamily = fontFamily;
  }
  document.body.appendChild(probe);

  // Measure the fixed single-line height from CSS
  probeTitle.textContent = "X";
  const singleLineHeight = probe.offsetHeight;

  let measureEvent;
  if (fixedEventHeight) {
    // OverflowTags ensures tags never wrap when fixedEventHeight is on,
    // so the box is always the single-line CSS height.
    measureEvent = () => ({ boxHeight: singleLineHeight, isMultiLine: false });
  } else {
    // Switch to auto-height for measuring multi-line content
    probe.classList.add("multi-lane");
    probe.style.height = "auto";
    const baseContentHeight = probe.offsetHeight;

    measureEvent = (title, tags, yearLabel) => {
      probeTitle.textContent = title || "X";
      probeYearSpan.textContent = yearLabel || "0000";
      setProbeTags(tags);
      const naturalHeight = probe.offsetHeight;
      const isMultiLine = naturalHeight > baseContentHeight;
      return {
        boxHeight: isMultiLine ? naturalHeight : singleLineHeight,
        isMultiLine,
      };
    };
  }

  // Use continuous vertical packing instead of discrete lanes
  const VERTICAL_GAP = Math.max(0, LANE_SPACING - singleLineHeight);
  const LANE0_TOP = BASE_LINE_Y - spanBandHeight - BOX_OFFSET;
  const placed = []; // { xEnd, top, boxHeight }

  const finalEvents = laidOut.map((event) => {
    const x = event._x;
    const yearLabel = event.dateLabel ?? formatYear(event.date, negID, posID, useMonths, hideDecimals);
    const { boxHeight, isMultiLine } = measureEvent(event.title, event.tags, yearLabel);

    // Find placed events that horizontally overlap
    const conflicts = placed
      .filter((p) => p.xEnd + EVENT_GAP > x)
      .sort((a, b) => b.top - a.top); // closest to baseline first

    // Start at the closest-to-baseline position, maintaining the same gap as single-line events
    const minBottom = LANE0_TOP + singleLineHeight; // bottom edge that single-line events sit at
    let top = Math.min(LANE0_TOP, minBottom - boxHeight);
    for (const c of conflicts) {
      if (top < c.top + c.boxHeight + VERTICAL_GAP &&
          top + boxHeight + VERTICAL_GAP > c.top) {
        top = c.top - boxHeight - VERTICAL_GAP;
      }
    }

    placed.push({ xEnd: x + EVENT_WIDTH, top, boxHeight });

    return {
      ...event,
      top,
      _boxHeight: boxHeight,
      _isMultiLine: isMultiLine,
    };
  });

  document.body.removeChild(probe);

  return finalEvents;
}
