import React, { useEffect, useRef, useState } from 'react';
import GlassCard from '../common/GlassCard';
import { Globe, Satellite, Plane, Flame, RefreshCw, AlertTriangle, Loader2, Sailboat } from 'lucide-react';
import {
  GeoOrbitStationOnChain,
  fetchGeoOrbitStations,
} from '../../services/credXService';
import { LiveFlightData, LiveHazardHotspot, LiveVesselData } from '../../utils/realGeoDataFeeds';

const CESIUM_VERSION = '1.111.0';
const CESIUM_JS = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/Cesium.js`;
const CESIUM_CSS = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`;

declare global {
  interface Window {
    Cesium: any;
  }
}

interface SmartGlobePanelProps {
  planes: LiveFlightData[];
  hotspots: LiveHazardHotspot[];
  vessels: LiveVesselData[];
}

/**
 * 3D globe built on Cesium (CDN). Draws real live objects only:
 * on-chain GeoOrbit stations + OpenSky ADS-B aircraft + NASA FIRMS thermal
 * anomalies. No simulated tracks — every entity is a live position.
 */
const SmartGlobePanel: React.FC<SmartGlobePanelProps> = ({ planes, hotspots, vessels }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loadingCesium, setLoadingCesium] = useState(false);
  const [stations, setStations] = useState<GeoOrbitStationOnChain[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadGlobeScripts = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (window.Cesium) {
        resolve(true);
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CESIUM_CSS;
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = CESIUM_JS;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

  const refreshStations = async () => {
    try {
      const list = await fetchGeoOrbitStations();
      setStations(list);
      renderStations(list);
    } catch {
      /* keep last known set */
    }
  };

  const renderStations = (list: GeoOrbitStationOnChain[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.removeById('station-layer', true);
    if (list.length === 0) return;
    for (const s of list) {
      viewer.entities.add({
        id: `station-${s.stationId}`,
        position: window.Cesium.Cartesian3.fromDegrees(s.lngE7 / 1e7, s.latE7 / 1e7, (s.hMeters || 0)),
        point: { pixelSize: 10, color: window.Cesium.Color.fromCssColorString('#34d399') },
        label: {
          text: `◎ STN#${s.stationId}`,
          font: '11px monospace',
          pixelOffset: new window.Cesium.Cartesian2(0, -14),
          fillColor: window.Cesium.Color.WHITE,
          style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: window.Cesium.Color.BLACK,
          outlineWidth: 3,
        },
        description: `On-chain station #${s.stationId} · hex ${s.hexId} · operator ${
          s.operator.slice(0, 6)
        }…${s.operator.slice(-4)} · block ${s.blockNumber.toLocaleString()}`,
      });
    }
    viewer.flyTo(viewer.entities);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCesium(true);
      const ok = await loadGlobeScripts();
      if (cancelled) return;
      setLoadingCesium(false);
      if (!ok || !containerRef.current) {
        setError('Cesium CDN blocked by network/CSP — falling back to the 2D coverage map.');
        return;
      }
      try {
        window.Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
        const viewer = new window.Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          baseLayer: window.Cesium.ImageryLayer.fromProviderAsync(
            window.Cesium.OpenStreetMapImageryProvider.fromUrl('https://tile.openstreetmap.org/')
          ),
        });
        viewer.scene.globe.enableLighting = false;
        viewerRef.current = viewer;
        viewer.entities.add({
          id: 'station-layer',
          position: window.Cesium.Cartesian3.fromDegrees(0, 0),
          point: { pixelSize: 0 },
        });
        setReady(true);
      } catch (e: any) {
        setError(e?.message || 'Failed to boot Cesium globe');
      }
    })();
    return () => {
      cancelled = true;
      try {
        viewerRef.current?.destroy();
        viewerRef.current = null;
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live overlay updates: aircraft + thermal anomalies + stations
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    viewer.entities.removeById('air-layer', true);
    if (planes.length > 0) {
      for (const f of planes) {
        viewer.entities.add({
          id: `air-${f.icao24}`,
          position: window.Cesium.Cartesian3.fromDegrees(f.longitude, f.latitude, (f.baroAltitude || 0) * 1000),
          point: { pixelSize: 6, color: window.Cesium.Color.fromCssColorString('#c084fc') },
          label: {
            text: `✈ ${f.callsign || f.icao24}`,
            font: '10px monospace',
            pixelOffset: new window.Cesium.Cartesian2(0, -10),
            fillColor: window.Cesium.Color.fromCssColorString('#d8b4fe'),
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: window.Cesium.Color.BLACK,
            outlineWidth: 2,
          },
        });
      }
    }
  }, [planes]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    viewer.entities.removeById('fire-layer', true);
    if (hotspots.length > 0) {
      for (const h of hotspots) {
        viewer.entities.add({
          id: `fire-${h.latitude}-${h.longitude}`,
          position: window.Cesium.Cartesian3.fromDegrees(h.longitude, h.latitude, 0),
          point: { pixelSize: 5, color: window.Cesium.Color.fromCssColorString('#ef4444') },
          label: {
            text: `🔥 ${h.satellite}`,
            font: '9px monospace',
            pixelOffset: new window.Cesium.Cartesian2(0, -8),
            fillColor: window.Cesium.Color.fromCssColorString('#fca5a5'),
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: window.Cesium.Color.BLACK,
            outlineWidth: 2,
          },
        });
      }
    }
  }, [hotspots]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    viewer.entities.removeById('ais-layer', true);
    if (vessels.length > 0) {
      for (const v of vessels) {
        viewer.entities.add({
          id: `ais-${v.mmsi}`,
          position: window.Cesium.Cartesian3.fromDegrees(v.longitude, v.latitude, 0),
          point: { pixelSize: 5, color: window.Cesium.Color.fromCssColorString('#14b8a6') },
          label: {
            text: `⛵ ${v.name || v.mmsi}`,
            font: '9px monospace',
            pixelOffset: new window.Cesium.Cartesian2(0, -8),
            fillColor: window.Cesium.Color.fromCssColorString('#5eead4'),
            style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineColor: window.Cesium.Color.BLACK,
            outlineWidth: 2,
          },
        });
      }
    }
  }, [vessels]);

  return (
    <GlassCard className="p-5 border-cyan-500/30 bg-gradient-to-br from-sky-950/20 via-black to-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-black text-sm flex items-center gap-2 tracking-tight">
            <Globe className="w-4 h-4 text-cyan-400" /> GeoOrbit 3D Transparency Globe
          </h3>
          <p className="text-[11px] text-white/50 font-mono mt-0.5">
            Live objects only: on-chain RNSS stations · ADS-B aircraft · FIRMS thermal anomalies (Cesium Ion)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStations}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Stations ({stations.length})
          </button>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/10 bg-black/60" style={{ height: 540 }}>
        {loadingCesium ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-cyan-300 font-mono text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> booting Cesium viewer…
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-rose-300 font-mono text-xs">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="absolute inset-0" />
            {!ready ? (
              <div className="absolute inset-0 flex items-center justify-center text-white/40 font-mono text-xs z-10 pointer-events-none">
                initializing…
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-white/45">
        <span className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-emerald-400" /> {stations.length} on-chain stations</span>
        <span className="flex items-center gap-1.5"><Plane className="w-3 h-3 text-purple-400" /> {planes.length} ADS-B aircraft</span>
        <span className="flex items-center gap-1.5"><Flame className="w-3 h-3 text-red-400" /> {hotspots.length} thermal anomalies</span>
        <span className="flex items-center gap-1.5"><Sailboat className="w-3 h-3 text-teal-400" /> {vessels.length} AIS vessels</span>
      </div>
    </GlassCard>
  );
};

export default SmartGlobePanel;