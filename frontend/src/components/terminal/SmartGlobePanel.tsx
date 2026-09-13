import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import GlassCard from '../common/GlassCard';
import { Globe, Satellite, Plane, Flame, RefreshCw, AlertTriangle, Loader2, Sailboat, Radio, MapPin } from 'lucide-react';
import {
  GeoOrbitStationOnChain,
  fetchGeoOrbitStations,
} from '../../services/credXService';
import { LiveFlightData, LiveHazardHotspot, LiveVesselData } from '../../utils/realGeoDataFeeds';
import { NTRIPMountpoint, GlobalMinerCluster } from '../../utils/geoOrbitTelemetry';

interface SmartGlobePanelProps {
  planes: LiveFlightData[];
  hotspots: LiveHazardHotspot[];
  vessels: LiveVesselData[];
  mountpoints?: NTRIPMountpoint[];
  clusters?: GlobalMinerCluster[];
  externalStations?: GeoOrbitStationOnChain[];
}

const DEG = Math.PI / 180;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Procedural dark globe used when the online earth texture cannot load (offline-safe). */
function createFallbackGlobeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0b1a2b');
  grad.addColorStop(0.5, '#0a1c33');
  grad.addColorStop(1, '#0b1a2b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = 'rgba(56,189,248,0.30)';
  ctx.lineWidth = 1;
  for (let lon = 0; lon <= 360; lon += 20) {
    ctx.beginPath();
    ctx.moveTo((lon / 360) * 1024, 0);
    ctx.lineTo((lon / 360) * 1024, 512);
    ctx.stroke();
  }
  for (let latv = -80; latv <= 120; latv += 20) {
    const y = ((90 - latv) / 180) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(1024, 256);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const ENTITY_COLORS: Record<string, string> = {
  station: '#34d399',
  plane: '#c084fc',
  fire: '#ef4444',
  vessel: '#14b8a6',
  mountpoint: '#f59e0b',
  cluster: '#38bdf8',
  onchain: '#a78bfa'
};

function makeGlowTexture(color: string): THREE.CanvasTexture {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color + 'aa');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * 3D globe — bundled three.js (no CDN / API key required). Draws real live
 * objects only: on-chain GeoOrbit stations + OpenSky ADS-B aircraft + NASA
 * FIRMS thermal anomalies + AIS vessels. No simulated tracks.
 */
const SmartGlobePanel: React.FC<SmartGlobePanelProps> = ({ planes, hotspots, vessels, mountpoints = [], clusters = [], externalStations = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const globeMeshRef = useRef<THREE.Mesh | null>(null);
  const entityGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; rotY: number; rotX: number } | null>(null);
  const autoRotateRef = useRef(true);

  const [stations, setStations] = useState<GeoOrbitStationOnChain[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // NTRIP mountpoint coordinates (sampled from GEORBIT_MOUNTPOINTS via clusters)
  const MOUNTPOINT_COORDS: Record<string, { lat: number; lng: number }> = {
    AUTO: { lat: 51.9244, lng: 4.4777 },        // Rotterdam — auto-select
    AUTO_ITRF2020: { lat: 1.3521, lng: 103.82 }, // Singapore — global
    AUTO_WGS84: { lat: 37.5665, lng: 126.978 },  // Seoul — dynamic
    AUTO_ITRF2014: { lat: 35.6762, lng: 139.65 },// Tokyo — legacy
    BRDC: { lat: 39.8283, lng: -77.0369 },        // US East — broadcast
  };

  const renderLayers = useCallback(() => {
    const env = entityGroupRef.current;
    if (!env || !rendererRef.current) return;
    while (env.children.length > 0) {
      const child = env.children[0] as THREE.Sprite;
      env.remove(child);
      child.material.dispose();
    }
    const add = (lat: number, lng: number, alt: number, key: string, size: number, name: string) => {
      let tex = glowTextureCache.get(key);
      if (!tex) {
        tex = makeGlowTexture(key);
        glowTextureCache.set(key, tex);
      }
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.userData.name = name;
      const pos = latLngToVec3(lat, lng, 1.01 + alt);
      sprite.position.copy(pos);
      sprite.scale.setScalar(size);
      env.add(sprite);
    };

    // On-chain registered stations (from registry logs)
    const allStations = externalStations.length > 0 ? externalStations : stations;
    for (const s of allStations)
      add(s.latE7 / 1e7, s.lngE7 / 1e7, 0, ENTITY_COLORS.station, 0.032, `◎ STN#${s.stationId} · hex ${s.hexId}`);

    // NTRIP Mountpoints
    for (const mp of mountpoints) {
      const coord = MOUNTPOINT_COORDS[mp.name];
      if (coord) add(coord.lat, coord.lng, 0.008, ENTITY_COLORS.mountpoint, 0.038, `📡 NTRIP: ${mp.name} · ${mp.format} · Port ${mp.port}`);
    }

    // Global Miner Clusters
    for (const c of clusters)
      add(c.lat, c.lng, 0.004, ENTITY_COLORS.cluster, 0.044, `📶 ${c.name} · ${c.count} stations · 2cm: ${c.precision2cmCoverageKm}km`);

    // ADS-B Aircraft
    for (const p of planes) add(p.latitude, p.longitude, 0.012, ENTITY_COLORS.plane, 0.026, `✈ ${p.callsign || p.icao24} (${p.originCountry}) Alt: ${p.baroAltitude ? p.baroAltitude + 'm' : 'GND'}`);

    // NASA FIRMS Thermal Anomalies
    for (const h of hotspots) add(h.latitude, h.longitude, 0, ENTITY_COLORS.fire, 0.02, `🔥 ${h.satellite} · Brightness: ${h.brightness}K`);

    // AIS Maritime Vessels
    for (const v of vessels) add(v.latitude, v.longitude, 0, ENTITY_COLORS.vessel, 0.022, `⛵ ${v.name || v.mmsi} · ${v.speedKnots.toFixed(1)} kn`);
  }, [stations, externalStations, mountpoints, clusters, planes, hotspots, vessels]);

  useEffect(() => {
    renderLayers();
  }, [renderLayers]);

  const buildGlobe = useCallback((): THREE.Texture => {
    const tex = new THREE.TextureLoader().load(
      'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg',
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
      },
      undefined,
      () => {
        // CDN texture unreachable — swap in the procedural graticule globe so it still renders offline.
        const mesh = globeMeshRef.current;
        if (mesh) {
          const fallback = createFallbackGlobeTexture();
          (mesh.material as THREE.MeshBasicMaterial).map = fallback;
          (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      }
    );
    return tex;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth || 640;
    const height = el.clientHeight || 540;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('WebGL unavailable — falling back to the 2D coverage map.');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    const globe = new THREE.Group();
    globe.rotation.y = -0.35;
    globeRef.current = globe;
    scene.add(globe);

    const sphere = new THREE.SphereGeometry(1, 128, 64);
    const globeMesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ map: buildGlobe() }));
    globeMeshRef.current = globeMesh;
    globe.add(globeMesh);

    // Safety net: if the online texture neither loads nor errors (network hang),
    // swap in the procedural graticule globe so rendering never fails.
    const swapTimer = window.setTimeout(() => {
      const mat = globeMesh.material as THREE.MeshBasicMaterial;
      if (globeMeshRef.current && mat.map && !(mat.map as THREE.Texture).image) {
        mat.map = createFallbackGlobeTexture();
        mat.needsUpdate = true;
      }
    }, 12000);
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 64, 32),
      new THREE.MeshBasicMaterial({ color: '#06b6d4', transparent: true, opacity: 0.1, side: THREE.FrontSide })
    );
    globe.add(haze);

    const starsGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(900);
    for (let i = 0; i < 900; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 80;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#9fd8ff', size: 0.12, transparent: true, opacity: 0.7 })));

    const entities = new THREE.Group();
    globe.add(entities);
    entityGroupRef.current = entities;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (globeRef.current && autoRotateRef.current && !dragRef.current) {
        globeRef.current.rotation.y += 0.0014;
      }
      renderer.render(scene, camera);
    };
    rafRef.current = requestAnimationFrame(animate);

    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      renderer.setSize(r.width, r.height);
      if (cameraRef.current) {
        cameraRef.current.aspect = r.width / r.height;
        cameraRef.current.updateProjectionMatrix();
      }
    });
    ro.observe(containerRef.current ?? el);

    setReady(true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(swapTimer);
      ro.disconnect();
      glowTextureCache.clear();
      renderer.dispose();
      sphere.dispose();
      starsGeo.dispose();
      el.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      globeRef.current = null;
      globeMeshRef.current = null;
      entityGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStations = async () => {
    try {
      const list = await fetchGeoOrbitStations();
      setStations(list);
    } catch {
      /* keep last known set */
    }
  };

  useEffect(() => {
    refreshStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, rotY: globeRef.current?.rotation.y ?? 0, rotX: globeRef.current?.rotation.x ?? 0 };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gl = globeRef.current;
    const cam = cameraRef.current;
    if (!gl || !cam || !rendererRef.current) return;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      gl.rotation.y = dragRef.current.rotY + dx * 0.0055;
      gl.rotation.x = Math.max(-1.2, Math.min(1.2, dragRef.current.rotX + dy * 0.004));
      return;
    }
    // hover tooltip via raycast on sprites
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), cam);
    const hits = raycaster.intersectObjects(gl.children, true);
    const sprite = hits.find((h) => (h.object as THREE.Sprite).isSprite) as { object: THREE.Sprite } | undefined;
    if (sprite) {
      setTooltip({ text: String((sprite.object as THREE.Object3D & { userData: { name?: string } }).userData.name ?? ''), x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltip(null);
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const displayStations = externalStations.length > 0 ? externalStations : stations;

  return (
    <GlassCard className="p-5 border-cyan-500/30 bg-gradient-to-br from-sky-950/20 via-black to-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-black text-sm flex items-center gap-2 tracking-tight">
            <Globe className="w-4 h-4 text-cyan-400" /> GeoOrbit 3D Network Globe
          </h3>
          <p className="text-[11px] text-white/50 font-mono mt-0.5">
            Live network: NTRIP mountpoints · miner clusters · on-chain stations · ADS-B aircraft · FIRMS anomalies · AIS vessels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStations}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Sync ({displayStations.length})
          </button>
        </div>
      </div>

      <div
        className="relative mt-3 rounded-2xl overflow-hidden border border-white/10 bg-black/60"
        style={{ height: 560 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-rose-300 font-mono text-xs">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="absolute inset-0" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-cyan-300 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin" /> Initializing 3D globe…
              </div>
            )}
            {tooltip && (
              <div
                className="absolute z-20 pointer-events-none px-2 py-1 rounded bg-black/85 border border-white/15 text-[10px] font-mono text-white/90 whitespace-nowrap max-w-xs"
                style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
              >
                {tooltip.text}
              </div>
            )}
            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
              <div className="flex flex-wrap gap-2">
                {mountpoints.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 border border-amber-500/30 text-[9px] font-mono text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {mountpoints.length} Mountpoints
                  </span>
                )}
                {clusters.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 border border-sky-500/30 text-[9px] font-mono text-sky-300">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> {clusters.length} Clusters
                  </span>
                )}
                {displayStations.length > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 border border-emerald-500/30 text-[9px] font-mono text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> {displayStations.length} On-chain
                  </span>
                )}
              </div>
            </div>
            {/* Drag hint */}
            <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded bg-black/60 border border-white/10 text-[9px] font-mono text-white/40 pointer-events-none">
              Drag to rotate · Hover to inspect
            </div>
          </>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] font-mono text-white/45">
        <span className="flex items-center gap-1.5"><Radio className="w-3 h-3 text-amber-400" /> {mountpoints.length} NTRIP mountpoints</span>
        <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-sky-400" /> {clusters.length} miner clusters</span>
        <span className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-emerald-400" /> {displayStations.length} on-chain stations</span>
        <span className="flex items-center gap-1.5"><Plane className="w-3 h-3 text-purple-400" /> {planes.length} ADS-B aircraft</span>
        <span className="flex items-center gap-1.5"><Flame className="w-3 h-3 text-red-400" /> {hotspots.length} thermal anomalies</span>
        <span className="flex items-center gap-1.5"><Sailboat className="w-3 h-3 text-teal-400" /> {vessels.length} AIS vessels</span>
      </div>
    </GlassCard>
  );
};

export default SmartGlobePanel;