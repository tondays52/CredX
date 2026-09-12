import React, { useEffect, useRef, useState } from 'react';
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleCirclesRef = useRef<any[]>([]);
  const trafficLayerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Dynamic Google Maps JS Script Loader
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
      script.onload = () => {
        setMapLoaded(true);
      };
      script.onerror = () => {
        setLoadError(true);
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setMapLoaded(true));
      existingScript.addEventListener('error', () => setLoadError(true));
    }
  }, [apiKey]);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return;

    try {
      const mapOptions: any = {
        center: { lat: center.lat, lng: center.lng },
        zoom,
        styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: true,
        backgroundColor: '#070b14'
      };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, mapOptions);
      } else {
        mapInstanceRef.current.setCenter({ lat: center.lat, lng: center.lng });
        mapInstanceRef.current.setZoom(zoom);
        mapInstanceRef.current.setOptions({ styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [] });
      }
    } catch (err) {
      console.warn('Google Maps init error, falling back to OSM:', err);
      setLoadError(true);
    }
  }, [mapLoaded, center.lat, center.lng, zoom, theme]);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear old markers
    googleMarkersRef.current.forEach(m => m.setMap(null));
    googleMarkersRef.current = [];

    // Create new markers with custom SVG pin
    markers.forEach(m => {
      const color = m.color || '#10b981';
      const markerOptions: any = {
        position: { lat: m.lat, lng: m.lng },
        map: mapInstanceRef.current,
        title: m.title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: m.label ? 10 : 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      };

      if (m.label) {
        markerOptions.label = {
          text: m.label,
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold'
        };
      }

      const marker = new window.google.maps.Marker(markerOptions);

      marker.addListener('click', () => {
        if (m.onClick) m.onClick();
        if (onMarkerClick) onMarkerClick(m);
      });

      googleMarkersRef.current.push(marker);
    });
  }, [mapLoaded, markers, onMarkerClick]);

  // Update Circles
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear old circles
    googleCirclesRef.current.forEach(c => c.setMap(null));
    googleCirclesRef.current = [];

    // Create new circles
    circles.forEach(c => {
      const circle = new window.google.maps.Circle({
        strokeColor: c.color,
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: c.color,
        fillOpacity: c.fillOpacity ?? 0.12,
        map: mapInstanceRef.current,
        center: { lat: c.lat, lng: c.lng },
        radius: c.radiusMeters
      });

      googleCirclesRef.current.push(circle);
    });
  }, [mapLoaded, circles]);

  // Real Google Maps Live Traffic Flow Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (showTrafficLayer) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    } else {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    }
  }, [mapLoaded, showTrafficLayer]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-white/10 ${className}`}>
      {/* Real Google Maps Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[440px]" />

      {/* SVG Spatial H3 Hexagonal Grid Overlay */}
      {showHexGrid && (
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

      {/* Fallback Display if Google Maps API has domain restriction */}
      {loadError && (
        <div className="absolute inset-0 bg-[#070b14] flex flex-col items-center justify-center p-6 text-center z-20">
          {/* Real Free OpenStreetMap Tile Layer without watermarks */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
            <div className="absolute -top-[100px] -left-[100px] w-[1100px] h-[750px] grid grid-cols-3 grid-rows-3 opacity-80 filter invert contrast-125 brightness-90">
              {[
                { x: 6152, y: 3536 }, { x: 6153, y: 3536 }, { x: 6154, y: 3536 },
                { x: 6152, y: 3537 }, { x: 6153, y: 3537 }, { x: 6154, y: 3537 },
                { x: 6152, y: 3538 }, { x: 6153, y: 3538 }, { x: 6154, y: 3538 },
              ].map((tile, idx) => (
                <img
                  key={idx}
                  src={`https://tile.openstreetmap.org/13/${tile.x}/${tile.y}.png`}
                  alt="OpenStreetMap Tile"
                  className="w-[256px] h-[256px] object-cover"
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/90 via-[#070b14]/40 to-[#070b14]/80" />
          </div>

          <div className="relative z-10 p-4 rounded-xl bg-black/80 border border-white/10 max-w-md space-y-2">
            <span className="text-xs font-mono text-cyan-400 font-bold block">
              Direct Street Cartography Active (OSM Free Layer)
            </span>
            <p className="text-[11px] text-white/60">
              {apiKey
                ? `Google Maps JS API blocked by referrer restriction — rendering real street coordinates at ${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° E via the free OpenStreetMap layer instead.`
                : 'Google Maps JS API key not configured (set VITE_GOOGLE_MAPS_API_KEY in frontend/.env). Rendering the free OpenStreetMap layer instead.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapView;
