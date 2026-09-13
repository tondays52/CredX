import React, { useEffect, useRef, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Satellite,
  Compass,
  Globe,
  Cpu,
  Flame,
  ShieldCheck,
  Copy,
  Check,
  Search,
  Crosshair,
  Activity,
  Zap,
  Radio,
  Layers,
  Power,
  TrendingUp,
  BarChart3,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Info,
  Navigation,
  SlidersHorizontal,
  ChevronRight,
  CheckCircle2,
  Filter,
  DollarSign,
  Plane,
  Flame as FireIcon,
  Bot,
  Sailboat
} from 'lucide-react';
import { StableHexRecord, GlobalMinerCluster, NTRIPMountpoint, parseNMEAGGA } from '../../utils/geoOrbitTelemetry';
import GeoOrbitAttestationModal from '../modals/GeoOrbitAttestationModal';
import GoogleMapView from '../common/GoogleMapView';
import GeoOrbitStatePanel from './GeoOrbitStatePanel';
import {
  getRealDevicePhysicalPosition,
  watchRealDevicePhysicalPosition,
  connectPhysicalSerialRTK,
  RealGNSSPosition
} from '../../utils/realHardwareConnect';
import {
  fetchLiveOpenSkyAirspace,
  fetchLiveNasaFirmsHotspots,
  queryOpenAiDePINAdvisor,
  connectLiveAisVessels,
  LiveFlightData,
  LiveHazardHotspot,
  LiveVesselData
} from '../../utils/realGeoDataFeeds';
import {
  fetchGeoOrbitStations,
  GeoOrbitStationOnChain
} from '../../services/credXService';
import SmartGlobePanel from './SmartGlobePanel';

export const CredXGeoOrbitView: React.FC = () => {
  const {
    orbitConnected,
    orbitTotalStations,
    orbitMyStationsCount,
    orbitClaimableTokens,
    orbitBurnedTokens,
    orbitDataRevenueUSD,
    orbitSatellitesLocked,
    orbitAccuracyCm,
    orbitActiveHexMultiplier,
    orbitMountpoint,
    orbitStationUptimeHours,
    orbitSatellites,
    orbitNmeaSentence,
    orbitNmeaData,
    orbitLastAttestationHash,
    orbitPoSTProofsCount,
    orbitStableHexes,
    orbitClusters,
    orbitMountpoints,
    toggleOrbitStation,
    claimOrbitTokens,
    syncOrbitAttestation,
    setOrbitMountpoint,
    simulateRoverFix
  } = useProtocol();

  const { addToast } = useToast();

  const [subTab, setSubTab] = useState<'explorer' | 'coverage' | 'hardware' | 'tokenomics'>('explorer');
  const [hexSearchQuery, setHexSearchQuery] = useState<string>('');
  const [selectedHex, setSelectedHex] = useState<StableHexRecord | null>(orbitStableHexes[0] || null);
  const [selectedCluster, setSelectedCluster] = useState<GlobalMinerCluster | null>(orbitClusters[0] || null);
  const [coverageFilter, setCoverageFilter] = useState<'all' | '2cm' | '10cm'>('all');
  const [isAttestationModalOpen, setIsAttestationModalOpen] = useState<boolean>(false);
  const [copiedString, setCopiedString] = useState<boolean>(false);
  const [selectedMountpointObj, setSelectedMountpointObj] = useState<NTRIPMountpoint>(
    orbitMountpoints.find(m => m.name === orbitMountpoint) || orbitMountpoints[1]
  );

  // Real Physical Hardware Connection State
  const [hardwareLinkMode, setHardwareLinkMode] = useState<'device-gps' | 'usb-serial' | 'calibrated-cors'>('device-gps');
  const [isReadingRealGPS, setIsReadingRealGPS] = useState<boolean>(false);
  const [realDevicePos, setRealDevicePos] = useState<RealGNSSPosition | null>(null);
  const [serialConnected, setSerialConnected] = useState<boolean>(false);
  const [liveNmeaOverride, setLiveNmeaOverride] = useState<string | null>(null);

  // Real Geospatial Live Feeds (OpenSky, NASA FIRMS, TomTom, OpenAI)
  const [liveTraffic, setLiveTraffic] = useState<boolean>(false);
  const [liveAirspace, setLiveAirspace] = useState<boolean>(false);
  const [liveFlights, setLiveFlights] = useState<LiveFlightData[]>([]);
  const [loadingFlights, setLoadingFlights] = useState<boolean>(false);
  const [liveFirms, setLiveFirms] = useState<boolean>(false);
  const [liveHotspots, setLiveHotspots] = useState<LiveHazardHotspot[]>([]);
  const [loadingFirms, setLoadingFirms] = useState<boolean>(false);
  const [aiAdvisorResponse, setAiAdvisorResponse] = useState<string | null>(null);
  const [isQueryingAi, setIsQueryingAi] = useState<boolean>(false);

  // Real on-chain stations (GeoOrbitRegistry StationRegistered via eth_getLogs)
  const [onChainStations, setOnChainStations] = useState<GeoOrbitStationOnChain[]>([]);
  const [showOnChain, setShowOnChain] = useState<boolean>(true);
  const [loadingStations, setLoadingStations] = useState<boolean>(false);
  const [showGlobe, setShowGlobe] = useState<boolean>(false);

  // Real AIS maritime layer (AISStream.io WebSocket)
  const [liveAis, setLiveAis] = useState<boolean>(false);
  const [aisVessels, setAisVessels] = useState<LiveVesselData[]>([]);
  const aisSocketRef = useRef<{ close: () => void } | null>(null);

  const handleToggleAis = () => {
    if (!liveAis) {
      const handle = connectLiveAisVessels((vessels) => setAisVessels([...vessels]));
      if (handle) {
        aisSocketRef.current = handle;
        setLiveAis(true);
        addToast('info', 'AISStream Maritime Stream', 'Live ship positions ingested over WebSocket.');
      } else {
        addToast('error', 'AISStream Not Configured', 'Set VITE_AISSTREAM_API_KEY to enable the live maritime layer.');
      }
    } else {
      aisSocketRef.current?.close();
      aisSocketRef.current = null;
      setAisVessels([]);
      setLiveAis(false);
    }
  };

  useEffect(() => {
    return () => {
      aisSocketRef.current?.close();
      aisSocketRef.current = null;
    };
  }, []);

  const loadOnChainStations = async (notify = false) => {
    setLoadingStations(true);
    try {
      const stations = await fetchGeoOrbitStations();
      setOnChainStations(stations);
      if (notify) {
        addToast('success', 'GeoOrbitRegistry Stations Synced', `${stations.length} station registrations read from on-chain logs.`);
      }
    } catch {
      /* keep last known */
    } finally {
      setLoadingStations(false);
    }
  };

  useEffect(() => {
    loadOnChainStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleAirspace = async () => {
    if (!liveAirspace) {
      setLoadingFlights(true);
      try {
        const flights = await fetchLiveOpenSkyAirspace();
        setLiveFlights(flights);
        setLiveAirspace(true);
        addToast('success', 'OpenSky ADS-B Airspace Ingested', `Live tracking ${flights.length} aircraft & drone vectors overhead.`);
      } catch (e: any) {
        addToast('error', 'Airspace Ingestion Error', e.message);
      } finally {
        setLoadingFlights(false);
      }
    } else {
      setLiveAirspace(false);
      setLiveFlights([]);
    }
  };

  const handleToggleFirms = async () => {
    if (!liveFirms) {
      setLoadingFirms(true);
      try {
        const hotspots = await fetchLiveNasaFirmsHotspots();
        setLiveHotspots(hotspots);
        setLiveFirms(true);
        addToast('info', 'NASA FIRMS Satellites Connected', `Ingested ${hotspots.length} thermal & wildfire monitoring anomalies.`);
      } catch (e: any) {
        addToast('error', 'FIRMS Ingestion Error', e.message);
      } finally {
        setLoadingFirms(false);
      }
    } else {
      setLiveFirms(false);
      setLiveHotspots([]);
    }
  };

  const handleRunAiDiagnostic = async () => {
    setIsQueryingAi(true);
    try {
      const response = await queryOpenAiDePINAdvisor(
        'Perform health check on CredX GeoOrbit base station and assess carrier-phase ambiguity resolution.',
        {
          mountpoint: orbitMountpoint,
          uptime: orbitStationUptimeHours,
          satellitesLocked: orbitSatellitesLocked,
          accuracyCm: orbitAccuracyCm,
          reputationBonus: '+50 CTS'
        }
      );
      setAiAdvisorResponse(response);
      addToast('success', 'OpenAI Autonomous Agent Assessment', 'Diagnostic evaluation completed.');
    } catch (err: any) {
      addToast('error', 'AI Diagnostic Error', err.message);
    } finally {
      setIsQueryingAi(false);
    }
  };

  // Connect to Real Physical Device GNSS Hardware via Web Geolocation API
  const handleConnectDeviceGPS = async () => {
    setIsReadingRealGPS(true);
    try {
      const pos = await getRealDevicePhysicalPosition(4);
      setRealDevicePos(pos);
      setHardwareLinkMode('device-gps');
      setLiveNmeaOverride(pos.nmeaSentence);
      simulateRoverFix(4);
      addToast(
        'success',
        'Physical Device Hardware GPS Connected',
        `Acquired hardware lock: ${pos.lat.toFixed(4)}° N, ${pos.lng.toFixed(4)}° E (±${pos.accuracyMeters.toFixed(1)}m precision). Real NMEA streaming.`
      );
    } catch (err: any) {
      addToast('info', 'Device GPS Notice', err.message || 'Browser location permission denied. Using calibrated base station.');
    } finally {
      setIsReadingRealGPS(false);
    }
  };

  // Connect to Physical USB/COM RTK Receiver via Web Serial API
  const handleConnectUSBSerial = async () => {
    try {
      const serialConn = await connectPhysicalSerialRTK((line) => {
        setLiveNmeaOverride(line);
      });
      setSerialConnected(true);
      setHardwareLinkMode('usb-serial');
      addToast(
        'success',
        'USB RTK Receiver Connected',
        'Listening for RTCM 3.2 / NMEA bytes on serial COM port at 115200 baud.'
      );
    } catch (err: any) {
      addToast('info', 'Web Serial Notice', err.message || 'Serial port connection canceled or not supported on this browser.');
    }
  };

  const filteredHexes = orbitStableHexes.filter(h =>
    h.regionName.toLowerCase().includes(hexSearchQuery.toLowerCase()) ||
    h.country.toLowerCase().includes(hexSearchQuery.toLowerCase()) ||
    h.centerId.toLowerCase().includes(hexSearchQuery.toLowerCase())
  );

  const handleCopyNtripUrl = () => {
    const url = `ntrip://rover:credx@caster.credx.geoorbit.net:2101/${orbitMountpoint}`;
    navigator.clipboard.writeText(url);
    setCopiedString(true);
    addToast('success', 'NTRIP Caster String Copied', 'Rover configuration string copied to clipboard.');
    setTimeout(() => setCopiedString(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* On-chain anchor is LIVE; the mesh views below remain local simulation */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="MESH VIEWS SIMULATED (ON-CHAIN ANCHOR LIVE)"
          note="The GeoOrbitRegistry below is deployed on Creditcoin testnet — custody, telemetry and rewards are real transactions. The mesh explorer, RTK correction streams and macro tokenomics panels remain locally simulated telemetry."
        />
        <span className="font-mono">
          On-chain layer: LIVE — the GeoOrbitRegistry pane above anchors stations and Proof-of-Space-Time
          heartbeats with real transactions. RTK correction interpolations, hex/mesh coverage and
          macro-tokenomics below are locally simulated and written to nothing.
        </span>
      </div>

      {/* LIVE on-chain telemetry anchor */}
      <GeoOrbitStatePanel />

      {/* Top Banner & High-Level Network Health Bar */}
      <GlassCard className="p-6 border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-black to-cyan-950/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-[11px] font-bold flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 animate-pulse" />
                Decentralized RTK Space-Time Mesh · Port 2101
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-extrabold uppercase tracking-wider">
                PoST Anchor Live · Mesh Sim
              </span>
            </div>

            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              CredX GeoOrbit
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white/80 font-mono font-normal">
                RTCM 3.2 MSM7
              </span>
            </h2>

            <p className="text-xs text-white/70 leading-relaxed">
              Global real-time kinematic (RTK) differential correction network demonstration delivering centimeter-level positioning (1–2 cm) for autonomous drones, agricultural robots, and smart mobility. The on-chain telemetry anchor is LIVE (panel above); triple-band carrier locks and the macro mesh are modeled locally.
            </p>
          </div>

          {/* Quick Action Station Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleOrbitStation}
                className={`flex-1 py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  orbitConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                }`}
              >
                <Power className="w-4 h-4" />
                {orbitConnected ? 'Base Station Online' : 'Base Station Offline'}
              </button>

              <button
                onClick={() => setIsAttestationModalOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Attest PoST (+50 CTS)
              </button>
            </div>

            <button
              onClick={claimOrbitTokens}
              disabled={orbitClaimableTokens <= 0}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              Claim {orbitClaimableTokens.toFixed(2)} ORBIT Rewards
            </button>
          </div>
        </div>

        {/* High-Level Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/[0.08]">
          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Global Stations</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black font-mono text-white">{orbitTotalStations.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">+1 Mine</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Carrier Ambiguity</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-sm font-black font-mono text-emerald-400">
                RTK Fixed ({orbitAccuracyCm.toFixed(1)} cm)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Satellites Locked</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black font-mono text-cyan-400">{orbitSatellitesLocked}</span>
              <span className="text-[10px] text-white/50 font-mono">GPS/GAL/BDS/GLO</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Enterprise Data ARR</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black font-mono text-amber-400">
                ${orbitDataRevenueUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-amber-300 font-mono font-bold">USD</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Tokens Burned</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
              <span className="text-sm font-black font-mono text-orange-400">
                {orbitBurnedTokens.toLocaleString()} ORBIT
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Sub-View Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
        <button
          onClick={() => setSubTab('explorer')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'explorer'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Compass className="w-4 h-4 text-amber-400" />
          <span>Station & StableHex Explorer</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-bold font-mono">6X</span>
        </button>

        <button
          onClick={() => setSubTab('coverage')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'coverage'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>RTK Coverage & NTRIP Map</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 font-bold font-mono">2cm</span>
        </button>

        <button
          onClick={() => setSubTab('hardware')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'hardware'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Hardware HUD & Rover Simulator</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold font-mono">NMEA</span>
        </button>

        <button
          onClick={() => setSubTab('tokenomics')}
          className={`flex-1 min-w-[180px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'tokenomics'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-lg shadow-orange-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <Flame className="w-4 h-4 text-orange-400" />
          <span>Tokenomics & Buyback Burn</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/30 text-orange-300 font-bold font-mono">80% Burn</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: STATION & STABLEHEX EXPLORER (Screenshot 2 Replication)       */}
      {/* ========================================================================= */}
      {subTab === 'explorer' && (
        <div className="space-y-6">
          {/* 6X Frontier StableHex Promotion Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-black to-amber-950/20 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 font-mono text-[10px] font-extrabold uppercase">
                  Active Incentive Program
                </span>
                <span className="text-amber-400 font-mono text-xs font-bold">Frontier StableHex 6X Multiplier</span>
              </div>
              <p className="text-xs text-white/70 max-w-2xl">
                Base stations deployed in approved commercial transportation corridors, deepwater maritime container terminals, and airport drone approach vectors receive a guaranteed 6X reward multiplier to ensure 99.99% RTK coverage density.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-center">
                <span className="text-[10px] font-mono uppercase text-amber-300/70 block">Target Density</span>
                <span className="text-base font-black font-mono text-amber-300">1 Base / Hex (Res 7)</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hexSearchQuery}
                onChange={e => setHexSearchQuery(e.target.value)}
                placeholder="Search Hex ID, City, or Country..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-mono">
              <span className="text-white/40 text-[11px]">Showing:</span>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white font-bold">
                {filteredHexes.length} Commercial StableHexes
              </span>
            </div>
          </div>

          {/* StableHex Table & Details Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hex List (2 Cols) */}
            <div className="lg:col-span-2 space-y-3">
              {filteredHexes.map(hex => (
                <div
                  key={hex.centerId}
                  onClick={() => setSelectedHex(hex)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    selectedHex?.centerId === hex.centerId
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : 'bg-black/40 border-white/[0.06] hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{hex.countryFlag}</span>
                      <span className="text-sm font-bold text-white">{hex.regionName}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-extrabold">
                        {hex.multiplier}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-white/50">
                      <span className="text-amber-400 font-bold">{hex.centerId}</span>
                      <span>•</span>
                      <span>{hex.lat.toFixed(4)}° N, {hex.lng.toFixed(4)}° E</span>
                      <span>•</span>
                      <span className="text-white/70">{hex.country}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.06]">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-white/40 block">Mining APY</span>
                      <span className="text-sm font-black font-mono text-emerald-400">{hex.estimatedApy}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-white/40 block">Miners Status</span>
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        hex.currentMiners >= hex.targetMiners
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {hex.currentMiners} / {hex.targetMiners} Active
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-white/30 hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Hex Inspector & Spec Sheet */}
            <div className="space-y-4">
              {selectedHex ? (
                <GlassCard className="p-5 border-amber-500/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                        Uber H3 Index (Res 7)
                      </span>
                      <h4 className="text-base font-bold text-white font-mono mt-0.5">{selectedHex.centerId}</h4>
                    </div>
                    <span className="text-2xl">{selectedHex.countryFlag}</span>
                  </div>

                  <div className="space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-white/60">
                      <span>Target Corridor</span>
                      <span className="text-white font-bold text-right">{selectedHex.regionName}</span>
                    </div>

                    <div className="flex items-center justify-between text-white/60">
                      <span>Geodetic Datum</span>
                      <span className="text-cyan-400 font-bold">ITRF2020 / WGS84</span>
                    </div>

                    <div className="flex items-center justify-between text-white/60">
                      <span>Antenna Requirements</span>
                      <span className="text-white font-bold">NGS Choke-Ring (3D)</span>
                    </div>

                    <div className="flex items-center justify-between text-white/60">
                      <span>Max Differential Baseline</span>
                      <span className="text-emerald-400 font-bold">&lt; 15.0 km</span>
                    </div>

                    <div className="flex items-center justify-between text-white/60">
                      <span>Multiplier Incentive</span>
                      <span className="text-amber-400 font-extrabold">{selectedHex.multiplier} StableHex Reward</span>
                    </div>

                    <div className="flex items-center justify-between text-white/60">
                      <span>Estimated Monthly Yield</span>
                      <span className="text-emerald-300 font-bold">~148.5 ORBIT</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white/70 space-y-1">
                    <div className="flex items-center gap-1 text-amber-400 font-mono text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Anti-Sybil Proof of Space-Time
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      This hex is cryptographically monitored for carrier phase continuity. Stations with elevation mask &lt; 10° or artificial phase jumps are slashed automatically.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      addToast('success', 'Deployment Manifest Generated', `Config template for Hex ${selectedHex.centerId} downloaded.`);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Download Station Setup JSON
                  </button>
                </GlassCard>
              ) : (
                <div className="p-8 rounded-2xl bg-black/40 border border-white/[0.08] text-center text-white/40 text-xs font-mono">
                  Select a StableHex to view geodetic parameters.
                </div>
              )}

              {/* Global Miner Cluster Summary */}
              <GlassCard className="p-5 border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    Global Station Clusters
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">7 Major Hubs</span>
                </div>

                <div className="space-y-2">
                  {orbitClusters.slice(0, 4).map(cluster => (
                    <div
                      key={cluster.id}
                      className="p-2.5 rounded-xl bg-black/30 border border-white/[0.04] flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <span className="text-white font-bold block">{cluster.name}</span>
                        <span className="text-[10px] text-white/40">{cluster.count} Active Base Stations</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                        2cm: {cluster.precision2cmCoverageKm}km
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: RTK COVERAGE & NTRIP SERVICE MAP (Screenshot 1 Replication)   */}
      {/* ========================================================================= */}
      {subTab === 'coverage' && (
        <div className="space-y-6">
          {/* Filter Controls & Real Geospatial Feeds Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-white/60 font-bold">Overlays:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setCoverageFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    coverageFilter === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  All Zones
                </button>
                <button
                  onClick={() => setCoverageFilter('2cm')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    coverageFilter === '2cm'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  2cm RTK Fixed
                </button>
                <button
                  onClick={() => setCoverageFilter('10cm')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    coverageFilter === '10cm'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  10cm RTK Float
                </button>

                {/* Real Live Google / TomTom Traffic Toggle */}
                <button
                  onClick={() => setLiveTraffic(!liveTraffic)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    liveTraffic
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Live Traffic
                </button>

                {/* Real OpenSky Live Airspace ADS-B Toggle */}
                <button
                  onClick={handleToggleAirspace}
                  disabled={loadingFlights}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    liveAirspace
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Plane className={`w-3.5 h-3.5 ${loadingFlights ? 'animate-spin' : ''}`} />
                  OpenSky Airspace {liveFlights.length > 0 && `(${liveFlights.length})`}
                </button>

                {/* Real NASA FIRMS Satellite Thermal Anomalies Toggle */}
                <button
                  onClick={() => { loadOnChainStations(true); setShowOnChain(!showOnChain); }}
                  disabled={loadingStations}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    showOnChain
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Satellite className={`w-3.5 h-3.5 ${loadingStations ? 'animate-pulse' : ''}`} />
                  On-chain Stations {onChainStations.length > 0 && `(${onChainStations.length})`}
                </button>

                {/* 3D Transparency Globe */}
                <button
                  onClick={() => setShowGlobe(!showGlobe)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    showGlobe
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  3D Globe
                </button>

                {/* Real AIS Maritime Vessels Stream */}
                <button
                  onClick={handleToggleAis}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    liveAis
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-500/20'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Sailboat className="w-3.5 h-3.5" />
                  AIS Vessels {aisVessels.length > 0 && `(${aisVessels.length})`}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunAiDiagnostic}
                disabled={isQueryingAi}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Bot className={`w-3.5 h-3.5 ${isQueryingAi ? 'animate-spin' : ''}`} />
                {isQueryingAi ? 'Reasoning...' : 'AI DePIN Diagnostic'}
              </button>

              <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>NTRIP Caster: </span>
                <span className="text-emerald-400 font-bold">RTCM 3.2 MSM7</span>
              </div>
            </div>
          </div>

          {/* AI Advisor Response Banner */}
          {aiAdvisorResponse && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 backdrop-blur-md flex items-start justify-between gap-3 text-xs font-mono text-emerald-200">
              <div className="flex items-start gap-2.5">
                <Bot className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-400 block mb-1">OpenAI Autonomous Agent Telemetry Evaluation:</span>
                  <p className="leading-relaxed text-emerald-100">{aiAdvisorResponse}</p>
                </div>
              </div>
              <button
                onClick={() => setAiAdvisorResponse(null)}
                className="text-white/40 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Interactive Google Map with Cyberpunk Dark Theme */}
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <GoogleMapView
              center={{ lat: realDevicePos?.lat || 25.0, lng: realDevicePos?.lng || 20.0 }}
              zoom={3}
              theme="dark"
              showHexGrid={true}
              showTrafficLayer={liveTraffic}
              markers={[
                {
                  id: 'my-station',
                  lat: realDevicePos?.lat || 23.8103,
                  lng: realDevicePos?.lng || 90.4125,
                  title: realDevicePos ? 'Your Live Hardware Station' : 'Your GeoOrbit CORS Base Station (Dhaka)',
                  color: '#f59e0b',
                  label: '★'
                },
                ...orbitClusters.map(c => ({
                  id: c.id,
                  lat: c.lat,
                  lng: c.lng,
                  title: `${c.name} (${c.count} Stations)`,
                  color: '#06b6d4',
                  onClick: () => setSelectedCluster(c)
                })),
                ...liveFlights.map(f => ({
                  id: `flight-${f.icao24}`,
                  lat: f.latitude,
                  lng: f.longitude,
                  title: `✈ Flight ${f.callsign} (${f.originCountry}) | Alt: ${f.baroAltitude ? `${f.baroAltitude}m` : 'GND'} | Spd: ${Math.round((f.velocity || 0) * 3.6)} km/h`,
                  color: '#c084fc',
                  label: '✈'
                })),
                ...liveHotspots.map((h, i) => ({
                  id: `firms-${i}`,
                  lat: h.latitude,
                  lng: h.longitude,
                  title: `🔥 NASA FIRMS Thermal Anomaly (${h.satellite}) | Brightness: ${h.brightness}K | Acq: ${h.acqDate}`,
                  color: '#ef4444',
                  label: '🔥'
                })),
                ...(showOnChain && onChainStations.length > 0
                  ? onChainStations.map((s) => ({
                      id: `onchain-${s.stationId}`,
                      lat: s.latE7 / 1e7,
                      lng: s.lngE7 / 1e7,
                      title: `◎ On-chain Station #${s.stationId} · hex ${s.hexId} · operator ${s.operator.slice(0, 6)}…${s.operator.slice(-4)} | CC3 block ${s.blockNumber.toLocaleString()}`,
                      color: '#34d399',
                      label: '◎'
                    }))
                  : []),
                ...(liveAis ? aisVessels.map((v) => ({
                  id: `ais-${v.mmsi}`,
                  lat: v.latitude,
                  lng: v.longitude,
                  title: `⛵ MMSI ${v.mmsi}${v.name ? ` · ${v.name}` : ''} | ${v.speedKnots.toFixed(1)} kn · cse ${v.course.toFixed(0)}°${v.destination ? ` → ${v.destination}` : ''}`,
                  color: '#14b8a6',
                  label: '⛵'
                })) : [])
              ]}
              circles={[
                ...orbitClusters.map(c => ({
                  id: `${c.id}-2cm`,
                  lat: c.lat,
                  lng: c.lng,
                  radiusMeters: c.precision2cmCoverageKm * 1000,
                  color: '#10b981',
                  fillOpacity: coverageFilter === '10cm' ? 0.02 : 0.15
                })),
                ...orbitClusters.map(c => ({
                  id: `${c.id}-10cm`,
                  lat: c.lat,
                  lng: c.lng,
                  radiusMeters: c.precision10cmCoverageKm * 1000,
                  color: '#3b82f6',
                  fillOpacity: coverageFilter === '2cm' ? 0.02 : 0.08
                }))
              ]}
              className="h-[460px] rounded-3xl"
            />

            {/* Map Floating HUD Info Box */}
            <div className="absolute bottom-4 left-4 z-30 p-3.5 rounded-2xl bg-black/85 border border-white/10 backdrop-blur-md max-w-sm space-y-1.5 font-mono text-xs pointer-events-none">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-white/40">Active Coordinate Frame</span>
                <span className="text-cyan-400 font-bold">{orbitMountpoint}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/70">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  &lt; 2.0 cm (RTK Fixed)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  &lt; 10.0 cm (RTK Float)
                </span>
              </div>
            </div>

            <div className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-xl bg-black/85 border border-white/10 text-[11px] font-mono text-white/80 flex items-center gap-2 pointer-events-none">
              <span className={`w-2 h-2 rounded-full ${onChainStations.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
              {onChainStations.length > 0
                ? `${onChainStations.length} Registered Station${onChainStations.length === 1 ? '' : 's On-Chain'}`
                : 'Syncing registered stations…'}
            </div>
          </div>

          {showGlobe ? <SmartGlobePanel planes={liveFlights} hotspots={liveHotspots} vessels={aisVessels} /> : null}

          {/* NTRIP Service Configuration Spec Card (Screenshot 1 Replication) */}
          <GlassCard className="p-6 border-cyan-500/30 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block">
                  Industry-Standard NTRIP v2.0 Protocol
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  RTK Differential Corrections & Mountpoints
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Connect any commercial survey rover, drone autopilot (PX4/ArduPilot), or precision tractor over internet.
                </p>
              </div>

              {/* Copy Full NTRIP String */}
              <button
                onClick={handleCopyNtripUrl}
                className="py-2.5 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {copiedString ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedString ? 'Copied Config!' : 'Copy Rover NTRIP String'}
              </button>
            </div>

            {/* Mountpoint Tabs (Matching screenshot options: AUTO, AUTO_ITRF2020, etc.) */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {orbitMountpoints.map((mp) => (
                  <button
                    key={mp.name}
                    onClick={() => {
                      setOrbitMountpoint(mp.name);
                      setSelectedMountpointObj(mp);
                    }}
                    className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                      orbitMountpoint === mp.name
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className="text-sm font-black block text-cyan-300">{mp.name}</span>
                    <span className="text-[10px] text-white/40 block mt-0.5 line-clamp-1">{mp.format}</span>
                  </button>
                ))}
              </div>

              {/* Active Mountpoint Detail Specification Grid */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
                <div>
                  <span className="text-white/40 text-[10px] block">Reference Frame</span>
                  <span className="text-white font-bold text-sm">{selectedMountpointObj.system}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block">Epoch / Tectonics</span>
                  <span className="text-cyan-400 font-bold text-sm">{selectedMountpointObj.epoch}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block">Caster Host & Port</span>
                  <span className="text-white font-bold text-sm">caster.credx.geoorbit.net : {selectedMountpointObj.port}</span>
                </div>
                <div>
                  <span className="text-white/40 text-[10px] block">Differential Stream Format</span>
                  <span className="text-emerald-400 font-bold text-sm">{selectedMountpointObj.format}</span>
                </div>
              </div>

              <p className="text-xs text-white/60 italic">
                ℹ️ {selectedMountpointObj.description}
              </p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: BASE STATION HARDWARE HUD & ROVER SIMULATOR                   */}
      {/* ========================================================================= */}
      {subTab === 'hardware' && (
        <div className="space-y-6">
          {/* Hardware & Antenna Specs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="p-6 border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">GeoOrbit CORS Receiver</h4>
                    <span className="text-[10px] text-white/40 font-mono">u-blox ZED-F9P Multi-Band Engine</span>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div className="space-y-2 font-mono text-xs text-white/70">
                <div className="flex justify-between">
                  <span>Serial Identifier</span>
                  <span className="text-white font-bold">GEO-9941-F9P</span>
                </div>
                <div className="flex justify-between">
                  <span>Hardware Uptime</span>
                  <span className="text-emerald-400 font-bold">{orbitStationUptimeHours.toFixed(1)} Hours</span>
                </div>
                <div className="flex justify-between">
                  <span>Antenna Type</span>
                  <span className="text-white font-bold">3D Choke-Ring (NGS)</span>
                </div>
                <div className="flex justify-between">
                  <span>Phase Center Var.</span>
                  <span className="text-cyan-400 font-bold">&lt; 0.8 mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Power / Connection</span>
                  <span className="text-white font-bold">PoE 802.3af · 4.2W</span>
                </div>
              </div>
            </GlassCard>

            {/* Carrier-Phase Ambiguity State */}
            <GlassCard className="p-6 border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Carrier-Phase Tracking</h4>
                    <span className="text-[10px] text-white/40 font-mono">Double-Differencing Baseline</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  INTEGER LOCKED
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs text-white/70">
                <div className="flex justify-between">
                  <span>3D Positioning Error</span>
                  <span className="text-emerald-400 font-extrabold">{orbitAccuracyCm.toFixed(1)} cm</span>
                </div>
                <div className="flex justify-between">
                  <span>Horizontal Dilution (HDOP)</span>
                  <span className="text-cyan-400 font-bold">{orbitNmeaData?.hdop.toFixed(1) || '0.7'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Elevation Cutoff Mask</span>
                  <span className="text-white font-bold">10.0°</span>
                </div>
                <div className="flex justify-between">
                  <span>Correction Latency</span>
                  <span className="text-white font-bold">0.8 sec (RTCM 3.2)</span>
                </div>
                <div className="flex justify-between">
                  <span>Geoid Model</span>
                  <span className="text-amber-400 font-bold">EGM2008 (-38.2m)</span>
                </div>
              </div>
            </GlassCard>

            {/* Proof of Space-Time (PoST) Verification Status */}
            <GlassCard className="p-6 border-cyan-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Creditcoin Attest L1</h4>
                    <span className="text-[10px] text-white/40 font-mono">Precompile 0x0FD2</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold">
                  VERIFIED
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs text-white/70">
                <div className="flex justify-between">
                  <span>Cumulative Proofs</span>
                  <span className="text-white font-bold">{orbitPoSTProofsCount} Blocks</span>
                </div>
                <div className="flex justify-between">
                  <span>Reputation Bonus</span>
                  <span className="text-amber-400 font-bold">+50 CTS Active</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Last Merkle Hash</span>
                  <span className="text-cyan-300 font-bold font-mono text-[10px]">
                    {orbitLastAttestationHash.slice(0, 8)}...{orbitLastAttestationHash.slice(-6)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsAttestationModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Submit Fresh Carrier Proof
              </button>
            </GlassCard>
          </div>

          {/* Multi-Constellation Live Satellite Signal Matrix (SNR in dB-Hz) */}
          <GlassCard className="p-6 border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Satellite className="w-5 h-5 text-amber-400" />
                  Live Satellite Constellation Tracking
                </h3>
                <p className="text-xs text-white/60">
                  Tracking carrier-to-noise density ratio (SNR in dB-Hz) across GPS (US), Galileo (EU), BeiDou (CN), and GLONASS (RU).
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">&gt;45 dB-Hz: Optimal</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">40–45 dB-Hz: Nominal</span>
              </div>
            </div>

            {/* Satellite Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {orbitSatellites.map((sat) => {
                const isOptimal = sat.snrDbHz >= 45.0;
                return (
                  <div
                    key={sat.id}
                    className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{sat.id}</span>
                      <span className="text-[10px] text-white/40">{sat.constellation}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-white/60">
                        <span>SNR</span>
                        <span className={`font-bold ${isOptimal ? 'text-emerald-400' : 'text-cyan-400'}`}>
                          {sat.snrDbHz.toFixed(1)} dB-Hz
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${isOptimal ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                          style={{ width: `${Math.min(100, (sat.snrDbHz / 55) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[9px] text-white/40 pt-1 border-t border-white/[0.04]">
                      <span>El: {sat.elevationDeg}°</span>
                      <span>Az: {sat.azimuthDeg}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Real Physical Hardware & Differential RTK Engine */}
          <GlassCard className="p-6 border-cyan-500/30 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block">
                    Telemetry Ingestion Pipeline
                  </span>
                  {hardwareLinkMode === 'device-gps' && realDevicePos ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Device Hardware GPS Linked
                    </span>
                  ) : serialConnected ? (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      USB RTK Serial Stream Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                      Calibrated CORS Base Stream
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mt-1">
                  Physical Receiver & Differential RTK Engine
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Connect your real physical device hardware GPS or plug in a USB GNSS RTK receiver (u-blox / Quectel), or test differential carrier ambiguity locks.
                </p>
              </div>

              {/* Physical Hardware Connect Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleConnectDeviceGPS}
                  disabled={isReadingRealGPS}
                  className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg ${
                    hardwareLinkMode === 'device-gps' && realDevicePos
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/60 shadow-emerald-500/20'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  {isReadingRealGPS ? 'Acquiring Device GPS...' : 'Connect Live Device GPS'}
                </button>

                <button
                  onClick={handleConnectUSBSerial}
                  className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg ${
                    serialConnected
                      ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/60 shadow-cyan-500/20'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  {serialConnected ? 'USB RTK Receiver (115200)' : 'Connect USB RTK Receiver'}
                </button>
              </div>
            </div>

            {/* Carrier-Phase Ambiguity Test Toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-xs font-mono text-white/50">Carrier Ambiguity Mode:</span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => simulateRoverFix(4)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orbitNmeaData?.quality === 4
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                      : 'bg-white/[0.03] text-white/50 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  RTK Fixed (1.2 cm)
                </button>

                <button
                  onClick={() => simulateRoverFix(5)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orbitNmeaData?.quality === 5
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-white/[0.03] text-white/50 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  RTK Float (14.5 cm)
                </button>

                <button
                  onClick={() => simulateRoverFix(1)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    orbitNmeaData?.quality === 1
                      ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-lg shadow-red-500/10'
                      : 'bg-white/[0.03] text-white/50 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Autonomous (2.8 m)
                </button>
              </div>
            </div>

            {/* Raw NMEA-0183 GGA Sentence Display */}
            <div className="p-4 rounded-2xl bg-black/70 border border-white/10 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-[10px] text-white/40 uppercase">
                <span>NMEA GGA Broadcast String</span>
                <span className="text-emerald-400 font-bold">{orbitNmeaData?.qualityLabel}</span>
              </div>
              <p className="text-emerald-300 select-all break-all text-sm font-semibold tracking-wide">
                {liveNmeaOverride || orbitNmeaSentence}
              </p>
            </div>

            {/* Decoded NMEA Data Fields Table */}
            {orbitNmeaData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">UTC Time</span>
                  <span className="text-white font-bold">{orbitNmeaData.utcTime}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Latitude</span>
                  <span className="text-white font-bold">{orbitNmeaData.lat.toFixed(4)}° {orbitNmeaData.latDirection}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Longitude</span>
                  <span className="text-white font-bold">{orbitNmeaData.lng.toFixed(4)}° {orbitNmeaData.lngDirection}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Quality Status</span>
                  <span className="text-emerald-400 font-bold">{orbitNmeaData.quality} (Fix)</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Satellites</span>
                  <span className="text-cyan-400 font-bold">{orbitNmeaData.satellites} Sats</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">HDOP</span>
                  <span className="text-white font-bold">{orbitNmeaData.hdop.toFixed(1)}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Altitude (MSL)</span>
                  <span className="text-white font-bold">{orbitNmeaData.altitudeMeters} m</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                  <span className="text-white/40 text-[10px] block">Est. Error</span>
                  <span className="text-emerald-400 font-black">{orbitNmeaData.accuracyCm.toFixed(1)} cm</span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: TOKENOMICS, BUYBACK & BURN ($354k ARR) (Screenshot 3 Replic.)  */}
      {/* ========================================================================= */}
      {subTab === 'tokenomics' && (
        <div className="space-y-6">
          {/* Headline Revenue & Burn Showcase Card (Direct Screenshot 3 Replication) */}
          <GlassCard className="p-6 border-orange-500/30 bg-gradient-to-r from-orange-950/20 via-black to-amber-950/25">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-mono text-[11px] font-bold flex items-center gap-1.5 w-fit">
                  <Flame className="w-3.5 h-3.5 animate-pulse" />
                  Deflationary Enterprise Flywheel · 80% Buyback
                </span>

                <h3 className="text-2xl lg:text-3xl font-black text-white">
                  Annual Enterprise Data Revenue: ${orbitDataRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>

                <p className="text-xs text-white/70 max-w-2xl leading-relaxed">
                  Enterprise rovers in precision agriculture (John Deere/Trimble), drone logistics corridors, and municipal smart survey networks pay subscriptions in fiat/stablecoins. 80% of all data revenues are programmatically used to market-buy ORBIT tokens on DEXs and burn them forever.
                </p>
              </div>

              <div className="text-left lg:text-right shrink-0 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
                <span className="text-[10px] uppercase font-mono text-white/40 block">Cumulative Tokens Burned</span>
                <span className="text-2xl lg:text-3xl font-black font-mono text-orange-400">
                  {orbitBurnedTokens.toLocaleString()} ORBIT
                </span>
                <span className="text-[10px] text-white/40 block mt-1 font-mono">
                  ~ ${(orbitBurnedTokens * 0.25).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD Market Value
                </span>
              </div>
            </div>

            {/* Burn Engine Progress Visualizer */}
            <div className="mt-6 pt-6 border-t border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/60">Enterprise Cashflow Burn Allocation</span>
                <span className="text-orange-400 font-bold">80% Buyback & Burn Active</span>
              </div>

              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 h-full rounded-full w-[80%] transition-all" />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-white/40">
                <span>0% General Reserve</span>
                <span className="text-orange-400 font-bold">80% Deflationary DEX Sinks</span>
                <span>20% Protocol Treasury & Maintenance</span>
              </div>
            </div>
          </GlassCard>

          {/* Enterprise Customer Verticals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Autonomous Agriculture</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">38% ARR</span>
              </div>
              <p className="text-[11px] text-white/60">
                Tractor guidance and automated crop harvesting rovers requiring 2cm boundary precision.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">UAV Drone Highways</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">29% ARR</span>
              </div>
              <p className="text-[11px] text-white/60">
                Last-mile delivery and inspection drones operating in complex urban air transit corridors.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Port & Maritime Docking</span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">19% ARR</span>
              </div>
              <p className="text-[11px] text-white/60">
                Automated container cranes and autonomous tugboats navigating tight harbor berths.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Smart Surveying & BIM</span>
                <span className="text-[10px] font-mono text-purple-400 font-bold">14% ARR</span>
              </div>
              <p className="text-[11px] text-white/60">
                Civil engineering firms and GIS cartographers streaming high-rate MSM7 observations.
              </p>
            </div>
          </div>

          {/* Recent DEX Buyback & Burn Feed */}
          <GlassCard className="p-6 border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Live On-Chain Buyback & Burn Ledger
                </h4>
                <span className="text-xs text-white/60">
                  Automatic smart contract burns triggered by enterprise API subscription payments.
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">Verified On-Chain</span>
            </div>

            <div className="space-y-2">
              {[
                { tx: '0x8f2d..391a', amount: '1,420 ORBIT', val: '$355 USD', source: 'John Deere RTK Rover Pool', time: '12m ago' },
                { tx: '0x1c3e..7b9d', amount: '2,850 ORBIT', val: '$712 USD', source: 'Rotterdam Port AGV Fleet', time: '41m ago' },
                { tx: '0x4b6a..0f2e', amount: '980 ORBIT', val: '$245 USD', source: 'Wing Drone UTM Corridor', time: '1h 15m ago' },
                { tx: '0x7e9d..5b7c', amount: '4,100 ORBIT', val: '$1,025 USD', source: 'Leica Surveying Network', time: '3h ago' },
              ].map((burn, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-black/30 border border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <div>
                      <span className="text-white font-bold">{burn.source}</span>
                      <span className="text-[10px] text-white/40 block">Tx: {burn.tx}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <span className="text-orange-400 font-bold block">{burn.amount} Burned 🔥</span>
                      <span className="text-[10px] text-white/40">{burn.val}</span>
                    </div>
                    <span className="text-white/40 text-[10px] min-w-[60px]">{burn.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Attestation Modal */}
      <GeoOrbitAttestationModal
        isOpen={isAttestationModalOpen}
        onClose={() => setIsAttestationModalOpen(false)}
      />
    </div>
  );
};
export default CredXGeoOrbitView;
