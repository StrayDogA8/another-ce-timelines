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
// - Forks: must start in the exact year parent ends, alternate above/below with increasing offset
// Pattern: -1, +1, -2, +2, -3, +3, ...
export function buildSpanChildPlacement(spans) {
  const placement = {};
  for (const span of spans) {
    // branches alternate below/above
    // offset -1 = lower lane number = larger Y = BELOW parent (lower on screen)
    // offset +1 = higher lane number = smaller Y = ABOVE parent (higher on screen)
    // Pattern: index 0 → -1, index 1 → +1, index 2 → -2, index 3 → +2, etc.
    if (Array.isArray(span.branches)) {
      span.branches.forEach((childId, index) => {
        const magnitude = index + 1;
        const offset = index % 2 === 0 ? -magnitude : +magnitude;
        placement[childId] = {
          parentId: span.id,
          offset,
        };
      });
    }

    // forks alternate above/below
    // offset -1 = lower lane number = larger Y = BELOW parent (lower on screen)
    // offset +1 = higher lane number = smaller Y = ABOVE parent (higher on screen)
    // Pattern: index 0 → +1, index 1 → -2, index 2 → +3, index 3 → -4, etc.
    if (Array.isArray(span.forks)) {
      span.forks.forEach((childId, index) => {
        const magnitude = index + 1;
        const offset = index % 2 === 0 ? +magnitude : -magnitude;
        placement[childId] = {
          parentId: span.id,
          offset,
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

  const childToParent = {};
  Object.entries(spanChildPlacement).forEach(([childId, { parentId }]) => {
    childToParent[childId] = parentId;
  });

  const sortedSpans = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const aIsChild = !!childToParent[a.id];
    const bIsChild = !!childToParent[b.id];
    if (aIsChild !== bIsChild) return aIsChild ? 1 : -1;
    return 0;
  });

  const processed = new Set();

  function spanFitsInLane(lane, start, end) {
    const startPx = yearToPx(start);
    const laneEnd = spanLaneEnds[lane];
    return laneEnd === undefined || laneEnd + SPAN_GAP <= startPx;
  }

  // Calculate how many lanes a family needs (parent + children)
  function getFamilyLaneExtent(span) {
    const childIds = [...(span.branches || []), ...(span.forks || [])];
    if (childIds.length === 0) return { minOffset: 0, maxOffset: 0 };

    let minOffset = 0;
    let maxOffset = 0;

    childIds.forEach(childId => {
      const childPlacement = spanChildPlacement[childId];
      if (childPlacement) {
        const offset = childPlacement.offset;
        minOffset = Math.min(minOffset, offset);
        maxOffset = Math.max(maxOffset, offset);
      }
    });

    return { minOffset, maxOffset };
  }

  function familyFitsAtLane(span, baseLane, start, end) {
    const { minOffset, maxOffset } = getFamilyLaneExtent(span);

    if (baseLane + minOffset < 0) return false;

    if (!spanFitsInLane(baseLane, start, end)) return false;

    for (let offset = minOffset; offset <= maxOffset; offset++) {
      if (offset === 0) continue; 
      const childLane = baseLane + offset;

      const childIds = [...(span.branches || []), ...(span.forks || [])];
      for (const childId of childIds) {
        const childPlacement = spanChildPlacement[childId];
        if (childPlacement && childPlacement.offset === offset) {
          const child = spanById[childId];
          if (child && !spanFitsInLane(childLane, child.start, child.end)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function placeSpan(span) {
    if (processed.has(span.id)) return;
    processed.add(span.id);

    const left = yearToPx(span.start);
    const width = (span.end - span.start) * PX_PER_YEAR;
    const right = left + width;
    const placement = spanChildPlacement[span.id];

    let lane;

    if (placement) {
      const parentLane = spanLaneById[placement.parentId];
      if (parentLane !== undefined) {
        const direction = placement.offset > 0 ? 1 : -1; 
        let searchLane = parentLane + direction;

        while (true) {
          if (searchLane < 0) {
            searchLane = parentLane + 1;
            while (!spanFitsInLane(searchLane, span.start, span.end)) {
              searchLane++;
            }
            break;
          }

          if (spanFitsInLane(searchLane, span.start, span.end)) {
            break;
          }

          searchLane += direction;
        }

        lane = searchLane;
      } else {
        lane = 0;
        while (!spanFitsInLane(lane, span.start, span.end)) {
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
    if (span.forks) {
      span.forks.forEach((childId) => {
        if (spanById[childId]) children.push(spanById[childId]);
      });
    }

    children.forEach(child => placeSpan(child));
  }

  sortedSpans.forEach(span => placeSpan(span));

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
    const preferredLane = idx % 2;

    function fitsInLane(lane) {
      const end = laneEnds[lane];
      return end === undefined || end + EVENT_GAP <= x;
    }

    let laneToUse;
    if (fitsInLane(preferredLane)) {
      laneToUse = preferredLane;
    } else {
      let l = 0;
      while (true) {
        if (fitsInLane(l)) {
          laneToUse = l;
          break;
        }
        l++;
      }
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
