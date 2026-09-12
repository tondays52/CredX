import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  Gauge,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Coins,
  Receipt,
  FileWarning,
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import { ethers } from 'ethers';
import { fetchMeterRegistryState, ActionMeterView, MeterRegistryState } from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

interface MeterRow {
  key: string;
  label: string;
  unit: string;
}

const METER_KEYS: MeterRow[] = [
  { key: ethers.id('gpu.lease.seconds'), label: 'GPU Lease (AI Track)', unit: 'sec' },
  { key: ethers.id('flashloan.cycles'), label: 'Reputation Flash-Loans', unit: 'cycles' },
  { key: ethers.id('compute.operations'), label: 'Proof-of-Compute Ops', unit: 'ops' },
  { key: ethers.id('perps.ticks'), label: 'Reputation Arena Ticks', unit: 'ticks' },
];

const SIM_EVENTS = [
  { t: 'ATTESTED USAGE', d: 'Attestcoin receipt verified — +400 GPU lease seconds recorded to meter. Debit $800 accrues on-chain.', kind: 'ok' },
  { t: 'CAP REFUSED (fail closed)', d: '+400 more seconds would exceed the 1,000 window cap → EXCEEDS WINDOW CAP, increment reverted.', kind: 'err' },
  { t: 'PREPAID TOP-UP', d: 'Wallet tops up $2,000 prepaid credit — usage now consumes the prepaid balance FIRST, never debt.', kind: 'ok' },
  { t: 'PREPAID OVERDRAW BLOCKED', d: 'Debit exceeds remaining prepaid → INSUFFICIENT PREPAID, fail closed. No silent debt drift while credit exists.', kind: 'err' },
  { t: 'WINDOW ROLLOVER', d: 'Window elapsed → used units reset; meter starts fresh at block N.', kind: 'ok' },
  { t: 'DEBT SETTLED', d: 'Wallet settles $1,600 outstanding metered debt in cUSD — totalOutstandingDebt → 0.', kind: 'ok' },
  { t: 'METERED CREDIT RECALC', d: 'Lender re-prices credit line from meter reading + verified usage history.', kind: 'ok' },
];

const MeterTrackingView: React.FC = () => {
  const { address, isConnected } = useWeb3();
  const [registry, setRegistry] = useState<{ state: MeterRegistryState; meters: Record<string, ActionMeterView | null>; totalDebt: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simIdx, setSimIdx] = useState(0);
  const [simLog, setSimLog] = useState<string[]>([]);

  const subject = isConnected && address ? address : DEMO_ACCOUNT;

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMeterRegistryState(subject, METER_KEYS.map((k) => k.key));
      setRegistry(res);
      const configured = Object.values(res.meters).filter(Boolean).length;
      setSimLog((prev) => [
        `live: UsageMeteringRegistry @ ${CONTRACTS.usageMeteringRegistry.slice(0, 8)}… — ${configured} meter(s) configured for ${subject.slice(0, 8)}…`,
        ...prev,
      ].slice(0, 20));
    } catch (err: any) {
      setError(err?.message || 'Failed to read UsageMeteringRegistry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceSim = async () => {
    if (simIdx >= SIM_EVENTS.length) {
      setSimIdx(0);
      setSimLog((prev) => ['sim events reset — deterministic mirror', ...prev].slice(0, 20));
      return;
    }
    const ev = SIM_EVENTS[simIdx];
    setSimIdx((s) => s + 1);
    setSimLog((prev) => [
      `${ev.t} — ${ev.d}`,
      ...prev,
    ].slice(0, 20));
  };

  const totalDebt = registry?.totalDebt ?? 0;

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-emerald-500/25 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Metered Usage & Accountability
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-normal">
                LIVE ON-CHAIN
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Every usage increment is bound to an attested cross-chain receipt or reported by a registered KYC agent; caps
              fail closed; accrued debt is on-chain and payable. Deployed at{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.usageMeteringRegistry}#code`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-mono">
                UsageMeteringRegistry
              </a>{' '}
              on Creditcoin testnet. Verifier:{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${registry?.state.verifier || CONTRACTS.attestationVerifier}#code`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-mono">
                {(registry?.state.verifier || CONTRACTS.attestationVerifier).slice(0, 10)}…
              </a>
            </p>
          </div>
        </div>

        {/* Live telemetry */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Outstanding Metered Debt</span>
              <button onClick={loadLive} disabled={loading} className="text-white/40 hover:text-emerald-400 transition cursor-pointer" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-emerald-400">${totalDebt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Prepaid Credit (covers usage first)</div>
            <div className="mt-1 text-xl font-black font-mono text-amber-300">${(registry?.state.prepaidBalance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            {(registry?.state.prepaidSpent ?? 0) > 0 && (
              <div className="text-[9px] font-mono text-white/35">spent ${(registry?.state.prepaidSpent ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            )}
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Settlement Token</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">{registry?.state.settlementToken ? `${registry.state.settlementToken.slice(0, 10)}…` : '…'}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Metered Subject</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">{subject.slice(0, 10)}…</div>
          </div>
        </div>
        {error && <div className="mt-2 text-[11px] text-rose-400 font-mono">{error}</div>}

        {/* Meter table */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> meter readings — read live from the deployed registry
          </div>
          <div className="space-y-2">
            {METER_KEYS.map((m) => {
              const meter = registry?.meters[m.key] ?? null;
              const pct = meter && meter.windowCapUnits > 0 ? Math.min(100, (meter.usedUnitsThisWindow / meter.windowCapUnits) * 100) : null;
              return (
                <div key={m.key} className="p-3 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-white flex items-center gap-2">
                        {m.label}
                        {meter?.exists ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                            <CircleCheck className="w-3 h-3" /> CONFIGURED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/40 text-[10px] font-mono">
                            NOT SET
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-white/45">
                        {meter?.exists
                          ? `window cap ${meter.windowCapUnits.toLocaleString()} ${m.unit} · unit price $${meter.unitPriceUSD.toFixed(4)} · used ${meter.usedUnitsThisWindow.toLocaleString()} ${m.unit}`
                          : 'no meter configured on-chain for this wallet — registry owner sets caps + prices.'}
                      </div>
                    </div>
                    <div className="shrink-0 w-full sm:w-56">
                      {pct !== null && (
                        <div>
                          <div className="flex justify-between text-[9px] font-mono text-white/40 mb-1">
                            <span>{pct.toFixed(1)}% of window</span>
                            <span>{meter!.windowStartBlock > 0 ? `window@#${meter!.windowStartBlock}` : ''}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Simulated metering feed */}
      <GlassCard className="p-6 border-white/[0.08]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-400" /> Metering Event Feed
            <SimulationBadge label="SIMULATED EVENTS" note="Deterministic mirror of UsageMeteringRegistry semantics (fail-closed caps, rollover, settlement). Live meter values above come from the deployed contract." />
          </h3>
          <button
            onClick={advanceSim}
            className="px-3 py-2 rounded-lg text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition cursor-pointer"
          >
            {simIdx >= SIM_EVENTS.length ? 'Reset feed' : `Emit next event → ${simIdx + 1}/${SIM_EVENTS.length}`}
          </button>
        </div>

        <div className="space-y-2">
          {SIM_EVENTS.map((e, i) => {
            const active = i < simIdx;
            return (
              <div
                key={e.t}
                className={`p-3 rounded-xl border transition-colors ${
                  active
                    ? e.kind === 'err'
                      ? 'border-rose-500/25 bg-rose-500/[0.04]'
                      : 'border-emerald-500/20 bg-emerald-500/[0.03]'
                    : 'border-white/[0.06] bg-slate-900/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {active ? (
                    e.kind === 'err' ? (
                      <TriangleAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    ) : (
                      <CircleCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    )
                  ) : (
                    <Loader2 className="w-4 h-4 text-white/25 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className={`text-[12px] font-bold ${e.kind === 'err' ? 'text-rose-300' : 'text-emerald-300'}`}>{e.t}</div>
                    <div className="mt-0.5 text-[11px] text-white/45 leading-snug">{e.d}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> metering audit feed
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {simLog.length === 0 && <div className="text-white/30">waiting for metering events…</div>}
            {simLog.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/25 select-none">›</span>
                <span className={l.includes('REFUSED') ? 'text-rose-400/90' : 'text-emerald-300/80'}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10px] text-white/35 leading-relaxed flex items-start gap-1.5">
          <Coins className="w-3 h-3 mt-0.5 text-emerald-400" />
          Principle: usage is provable and priced. Attested receipts move the meter; registered agents cover off-chain
          telemetry. No unit is counted twice, caps fail closed, and every dollar of debt is on-chain and payable. A prepaid
          balance is consumed FIRST, fail-closed — while credit exists a debit can never silently drift into debt.
        </p>
      </GlassCard>

      <GlassCard className="p-4 border-white/[0.08]">
        <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> honesty note
        </div>
        <div className="text-[11px] text-white/50 leading-relaxed font-mono">
          LIVE readings (meters, prepaid balance, debt) come from the deployed UsageMeteringRegistry v2 on Creditcoin
          testnet. The event feed is a deterministic mirror marked SIMULATED — no gas. Attested usage recording, prepaid
          top-ups and debt settlement execute against the deployed contract through a connected wallet.
        </div>
      </GlassCard>
    </div>
  );
};

export default MeterTrackingView;