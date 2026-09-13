import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import {
  Satellite,
  Radio,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Crosshair,
  Zap,
  ExternalLink,
  MapPin,
  Navigation,
  Layers,
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import {
  fetchGeoOrbitState,
  fetchGeoOrbitStation,
  geoOrbitRegisterStation,
  geoOrbitSubmitTelemetry,
  geoOrbitClaimRewards,
  toGeoOrbitHexId,
  GeoOrbitState,
  GeoOrbitStationView,
} from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { ethers } from 'ethers';

// Seeded demo reference (Amsterdam scientific). The connected demo account owns
// the seeded station — heartbeats walk a few meters around this origin.
const ORIGIN_LAT = 523676000;
const ORIGIN_LNG = 49041000;

const GeoOrbitStatePanel: React.FC = () => {
  const { address, isConnected, openConnectModal } = useWeb3();
  const [state, setState] = useState<GeoOrbitState | null>(null);
  const [station, setStation] = useState<GeoOrbitStationView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const [hexId, setHexId] = useState('d32fe600');
  const [txLog, setTxLog] = useState<string[]>([]);
  const [gpsPos, setGpsPos] = useState<{ latE7: number; lngE7: number; hMeters: number } | null>(null);

  const account = isConnected && address ? address : '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, my] = await Promise.all([fetchGeoOrbitState(), fetchGeoOrbitStation(account)]);
      setState(st);
      setStation(my);
    } catch (err: any) {
      setError(err?.message || 'Failed to read GeoOrbitRegistry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushLog = (line: string) => setTxLog((prev) => [line, ...prev].slice(0, 12));

  const register = async () => {
    if (!isConnected) { setError('Connect a wallet to register a station'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      const coords = gpsPos ?? { latE7: ORIGIN_LAT, lngE7: ORIGIN_LNG, hMeters: 0 };
      const txHash = await geoOrbitRegisterStation(
        toGeoOrbitHexId(hexId), coords.latE7, coords.lngE7, coords.hMeters
      );
      setLastTx(txHash);
      pushLog(`tx broadcast: registerStation → ${txHash.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      const custom = err?.info?.error?.data ?? err?.data ?? '';
      pushLog(`registerStation failed — ${err?.reason || err?.message || 'reverted'}`);
      setError(err?.reason || err?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const submitHeartbeat = async () => {
    if (!isConnected) { setError('Connect a wallet to stream telemetry'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      let lat = station?.lastFix?.latE7 ?? ORIGIN_LAT;
      let lng = station?.lastFix?.lngE7 ?? ORIGIN_LNG;
      let h = station?.lastFix?.hMeters ?? 0;
      if (gpsPos) { lat = gpsPos.latE7; lng = gpsPos.lngE7; h = gpsPos.hMeters; }
      else if (station) {
        // PoST walk: drift a few meters inside the speed envelope.
        lat += Math.round((Math.random() * 800 - 400));
        lng += Math.round((Math.random() * 800 - 400));
      }
      const txHash = await geoOrbitSubmitTelemetry(
        lat, lng, h,
        station?.lastFix?.satellites ?? 15,
        station?.lastFix?.tdop ?? 11,
        ethers.id('antenna-helios-LXA01')
      );
      setLastTx(txHash);
      pushLog(`tx broadcast: submitTelemetry @ ${(lat / 1e7).toFixed(6)}, ${(lng / 1e7).toFixed(6)} → ${txHash.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      pushLog(`submitTelemetry failed — ${err?.reason || err?.message || 'reverted'}`);
      setError(err?.reason || err?.message || 'Telemetry failed');
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!isConnected) { setError('Connect a wallet to claim rewards'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      const txHash = await geoOrbitClaimRewards();
      setLastTx(txHash);
      pushLog(`tx broadcast: claimRewards → ${txHash.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      pushLog(`claimRewards failed — ${err?.reason || err?.message || 'reverted'}`);
      setError(err?.reason || err?.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  const useGps = () => {
    const g = (navigator as any).geolocation;
    if (!g) { setError('Geolocation unsupported on this browser'); return; }
    g.getCurrentPosition(
      (p: GeolocationPosition) => {
        setGpsPos({
          latE7: Math.round(p.coords.latitude * 1e7),
          lngE7: Math.round(p.coords.longitude * 1e7),
          hMeters: Math.round(p.coords.altitude ?? 0),
        });
        pushLog('device GPS locked — real observables ready to anchor');
      },
      (e: any) => setError('GPS denied — falling back to anchored-origin telemetry'),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const unpaid = station ? Math.max(0, station.totalRewardUnits - station.claimedUnits) : 0;

  return (
    <GlassCard className="p-5 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-black to-cyan-950/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE — GeoOrbitRegistry on-chain telemetry anchor
            </span>
            <a
              href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.geoOrbitRegistry}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-emerald-300 font-mono text-[10px]"
            >
              {CONTRACTS.geoOrbitRegistry.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-xs text-white/70 leading-relaxed max-w-3xl">
            Stations register and stream Proof-of-Space-Time heartbeats directly to Creditcoin. Every fix is
            chained to the previous PoS hash and speed-bounded — a station can never teleport. Reward units
            accrue per heartbeat and are claimed on-chain.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadLive}
            className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Satellite className="w-3 h-3" /> Stations</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{state?.stationCount ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Radio className="w-3 h-3" /> Heartbeats Anchored</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state?.totalTelemetryAnchored.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Zap className="w-3 h-3" /> ORBIT Issued</span>
          <span className="text-lg font-black font-mono text-amber-300 mt-0.5 block">{state ? state.totalRewardUnitsIssued.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Crosshair className="w-3 h-3" /> Reward / Heartbeat</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state ? `${state.rewardPerTelemetry.toLocaleString(undefined, { maximumFractionDigits: 0 })} ORBIT` : '…'}</span>
        </div>
      </div>

      {/* My station */}
      <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-white/40 flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> YOUR STATION {gpsPos ? <span className="text-emerald-400 font-bold">· DEVICE GPS LOCKED</span> : null}
            </span>
            {station ? (
              <>
                <div className="text-sm font-black font-mono text-white flex items-center gap-2 flex-wrap">
                  #{station.stationId} · hex {station.hexId}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                    {station.telemetryCount} heartbeat{(station.telemetryCount === 1 ? '' : 's')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                    {unpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })} ORBIT unclaimed
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/40 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {(station.lastFix!.latE7 / 1e7).toFixed(6)}, {(station.lastFix!.lngE7 / 1e7).toFixed(6)} · alt {station.lastFix!.hMeters}m ·
                  {station.lastFix!.satellites} sats · tdop {station.lastFix!.tdop / 10} · PoS {station.lastPosHash.slice(0, 10)}…
                </div>
              </>
            ) : (
              <div className="text-xs font-mono text-white/60">{isConnected ? 'No station registered to this wallet yet.' : 'Demo watch (not connected): read-only across public state.'}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {station ? (
              <>
                <button
                  onClick={useGps}
                  className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[11px] font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" /> Device GPS
                </button>
                <button
                  onClick={submitHeartbeat}
                  disabled={busy || !isConnected}
                  className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />} Anchor Heartbeat
                </button>
                <button
                  onClick={claim}
                  disabled={busy || !isConnected || unpaid <= 0}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" /> Claim {unpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={hexId}
                  onChange={(e) => setHexId(e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8))}
                  placeholder="hex id (8 hex)"
                  className="w-28 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={useGps}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[11px] font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" /> GPS
                </button>
                <button
                  onClick={register}
                  disabled={busy || !isConnected}
                  className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Satellite className="w-3.5 h-3.5" />} Register Station
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Honesty + tx trail */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
          {error ? (
            <div className="flex items-start gap-2 text-[11px] text-rose-300 font-mono">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          ) : null}
          {lastTx ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
              <CircleCheck className="w-3.5 h-3.5 shrink-0" /> tx {lastTx.slice(0, 10)}…
              <a href={`${CREDITCOIN_BLOCKSCOUT}/tx/${lastTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/40 hover:text-emerald-300">
                blockscout <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : null}
          <div className="text-[10px] font-mono text-white/30 leading-relaxed">
            Observables are operator-signed by the station wallet and stored on-chain. GNSS raw-observation
            verification (SNR/doppler/carrier-phase) is deferred — heartbeats are an honest anchor, not a
            hardware attestation claim. The seeded demo station broadcasts canopy-mining heartbeats on CC3.
          </div>
          {txLog.slice(0, 4).map((l, i) => (
            <div key={i} className="text-[10px] font-mono text-white/40 truncate">{l}</div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};

export default GeoOrbitStatePanel;