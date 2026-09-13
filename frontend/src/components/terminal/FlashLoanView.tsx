import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  Info,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Terminal as TerminalIcon,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { ethers } from 'ethers';
import { useToast } from '../../context/ToastContext';
import { CREDITCOIN_BLOCKSCOUT, CREDITCOIN_RPC } from '../../config/contracts';
import { DEMO_WALLET_VAULT } from '../../config/demoWallets';
import {
  demoWalletSigner,
  executeFlashLoan,
  fetchFlashLoanLedger,
  fetchFlashLoanState,
  projectFlashRoundTrip,
  type FlashLoanLedgerEntry,
  type FlashLoanState,
} from '../../services/credXService';

const ROOT_WALLET = DEMO_WALLET_VAULT.find((w) => w.id === 'credx-root');
const DEMO_ACCOUNT = ROOT_WALLET?.address ?? '';

const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

const fmtAddr = (a: string): string => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—');

interface Receipt {
  status: 'ok' | 'reverted' | 'error';
  txHash: string;
  block: number;
  amount: number;
  fee: number;
  score: number;
  message: string;
}

interface Projection {
  amount: number;
  fee: number;
  feeBps: number;
  depinOut: number;
  cusdBack: number;
  net: number;
  profitable: boolean;
}

export const FlashLoanView: React.FC = () => {
  const { showToast } = useToast();

  const [state, setState] = useState<FlashLoanState | null>(null);
  const [ledger, setLedger] = useState<FlashLoanLedgerEntry[]>([]);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [liveBlock, setLiveBlock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('20000');
  const [mode, setMode] = useState<0 | 1>(0);
  const [executing, setExecuting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [showSpecs, setShowSpecs] = useState(false);
  const [copied, setCopied] = useState(false);

  const numAmount = parseFloat(amount) || 0;
  const capacity = state?.capacity ?? 0;
  const amountTooBig = numAmount > capacity && capacity > 0;
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, lg] = await Promise.all([
        fetchFlashLoanState(DEMO_ACCOUNT),
        fetchFlashLoanLedger(30),
      ]);
      setState(st);
      setLedger(lg);
    } catch (err: any) {
      setError(err?.message || 'Flash-loan RPC read failed');
    } finally {
      setLoading(false);
    }
  }, []);

  refreshRef.current = refresh;

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refreshRef.current(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Live block heartbeat (real RPC ping).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const p = new ethers.JsonRpcProvider(CREDITCOIN_RPC);
        setLiveBlock(Number(await p.getBlockNumber()));
      } catch {
        /* heartbeat best-effort */
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Live projection recomputed from the DEPLOYED receiver on every change.
  useEffect(() => {
    if (numAmount <= 0) {
      setProjection(null);
      return;
    }
    let alive = true;
    projectFlashRoundTrip(numAmount, DEMO_ACCOUNT)
      .then((p) => {
        if (!alive) return;
        setProjection({
          amount: numAmount,
          fee: p.fee,
          feeBps: state?.feeBps ?? 0,
          depinOut: p.depinOut,
          cusdBack: p.cusdBack,
          net: p.net,
          profitable: p.profitable,
        });
      })
      .catch(() => alive && setProjection(null));
    return () => {
      alive = false;
    };
  }, [numAmount, mode, state, state?.feeBps]);

  const handleExecute = async () => {
    if (numAmount <= 0) {
      showToast('Invalid Amount', 'Enter a positive borrow amount.', 'error');
      return;
    }
    if (amountTooBig) {
      showToast('Over Capacity', 'Requested amount exceeds the lender\u2019s live cUSD balance.', 'error');
      return;
    }
    if (!ROOT_WALLET) {
      showToast('Signer Missing', 'Demo wallet unavailable.', 'error');
      return;
    }
    setExecuting(true);
    setReceipt(null);
    const signer = demoWalletSigner(ROOT_WALLET.privateKey);
    try {
      const res = await executeFlashLoan(numAmount, mode, DEMO_ACCOUNT, signer);
      setReceipt({
        status: 'ok',
        txHash: res.txHash,
        block: res.block,
        amount: res.amount,
        fee: res.fee,
        score: res.score,
        message: mode === 0
          ? `Atomic audit carried: real FlashLoan event broadcast, principal + ${res.fee.toFixed(4)} cUSD fee repaid in one block.`
          : 'AMM round-trip executed and repaid atomically within the same block.',
      });
      showToast('Real Flash Loan Settled in 1 Block', `Borrowed ${fmtNum(res.amount)} cUSD on CC3 — real fee ${res.fee.toFixed(4)} cUSD (score ${res.score}, ${state?.feeBps ?? '?'} bps).`, 'success', 6000);
      refresh();
    } catch (err: any) {
      const reason = String(err?.shortMessage || err?.reason || err?.message || 'execution reverted');
      const isGuard = reason.toLowerCase().includes('noprofit') || reason.toLowerCase().includes('reverted');
      setReceipt({
        status: 'reverted',
        txHash: String(err?.transactionHash || ''),
        block: 0,
        amount: numAmount,
        fee: 0,
        score: 0,
        message: isGuard
          ? 'ATOMIC GUARD (mode 1): the exact live round-trip math nets below the flash fee, so the whole transaction reverted — nothing moved. This is the all-or-nothing property.'
          : reason,
      });
      showToast('Real Tx Reverted Atomically', isGuard ? 'Guard triggered — no fee-covering route on the live pool.' : reason, 'error', 7000);
    } finally {
      setExecuting(false);
      refresh();
    }
  };

  const copyTx = async (h: string) => {
    try {
      await navigator.clipboard.writeText(h);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const quickAmounts = ['5000', '10000', '25000', '50000', '100000'];
  const tierLabel =
    !state ? '—' : state.tier === 'SUPER_PRIME' ? 'Super-Prime' : state.tier === 'PRIME' ? 'Prime' : state.tier === 'NEAR_PRIME' ? 'Near-Prime' : 'Standard';
  const feePct = state ? (state.feeBps / 100).toFixed(2) : '—';

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* Honest LIVE banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3 text-[11px] leading-relaxed text-emerald-100/80">
        <span className="flex items-center gap-1.5 shrink-0 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[10px] font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
        </span>
        <span className="font-mono">
          Every execution below broadcasts a <strong className="text-white">real</strong> ERC-3156
          transaction to <span className="text-cyan-300">ReputationFlashLoan</span> on CC3 signed by the bundled demo
          wallet (score {state?.creditScore ?? '…'}, live fee {state ? state.feeBps : '…'} bps). Bid, fee, projection and
          the activity ledger are all read from the deployed contracts. Because CC3 runs a single
          constant-product AMM, a same-block round-trip cannot out-earn the flash fee — so "AMM Round-Trip" mode
          <strong className="text-white"> reverts atomically</strong> when unprofitable (that real revert is the demo).
        </span>
      </div>

      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#02131e] via-[#031c2d] to-[#010912] border border-cyan-500/25 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-mono text-[10px] font-bold tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                CREDX DEFI &bull; ERC-3156 FLASH LENDING
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-200 font-mono text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Zap className="w-7 h-7 text-cyan-400 fill-cyan-400/20" />
              0-Collateral Flash Loans
            </h2>
            <p className="text-xs lg:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Borrow real cUSD liquidity in a single block with zero upfront collateral. Settled atomically on
              Creditcoin Testnet via the deployed{' '}
              <button onClick={() => window.open(CREDITCOIN_BLOCKSCOUT + '/address/' + '0x4962e6AdF6E59C60058d09b7cA4516dD2410d637', '_blank')} className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 cursor-pointer font-mono">
                ReputationFlashLoan
              </button>{' '}
              — live fee {feePct}% ({state?.feeBps ?? '—'} bps) locked by the demo wallet&apos;s real credit tier.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right font-mono text-[11px] text-slate-400">
              <div>Block{' '}<span className="text-cyan-300 font-bold">{liveBlock || state?.currentBlock || '…'}</span></div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="inline-flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> CC3</span>
              </div>
            </div>
            <button onClick={() => { setShowSpecs(true); }} className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-slate-300 transition flex items-center gap-1.5 cursor-pointer">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>ERC-3156 Specs</span>
            </button>
          </div>
        </div>

        {/* Real KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-cyan-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Live Borrow Capacity</span>
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              {fmtNum(capacity, 0)} cUSD
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Lender cUSD balance {loading && <RefreshCw className="w-2.5 h-2.5 inline animate-spin" />}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-emerald-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Your Live Credit Fee</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              {feePct}% <span className="text-xs text-slate-400 font-normal">({state?.feeBps ?? '—'} bps)</span>
            </div>
            <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
              {tierLabel} &bull; score {state?.creditScore ?? '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-blue-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Atomicity</span>
              <Lock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              1 Block
            </div>
            <div className="text-[10px] font-mono text-blue-300 mt-0.5">
              All-or-nothing revert guard
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-amber-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Executor Sponsor Float</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono">
              {fmtNum(state?.float ?? 0, 0)} cUSD
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Covers the fee — borrower pays $0
            </div>
          </div>
        </div>
      </div>

      {/* How it works strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        {[
          { t: '1 · BORROW', d: 'flashLoan(receiver, amount, data) transfers real cUSD from the lender in-block.' },
          { t: '2 · CALLBACK', d: 'onFlashLoan(initiator, amount, fee, data) runs inside the same block; must return CALLBACK_SUCCESS.' },
          { t: '3 · STRATEGY', d: 'Audit & Return parks the liquidity; AMM Round-Trip executes a guarded swap loop.' },
          { t: '4 · REPAY', d: 'Principal + live fee pulled back by the lender — or the whole block reverts atomically.' },
        ].map((s) => (
          <div key={s.t} className="p-3.5 rounded-2xl bg-[#031520]/80 border border-white/[0.06]">
            <div className="text-[10px] font-mono text-cyan-300 font-bold mb-1">{s.t}</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">{s.d}</div>
          </div>
        ))}
      </div>

      {/* Borrow console + projection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 rounded-3xl p-6 bg-gradient-to-br from-[#031522] to-[#010a12] border border-blue-500/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Configure Real Execution
            </h4>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/15 px-3 py-1 rounded-full border border-cyan-500/30 font-bold">
              mode {mode === 0 ? '0 · Audit &amp; Return' : '1 · AMM Round-Trip'}
            </span>
          </div>

          {/* Mode selection */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <button
              onClick={() => setMode(0)}
              className={'py-2.5 px-3 rounded-2xl text-left transition cursor-pointer border ' + (mode === 0 ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-black/40 border-white/5 text-slate-400 hover:text-white')}
            >
              <div className="font-black">Audit &amp; Return</div>
              <div className="text-[10px] mt-0.5 opacity-80">Prove atomicity — always settles</div>
            </button>
            <button
              onClick={() => setMode(1)}
              className={'py-2.5 px-3 rounded-2xl text-left transition cursor-pointer border ' + (mode === 1 ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-black/40 border-white/5 text-slate-400 hover:text-white')}
            >
              <div className="font-black">AMM Round-Trip</div>
              <div className="text-[10px] mt-0.5 opacity-80">Guarded arb — reverts if not profitable</div>
            </button>
          </div>

          {/* Amount */}
          <div className="p-4 rounded-2xl bg-black/50 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Borrow Amount (cUSD)</span>
              <span>Capacity: <strong className={amountTooBig ? 'text-rose-400' : 'text-white'}>{fmtNum(capacity, 0)} cUSD</strong></span>
            </div>
            <div className="flex items-center justify-between gap-3 font-mono">
              <input
                type="number"
                value={amount}
                min={0}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="20000"
                className="w-full bg-transparent text-2xl font-bold text-blue-300 outline-none"
              />
              <span className="text-sm font-bold text-white bg-[#041a2a] px-3 py-1.5 rounded-xl border border-blue-500/30">cUSD</span>
            </div>
            {amountTooBig && (
              <div className="text-[11px] font-mono text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Exceeds the lender&apos;s live balance — capped at {fmtNum(capacity, 0)} cUSD.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-[10px]">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setAmount(amt); }}
                  className="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition cursor-pointer"
                >
                  {parseInt(amt, 10).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Live projection */}
          <div className="p-3 rounded-xl bg-[#031522] border border-cyan-500/20 font-mono text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Live Flash Fee ({state?.feeBps ?? '—'} bps):</span>
              <span className="text-white font-bold">{projection ? '-' + fmtNum(projection.fee, 4) : '—'} cUSD</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Projected cUSD → DEPIN:</span>
              <span className="text-cyan-300 font-bold">{projection ? fmtNum(projection.depinOut, 3) : '—'} DEPIN</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Projected DEPIN → cUSD:</span>
              <span className="text-cyan-300 font-bold">{projection ? fmtNum(projection.cusdBack, 3) : '—'} cUSD</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Round-Trip Net:</span>
              <span className={projection && projection.net >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {projection ? (projection.net >= 0 ? '+' : '') + fmtNum(projection.net, 3) : '—'} cUSD
              </span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-white/10 text-[11px]">
              <span className="text-slate-400">Projection Source:</span>
              <span className="text-slate-200">
                {projection ? (projection.cusdBack >= projection.amount + projection.fee ? 'PROFITABLE ROUTE' : 'NO PROFITABLE ROUTE') : '—'}
              </span>
            </div>
          </div>

          {/* Execute */}
          <button
            disabled={executing || loading || numAmount <= 0 || amountTooBig}
            onClick={handleExecute}
            className="w-full py-4 rounded-2xl font-bold font-mono text-sm bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-slate-950 shadow-xl shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {executing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Broadcasting real flashLoan() on CC3…</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Execute Real Flash Loan ({fmtNum(numAmount, 0)} cUSD)</span>
              </>
            )}
          </button>

          {mode === 1 && (
            <div className="text-[10px] font-mono text-slate-500 leading-relaxed -mt-1">
              Mode 1 executes the round-trip two legs only when the exact on-chain math nets ≥ the live fee — otherwise
              the transaction reverts atomically (NoProfit) and nothing moves. On this single AMM it will revert, which
              is the all-or-nothing safety property in action.
            </div>
          )}
        </div>

        {/* Receipt / console column */}
        <div className="lg:col-span-6 rounded-3xl p-6 bg-gradient-to-br from-[#02131d] to-[#01080e] border border-blue-500/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-cyan-400" />
              Execution Receipt &amp; Ledger
            </h4>
            <span className="text-xs font-mono text-slate-400">{ledger.length} real FlashLoan events</span>
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] font-mono text-rose-300">
              {error}
            </div>
          )}

          {!receipt && !error && (
            <div className="p-5 rounded-2xl bg-black/50 border border-white/[0.06] text-center text-[11px] font-mono text-slate-500">
              No execution yet this session — pick an amount and press Execute. Every result here comes from a real CC3
              transaction.
            </div>
          )}

          {receipt && (
            <div className={'p-4 rounded-2xl border font-mono text-[11px] space-y-2 ' + (receipt.status === 'ok' ? 'bg-emerald-500/[0.06] border-emerald-500/30' : 'bg-amber-500/[0.06] border-amber-500/30')}>
              <div className={'flex items-center gap-2 font-bold ' + (receipt.status === 'ok' ? 'text-emerald-300' : 'text-amber-300')}>
                {receipt.status === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {receipt.status === 'ok' ? 'SETTLED IN 1 BLOCK' : 'ATOMIC REVERT (nothing moved)'}
              </div>
              {receipt.block > 0 && <div className="text-slate-400">Block <span className="text-white font-bold">{receipt.block}</span></div>}
              {receipt.amount > 0 && <div className="text-slate-400">Amount <span className="text-white font-bold">{fmtNum(receipt.amount, 4)} cUSD</span></div>}
              {receipt.fee > 0 && <div className="text-slate-400">Live fee charged <span className="text-emerald-400 font-bold">{fmtNum(receipt.fee, 4)} cUSD</span> (credit score {receipt.score})</div>}
              {receipt.txHash ? (
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                  <span className="text-slate-500">tx</span>
                  <a href={CREDITCOIN_BLOCKSCOUT + '/tx/' + receipt.txHash} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 truncate cursor-pointer">
                    {receipt.txHash}
                  </a>
                  <button onClick={() => copyTx(receipt.txHash)} className="text-slate-400 hover:text-white transition cursor-pointer" title="Copy tx hash">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied && <span className="text-emerald-400 text-[9px]">copied</span>}
                </div>
              ) : (
                <div className="text-slate-500 pt-1 border-t border-white/10">tx hash unavailable from revert</div>
              )}
              <div className="text-slate-300 leading-relaxed pt-1">{receipt.message}</div>
            </div>
          )}

          {/* Activity ledger */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-wide">FlashLoan Activity (real events)</span>
            </div>
            {ledger.length === 0 ? (
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-center text-[11px] font-mono text-slate-500">
                Run an execution above to write the first FlashLoan event to the ledger.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-left font-mono text-[10.5px]">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 text-[10px]">
                      <th className="py-2 px-2.5 font-semibold">Block</th>
                      <th className="py-2 px-2.5 font-semibold">Amount</th>
                      <th className="py-2 px-2.5 font-semibold">Fee (real)</th>
                      <th className="py-2 px-2.5 font-semibold">Score</th>
                      <th className="py-2 px-2.5 font-semibold">Receiver</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ledger.map((e, i) => (
                      <tr key={e.txHash + i} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-2.5 text-slate-400">{e.block}</td>
                        <td className="py-2 px-2.5 text-white font-bold">{fmtNum(e.amount, 2)}</td>
                        <td className="py-2 px-2.5 text-emerald-400 font-bold">{fmtNum(e.fee, 4)}</td>
                        <td className="py-2 px-2.5 text-cyan-300">{e.score}</td>
                        <td className="py-2 px-2.5 text-slate-400">{fmtAddr(e.receiver)}</td>
                        <td className="py-2 px-2.5 text-right">
                          <a href={CREDITCOIN_BLOCKSCOUT + '/tx/' + e.txHash} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 cursor-pointer inline-flex items-center gap-1">
                            {fmtAddr(e.txHash)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer links */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500">
        <span className="mr-1">Deployed on Creditcoin Testnet (chainId 102031):</span>
        {[
          { label: 'ReputationFlashLoan', addr: '0x4962e6AdF6E59C60058d09b7cA4516dD2410d637' },
          { label: 'ReputationFlashBorrower', addr: state?.borrower ?? '0xb11342835BD710B77C7876AdcC37971d95bC4c57' },
          { label: 'ReputationAMM', addr: '0x81463b6bf1A8DD535c6DAeF034cAb6ee92434c32' },
        ].map((l) => (
          <a
            key={l.label}
            href={CREDITCOIN_BLOCKSCOUT + '/address/' + l.addr}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            {l.label} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>

      {/* ERC-3156 specs modal */}
      {showSpecs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#04121d] border border-cyan-500/30 rounded-3xl p-6 max-w-xl w-full space-y-4 font-mono shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                ERC-3156 Flash Loans — Deployed Implementation
              </h3>
              <button onClick={() => setShowSpecs(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <strong className="text-white">ReputationFlashLoan</strong> implements an ERC-3156-style lender on
                Creditcoin Testnet funded with real cUSD. Reputation tiers discount the flash fee: Super-Prime (≥780)
                1 bp, Prime (≥650) 5 bps, Standard 9 bps — the demo wallet currently reads{' '}
                <strong className="text-cyan-300">{state?.feeBps ?? '—'} bps</strong>.
              </p>

              <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20 space-y-1.5">
                <div className="text-cyan-300 font-bold">Lender surface</div>
                <div className="text-slate-400 text-[11px] break-all">
                  <code>flashLoan(address receiver, uint256 amount, bytes data)</code>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <code>CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan")</code>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Flow: transfer TOKEN → <code>onFlashLoan(initiator, amount, fee, data)</code> → transferFrom
                  principal + fee. (This implementation exposes no <code>maxFlashLoan</code>/<code>flashFee</code>{' '}
                  getters — live capacity is the lender&apos;s real cUSD balance.)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20 space-y-1.5">
                <div className="text-cyan-300 font-bold">Receiver (ReputationFlashBorrower)</div>
                <div className="text-slate-400 text-[11px]">
                  Holds a sponsor <strong className="text-slate-200">executor float</strong> that repays the fee, and a
                  max allowance so the lender always recovers principal + fee in-block.
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Audit &amp; Return:</strong> liquidity parked, projection recorded, principal + fee repaid — always succeeds.</li>
                  <li><strong className="text-slate-200">AMM Round-Trip:</strong> executes two legs only when the exact constant-product math nets ≥ the live fee; otherwise reverts atomically — nothing moves.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <div className="text-white font-bold">Key invariants:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Zero upfront collateral:</strong> no capital locked before borrowing; the borrower&apos;s own wallet is never charged.</li>
                  <li><strong className="text-slate-200">Single-block atomicity:</strong> if principal + fee is not repaid, the entire transaction reverts with 0 borrower loss.</li>
                  <li><strong className="text-slate-200">Real ledger:</strong> every broadcast emits the on-chain <code>FlashLoan</code> event shown in the Activity ledger.</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button onClick={() => setShowSpecs(false)} className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer">
                Close Specifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashLoanView;