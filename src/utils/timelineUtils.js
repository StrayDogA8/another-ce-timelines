export function formatYear(year, negID, posID, useMonths = false) {
  if (year < 0) {
    return negID ? `${Math.abs(year)} ${negID}` : `${year}`;
  }
  if (year > 0) {
    const yearInt = Math.floor(year);
    const fraction = year - yearInt;
    const hasFraction = Math.abs(fraction) > 1e-9;
    const hasShortYear = yearInt <= 9999;

    if (useMonths && hasShortYear) {
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

    const label = `${hasFraction ? year : yearInt}`;
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

  // Calculate detail level so scrollbar is 20% at min zoom (0.5) with 1200px viewport
  const detailLevel = 12000 / absRange;

  return detailLevel;
}

export function pickStep(range) {
  const absRange = Math.abs(range);
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
// Rules:
// - Branches: must start within parent's time span, alternate above/below with increasing offset
// Pattern: -1, +1, -2, +2, -3, +3, ...
export function buildSpanChildPlacement(spans, branchOrdering = "later-first") {
  const placement = {};
  for (const span of spans) {
    // branches alternate below/above
    // offset -1 = lower lane number = larger Y = BELOW parent (lower on screen)
    // offset +1 = higher lane number = smaller Y = ABOVE parent (higher on screen)
    // Pattern: index 0 → -1, index 1 → +1, index 2 → -2, index 3 → +2, etc.
    if (Array.isArray(span.branches)) {
      const orderedBranches =
        branchOrdering === "original"
          ? [...span.branches]
          : [...span.branches].sort((aId, bId) => {
              const a = spans.find(s => s.id === aId);
              const b = spans.find(s => s.id === bId);
              const aHasChildren = Array.isArray(a?.branches) && a.branches.length > 0;
              const bHasChildren = Array.isArray(b?.branches) && b.branches.length > 0;
              if (aHasChildren !== bHasChildren) return aHasChildren ? -1 : 1;
              const aStart = a?.start ?? 0;
              const bStart = b?.start ?? 0;
              if (aStart !== bStart) return bStart - aStart;
              return String(aId).localeCompare(String(bId));
            });
      // "later-first": branches with their own branches stay closer, then later start dates.
      // "original": keep the branch list order from the .timeline file.
      // Alternate offsets around the parent: -1, +1, -2, +2, ...
      // Negative offsets appear lower on screen, positive offsets higher.
      orderedBranches.forEach((childId, index) => {
        const magnitude = index + 1;
        const offset = index % 2 === 0 ? -magnitude : +magnitude;
        placement[childId] = {
          parentId: span.id,
          offset,
          priority: index,
        };
      });
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
  PX_PER_YEAR,
}) {
  const spanLaneEnds = [];
  const spanLaneById = {};
  const spanById = Object.fromEntries(spans.map(s => [s.id, s]));
  const finalSpans = [];
  const familyBands = new Map();

  const childToParent = {};
  Object.entries(spanChildPlacement).forEach(([childId, { parentId }]) => {
    childToParent[childId] = parentId;
  });

  const getRootId = (id) => {
    let current = id;
    while (childToParent[current]) {
      current = childToParent[current];
    }
    return current;
  };

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
      const span = spanById[id];
      const children = Array.isArray(span?.branches) ? span.branches : [];
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
      const children = Array.isArray(span.branches) ? span.branches : [];
      children.forEach((childId) => stack.push(childId));
    }
    const result = { start: minStart, end: maxEnd };
    familyRangeCache.set(rootId, result);
    return result;
  };

  const spansOverlap = (startA, endA, startB, endB) =>
    startA < endB && endA > startB;

  const rootSpans = spans.filter(span => !childToParent[span.id]);
  const familyRoots = rootSpans.filter(span => Array.isArray(span.branches) && span.branches.length > 0);
  const otherRoots = rootSpans.filter(span => !Array.isArray(span.branches) || span.branches.length === 0);

  familyRoots.sort((a, b) => a.start - b.start);
  otherRoots.sort((a, b) => a.start - b.start);

  const processed = new Set();

  function spanFitsInLane(lane, start, end, rootId) {
    const startPx = yearToPx(start);
    const laneEnd = spanLaneEnds[lane];
    if (!(laneEnd === undefined || laneEnd + SPAN_GAP <= startPx)) {
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

  function familyFitsAtLane(span, baseLane, start, end) {
    const rootId = span.id;
    const { minOffset, maxOffset } = getFamilyOffsets(rootId);

    if (baseLane + minOffset < 0) return false;

    if (!spanFitsInLane(baseLane, start, end, rootId)) return false;

    for (let offset = minOffset; offset <= maxOffset; offset++) {
      if (offset === 0) continue; 
      const childLane = baseLane + offset;

      const childIds = [...(span.branches || [])];
      for (const childId of childIds) {
        const childPlacement = spanChildPlacement[childId];
        if (childPlacement && childPlacement.offset === offset) {
          const child = spanById[childId];
          if (child && !spanFitsInLane(childLane, child.start, child.end, rootId)) {
            return false;
          }
        }
      }
    }

    const familyRange = getFamilyRange(rootId);
    for (const [familyRoot, band] of familyBands.entries()) {
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

    const left = yearToPx(span.start);
    const width = yearToPx(span.end) - yearToPx(span.start);
    const right = left + width;
    const placement = spanChildPlacement[span.id];

    let lane;

    const rootId = getRootId(span.id);

    if (placement) {
      const parentLane = spanLaneById[placement.parentId];
      if (parentLane !== undefined) {
        const direction = placement.offset > 0 ? 1 : -1; 
        let searchLane = parentLane + direction;

        while (true) {
          if (searchLane < 0) {
            searchLane = parentLane + 1;
            while (!spanFitsInLane(searchLane, span.start, span.end, rootId)) {
              searchLane++;
            }
            break;
          }

          if (spanFitsInLane(searchLane, span.start, span.end, rootId)) {
            break;
          }

          searchLane += direction;
        }

        lane = searchLane;
      } else {
        lane = 0;
        while (!spanFitsInLane(lane, span.start, span.end, rootId)) {
          lane++;
        }
      }
    } else {
      lane = 0;
      while (!familyFitsAtLane(span, lane, span.start, span.end)) {
        lane++;
      }
    }

    spanLaneEnds[lane] = right;
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

    const top = BASE_LINE_Y - SPAN_OFFSET - SPAN_HEIGHT - lane * (SPAN_HEIGHT + SPAN_VERTICAL_GAP);

    finalSpans.push({
      ...span,
      left,
      width,
      top,
      lane,
    });

    const children = [];
    if (span.branches) {
      span.branches.forEach((childId) => {
        if (spanById[childId]) children.push(spanById[childId]);
      });
    }
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
}) {
  const laidOut = [...events]
    .sort((a, b) => a.date - b.date)
    .map((ev) => ({ ...ev, _x: yearToPx(ev.date) }));

  const laneEnds = [];

  const finalEvents = laidOut.map((event, idx) => {
    const x = event._x;

    function fitsInLane(lane) {
      const end = laneEnds[lane];
      return end === undefined || end + EVENT_GAP <= x;
    }

    let laneToUse = 0;
    while (!fitsInLane(laneToUse)) {
      laneToUse++;
    }

    laneEnds[laneToUse] = x + EVENT_WIDTH;

    const top =
      BASE_LINE_Y - spanBandHeight - BOX_OFFSET - laneToUse * LANE_SPACING;

    return {
      ...event,
      top,
    };
  });

  return finalEvents;
}
