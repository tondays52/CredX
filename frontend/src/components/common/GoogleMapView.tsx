import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GOOGLE_MAPS_API_KEY } from '../../config/contracts';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  category?: string;
  color?: string;
  label?: string;
  iconUrl?: string;
  onClick?: () => void;
}

export interface MapCircle {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  color: string;
  fillOpacity?: number;
}

interface GoogleMapViewProps {
  apiKey?: string;
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  theme?: 'dark' | 'light';
  showHexGrid?: boolean;
  showTrafficLayer?: boolean;
  className?: string;
  onMarkerClick?: (marker: MapMarker) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

// Sleek dark cyberpunk theme for Google Maps
const GOOGLE_MAPS_DARK_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#070b14' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#070b14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0c1626' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#141e33' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#131e30' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050811' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0284c7' }]
  }
];

/* ------------------------------------------------------------------ *
 * Web-Mercator math for the keyless OpenStreetMap tile layer
 * ------------------------------------------------------------------ */
const TILE = 256;
const MAX_LAT = 85.05112878;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const s = TILE * Math.pow(2, zoom);
  const latR = (clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180;
  const x = (s * (lng + 180)) / 360;
  const y = (s * (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI)) / 2;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const s = TILE * Math.pow(2, zoom);
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

const OSM_PROVIDERS = [
  (z: number, x: number, y: number) =>
    `https://${'abcd'[((x % 4) + 4) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
  (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
];

interface OsmLayerProps {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MapMarker[];
  circles: MapCircle[];
  theme: 'dark' | 'light';
  showHexGrid: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
}

/** Interactive, keyless slippy-map tile layer (CARTO dark + OSM fallback). */
const OsmLayer: React.FC<OsmLayerProps> = ({ center, zoom, markers, circles, theme, showHexGrid, onMarkerClick }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [pos, setPos] = useState<{ lat: number; lng: number }>(center);
  const [zl, setZl] = useState(zoom);
  const dragRef = useRef<{ x: number; y: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    setPos(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Native non-passive wheel listener so page scroll can be prevented while zooming.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, zl, size]);

  const view = useMemo(() => {
    const c = project(pos.lat, pos.lng, zl);
    return { centerPx: c, topLeft: { x: c.x - size.w / 2, y: c.y - size.h / 2 } };
  }, [pos, zl, size]);

  const tiles = useMemo(() => {
    const out: { x: number; y: number; px: number; py: number }[] = [];
    if (size.w === 0 || size.h === 0) return out;
    const x0 = Math.floor(view.topLeft.x / TILE) - 1;
    const y0 = Math.floor(view.topLeft.y / TILE) - 1;
    const x1 = Math.floor((view.topLeft.x + size.w) / TILE) + 1;
    const y1 = Math.floor((view.topLeft.y + size.h) / TILE) + 1;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= Math.pow(2, zl)) continue;
        out.push({ x: tx, y: ty, px: tx * TILE - view.topLeft.x, py: ty * TILE - view.topLeft.y });
      }
    }
    return out;
  }, [view, size, zl]);

  const metersPerPixel = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z);

  const panTo = (dx: number, dy: number, startLat: number, startLng: number) => {
    const startPx = project(startLat, startLng, zl);
    const next = unproject(startPx.x + dx, startPx.y + dy, zl);
    setPos(next);
  };

  const clampZoom = (z: number) => clamp(Math.round(z), 2, 19);

  const zoomAt = (dz: number, cx: number, cy: number) => {
    const nextZ = clampZoom(zl + dz);
    if (nextZ === zl) return;
    const worldPx = project(pos.lat, pos.lng, zl);
    const offsetX = cx - size.w / 2;
    const offsetY = cy - size.h / 2;
    const targetWorldBefore = { x: worldPx.x + offsetX, y: worldPx.y + offsetY };
    const geoBefore = unproject(targetWorldBefore.x, targetWorldBefore.y, zl);
    const targetWorldAfter = project(geoBefore.lat, geoBefore.lng, nextZ);
    const newCenterPx = { x: targetWorldAfter.x - offsetX, y: targetWorldAfter.y - offsetY };
    const next = unproject(newCenterPx.x, newCenterPx.y, nextZ);
    setZl(nextZ);
    setPos(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, lat: pos.lat, lng: pos.lng };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    panTo(e.clientX - dragRef.current.x, e.clientY - dragRef.current.y, dragRef.current.lat, dragRef.current.lng);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
  };

  const markerPx = (m: MapMarker) => {
    const p = project(m.lat, m.lng, zl);
    return { left: p.x - view.topLeft.x, top: p.y - view.topLeft.y };
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[320px] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing bg-[#070b14]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {tiles.map((t) => (
        <Tile
          key={`${t.x}:${t.y}:${zl}`}
          zl={zl}
          tx={t.x}
          ty={t.y}
          px={t.px}
          py={t.py}
        />
      ))}

      {/* Coverage circles */}
      {circles.map((c) => {
        const p = project(c.lat, c.lng, zl);
        const px = Math.max(2, c.radiusMeters / metersPerPixel(c.lat, zl));
        return (
          <div
            key={c.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: p.x - view.topLeft.x,
              top: p.y - view.topLeft.y,
              width: px * 2,
              height: px * 2,
              transform: 'translate(-50%, -50%)',
              border: `1.5px solid ${c.color}`,
              backgroundColor: `${c.color}${Math.round((c.fillOpacity ?? 0.12) * 255)
                .toString(16)
                .padStart(2, '0')}`,
              boxShadow: `0 0 12px ${c.color}44, inset 0 0 12px ${c.color}22`
            }}
          />
        );
      })}

      {/* Markers */}
      {markers.map((m) => {
        const p = markerPx(m);
        const color = m.color || '#10b981';
        const isLabel = !!m.label;
        return (
          <div
            key={m.id}
            title={m.title}
            onClick={(e) => {
              e.stopPropagation();
              if (m.onClick) m.onClick();
              if (onMarkerClick) onMarkerClick(m);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full cursor-pointer pointer-events-auto"
            style={{ left: p.left, top: p.top, width: isLabel ? 30 : 18, height: isLabel ? 30 : 18 }}
          >
            <div
              className="rounded-full border-2 border-white"
              style={{
                width: isLabel ? 26 : 12,
                height: isLabel ? 26 : 12,
                background: `radial-gradient(circle at 30% 30%, ${color}, #0b1220)`,
                boxShadow: `0 0 10px ${color}aa`
              }}
            />
            {isLabel && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-white drop-shadow">
                {m.label}
              </span>
            )}
          </div>
        );
      })}

      {/* SVG Spatial H3 Hexagonal Grid Overlay */}
      {showHexGrid && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="gmapHex" width="60" height="104" patternUnits="userSpaceOnUse">
              <path
                d="M30 0 L60 17.32 L60 51.96 L30 69.28 L0 51.96 L0 17.32 Z M30 104 L60 86.68 L60 51.96 L30 69.28 L0 51.96 L0 86.68 Z"
                fill="none"
                stroke={theme === 'dark' ? '#06b6d4' : '#0284c7'}
                strokeWidth="0.75"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gmapHex)" />
        </svg>
      )}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        {[
          { label: '+', dz: 1 },
          { label: '−', dz: -1 }
        ].map((b) => (
          <button
            key={b.label}
            onClick={(e) => {
              e.stopPropagation();
              zoomAt(b.dz, size.w / 2, size.h / 2);
            }}
            className="w-8 h-8 rounded-lg bg-black/70 backdrop-blur border border-white/15 text-white/80 text-sm font-mono hover:border-cyan-400/60 hover:text-cyan-300 transition-colors flex items-center justify-center"
            style={{ touchAction: 'none' }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Attribution */}
      <div className="absolute bottom-1 right-2 z-10 text-[9px] font-mono text-white/40 pointer-events-none">
        © OpenStreetMap contributors · CARTO
      </div>
    </div>
  );
};

const Tile: React.FC<{ zl: number; tx: number; ty: number; px: number; py: number }> = ({ zl, tx, ty, px, py }) => {
  const [providerIdx, setProviderIdx] = useState(0);
  if (providerIdx >= OSM_PROVIDERS.length) return null;
  const src = OSM_PROVIDERS[providerIdx](zl, tx, ty);
  return (
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      draggable={false}
      className="absolute pointer-events-none"
      style={{ left: px, top: py, width: TILE, height: TILE }}
      onError={() => setProviderIdx((i) => i + 1)}
    />
  );
};

interface GoogleLayerProps {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MapMarker[];
  circles: MapCircle[];
  theme: 'dark' | 'light';
  showTrafficLayer: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
}

/** Google Maps JS API layer — only rendered when an API key loads successfully. */
const GoogleLayer: React.FC<GoogleLayerProps> = ({
  center,
  zoom,
  markers,
  circles,
  theme,
  showTrafficLayer,
  onMarkerClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleCirclesRef = useRef<any[]>([]);
  const trafficRef = useRef<any>(null);
  const [ready, setReady] = useState<boolean>(!!window.google?.maps);

  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    const id = 'google-maps-script-credx';
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener('load', () => setReady(true));
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google?.maps) return;
    try {
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
          backgroundColor: '#070b14'
        });
      } else {
        mapRef.current.setCenter({ lat: center.lat, lng: center.lng });
        mapRef.current.setZoom(zoom);
      }
    } catch {
      /* leave map uninitialised */
    }
  }, [ready, center.lat, center.lng, zoom, theme]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    markers.forEach((m) => {
      const color = m.color || '#10b981';
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current,
        title: m.title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: m.label ? 10 : 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
      if (m.label) {
        marker.setLabel({ text: m.label, color: '#ffffff', fontSize: '10px', fontWeight: 'bold' });
      }
      marker.addListener('click', () => {
        if (m.onClick) m.onClick();
        if (onMarkerClick) onMarkerClick(m);
      });
      googleMarkersRef.current.push(marker);
    });
  }, [ready, markers, onMarkerClick]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    googleCirclesRef.current.forEach((c) => c.setMap(null));
    googleCirclesRef.current = [];
    circles.forEach((c) => {
      const circle = new window.google.maps.Circle({
        strokeColor: c.color,
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: c.color,
        fillOpacity: c.fillOpacity ?? 0.12,
        map: mapRef.current,
        center: { lat: c.lat, lng: c.lng },
        radius: c.radiusMeters
      });
      googleCirclesRef.current.push(circle);
    });
  }, [ready, circles]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (showTrafficLayer) {
      if (!trafficRef.current) trafficRef.current = new window.google.maps.TrafficLayer();
      trafficRef.current.setMap(mapRef.current);
    } else if (trafficRef.current) {
      trafficRef.current.setMap(null);
    }
  }, [ready, showTrafficLayer]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  apiKey = GOOGLE_MAPS_API_KEY,
  center,
  zoom = 13,
  markers = [],
  circles = [],
  theme = 'dark',
  showHexGrid = true,
  showTrafficLayer = false,
  className = 'w-full h-full min-h-[440px]',
  onMarkerClick
}) => {
  const [mapLoaded, setMapLoaded] = useState<boolean>(!!window.google?.maps);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }
    if (!apiKey) {
      setLoadError(true);
      return;
    }
    const scriptId = 'google-maps-script-credx';
    const existingScript = document.getElementById(scriptId);
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => setLoadError(true);
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setMapLoaded(true));
      existingScript.addEventListener('error', () => setLoadError(true));
    }
  }, [apiKey]);

  const useGoogle = !!apiKey && mapLoaded && !loadError && !!window.google?.maps;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-white/10 ${className}`}>
      {useGoogle ? (
        <GoogleLayer
          center={center}
          zoom={zoom}
          markers={markers}
          circles={circles}
          theme={theme}
          showTrafficLayer={showTrafficLayer}
          onMarkerClick={onMarkerClick}
        />
      ) : (
        <OsmLayer
          center={center}
          zoom={clamp(Math.round(zoom), 2, 19)}
          markers={markers}
          circles={circles}
          theme={theme}
          showHexGrid={showHexGrid}
          onMarkerClick={onMarkerClick}
        />
      )}

      {/* SVG Spatial H3 Hexagonal Grid Overlay on the google path */}
      {useGoogle && showHexGrid && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-25"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="gmapHex" width="60" height="104" patternUnits="userSpaceOnUse">
              <path
                d="M30 0 L60 17.32 L60 51.96 L30 69.28 L0 51.96 L0 17.32 Z M30 104 L60 86.68 L60 51.96 L30 69.28 L0 51.96 L0 86.68 Z"
                fill="none"
                stroke={theme === 'dark' ? '#06b6d4' : '#0284c7'}
                strokeWidth="0.75"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gmapHex)" />
        </svg>
      )}
    </div>
  );
};

export default GoogleMapView;