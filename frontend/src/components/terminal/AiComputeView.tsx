import React, { useState, useEffect, useMemo } from 'react';
import GlassCard from '../common/GlassCard';
import {
  Cpu,
  Zap,
  ShieldCheck,
  Radio,
  Wallet,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  ExternalLink,
  Activity,
  Play,
  AlertTriangle,
  CheckCircle2,
  Server,
  Gauge,
  Timer,
  BrainCircuit,
  Database,
} from 'lucide-react';
import useAiComputeLive from '../../hooks/useAiComputeLive';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { computeYumaConsensus, getSampleYumaNetwork, YumaConsensusResult } from '../../utils/yumaConsensus';

interface AiComputeViewProps {
  hardware?: {
    cpuCores: number;
    deviceMemoryGB: number;
    gpuRenderer: string;
    pingMs: number;
  };
}

const fmtUnits = (n: number) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '…');
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const AiComputeView: React.FC<AiComputeViewProps> = ({
  hardware = {
    cpuCores: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8,
    deviceMemoryGB: (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) || 16,
    gpuRenderer: 'Standard Neural Engine',
    pingMs: 18,
  },
}) => {
  const {
    state, provider, providers, ledger, benchmark, loading, busy, error, lastTx, txLog,
    unpaid, canSettle, activeSignerLabel, openPicker,
    register, settle, claim, runBenchmark, refresh, contract,
  } = useAiComputeLive();

  const [subTab, setSubTab] = useState<'market' | 'bench' | 'ledger' | 'consensus'>('market');

  // Register form
  const [modelTag, setModelTag] = useState('CRDX-H100');
  const [vramGb, setVramGb] = useState(24);
  const [tflops, setTflops] = useState(180);

  // Settle form
  const [minutes, setMinutes] = useState(5);
  const [grade, setGrade] = useState(3);

  // Yuma model state (local-only educational)
  const [yumaData, setYumaData] = useState<YumaConsensusResult>(() => {
    const { W, S } = getSampleYumaNetwork();
    return computeYumaConsensus(W, S, 10.0, 0.5);
  });
  const [rhoParam, setRhoParam] = useState(10.0);
  const [kappaParam, setKappaParam] = useState(0.5);
  const [simulateCabalAttack, setSimulateCabalAttack] = useState(false);

  useEffect(() => {
    const { W, S } = getSampleYumaNetwork();
    if (simulateCabalAttack) {
      W[4] = [0, 0, 0, 0, 0.5, 0.5];
      W[5] = [0, 0, 0, 0, 0.5, 0.5];
    }
    setYumaData(computeYumaConsensus(W, S, rhoParam, kappaParam));
  }, [rhoParam, kappaParam, simulateCabalAttack]);

  const busyAny = busy !== null;

  // Session cooldown countdown (on-chain minSecondsBetweenSessions).
  const coolDownLeft = useMemo(() => {
    if (!provider || !state) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, provider.lastSettledAt + state.minSecondsBetweenSessions - now);
  }, [provider, state]);

  const fmtGrade = (g: number) => ({ 1: 'Degraded', 2: 'Stable', 3: 'Strong', 4: 'Excellent' } as const)[g as 1 | 2 | 3 | 4] ?? 'Unknown';

  const registerDevice = () => register(modelTag, vramGb, tflops);
  const settleSession = () => settle(minutes, grade);
  const claimRewards = () => claim();

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HERO HEADER — live on-chain CredXsor registry                            */}
      {/* ========================================================================= */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30 bg-gradient-to-r from-black via-[#0d071a] to-[#120826]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                LIVE — AiComputeRegistry on Creditcoin Testnet
              </span>
              <a
                href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-purple-300 font-mono text-[10px]"
              >
                {contract.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
              </a>
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/60 text-xs font-mono">
                {state?.providerCount ?? '…'} providers · {fmtUnits(state?.totalSessionsSettled ?? 0)} sessions
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AI Compute (CredXsor) — on-chain compute Data-DAO
            </h2>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
              Providers register hardware (model tag, VRAM, peak TFLOPS) and settle compute sessions directly on
              Creditcoin. Every session is chained to the provider's previous anchor, quality-graded 1–4, and
              rewarded in CREDX units. The Merkle root of each session commits the real browser-native benchmark
              measured on this device — an honest Data-DAO ledger, not a claimed GPU execution marketplace.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs space-y-1">
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Reward Rate</span>
                <span className="text-purple-400 font-bold">{state ? `${fmtUnits(state.rewardUnitsPerMinute)} CREDX/min` : '…'}</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Session Cooldown</span>
                <span className="text-white font-bold">{state ? `${state.minSecondsBetweenSessions}s` : '…'}</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Quality Grades</span>
                <span className="text-emerald-400 font-bold">{state ? `1–${state.maxGrade}` : '…'}</span>
              </div>
            </div>

            <button
              onClick={runBenchmark}
              disabled={busyAny}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${busy === 'benchmark' ? 'animate-spin' : ''}`} />
              {busy === 'benchmark' ? 'Benchmarking Hardware...' : 'Benchmark This Device'}
            </button>
          </div>
        </div>

        {/* Live registry + this-device telemetry banner */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Detected AI Accelerator</span>
            <span className="text-white font-bold truncate block">{hardware.gpuRenderer}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Hardware Logic Cores</span>
            <span className="text-white font-bold">{hardware.cpuCores} CPU Threads</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Measured This Browser</span>
            <span className="text-purple-300 font-bold">
              {benchmark ? `${benchmark.tokensPerSecond} t/s · ${benchmark.tensorFLOPS.toFixed(3)} GFLOPS` : 'no benchmark yet'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Signing Wallet</span>
            <button onClick={openPicker} className="text-cyan-400 font-bold truncate w-full text-left hover:opacity-80 transition">
              {activeSignerLabel} ⇄
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ========================================================================= */}
      {/* REGISTRY STATS                                                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Server className="w-3 h-3" /> Providers</span>
          <span className="text-lg font-black font-mono text-purple-300 mt-0.5 block">{state?.providerCount ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Activity className="w-3 h-3" /> Sessions Settled</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state?.totalSessionsSettled?.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Timer className="w-3 h-3" /> Session Minutes</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state?.totalSessionMinutes?.toLocaleString() ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Zap className="w-3 h-3" /> CREDX Issued</span>
          <span className="text-lg font-black font-mono text-amber-300 mt-0.5 block">{state ? fmtUnits(state.totalRewardUnitsIssued) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Gauge className="w-3 h-3" /> Reward / min</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state ? `×${fmtUnits(state.rewardUnitsPerMinute)}` : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Grade Cap</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{state?.maxGrade ?? '…'}/4</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TABS NAVIGATION                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08]">
        {([
          { key: 'market' as const, icon: Server, label: 'Compute Market' },
          { key: 'bench' as const, icon: Zap, label: 'Benchmark & Settle' },
          { key: 'ledger' as const, icon: Database, label: 'On-Chain Ledger' },
          { key: 'consensus' as const, icon: BrainCircuit, label: 'Yuma Consensus' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
              subTab === key
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
                : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 — COMPUTE MARKET (real on-chain provider directory + registration)  */}
      {/* ========================================================================= */}
      {subTab === 'market' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Registered compute providers on the live registry
              </span>
              <span className="text-[11px] font-mono text-white/40">hardware specs are operator-reported declarations stored on-chain</span>
            </div>
            <button
              onClick={refresh}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {providers.length === 0 ? (
            <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] text-xs font-mono text-white/50">
              No providers registered on-chain yet. Register this device below.
            </div>
          ) : (
            <div className={`grid gap-4 ${providers.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {providers.map((p) => (
                <GlassCard key={p.providerId} className="p-5 hover:border-purple-500/40 transition space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                          #{p.providerId} · {p.modelTag}
                        </span>
                        <a
                          href={`${CREDITCOIN_BLOCKSCOUT}/address/${p.operator}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-mono text-white/40 hover:text-purple-300 inline-flex items-center gap-1"
                        >
                          {shortAddr(p.operator)} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {p.sessionSeq} session{p.sessionSeq === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 mt-4 font-mono text-xs">
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">Model Tag</span>
                        <span className="text-white font-bold text-sm">{p.modelTag}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">VRAM (reported)</span>
                        <span className="text-white font-bold text-sm">{p.vramGb} GB</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">Peak TFLOPS (reported)</span>
                        <span className="text-purple-300 font-bold text-sm">{p.tflops.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-3 p-2.5 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] text-white/70 space-y-1">
                      <div className="flex justify-between"><span className="text-white/40">Minutes settled:</span><span className="text-white font-bold">{p.totalSessionMinutes}</span></div>
                      <div className="flex justify-between"><span className="text-white/40">CREDX earned:</span><span className="text-amber-300 font-bold">{fmtUnits(p.totalRewardUnits)}</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Anchor:</span><span className="text-white/60 truncate max-w-[200px]">{p.lastAnchorHash.slice(0, 10)}…</span></div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Register this device */}
          {!provider && (
            <GlassCard className="p-5 border-purple-500/30 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Register This Device as a Compute Provider
                </span>
                <p className="text-[11px] text-white/60">
                  Declare your hardware specs on-chain from the signing wallet below. The model tag, VRAM and peak
                  TFLOPS are operator-reported declarations (like an edge tag), bound to your wallet forever.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Model Tag (bytes4)</span>
                  <input
                    value={modelTag}
                    onChange={(e) => setModelTag(e.target.value)}
                    placeholder="CRDX-H100"
                    className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">VRAM GB (reported)</span>
                  <input
                    type="number"
                    min={1}
                    value={vramGb}
                    onChange={(e) => setVramGb(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Peak TFLOPS (reported)</span>
                  <input
                    type="number"
                    min={1}
                    value={tflops}
                    onChange={(e) => setTflops(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={registerDevice}
                  disabled={busyAny}
                  className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300 font-bold text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />} Register Provider
                </button>
              </div>

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
              {txLog.slice(0, 3).map((l, i) => (
                <div key={i} className="text-[10px] font-mono text-white/40 truncate">{l}</div>
              ))}
            </GlassCard>
          )}

          {provider && (
            <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/25 text-xs font-mono text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              This wallet is registered as provider #{provider.providerId} ({provider.modelTag}) — settle compute sessions in the Benchmark &amp; Settle tab.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 — BENCHMARK & SESSIONS (real measurement + on-chain settlement)      */}
      {/* ========================================================================= */}
      {subTab === 'bench' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Benchmark + settle form */}
            <div className="lg:col-span-7 space-y-4">
              <GlassCard className="p-6 border-purple-500/30 space-y-5">
                <div>
                  <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block">
                    Real Local Benchmark & On-Chain Session
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">Measure this device, then settle</h3>
                  <p className="text-xs text-white/60 mt-1">
                    Run a real browser-native matrix pass on <strong className="text-white/80">{hardware.gpuRenderer}</strong> to
                    measure authentic tokens/sec and GFLOPS. The measured result is committed as the session's
                    Merkle root when you settle on Creditcoin.
                  </p>
                </div>

                {benchmark ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <span className="text-[10px] text-white/40 block">Throughput</span>
                      <span className="text-purple-300 font-bold text-sm">{benchmark.tokensPerSecond} t/s</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <span className="text-[10px] text-white/40 block">Tensor Compute</span>
                      <span className="text-white font-bold text-sm">{benchmark.tensorFLOPS.toFixed(3)} GFLOPS</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <span className="text-[10px] text-white/40 block">Embed Latency</span>
                      <span className="text-cyan-300 font-bold text-sm">{benchmark.embeddingLatencyMs} ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <span className="text-[10px] text-white/40 block">Device</span>
                      <span className="text-white font-bold text-sm truncate">{benchmark.hardwareDevice.replace(/ \(.*\)/, '')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-white/60">
                    No benchmark run yet. Run it once — the measured root is what gets committed on-chain.
                  </div>
                )}

                {provider ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-mono text-white/40 block">Session minutes (1–{state?.maxSessionMinutes})</span>
                        <input
                          type="number"
                          min={1}
                          max={state?.maxSessionMinutes ?? 1440}
                          value={minutes}
                          onChange={(e) => setMinutes(Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-mono text-white/40 block">Quality grade (1–4)</span>
                        <select
                          value={grade}
                          onChange={(e) => setGrade(Number(e.target.value))}
                          className="w-full px-2 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white focus:outline-none focus:border-purple-500/50"
                        >
                          <option value={1} className="bg-slate-900">1 · Degraded</option>
                          <option value={2} className="bg-slate-900">2 · Stable</option>
                          <option value={3} className="bg-slate-900">3 · Strong</option>
                          <option value={4} className="bg-slate-900">4 · Excellent</option>
                        </select>
                      </div>
                      <div className="space-y-1 self-end">
                        <span className="text-[9px] uppercase font-mono text-white/40 block">Reward</span>
                        <div className="px-2.5 py-2 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-amber-300 font-bold">
                          ≈{fmtUnits((state?.rewardUnitsPerMinute ?? 0) * minutes * grade)} CREDX
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        onClick={settleSession}
                        disabled={busyAny || coolDownLeft > 0}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 disabled:opacity-50"
                      >
                        {busy === 'settle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {coolDownLeft > 0 ? `Cooldown ${fmtClock(coolDownLeft)}s` : 'Settle Session'}
                      </button>
                      <button
                        onClick={claimRewards}
                        disabled={busyAny || unpaid <= 0}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5" /> Claim {fmtUnits(unpaid)}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/30 text-xs font-mono text-amber-300">
                    This wallet has no compute provider registered yet — go to the <button onClick={() => setSubTab('market')} className="underline hover:text-amber-200">Compute Market</button> tab to register first.
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Your provider card */}
            <div className="lg:col-span-5 space-y-4">
              <GlassCard className="p-5 border-cyan-500/30 space-y-3">
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Your On-Chain Provider
                  <button onClick={openPicker} className="text-cyan-300 font-bold flex items-center gap-1 hover:opacity-80 transition ml-1">
                    <Wallet className="w-3 h-3" /> {activeSignerLabel.toUpperCase()}
                  </button>
                </span>
                {provider ? (
                  <>
                    <div className="text-sm font-black font-mono text-white flex items-center gap-2 flex-wrap">
                      #{provider.providerId} · {provider.modelTag}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono">
                        {provider.sessionSeq} session{provider.sessionSeq === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                        {fmtUnits(provider.totalRewardUnits)} CREDX
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                        {fmtUnits(unpaid)} unclaimed
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-white/70">
                      <div className="flex justify-between"><span className="text-white/40">VRAM (reported):</span><span className="text-white font-bold">{provider.vramGb} GB</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Peak TFLOPS:</span><span className="text-white font-bold">{provider.tflops.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Minutes settled:</span><span className="text-white font-bold">{provider.totalSessionMinutes}</span></div>
                      <div className="flex justify-between"><span className="text-white/40">Anchor:</span><span className="text-white/70 truncate max-w-[110px]">{provider.lastAnchorHash.slice(0, 10)}…</span></div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs font-mono text-white/60">
                    No on-chain provider for the signing wallet <strong className="text-white/80">{activeSignerLabel}</strong> yet.
                  </div>
                )}
              </GlassCard>

              {/* Session rewards honesty note */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] font-mono text-[10px] text-white/40 leading-relaxed space-y-1.5">
                <p>Session minutes, hardware specs and grades are operator-signed reports anchored on CC3 — an honest Data-DAO ledger, not a claim of executing untrusted third-party GPU jobs.</p>
                <p>The Merkle root commits the <strong className="text-white/60">real benchmark measured on this device</strong>. CREDX units are internal ledger credits tracked on-chain (no token transfer).</p>
                <p>Sessions are rate-limited to one per {state?.minSecondsBetweenSessions ?? 60}s between a provider's settlements; rewards = minutes × grade × {state ? fmtUnits(state.rewardUnitsPerMinute) : '10'} CREDX/min.</p>
              </div>

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
              {txLog.slice(0, 4).map((l, i) => (
                <div key={i} className="text-[10px] font-mono text-white/40 truncate">{l}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3 — ON-CHAIN LEDGER (real ComputeSessionSettled events via getLogs)    */}
      {/* ========================================================================= */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> ComputeSessionSettled · {ledger.length} events (read via eth_getLogs)
              </span>
              <span className="text-[11px] font-mono text-white/40">live from <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}#events`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-purple-300 underline">blockscout</a></span>
            </div>
            <button
              onClick={refresh}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {ledger.length === 0 ? (
            <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] text-xs font-mono text-white/50">
              No settled sessions in the recent window yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left font-mono text-xs bg-black/60">
                <thead className="bg-white/[0.04] text-white/50 text-[10px] uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3">Seq</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Minutes</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">CREDX</th>
                    <th className="p-3">Merkle Root</th>
                    <th className="p-3">Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {ledger.map((l) => (
                    <tr key={`${l.operator}-${l.sessionSeq}`} className="hover:bg-white/[0.02] transition">
                      <td className="p-3 font-bold text-white">#{String(l.sessionSeq).padStart(2, '0')}</td>
                      <td className="p-3">
                        <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${l.operator}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
                          {shortAddr(l.operator)} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="p-3 text-white/80">{l.sessionMinutes} min</td>
                      <td className="p-3">
                        <span className={`${l.qualityGrade >= 4 ? 'text-purple-300' : l.qualityGrade >= 3 ? 'text-emerald-300' : l.qualityGrade >= 2 ? 'text-cyan-300' : 'text-amber-300'}`}>
                          {'●'.repeat(l.qualityGrade)}{'○'.repeat(4 - l.qualityGrade)} {fmtGrade(l.qualityGrade)}
                        </span>
                      </td>
                      <td className="p-3 text-amber-300 font-bold">+{fmtUnits(l.rewardUnits)}</td>
                      <td className="p-3 text-white/60 truncate max-w-[180px]">{l.merkleRoot.slice(0, 12)}…</td>
                      <td className="p-3 text-white/40" title={`Anchored at CC3 block ${l.blockNumber.toLocaleString()}`}>b{l.blockNumber.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4 — YUMA CONSENSUS (labeled educational whitepaper model)             */}
      {/* ========================================================================= */}
      {subTab === 'consensus' && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-sky-200/80">
            <BrainCircuit className="w-4 h-4 shrink-0 mt-0.5 text-sky-300" />
            <span className="font-mono">
              Educational whitepaper model — Yuma consensus incentive mathematics run locally on a synthetic 6-peer
              network with example stakes. NOT live Bittensor/TAO telemetry; nothing in this tab is attested to Creditcoin.
              The real, on-chain part of the CredXsor market lives in the Compute Market, Benchmark &amp; Settle and
              On-Chain Ledger tabs above.
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase text-purple-400 font-bold block">
                  Yuma Rao Incentive Mechanics
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Weight Matrix W &amp; Sigmoid Consensus C = σ(ρ(TᵀS - κ))
                </h3>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold">
                {yumaData.isConsensusHealthy ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Consensus Secure (Loss L = {yumaData.antiCollusionLoss.toFixed(3)} &lt; 0)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-red-400 border-red-500/30 bg-red-500/10 px-3 py-1 rounded-lg animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cabal Detected (Loss L = {yumaData.antiCollusionLoss.toFixed(3)} &gt; 0)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-white/[0.06] font-mono text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60">Sigmoid Temperature (ρ):</span>
                  <span className="text-purple-300 font-bold">{rhoParam.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={rhoParam}
                  onChange={(e) => setRhoParam(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60">Consensus Shift (κ):</span>
                  <span className="text-purple-300 font-bold">{kappaParam.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={kappaParam}
                  onChange={(e) => setKappaParam(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div>
                  <span className="text-white font-bold block text-xs">Simulate Disjoint Cabal</span>
                  <span className="text-[10px] text-white/40">Peers 4 &amp; 5 only vote for each other</span>
                </div>
                <button
                  onClick={() => setSimulateCabalAttack(!simulateCabalAttack)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                    simulateCabalAttack
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {simulateCabalAttack ? 'Active' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left font-mono text-xs bg-black/60">
              <thead className="bg-white/[0.04] text-white/50 text-[10px] uppercase border-b border-white/10">
                <tr>
                  <th className="p-3">UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Stake (S)</th>
                  <th className="p-3">Fisher Rank (R)</th>
                  <th className="p-3">Consensus (C)</th>
                  <th className="p-3">Incentive (I)</th>
                  <th className="p-3">Daily Emission (ΔS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {yumaData.peers.map((peer) => (
                  <tr key={peer.uid} className="hover:bg-white/[0.02] transition">
                    <td className="p-3 font-bold text-white">Peer {peer.uid}</td>
                    <td className="p-3">
                      {peer.isValidator ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">Validator</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">Miner</span>
                      )}
                    </td>
                    <td className="p-3 text-white/80">{peer.stakeTao.toLocaleString()} TAO</td>
                    <td className="p-3 text-cyan-400 font-bold">{peer.rank.toFixed(4)}</td>
                    <td className="p-3 text-emerald-400 font-bold">{(peer.consensus * 100).toFixed(1)}%</td>
                    <td className="p-3 text-purple-300 font-bold">{(peer.incentive * 100).toFixed(2)}%</td>
                    <td className="p-3 font-bold text-white">{peer.emissionTaoPerDay.toFixed(2)} TAO</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiComputeView;