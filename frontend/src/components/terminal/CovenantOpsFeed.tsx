import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  Activity,
  ShieldCheck,
  RefreshCw,
  TriangleAlert,
  CircleCheck,
  CircleX,
  FileWarning,
  Landmark,
  Loader2,
} from 'lucide-react';
import { fetchUSCOracleInfo, USCOracleInfo } from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

interface CollateralPosition {
  id: string;
  label: string;
  sourceChain: string;
  sourceAddress: string;
  ltvBps: number;
  covenantCap: string;
  breached: boolean;
}

const INITIAL_POSITIONS: CollateralPosition[] = [
  { id: 'p1', label: 'USDC Vault — 88,400 USDC', sourceChain: 'Sepolia', sourceAddress: '0x9aF4…8f07', ltvBps: 8000, covenantCap: '$10,000', breached: false },
  { id: 'p2', label: 'stETH Lock — 42.5 stETH', sourceChain: 'Sepolia', sourceAddress: '0x4d11…C671', ltvBps: 6000, covenantCap: '$25,000', breached: false },
  { id: 'p3', label: 'wBTC Collateral — 6.2 wBTC', sourceChain: 'Sepolia', sourceAddress: '0x2Ea3…9f0c', ltvBps: 7500, covenantCap: '$90,000', breached: false },
];

const CovenantOpsFeed: React.FC = () => {
  const [uscInfo, setUscInfo] = useState<USCOracleInfo | null>(null);
  const [uscLoading, setUscLoading] = useState(false);
  const [uscError, setUscError] = useState<string | null>(null);
  const [positions, setPositions] = useState<CollateralPosition[]>(INITIAL_POSITIONS);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [widgetLog, setWidgetLog] = useState<string[]>([]);

  const pushLog = (line: string) => setWidgetLog((prev) => [line, ...prev].slice(0, 20));

  const loadUscInfo = async () => {
    setUscLoading(true);
    setUscError(null);
    try {
      const info = await fetchUSCOracleInfo();
      setUscInfo(info);
      pushLog(`oracle anchor count ${info.anchoredCount} — chains ${info.chains.map((c) => `${c.chainName}#${c.latestAttestedHeight}`).join(', ')}`);
    } catch (err: any) {
      setUscError(err?.message || 'Failed to read BlockProverAttestationOracle');
    } finally {
      setUscLoading(false);
    }
  };

  useEffect(() => {
    loadUscInfo();
  }, []);

  const toggleBreach = async (id: string) => {
    if (simulating) return;
    setSimulating(id);
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, breached: !p.breached } : p)));
    const target = positions.find((p) => p.id === id)!;
    await new Promise((r) => setTimeout(r, 500));
    if (target.breached) {
      pushLog(`Covenant CLEARED — ${target.label}: new credit re-opened (repay+withdraw always open)`);
    } else {
      pushLog(`COVENANT BREACH — ${target.label}: attested receipt shows collateral departed; NEW CREDIT BLOCKED`);
    }
    setSimulating(null);
  };

  const height = uscInfo?.chains.find((c) => c.chainKey === 1)?.latestAttestedHeight;

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-emerald-500/25 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Risk & Attestation Ops Center
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-normal">
                LIVE ORACLE TELEMETRY
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              One pane of glass over every verified spine fact. Attestation heights and anchor counts are read
              straight from the deployed
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.blockProverAttestationOracle}#code`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-mono mx-1">
                BlockProverAttestationOracle
              </a>
              on Creditcoin testnet (ChainInfo precompile 0x0FD3). Collateral liveness feeds decide, per position,
              whether new credit stays open — the instant an attested receipt proves the collateral left, new credit
              is blocked while repayment and withdrawal remain open.
            </p>
          </div>
        </div>

        {/* Live oracle telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">BlockProver Precompile</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">0x0FD2</div>
            <div className="text-[10px] text-white/40 font-mono truncate">{uscInfo?.blockProverPrecompile || '…'}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">ChainInfo Precompile</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">0x0FD3</div>
            <div className="text-[10px] text-white/40 font-mono truncate">{uscInfo?.chainInfoPrecompile || '…'}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Anchored Attestations</div>
            <div className="mt-1 text-2xl font-black font-mono text-emerald-400">{uscInfo?.anchoredCount ?? '–'}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Attested Height</span>
              <button onClick={loadUscInfo} disabled={uscLoading} className="text-white/40 hover:text-emerald-400 transition cursor-pointer" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${uscLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {uscError ? (
              <div className="mt-1 text-2xl font-black font-mono text-rose-400">ERR</div>
            ) : (
              <div className="mt-1 text-2xl font-black font-mono text-white">
                {height !== undefined ? <span>#{height.toLocaleString()}</span> : <Loader2 className="w-5 h-5 animate-spin text-white/40" />}
              </div>
            )}
          </div>
        </div>
        {uscError && <div className="mt-2 text-[11px] text-rose-400 font-mono">{uscError}</div>}
        {uscInfo && (
          <div className="mt-3 flex flex-wrap gap-3">
            {uscInfo.chains.map((c) => (
              <div key={c.chainKey} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white/80">{c.chainName}</span>
                <span className="text-white/40">chainKey {c.chainKey}</span>
                <span className="text-emerald-300 font-bold">#{c.latestAttestedHeight.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Collateral liveness positions */}
      <GlassCard className="p-6 border-white/[0.08]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Landmark className="w-4 h-4 text-cyan-400" /> Collateral Liveness & Covenant Feed
            <SimulationBadge label="LIVENESS SIM" note="Attestation telemetry above is live from the deployed oracle; per-position liveness decisions are a deterministic mirror of the CovenantOps policy for the demo." />
          </h3>
          <span className="text-[10px] font-mono text-white/40">credit state: OPEN ↔ BLOCK-NEW-ONLY</span>
        </div>

        <div className="space-y-2.5">
          {positions.map((p) => (
            <div key={p.id} className={`p-3.5 rounded-xl border transition-colors ${p.breached ? 'border-rose-500/30 bg-rose-500/[0.05]' : 'border-emerald-500/20 bg-emerald-500/[0.03]'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{p.label}</span>
                    {p.breached ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-semibold font-mono">
                        <TriangleAlert className="w-3 h-3" /> BREACH — NEW CREDIT BLOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold font-mono">
                        <CircleCheck className="w-3 h-3" /> ATTESTED INTACT — CREDIT OPEN
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-white/45">
                    {p.sourceChain} · {p.sourceAddress} · Max LTV {p.ltvBps / 100}% · Covenant cap {p.covenantCap}
                  </div>
                </div>
                <button
                  onClick={() => toggleBreach(p.id)}
                  disabled={!!simulating}
                  className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-medium border transition cursor-pointer disabled:opacity-50 ${
                    p.breached
                      ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {simulating === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" /> : null}
                  {p.breached ? 'Simulate collateral restored' : 'Simulate attested collateral departure'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-white/35 leading-relaxed">
          Principle: an attested receipt proving the collateral left the source chain triggers self-enforcement —
          no oracle, no bridge, no operator decision. Repayment and withdrawal stay open; only new credit is
          blocked, and it re-opens automatically when a fresh receipt shows the collateral restored.
        </p>
      </GlassCard>

      {/* Ops feed log */}
      <GlassCard className="p-4 border-white/[0.08]">
        <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
          <FileWarning className="w-3.5 h-3.5" /> attestation & covenant ops feed
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          {widgetLog.length === 0 && <div className="text-white/30">waiting for telemetry…</div>}
          {widgetLog.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-white/25 select-none">›</span>
              <span className={l.includes('BREACH') ? 'text-rose-400/90' : 'text-cyan-300/80'}>{l}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
          <CircleX className="w-3 h-3 text-rose-400" /> breach event takes precedence — the precompile verdict is the only trust root.
        </div>
      </GlassCard>
    </div>
  );
};

export default CovenantOpsFeed;