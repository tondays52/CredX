import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import {
  Radio,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Zap,
  ExternalLink,
  ScrollText,
  Layers,
  ShieldCheck,
  Activity,
  Bluetooth,
  Server,
  Wallet,
} from 'lucide-react';
import useNexusLive from '../../hooks/useNexusLive';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const fmtUnits = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

interface NexusLivePanelProps {
  beaconLeaves?: string[];
}

const NexusLivePanel: React.FC<NexusLivePanelProps> = ({ beaconLeaves = [] }) => {
  const {
    state, edge, ledger, loading, busy, error, lastTx, txLog,
    unpaid, register, commitBatch, claim, refresh, contract,
    activeSignerLabel, openPicker,
  } = useNexusLive();

  const [tag, setTag] = useState('nexus-edge');
  const [detections, setDetections] = useState(() => Math.max(1, beaconLeaves.length || 4));
  const [grade, setGrade] = useState(3);

  const busyAny = busy !== null;

  const commitNow = () => commitBatch(detections, beaconLeaves);
  const claimNow = () => claim();
  const registerNow = () => register(tag);

  return (
    <GlassCard className="p-5 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-black to-sky-950/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE — NexusEdgeRegistry on-chain detection ledger
            </span>
            <a
              href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-emerald-300 font-mono text-[10px]"
            >
              {contract.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
            </a>
            {beaconLeaves.length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono text-[10px] font-bold flex items-center gap-1.5">
                <Bluetooth className="w-3 h-3" /> {beaconLeaves.length} real beacon leaves ready
              </span>
            ) : null}
          </div>
          <p className="text-xs text-white/70 leading-relaxed max-w-3xl">
            IoT edge operators settle batches of BLE proximity detections on Creditcoin. Each batch carries a
            client-computed Merkle root over the observed advertising frames, a detection count and a signal
            quality grade — chained to the edge's previous anchor, rate-limited, and rewarded in NEXUS units
            claimed on-chain. Roots are operator-signed honest witness commits, not traffic interception.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openPicker}
            title="Choose which wallet signs on-chain transactions"
            className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-200 hover:bg-cyan-500/20 transition text-[11px] font-mono font-bold flex items-center gap-1.5 max-w-[240px]"
          >
            <Wallet className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{activeSignerLabel}</span>
            <span className="text-[9px] uppercase tracking-wider text-cyan-400/70 shrink-0">switch</span>
          </button>
          <button
            onClick={refresh}
            className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Server className="w-3 h-3" /> Edge Nodes</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{state?.edgeCount ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Activity className="w-3 h-3" /> Batches Settled</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state?.totalBatchesSettled?.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Radio className="w-3 h-3" /> Detections Anchored</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state?.totalDetectionsAnchored?.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Layers className="w-3 h-3" /> Batch Cooldown</span>
          <span className="text-lg font-black font-mono text-sky-300 mt-0.5 block">{state ? `${state.minSecondsBetweenBatches}s` : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Zap className="w-3 h-3" /> NEXUS Issued</span>
          <span className="text-lg font-black font-mono text-amber-300 mt-0.5 block">{state ? fmtUnits(state.totalRewardUnitsIssued) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Reward / Detection</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state ? `${fmtUnits(state.rewardPerDetection)} NX` : '…'}</span>
        </div>
      </div>

      {/* My edge node */}
      <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] uppercase font-mono text-white/40 flex items-center gap-1.5">
              <ScrollText className="w-3 h-3" /> YOUR EDGE NODE
              <button onClick={openPicker} className="text-emerald-400 font-bold flex items-center gap-1 hover:opacity-80 transition">
                <Wallet className="w-3 h-3" /> SIGNING WITH {activeSignerLabel.toUpperCase()}
              </button>
            </span>
            {edge ? (
              <>
                <div className="text-sm font-black font-mono text-white flex items-center gap-2 flex-wrap">
                  #{edge.edgeId} · {edge.edgeTag}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                    {edge.batchCount} batch{edge.batchCount === 1 ? '' : 'es'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                    {fmtUnits(unpaid)} NEXUS unclaimed
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/40 flex items-center gap-1 mt-0.5 flex-wrap">
                  <Radio className="w-3 h-3" />
                  seq #{edge.lastBatchSeq} · {edge.totalDetections.toLocaleString()} detections anchored · quality {edge.lastQualityGrade}/4 ·
                  Merkle {edge.lastMerkleRoot.slice(0, 10)}… · PoS {edge.lastAnchorHash.slice(0, 10)}…
                </div>
              </>
            ) : (
              <div className="text-xs font-mono text-white/60">
                This signing wallet (<strong className="text-white/80">{activeSignerLabel}</strong>) has no edge node yet — commit a batch below and it will be auto-registered.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {!edge ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="edge tag"
                className="w-36 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={registerNow}
                disabled={busyAny}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />} Register Edge Node
              </button>
            </div>
          ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-mono text-white/40 block">Detections in batch</span>
              <input
                type="number"
                min={1}
                max={state?.maxDetectionsPerBatch ?? 5000}
                value={detections}
                onChange={(e) => setDetections(Number(e.target.value))}
                className="w-32 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-mono text-white/40 block">Signal quality (1–4)</span>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-28 px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value={1} className="bg-slate-900">1 · Weak</option>
                <option value={2} className="bg-slate-900">2 · Stable</option>
                <option value={3} className="bg-slate-900">3 · Strong</option>
                <option value={4} className="bg-slate-900">4 · Excellent</option>
              </select>
            </div>
            <button
              onClick={commitNow}
              disabled={busyAny}
              className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {busy === 'settle' || busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Commit Batch to Creditcoin
            </button>
            <button
              onClick={claimNow}
              disabled={busyAny || unpaid <= 0}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" /> Claim {fmtUnits(unpaid)}
            </button>
            {beaconLeaves.length > 0 ? (
              <span className="text-[9px] font-mono text-sky-300/80 flex items-center gap-1">
                <Bluetooth className="w-3 h-3" /> Merkle root computed over the {beaconLeaves.length} live-scanned beacon mac hashes
              </span>
            ) : null}
          </div>
          )}
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
            Merkle roots are operator-computed commitments over observed BLE frames — an honest witness ledger,
            not a claim of global traffic interception. One batch per edge per 60s cooldown; rewards scale with
            detection count and quality. The seeded CC3 network settles Epoch-loaded demo batches on 2 edges.
          </div>
          {txLog.slice(0, 4).map((l, i) => (
            <div key={i} className="text-[10px] font-mono text-white/40 truncate">{l}</div>
          ))}
        </div>
      </div>

      {/* Recent batch ledger */}
      {ledger.length > 0 ? (
        <div className="mt-4">
          <span className="text-[10px] uppercase font-mono text-white/40 flex items-center gap-1.5 mb-2">
            <ScrollText className="w-3 h-3" /> Recent settlement ledger · {ledger.length} DetectionBatchSettled events (read via eth_getLogs)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ledger.slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-[10px] font-mono">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">B{l.batchSeq}</span>
                <span className="text-white/50 shrink-0">{l.operator.slice(0, 6)}…{l.operator.slice(-4)}</span>
                <span className="text-white/90">{l.detectionsCount} detections</span>
                <span className={`shrink-0 ${l.qualityGrade >= 4 ? 'text-emerald-300' : l.qualityGrade >= 3 ? 'text-cyan-300' : l.qualityGrade >= 2 ? 'text-sky-300' : 'text-amber-300'}`}>
                  {'●'.repeat(l.qualityGrade)}{'○'.repeat(4 - l.qualityGrade)}
                </span>
                <span className="text-amber-300 shrink-0">+{fmtUnits(l.rewardUnits)} NX</span>
                <span className="ml-auto text-white/30" title={`Anchored at CC3 block ${l.blockNumber.toLocaleString()}`}>
                  b{l.blockNumber.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
};

export default NexusLivePanel;