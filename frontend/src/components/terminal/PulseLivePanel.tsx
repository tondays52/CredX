import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import {
  Wifi,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Zap,
  ExternalLink,
  Radio,
  ScrollText,
  Layers,
  ShieldCheck,
  Activity,
  Wallet,
} from 'lucide-react';
import usePulseLive from '../../hooks/usePulseLive';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const fmtUnits = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const PulseLivePanel: React.FC = () => {
  const {
    state, node, ledger, loading, busy, error, lastTx, txLog,
    unpaid, networkQualityPct, ledgerGB, activeSignerLabel, openPicker,
    register, submit, claim, refresh,
    contract,
  } = usePulseLive();

  const [tag, setTag] = useState('pulse-demo');
  const [mb, setMb] = useState(50000);
  const [grade, setGrade] = useState(3);

  const registerNode = () => register(tag);
  const submitEpoch = () => submit(mb, grade);
  const claimRewards = () => claim();

  const busyAny = busy !== null;

  return (
    <GlassCard className="p-5 border-[#ABF600]/30 bg-gradient-to-br from-[#0a1506] via-black to-cyan-950/20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-[#ABF600]/20 border border-[#ABF600]/40 text-[#ABF600] font-mono text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ABF600] animate-pulse" />
              LIVE — PulseBandwidthRegistry on-chain epoch ledger
            </span>
            <a
              href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-[#ABF600] font-mono text-[10px]"
            >
              {contract.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
            </a>
            {state?.currentEpoch !== undefined ? (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold">
                Live Epoch #{state?.currentEpoch}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-white/70 leading-relaxed max-w-3xl">
            Node operators register and settle one bandwidth report per live epoch directly on Creditcoin. Every
            anchor is chained to the node's previous report, bounded by a bandwidth corridor, quality-graded 1–4,
            and rewarded in PULSE units claimed on-chain. Reports are operator-signed session figures — an honest
            Data-DAO ledger, not claimed traffic interception.
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
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Layers className="w-3 h-3" /> Nodes</span>
          <span className="text-lg font-black font-mono text-[#ABF600] mt-0.5 block">{state?.nodeCount ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Activity className="w-3 h-3" /> Epochs Settled</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state?.totalEpochsSettled?.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Radio className="w-3 h-3" /> Bandwidth Anchored</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">
            {state ? `${(state.totalBandwidthMB / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB` : '…'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Quality</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{networkQualityPct}%</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Zap className="w-3 h-3" /> PULSE Issued</span>
          <span className="text-lg font-black font-mono text-amber-300 mt-0.5 block">{state ? fmtUnits(state.totalRewardUnitsIssued) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Wifi className="w-3 h-3" /> Reward / Epoch</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state ? `${fmtUnits(state.rewardPerEpoch)} PULSE` : '…'}</span>
        </div>
      </div>

      {/* My node */}
      <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] uppercase font-mono text-white/40 flex items-center gap-1.5">
              <ScrollText className="w-3 h-3" /> YOUR PULSE NODE
              <button onClick={openPicker} className="text-[#ABF600] font-bold flex items-center gap-1 hover:opacity-80 transition">
                <Wallet className="w-3 h-3" /> SIGNING WITH {activeSignerLabel.toUpperCase()}
              </button>
            </span>
            {node ? (
              <>
                <div className="text-sm font-black font-mono text-white flex items-center gap-2 flex-wrap">
                  #{node.nodeId} · {node.nodeTag}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                    {node.epochCount} epoch{node.epochCount === 1 ? '' : 's'} settled
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                    {fmtUnits(unpaid)} PULSE unclaimed
                  </span>
                </div>
                <div className="text-[10px] font-mono text-white/40 flex items-center gap-1 mt-0.5 flex-wrap">
                  <Radio className="w-3 h-3" />
                  last epoch #{node.lastEpoch} · {node.lastBandwidthMB.toLocaleString()} MB routed{node.lastBandwidthMB > 0 ? ` (${(node.lastBandwidthMB / 1024).toFixed(2)} GB)` : ''} ·
                  quality {node.lastQualityGrade}/4 · PoS {node.lastAnchorHash.slice(0, 10)}…
                </div>
              </>
            ) : (
              <div className="text-xs font-mono text-white/60">
                This signing wallet (<strong className="text-white/80">{activeSignerLabel}</strong>) has no Pulse node yet — register one below.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {!node ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="node tag"
                className="w-36 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-[#ABF600]/50"
              />
              <button
                onClick={registerNode}
                disabled={busyAny}
                className="px-3 py-2 rounded-xl bg-[#ABF600]/20 hover:bg-[#ABF600]/30 text-[#ABF600] border border-[#ABF600]/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />} Register Node
              </button>
            </div>
          ) : null}

          {node ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-mono text-white/40 block">Bandwidth this epoch (MB)</span>
                <input
                  type="number"
                  min={1}
                  max={state?.maxBandwidthMB ?? 5000000}
                  value={mb}
                  onChange={(e) => setMb(Number(e.target.value))}
                  className="w-32 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-[#ABF600]/50"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-mono text-white/40 block">Quality grade (1–4)</span>
                <select
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="w-28 px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white focus:outline-none focus:border-[#ABF600]/50"
                >
                  <option value={1} className="bg-slate-900">1 · Degraded</option>
                  <option value={2} className="bg-slate-900">2 · Stable</option>
                  <option value={3} className="bg-slate-900">3 · Strong</option>
                  <option value={4} className="bg-slate-900">4 · Excellent</option>
                </select>
              </div>
              <button
                onClick={submitEpoch}
                disabled={busyAny}
                className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy === 'submit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />} Anchor Epoch #{state?.currentEpoch ?? '…'}
              </button>
              <button
                onClick={claimRewards}
                disabled={busyAny || unpaid <= 0}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-[11px] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" /> Claim {fmtUnits(unpaid)}
              </button>
            </div>
          ) : null}
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
            Bandwidth figures are operator-signed session reports stored on-chain — an honest ledger, not an ISP
            interception claim. One anchor per node per 24h epoch; rewards scale with quality grade. The seeded
            CC3 network anchors Epoch 0 from two demo nodes.
          </div>
          {txLog.slice(0, 4).map((l, i) => (
            <div key={i} className="text-[10px] font-mono text-white/40 truncate">{l}</div>
          ))}
        </div>
      </div>

      {/* Recent epoch ledger */}
      {ledger.length > 0 ? (
        <div className="mt-4">
          <span className="text-[10px] uppercase font-mono text-white/40 flex items-center gap-1.5 mb-2">
            <ScrollText className="w-3 h-3" /> Recent settlement ledger · {ledger.length} BandwidthAnchored events (read via eth_getLogs)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ledger.slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-[10px] font-mono">
                <span className="shrink-0 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">E{String(l.epochId).padStart(2, '0')}</span>
                <span className="text-white/50 shrink-0">{shortAddr(l.operator)}</span>
                <span className="text-white/90">{l.bandwidthMB.toLocaleString()} MB</span>
                <span className={`shrink-0 ${l.qualityGrade >= 4 ? 'text-[#ABF600]' : l.qualityGrade >= 3 ? 'text-emerald-300' : l.qualityGrade >= 2 ? 'text-cyan-300' : 'text-amber-300'}`}>
                  {'●'.repeat(l.qualityGrade)}{'○'.repeat(4 - l.qualityGrade)}
                </span>
                <span className="text-amber-300 shrink-0">+{fmtUnits(l.rewardUnits)} PULSE</span>
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

export default PulseLivePanel;