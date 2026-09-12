import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  Vault,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  Lock,
  Unlock,
  FileWarning,
  Timer,
  Send,
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import {
  fetchEscrowState,
  fetchEscrowJobs,
  fetchCurrentBlock,
  escrowCreateEscrow,
  escrowRelease,
  escrowRefund,
  EscrowState,
  EscrowView,
} from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { ethers } from 'ethers';

const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';
const DEMO_SELLER = '0xE04Bb93a6a4Cb1a4C2b45a0d5E4E38D091fc2B5C';

const SIM_STEPS = [
  { title: 'Lock funds', desc: 'Depositor locks $1,500 cUSD against PO-CC3-2026-001 — released only on a verified cross-chain proof, else refundable after the deadline.', state: 'ESCROW LOCKED' },
  { title: 'Attested release', desc: 'A USC/Attestcoin receipt for the order is verified — escrow pays the committed seller $1,500, one receipt, one release (replay guard).', state: 'RELEASED' },
  { title: 'Replay attempt', desc: 'The SAME receipt is re-submitted against a second escrow → PROOF ALREADY USED. One attested transaction, one payment.', state: 'BLOCKED' },
  { title: 'Deadline expiry', desc: 'No proof arrives before the deadline → anyone can refund the depositor. Funds can never be locked forever.', state: 'REFUNDED' },
];

const StatusBadge: React.FC<{ status: EscrowView['status']; deadlineBlock: number; currentBlock: number }> = ({ status, deadlineBlock, currentBlock }) => {
  if (status === 'released') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono"><Unlock className="w-3 h-3" /> RELEASED</span>;
  }
  if (status === 'refunded') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/40 text-slate-300 text-[10px] font-mono"><Timer className="w-3 h-3" /> REFUNDED</span>;
  }
  const expired = currentBlock > deadlineBlock;
  return expired
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono"><TriangleAlert className="w-3 h-3" /> EXPIRED</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono"><Lock className="w-3 h-3" /> LOCKED</span>;
};

const VerifiedEscrowView: React.FC = () => {
  const { address, isConnected } = useWeb3();
  const [state, setState] = useState<EscrowState | null>(null);
  const [jobs, setJobs] = useState<EscrowView[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [simStep, setSimStep] = useState(0);
  const [simLog, setSimLog] = useState<string[]>([]);

  // new-escrow form
  const [seller, setSeller] = useState(DEMO_SELLER);
  const [orderRef, setOrderRef] = useState('PO-CC3-2026-002 buyer=acme corp purpose=RWA invoice settlement');
  const [amount, setAmount] = useState('2500');
  const [duration, setDuration] = useState('216000');

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, j, cb] = await Promise.all([fetchEscrowState(), fetchEscrowJobs(isConnected && address ? address : DEMO_ACCOUNT), fetchCurrentBlock()]);
      setState(st);
      setJobs(j);
      setCurrentBlock(cb);
      setSimLog((prev) => [
        `live: VerifiedEscrow @ ${CONTRACTS.verifiedEscrow.slice(0, 8)}… — ${st?.escrowCount ?? 0} escrow(s), ${st?.totalLockedUSD ?? 0} locked $ · block ${cb}`,
        ...prev,
      ].slice(0, 20));
    } catch (err: any) {
      setError(err?.message || 'Failed to read VerifiedEscrow');
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

  const onCreate = async () => {
    if (!isConnected) { setError('Connect a wallet to lock an escrow'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      const txHash = await escrowCreateEscrow(seller, orderRef, Number(amount), Number(duration));
      setLastTx(txHash);
      setSimLog((prev) => [`tx broadcast: createEscrow ($) → ${txHash.slice(0, 10)}…`, ...prev].slice(0, 20));
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      setError(err?.message || 'Escrow creation failed');
    } finally {
      setBusy(false);
    }
  };

  const onRelease = async (escrowId: number) => {
    if (!isConnected) { setError('Connect a wallet to release'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      const txHash = await escrowRelease(escrowId);
      setLastTx(txHash);
      setSimLog((prev) => [`tx broadcast: release(#${escrowId}) w/ pinned attestation → ${txHash.slice(0, 10)}…`, ...prev].slice(0, 20));
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      setError(err?.message || `Release #${escrowId} failed`);
    } finally {
      setBusy(false);
    }
  };

  const onRefund = async (escrowId: number) => {
    if (!isConnected) { setError('Connect a wallet to refund'); return; }
    setBusy(true); setError(null); setLastTx(null);
    try {
      const txHash = await escrowRefund(escrowId);
      setLastTx(txHash);
      setSimLog((prev) => [`tx broadcast: refundAfterDeadline(#${escrowId}) → ${txHash.slice(0, 10)}…`, ...prev].slice(0, 20));
      await new Promise((r) => setTimeout(r, 1500));
      await loadLive();
    } catch (err: any) {
      setError(err?.message || `Refund #${escrowId} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-amber-500/25 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Vault className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Verified Settlement Escrow
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-normal">
                LIVE ON-CHAIN
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Condition-locked escrow that pays the committed seller ONLY when an attested cross-chain proof verifies.
              One receipt, one release (replay guard); before the deadline the funds are unreleasable without proof, after
              it anyone can refund the depositor — funds can never be stuck. Deployed at{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.verifiedEscrow}#code`} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-mono">
                VerifiedEscrow
              </a>{' '}
              on Creditcoin testnet. Verifier:{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${state?.verifier || CONTRACTS.attestationVerifier}#code`} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-mono">
                {(state?.verifier || CONTRACTS.attestationVerifier).slice(0, 10)}…
              </a>
            </p>
          </div>
        </div>

        {/* Live telemetry */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Escrows</span>
              <button onClick={loadLive} disabled={loading} className="text-white/40 hover:text-amber-400 transition cursor-pointer" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-white">{state?.escrowCount ?? '…'}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Locked (cUSD)</div>
            <div className="mt-1 text-xl font-black font-mono text-amber-300">${(state?.totalLockedUSD ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Live Block</div>
            <div className="mt-1 text-xl font-black font-mono text-white">{currentBlock.toLocaleString()}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Release Policy</div>
            <div className="mt-1"><span className="text-[11px] font-bold font-mono text-emerald-300">PROOF-GATED</span></div>
          </div>
        </div>
        {error && <div className="mt-2 text-[11px] text-rose-400 font-mono">{error}</div>}
        {lastTx && (
          <div className="mt-2 text-[11px] font-mono text-emerald-300">
            ✓ tx <a href={`${CREDITCOIN_BLOCKSCOUT}/tx/${lastTx}`} target="_blank" rel="noreferrer" className="hover:underline">{lastTx.slice(0, 18)}…</a>
          </div>
        )}

        {/* Escrow jobs */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> escrow jobs — read live from the deployed vault
          </div>
          {jobs.length === 0 ? (
            <div className="text-[11px] text-white/35 font-mono">
              {loading ? <Loader2 className="w-4 h-4 inline animate-spin mr-1.5" /> : null}
              no escrows yet — lock a settlement below.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.escrowId} className="p-3 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-white flex items-center gap-2">
                        Escrow #{j.escrowId}
                        <StatusBadge status={j.status} deadlineBlock={j.deadlineBlock} currentBlock={currentBlock} />
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-white/45">
                        seller {j.seller.slice(0, 10)}… · order {j.orderRef} · ${j.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} · deadline @ {j.deadlineBlock.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {j.status === 'active' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => onRelease(Number(j.escrowId))}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition cursor-pointer disabled:opacity-40"
                          >
                            Release w/ proof
                          </button>
                          {currentBlock > j.deadlineBlock && (
                            <button
                              disabled={busy}
                              onClick={() => onRefund(Number(j.escrowId))}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition cursor-pointer disabled:opacity-40"
                            >
                              Refund (expired)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New escrow */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-3 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> lock a new settlement (signed tx on Creditcoin testnet)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="seller address" className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/[0.08] text-[11px] font-mono text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40" />
            <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="order ref (e.g. PO-xxx)" className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/[0.08] text-[11px] font-mono text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" placeholder="$ amount" className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/[0.08] text-[11px] font-mono text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40" />
            <input value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="1" placeholder="deadline blocks" className="px-3 py-2 rounded-lg bg-slate-950/60 border border-white/[0.08] text-[11px] font-mono text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40" />
            <button
              disabled={busy || !isConnected}
              onClick={onCreate}
              className="px-3 py-2 rounded-lg text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition cursor-pointer disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" /> : null}
              Lock escrow
            </button>
          </div>
          {!isConnected && <div className="mt-2 text-[10px] text-white/35 font-mono">connect a wallet to sign escrow transactions (demo wallet 0x9afB… has cUSD).</div>}
        </div>
      </GlassCard>

      {/* Simulated escrow lifecycle feed */}
      <GlassCard className="p-6 border-white/[0.08]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Vault className="w-4 h-4 text-amber-400" /> Escrow Lifecycle Feed
            <SimulationBadge label="SIMULATED EVENTS" note="Deterministic mirror of VerifiedEscrow semantics (proof-gated release, replay guard, deadline refund). Escrow rows above come from the deployed vault." />
          </h3>
          <button
            onClick={advanceSim}
            className="px-3 py-2 rounded-lg text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition cursor-pointer"
          >
            {simStep >= SIM_STEPS.length ? 'Reset feed' : `Emit next event → ${simStep + 1}/${SIM_STEPS.length}`}
          </button>
        </div>

        <div className="space-y-2">
          {SIM_STEPS.map((e, i) => {
            const active = i < simStep;
            return (
              <div
                key={e.title}
                className={`p-3 rounded-xl border transition-colors ${
                  active
                    ? e.title.startsWith('Replay')
                      ? 'border-rose-500/25 bg-rose-500/[0.04]'
                      : 'border-amber-500/20 bg-amber-500/[0.03]'
                    : 'border-white/[0.06] bg-slate-900/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {active ? (
                    e.title.startsWith('Replay') ? (
                      <TriangleAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    ) : (
                      <CircleCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    )
                  ) : (
                    <Loader2 className="w-4 h-4 text-white/25 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className={`text-[12px] font-bold ${e.title.startsWith('Replay') ? 'text-rose-300' : 'text-amber-300'}`}>{e.title}</div>
                    <div className="mt-0.5 text-[11px] text-white/45 leading-snug">{e.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> escrow audit feed
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {simLog.length === 0 && <div className="text-white/30">waiting for escrow events…</div>}
            {simLog.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/25 select-none">›</span>
                <span className={l.includes('BLOCKED') ? 'text-rose-400/90' : 'text-amber-300/80'}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10px] text-white/35 leading-relaxed flex items-start gap-1.5">
          <ShieldCheck className="w-3 h-3 mt-0.5 text-amber-400" />
          Principle: pay only when proven. The attested receipt is the key — before the deadline not even the owner can
          move the funds without a verified proof, and the same receipt can never be spent twice across escrows.
        </p>
      </GlassCard>
    </div>
  );
};

export default VerifiedEscrowView;