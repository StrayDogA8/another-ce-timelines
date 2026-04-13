import { useMemo, useEffect, useRef, memo, forwardRef, useImperativeHandle } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatYear } from "../utils/timelineUtils";

const DEFAULT_COLOR = "#6b7280";
const TYPE_LABEL = { event: "Event", span: "Span", era: "Era" };

function resolveElementColor(el, spanById) {
  if (el.color) return el.color;
  if (el.type === "event") {
    const parentId = el.parents?.[0];
    const parentSpan = parentId ? spanById.get(parentId) : null;
    if (parentSpan?.color) return parentSpan.color;
  }
  return DEFAULT_COLOR;
}

function makeColoredIcon(color, selected) {
  const stroke = selected
    ? getComputedStyle(document.documentElement).getPropertyValue("--info-bg").trim() || "#5282DB"
    : "white";
  const strokeWidth = selected ? 4 : 1.5;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" style="cursor:pointer;display:block;">
      <rect x="0" y="0" width="24" height="36" fill="transparent"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.7"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    tooltipAnchor: [14, -18],
  });
}

function formatElementDate(el, fileConfig) {
  const { negID, posID, useMonths, hideDecimals } = fileConfig ?? {};
  if (el.type === "event") {
    const year = el.dateLabel ?? (el.date != null ? formatYear(el.date, negID, posID, useMonths, hideDecimals) : null);
    return year ?? "";
  }
  const start = el.startLabel ?? (el.start != null ? formatYear(el.start, negID, posID, useMonths, hideDecimals) : null);
  const end = el.endLabel ?? (el.end != null ? formatYear(el.end, negID, posID, useMonths, hideDecimals) : null);
  if (start && end) return `${start} â€“ ${end}`;
  return start ?? end ?? "";
}

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click: (e) => {
      if (e.originalEvent?.target?.closest?.(".leaflet-marker-icon")) return;
      onSelect?.(null);
    }
  });
  return null;
}

function MapControls({ controlRef }) {
  const map = useMap();
  useImperativeHandle(controlRef, () => ({
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
  }), [map]);
  return null;
}

function FlyToSelected({ markers, selectedId }) {
  const map = useMap();
  const lastSnappedId = useRef(null);
  useEffect(() => {
    if (!selectedId || selectedId === lastSnappedId.current) return;
    const el = markers.find((m) => m.id === selectedId);
    if (el) {
      lastSnappedId.current = selectedId;
      map.flyTo([Number(el.lat), Number(el.lng)], Math.max(map.getZoom(), 5), { duration: 0.8 });
    }
  }, [selectedId, markers, map]);
  return null;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default memo(forwardRef(function MapView({ elements = [], onSelect, selectedId, fileConfig }, ref) {
  const spanById = useMemo(() => {
    const map = new Map();
    elements.forEach((el) => { if (el.type === "span") map.set(el.id, el); });
    return map;
  }, [elements]);

  const markers = useMemo(() =>
    elements
      .filter((el) => el.lat != null && el.lat !== "" && el.lng != null && el.lng !== "")
      .map((el) => ({ ...el, resolvedColor: resolveElementColor(el, spanById) })),
    [elements, spanById]
  );

  const center = markers.length > 0 ? [Number(markers[0].lat), Number(markers[0].lng)] : [20, 0];
  const zoom = markers.length > 0 ? 5 : 2;

  return (
    <div className="timeline-map-view">
      <MapContainer
        key={`${center[0]},${center[1]}`}
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <MapClickHandler onSelect={onSelect} />
        <MapControls controlRef={ref} />
        <FlyToSelected markers={markers} selectedId={selectedId} />
        <TileLayer
          url={fileConfig?.mapTileUrl || DEFAULT_TILE_URL}
          attribution={fileConfig?.mapTileUrl ? "" : DEFAULT_ATTRIBUTION}
        />
        {markers.map((el) => {
          const dateStr = formatElementDate(el, fileConfig);
          const tags = Array.isArray(el.tags) && el.tags.length > 0 ? el.tags : null;
          return (
            <Marker
              key={el.id}
              position={[Number(el.lat), Number(el.lng)]}
              icon={makeColoredIcon(el.resolvedColor, el.id === selectedId)}
              bubblingMouseEvents={false}
              eventHandlers={{ click: () => onSelect?.(el.id) }}
            >
              <Tooltip className="map-element-tooltip" direction="right" offset={[0, 0]} opacity={1} interactive={false}>
                <div className="map-popup-box" style={{ borderColor: el.resolvedColor }}>
                  <div className="map-popup-header">
                    <span className="map-popup-type" style={{ background: el.resolvedColor }}>{TYPE_LABEL[el.type] ?? el.type}</span>
                    {dateStr && <span className="map-popup-date">{dateStr}</span>}
                  </div>
                  <div className="map-popup-title">{el.title || el.id}</div>
                  {tags && (
                    <div className="map-popup-tags">
                      {tags.map((t) => <span key={t} className="map-popup-tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}));
