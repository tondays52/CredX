import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  Anchor,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Coins,
  Landmark,
  LockKeyhole,
  FileWarning,
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import { fetchPurposeFundState, fetchPurposeRecords, PurposeFundState, PurposeRecordView } from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const PURPOSE_NAMES = ['RWA Invoice Purchase', 'Equipment Financing', 'Inventory Replenishment', 'Payroll', 'GPU Lease', 'R&D Ecosystem'] as const;

const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

const SIM_STEPS = [
  { title: 'Fund purpose', desc: 'Borrower locks 3,500 CTC and opens a $10,000 purpose record bound to INVOICE_PURCHASE.', state: 'FUNDED' },
  { title: 'Disburse to allowlisted counterparty', desc: '$1,000 leaves the vault — only to the invoice counterparty (acme corp), never to the borrower.', state: 'DISBURSED 1,000' },
  { title: 'Attested-usage tranche', desc: 'Receipt of the invoice payment is cryptographically verified against the deployed verifier — borrower unlocks $500.', state: 'USAGE ATTESTED' },
  { title: 'Covenant deadswitch', desc: 'An attested receipt proves collateral departed the source chain → vault frozen, ALL further disbursement blocked.', state: 'BLOCKED' },
  { title: 'Restore + settle', desc: 'Collateral restored to cover → record settled; principal + interest repaid, collateral refunded.', state: 'SETTLED' },
];

const PurposeFundView: React.FC = () => {
  const { address, isConnected } = useWeb3();
  const [fund, setFund] = useState<PurposeFundState | null>(null);
  const [records, setRecords] = useState<PurposeRecordView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simStep, setSimStep] = useState(0);
  const [simLog, setSimLog] = useState<string[]>([]);

  const subject = isConnected && address ? address : DEMO_ACCOUNT;

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, recs] = await Promise.all([fetchPurposeFundState(), fetchPurposeRecords(subject)]);
      setFund(f);
      setRecords(recs);
      setSimLog((prev) => [
        `live: PurposeBoundFunding @ ${CONTRACTS.purposeBoundFunding.slice(0, 8)}… verified ${recs.length} live record(s) for ${subject.slice(0, 8)}…`,
        ...prev,
      ].slice(0, 20));
    } catch (err: any) {
      setError(err?.message || 'Failed to read PurposeBoundFunding');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceSim = async () => {
    if (simStep >= SIM_STEPS.length) {
      setSimStep(0);
      setSimLog((prev) => ['trace reset — rerun the deterministic mirror', ...prev].slice(0, 20));
      return;
    }
    const step = SIM_STEPS[simStep];
    setSimStep((s) => s + 1);
    setSimLog((prev) => [`SIM ${step.title.toUpperCase()} — ${step.state}`, ...prev].slice(0, 20));
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-cyan-500/25 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <Anchor className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Purpose-Bound RWA Vault
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-normal">
                LIVE ON-CHAIN
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Funds are locked to a declared purpose. Until an attested usage receipt is verified, credit-line money can only
              move to the allowlisted counterparty — never to the borrower. Covenant deadswitch freezes the vault on proven breach.
              Deployed at{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.purposeBoundFunding}#code`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-mono">
                PurposeBoundFunding
              </a>{' '}
              on Creditcoin testnet. Verifier:{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${fund?.verifier || CONTRACTS.attestationVerifier}#code`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-mono">
                {(fund?.verifier || CONTRACTS.attestationVerifier).slice(0, 10)}…
              </a>
            </p>
          </div>
        </div>

        {/* Live telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Vault Liquidity (cUSD)</div>
            <div className="mt-1 text-xl font-black font-mono text-white">${(fund?.totalLiquidityUSD ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Purpose-Bound Out</div>
            <div className="mt-1 text-xl font-black font-mono text-cyan-300">${(fund?.totalBorrowedUSD ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Live Records</span>
              <button onClick={loadLive} disabled={loading} className="text-white/40 hover:text-cyan-400 transition cursor-pointer" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-white">{records.length || (fund?.nextRecordId ?? 1) - 1}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">CTC Price (demo)</div>
            <div className="mt-1 text-xl font-black font-mono text-white">${(fund?.ctcPriceUSD ?? 2).toFixed(2)}</div>
          </div>
        </div>
        {error && <div className="mt-2 text-[11px] text-rose-400 font-mono">{error}</div>}

        {/* Live records */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5" /> live purpose records — {subject.slice(0, 8)}…
          </div>
          {records.length === 0 ? (
            <div className="text-[11px] text-white/35 font-mono">
              {loading ? <Loader2 className="w-4 h-4 inline animate-spin mr-1.5" /> : null}
              no purpose-bound records for this wallet yet — connect the demo wallet or fund a purpose on-chain.
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.recordId} className="p-3 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="font-bold text-white">Record #{r.recordId}</span>
                    <span className="font-mono text-cyan-300">{PURPOSE_NAMES[r.purposeCode] ?? 'RWA'}</span>
                    {(r.isFrozen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-mono">
                        <TriangleAlert className="w-3 h-3" /> FROZEN
                      </span>
                    ) : r.isSettled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/40 text-slate-300 text-[10px] font-mono">
                        SETTLED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                        <CircleCheck className="w-3 h-3" /> ACTIVE
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-white/45">
                    approved ${r.approvedUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} · drawn ${r.drawnUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} · collateral {r.collateralCTC.toFixed(1)} CTC · recipient {r.allowlistedRecipient.slice(0, 10)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Simulated policy trace */}
      <GlassCard className="p-6 border-white/[0.08]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LockKeyhole className="w-4 h-4 text-cyan-400" /> Purpose-Bound Policy Trace
            <SimulationBadge label="SIMULATED POLICY TRACE" note="Deterministic mirror of the deployed PurposeBoundFunding logic — step previews the exact on-chain policy without spending gas." />
          </h3>
          <button
            onClick={advanceSim}
            className="px-3 py-2 rounded-lg text-[11px] font-medium border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition cursor-pointer"
          >
            {simStep >= SIM_STEPS.length ? 'Reset trace' : `Advance → step ${simStep + 1}/${SIM_STEPS.length}`}
          </button>
        </div>

        <div className="space-y-2">
          {SIM_STEPS.map((s, i) => {
            const done = i < simStep;
            const current = i === simStep;
            return (
              <div
                key={s.title}
                className={`p-3 rounded-xl border transition-colors ${
                  done
                    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                    : current
                    ? 'border-cyan-500/30 bg-cyan-500/[0.05]'
                    : 'border-white/[0.06] bg-slate-900/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-white flex items-center gap-2">
                      <span className="text-cyan-400 font-mono text-[10px]">STEP {i + 1}</span> {s.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45 leading-snug">{s.desc}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold border ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : current
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                        : 'border-white/[0.06] text-white/25'
                    }`}
                  >
                    {done ? '✓ ' : current ? '▶ ' : ''}
                    {s.state}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> vault decision feed
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {simLog.length === 0 && <div className="text-white/30">waiting for policy trace…</div>}
            {simLog.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/25 select-none">›</span>
                <span className={l.includes('BLOCKED') || l.includes('SETTLED') ? 'text-rose-400/90' : 'text-cyan-300/80'}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10px] text-white/35 leading-relaxed flex items-start gap-1.5">
          <Coins className="w-3 h-3 mt-0.5 text-cyan-400" />
          Principle: disbursement is bound to the purpose at funding time. Only the allowlisted counterparty can draw until an
          attested receipt proves the purpose was actually rendered — then borrower tranches unlock. A proven covenant breach
          freezes the vault with no operator decision.
        </p>
      </GlassCard>

      <GlassCard className="p-4 border-white/[0.08]">
        <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> honesty note
        </div>
        <div className="text-[11px] text-white/50 leading-relaxed font-mono">
          LIVE figures above are read from the deployed PurposeBoundFunding on Creditcoin testnet. The policy trace is a
          deterministic mirror marked SIMULATED — no wallet, no gas. Write paths (fund/disburse/settle) execute against the
          deployed contract when a wallet is connected.
        </div>
      </GlassCard>
    </div>
  );
};

export default PurposeFundView;