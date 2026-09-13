import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  ExternalLink,
  Flame,
  Info,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { DEMO_WALLET_VAULT } from '../../config/demoWallets';
import {
  demoWalletSigner,
  executeApplyFunding,
  executeClosePerp,
  executeOpenPerp,
  executePerpMargin,
  fetchPerpLedger,
  fetchPerpMarket,
  fetchPerpPositions,
  projectPerpPosition,
  type PerpLedgerEntry,
  type PerpMarketState,
  type PerpPosition,
} from '../../services/credXService';

const ROOT_WALLET = DEMO_WALLET_VAULT.find((w) => w.id === 'credx-root');

const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

const fmtAddr = (a: string): string => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—');

const fmtTime = (ts: number): string => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-US', { hour12: false }) + ' · ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const LEVERAGES = [1, 2, 3, 5, 10];

/** Illustrative candles anchored to the live mark (honestly labeled in the UI). */
function buildCandles(mark: number, seed: number): { t: string; o: number; h: number; l: number; c: number }[] {
  const out: { t: string; o: number; h: number; l: number; c: number }[] = [];
  let x = seed | 0;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
  let price = mark * (1 - 0.012);
  for (let i = 0; i < 36; i++) {
    const o = price;
    const drift = (rnd() - 0.48) * 0.004;
    const c = o * (1 + drift);
    const h = Math.max(o, c) * (1 + rnd() * 0.002);
    const l = Math.min(o, c) * (1 - rnd() * 0.002);
    out.push({ t: `${8 + (i % 12)}:${String((i * 5) % 60).padStart(2, '0')}`, o, h, l, c });
    price = c;
  }
  // snap the final candle to the live mark
  const last = out[out.length - 1];
  last.c = mark;
  last.h = Math.max(last.h, mark);
  last.l = Math.min(last.l, mark);
  return out;
}

export const PerpsTerminal: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore } = useProtocol();

  const [state, setState] = useState<PerpMarketState | null>(null);
  const [positions, setPositions] = useState<PerpPosition[]>([]);
  const [ledger, setLedger] = useState<PerpLedgerEntry[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState<number>(5);
  const [collateral, setCollateral] = useState<string>('200');
  const [executing, setExecuting] = useState(false);
  const [marginTopUp, setMarginTopUp] = useState<Record<string, string>>({});
  const [busyClose, setBusyClose] = useState<string | null>(null);
  const [busyMargin, setBusyMargin] = useState<string | null>(null);
  const [busyFunding, setBusyFunding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);

  const root = ROOT_WALLET;

  const refresh = useCallback(async () => {
    if (!root) return;
    const [m, p, l] = await Promise.all([fetchPerpMarket(root.address), fetchPerpPositions(root.address), fetchPerpLedger(24)]);
    setState(m);
    setPositions(p);
    setLedger(l);
  }, [root]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => setRefreshTick((t) => t + 1), 14000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (refreshTick > 0) refresh();
  }, [refreshTick, refresh]);

  const candles = useMemo(() => buildCandles(state?.mark ?? 0.09, state?.currentBlock ?? 7), [state?.mark, state?.currentBlock]);

  const markNow = state?.mark ?? 0;
  const nextFundingBlock = state?.nextFundingBlock ?? 0;
  const blocksUntilFunding = Math.max(0, nextFundingBlock - (state?.currentBlock ?? 0));
  const fundingDue = state != null && state.currentBlock >= state.nextFundingBlock;

  const collateralNum = parseFloat(collateral) || 0;
  const projection = useMemo(
    () => (state && collateralNum > 0 ? projectPerpPosition(side, collateralNum, leverage, state.mark, state.feeBps) : null),
    [state, side, leverage, collateralNum]
  );
  const overCap = projection != null && projection.notional > (state?.maxPositionNotional ?? 0);
  const exposureCap = state != null && (side === 'LONG' ? state.longNotional + (projection?.notional ?? 0) : state.shortNotional + (projection?.notional ?? 0)) > (state?.maxTotalNotional ?? 0);

  const copyTx = async (h: string) => {
    try {
      await navigator.clipboard.writeText(h);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleOpen = async () => {
    if (!root || !state || collateralNum <= 0 || overCap || exposureCap) {
      showToast('Invalid Position', 'Check the collateral, leverage and exposure caps.', 'error');
      return;
    }
    setExecuting(true);
    try {
      const res = await executeOpenPerp(side, collateralNum, leverage, demoWalletSigner(root.privateKey));
      playSound('success');
      showToast('Real Perp Position Opened', `${side} ${fmtNum(res.notional, 0)} cUSD on-chain (mark ${fmtNum(state.mark, 6)}).`, 'success');
      boostScore(30, 'Perpetual Position Opened');
      await refresh();
    } catch (err: any) {
      playSound('ping');
      showToast('Open Reverted', String(err?.shortMessage || err?.reason || err?.message || 'execution reverted'), 'error', 7000);
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = async (p: PerpPosition) => {
    setBusyClose(p.id);
    try {
      const res = await executeClosePerp(p.id, demoWalletSigner(root?.privateKey ?? ''));
      playSound('success');
      showToast('Position Closed Realized On-Chain', `Payout ${fmtNum(res.payout, 4)} cUSD (tx ${res.txHash.slice(0, 14)}…).`, 'success');
      boostScore(20, 'Perpetual Position Closed');
      await refresh();
    } catch (err: any) {
      playSound('ping');
      showToast('Close Reverted', String(err?.shortMessage || err?.reason || err?.message || 'execution reverted'), 'error', 7000);
    } finally {
      setBusyClose(null);
    }
  };

  const handleMargin = async (p: PerpPosition, deposit: boolean) => {
    const amt = parseFloat(marginTopUp[p.id] || '');
    if (!amt || amt <= 0 || !root) return;
    setBusyMargin(p.id);
    try {
      const res = await executePerpMargin(p.id, amt, deposit, demoWalletSigner(root.privateKey));
      playSound('success');
      showToast('Margin Updated On-Chain', `${deposit ? 'Added' : 'Removed'} ${fmtNum(amt, 2)} cUSD margin (tx ${res.txHash.slice(0, 14)}…).`, 'success');
      await refresh();
    } catch (err: any) {
      playSound('ping');
      showToast('Margin Updated Failed', String(err?.shortMessage || err?.reason || err?.message || 'execution reverted'), 'error', 7000);
    } finally {
      setBusyMargin(null);
    }
  };

  const handleFunding = async () => {
    if (!root) return;
    setBusyFunding(true);
    try {
      const res = await executeApplyFunding(demoWalletSigner(root.privateKey));
      playSound('success');
      showToast('Funding Applied On-Chain', `1 bps LONG→SHORT accrued to the accumulator (next epoch in ${state?.fundingEpochBlocks ?? 3600} blocks).`, 'success');
      await refresh();
    } catch (err: any) {
      playSound('ping');
      showToast('Funding Not Yet Due', String(err?.shortMessage || err?.reason || err?.message || 'execution reverted'), 'error', 7000);
    } finally {
      setBusyFunding(false);
    }
  };

  if (!root) return <div className="text-xs text-slate-500 font-mono p-4">Perps demo wallet unavailable.</div>;

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* ── LIVE banner ── */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3 text-[11px] leading-relaxed text-emerald-100/80">
        <span className="flex items-center gap-1.5 shrink-0 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-mono text-[10px] font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
        </span>
        <span className="font-mono">
          <strong className="text-white">DEPIN/USD</strong> perpetual futures run on the deployed{' '}
          <strong className="text-white">ReputationPerpetual</strong> engine. The mark price is the{' '}
          <strong className="text-white">live single-venue AMM pool spot</strong> (quote/base = {fmtNum(state?.reserveQuote, 2)} cUSD / {fmtNum(state?.reserveBase, 2)} DEPIN). The protocol is the
          counterparty of record — an insurance pool (sponsor float) settles every open/close/funding.
        </span>
      </div>

      {/* ── Market header ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="col-span-2 p-4 rounded-2xl bg-black/40 border border-white/10">
          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
            <TerminalIcon className="w-3 h-3 text-cyan-400" /> PERP · DEPIN/USD · {state ? `#${state.currentBlock}` : '…'}
          </div>
          <div className="flex items-end gap-3 mt-2">
            <span className="text-3xl font-black text-white tracking-tight">{markNow.toFixed(6)}</span>
            <span className="text-[11px] font-mono text-slate-400 pb-1">cUSD / DEPIN</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/20 text-cyan-300">LIVE MARK</span>
            <span className="text-slate-400">reserve0/reserve1 (pool spot)</span>
          </div>
        </div>
        {[
          { label: 'Credit Fee (bps)', value: `${state?.feeBps ?? '—'}` },
          { label: 'Max Leverage', value: `${state?.maxLeverage ?? '—'}×` },
          { label: 'Maintenance', value: `${((state?.maintenanceBps ?? 0) / 100).toFixed(2)}%` },
          { label: 'Open Positions', value: `${state?.openCount ?? '—'}` },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col justify-between">
            <div className="text-[10px] font-mono text-slate-400">{k.label}</div>
            <div className="text-xl font-black text-white mt-1">{k.value}</div>
          </div>
        ))}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col justify-between">
          <div className="text-[10px] font-mono text-slate-400">Insurance Pool</div>
          <div className="text-xl font-black text-cyan-300 mt-1">{state ? fmtNum(state.insurancePool, 0) : '—'}</div>
          <div className="text-[9px] font-mono text-slate-500">cUSD (counterparty of record)</div>
        </div>
      </div>

      {/* ── Funding bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-mono">
        <Flame className={`w-4 h-4 ${fundingDue ? 'text-amber-400' : 'text-cyan-400'}`} />
        <span className="text-slate-400">Funding: <strong className="text-white">{state?.fundingRateBps ?? '—'} bps/epoch</strong></span>
        <span className="text-slate-400">LONGs pay SHORTs; settled against the insurance pool</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">Next epoch in <strong className={fundingDue ? 'text-emerald-400' : 'text-white'}>{blocksUntilFunding.toLocaleString()} blocks</strong></span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">acc <strong className="text-white">{state?.fundingAcc.toFixed(6) ?? '—'}</strong></span>
        <button
          onClick={handleFunding}
          disabled={busyFunding || !fundingDue}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 font-bold hover:bg-amber-500/25 disabled:opacity-40 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busyFunding ? 'animate-spin' : ''}`} />
          {fundingDue ? 'Apply Funding (any keeper)' : busyFunding ? 'Applying…' : 'Epoch not due'}
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* ── Trade ticket ── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Open Real Position</h3>
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> margin in cUSD
              </span>
            </div>

            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('LONG')}
                className={`py-2.5 rounded-xl text-xs font-black transition-all border ${side === 'LONG' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-emerald-500/15'}`}
              >
                LONG <ArrowUpRight className="inline w-3.5 h-3.5 ml-0.5" />
              </button>
              <button
                onClick={() => setSide('SHORT')}
                className={`py-2.5 rounded-xl text-xs font-black transition-all border ${side === 'SHORT' ? 'bg-rose-500 text-slate-950 border-rose-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-rose-500/15'}`}
              >
                SHORT <ArrowDownRight className="inline w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {/* Leverage */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Leverage</span>
                <span className="text-cyan-300 font-bold">{leverage}×</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {LEVERAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLeverage(l)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold font-mono border transition-all ${leverage === l ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-cyan-500/15'}`}
                  >
                    {l}×
                  </button>
                ))}
              </div>
            </div>

            {/* Collateral */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400">Collateral (cUSD)</label>
              <input
                type="number"
                min={0}
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-cyan-500/50"
              />
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                {[100, 200, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setCollateral(String(v))}
                    className="py-1 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/10 text-slate-300 hover:text-white transition"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Projection */}
            <div className="p-3 rounded-xl bg-black/60 border border-white/5 space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Notional</span>
                <span className="text-white font-bold">{projection ? `${fmtNum(projection.notional, 2)} cUSD` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Open fee ({state?.feeBps ?? '—'} bps, credit tier)</span>
                <span className="text-amber-300 font-bold">-{projection ? fmtNum(projection.fee, 4) : '—'} cUSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collateral after fee</span>
                <span className="text-white font-bold">{projection ? fmtNum(projection.collateralAfterFee, 2) : '—'} cUSD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Est. liquidation price</span>
                <span className="text-rose-300 font-bold">{projection ? projection.liqPriceApprox.toFixed(6) : '—'}</span>
              </div>
              {overCap && <div className="text-[10px] text-rose-400">Exceeds max position notional ({fmtNum(state?.maxPositionNotional, 0)} cUSD).</div>}
              {exposureCap && <div className="text-[10px] text-rose-400">Exceeds side exposure cap ({fmtNum(state?.maxTotalNotional, 0)} cUSD).</div>}
            </div>

            <button
              onClick={handleOpen}
              disabled={executing || !state || collateralNum <= 0 || overCap || exposureCap}
              className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all shadow-lg disabled:opacity-40 ${side === 'LONG' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-emerald-500/20' : 'bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 shadow-rose-500/20'}`}
            >
              {executing ? 'Broadcasting Real Position…' : `Open ${side} ${leverage}× — ${projection ? fmtNum(projection.notional, 0) : 0} cUSD`}
            </button>
            <p className="text-[10px] leading-relaxed text-slate-500 font-mono">
              Executes with the demo-root wallet (testnet key). Real broadcasts cost CTC gas; the open fee + all PnL settle in the deployed insurance pool.
            </p>
          </div>

          {/* ── Spec card ── */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2 text-[11px] font-mono">
            <button onClick={() => setShowSpecs((s) => !s)} className="w-full flex justify-between items-center text-slate-300 hover:text-white">
              <span className="font-bold text-xs flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-cyan-400" /> Engine mechanics</span>
              <span>{showSpecs ? '−' : '+'}</span>
            </button>
            {showSpecs && (
              <div className="space-y-1.5 text-slate-400 text-[10px] leading-relaxed pt-1 border-t border-white/5">
                <p><span className="text-slate-200">Mark:</span> live AMM spot (reserve0/reserve1) — the only priced venue on CC3; there is no cross-venue oracle to consult.</p>
                <p><span className="text-slate-200">Margin:</span> isolated cUSD collateral pulled into the engine; notional = collateral × leverage.</p>
                <p><span className="text-slate-200">Funding:</span> every epoch (owner-set blocks) LONGs pay SHORTs an owner-set bps; the insurance pool settles the imbalance.</p>
                <p><span className="text-slate-200">Liquidations:</span> when equity falls below {((state?.maintenanceBps ?? 65) / 100).toFixed(2)}% of notional any keeper can liquidate for up to {((state?.liquidationBonusBps ?? 5) / 100).toFixed(2)}% of notional.</p>
                <p><span className="text-slate-200">Fee:</span> tiered by the trader’s real credit score — {fmtNum(state?.feeBps ?? 0)} bps here because the demo root is PRIME.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: chart + positions ── */}
        <div className="lg:col-span-3 space-y-5">
          {/* Chart */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-left">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">DEPIN/USD · Live Mark</h3>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">illustrative candles anchored to the on-chain mark — only the last point is real</p>
              </div>
              <div className="text-right font-mono">
                <div className="text-lg font-black text-cyan-300">{markNow.toFixed(6)}</div>
                <div className="text-[10px] text-slate-500">{state ? `sync @ block ${state.currentBlock}` : '…'}</div>
              </div>
            </div>
            <div className="flex items-end gap-[2px] h-32">
              {candles.map((c, i) => {
                const hi = Math.max(...candles.map((x) => x.h));
                const lo = Math.min(...candles.map((x) => x.l));
                const rng = hi - lo || 1;
                const h = ((c.h - lo) / rng) * 100;
                const l = ((c.l - lo) / rng) * 100;
                const o = ((c.o - lo) / rng) * 100;
                const cl = ((c.c - lo) / rng) * 100;
                const up = c.c >= c.o;
                const color = up ? '#34d399' : '#fb7185';
                const bodyTop = Math.min(o, cl);
                const bodyH = Math.max(0.8, Math.abs(cl - o));
                return (
                  <div key={i} className="relative w-full h-full">
                    <div className="absolute left-1/2 w-[1px] bg-slate-700" style={{ bottom: `${l}%`, height: `${h - l}%` }} />
                    <div className="absolute left-1/2 -translate-x-1/2 w-[70%] rounded-sm" style={{ bottom: `${bodyTop}%`, height: `${bodyH}%`, background: color }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-1">
              <span>{candles[0]?.t}</span><span>{candles[Math.floor(candles.length / 2)]?.t}</span><span>{candles[candles.length - 1]?.t}</span>
            </div>
          </div>

          {/* Positions */}
          <div className="rounded-2xl border border-white/10 bg-black/40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" /> POOL POSITIONS <span className="text-cyan-300">(demo root)</span>
              </h3>
              <button onClick={refresh} className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-white transition">
                <RefreshCw className={`w-3 h-3 ${refreshTick % 2 ? '' : ''}`} /> refresh
              </button>
            </div>
            {positions.length === 0 ? (
              <div className="p-6 text-center text-[11px] font-mono text-slate-500">
                No open positions for the demo wallet. Open a LONG or SHORT above — every entry is a real broadcast.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {positions.map((p) => {
                  const pnl = p.unrealizedPnl + p.fundingDelta;
                  const pnlPct = p.collateral > 0 ? (pnl / p.collateral) * 100 : 0;
                  const up = pnl >= 0;
                  return (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${p.side === 'LONG' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30' : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'}`}>
                          {p.side === 'LONG' ? '▲ LONG' : '▼ SHORT'} #{p.id}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          opened {fmtTime(p.openedAtBlock)} · block {p.openedAtBlock.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
                        <div>
                          <div className="text-[9px] text-slate-500">NOTIONAL</div>
                          <div className="text-white font-bold">{fmtNum(p.notional, 2)} cUSD</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500">MARGIN</div>
                          <div className="text-white font-bold">{fmtNum(p.collateral, 2)} cUSD</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500">ENTRY → NOW</div>
                          <div className="text-slate-300 font-bold">{p.entryMark.toFixed(6)} → <span className="text-cyan-300">{p.markNow.toFixed(6)}</span></div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-500">MARGIN RATIO</div>
                          <div className={p.liquidatable ? 'text-rose-400 font-bold' : 'text-slate-300 font-bold'}>{((p.marginRatio ?? 0) * 100).toFixed(2)}%</div>
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-xl border text-[11px] font-mono flex items-center justify-between ${up ? 'bg-emerald-500/[0.06] border-emerald-500/25' : 'bg-rose-500/[0.06] border-rose-500/25'}`}>
                        <span className="text-slate-400">
                          Unrealized <span className={up ? 'text-emerald-300' : 'text-rose-300'}>{up ? '+' : ''}{fmtNum(pnl, 4)} cUSD ({up ? '+' : ''}{fmtNum(pnlPct, 2)}%)</span><span className="text-slate-600"> — incl. funding {up ? '+' : ''}{fmtNum(p.fundingDelta, 4)}</span>
                        </span>
                        <button
                          onClick={() => handleClose(p)}
                          disabled={busyClose === p.id || p.liquidatable}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-bold text-[10px]"
                        >
                          {busyClose === p.id ? 'Closing…' : 'Close (real)'}
                        </button>
                      </div>
                      {p.liquidatable && (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-amber-300 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30">
                          <AlertTriangle className="w-3.5 h-3.5" /> Equity below maintenance — this position is liquidatable by any keeper (up to {((state?.liquidationBonusBps ?? 5) / 100).toFixed(2)}% of notional reward).
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="cUSD"
                          value={marginTopUp[p.id] ?? ''}
                          onChange={(e) => setMarginTopUp((m) => ({ ...m, [p.id]: e.target.value }))}
                          className="w-28 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={() => handleMargin(p, true)}
                          disabled={busyMargin === p.id}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-500/25 font-bold text-[10px] disabled:opacity-40"
                        >
                          {busyMargin === p.id ? '…' : '+ Add'}
                        </button>
                        <button
                          onClick={() => handleMargin(p, false)}
                          disabled={busyMargin === p.id}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 font-bold text-[10px] disabled:opacity-40"
                        >
                          − Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity ledger */}
          <div className="rounded-2xl border border-white/10 bg-black/40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> ON-CHAIN LEDGER
              </h3>
              <span className="text-[10px] font-mono text-slate-500">{ledger.length} recent events</span>
            </div>
            {ledger.length === 0 ? (
              <div className="p-6 text-center text-[11px] font-mono text-slate-500">No engine events yet on this RPC window.</div>
            ) : (
              <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {ledger.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-[11px] font-mono">
                    <span className={`w-14 shrink-0 px-1.5 py-0.5 rounded text-center text-[9px] font-black ${
                      e.type === 'OPEN' ? 'bg-emerald-500/15 text-emerald-300' : e.type === 'CLOSE' ? 'bg-cyan-500/15 text-cyan-300' : e.type === 'LIQUIDATE' ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-500/15 text-slate-300'
                    }`}>
                      {e.type}
                    </span>
                    <span className={e.side === 'LONG' ? 'text-emerald-300 font-bold' : e.side === 'SHORT' ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                      {e.side ?? '—'}
                    </span>
                    <span className="text-slate-300">{fmtNum(e.amount, 2)}</span>
                    <span className="text-slate-600">@ {fmtNum(e.mark, 6)}</span>
                    <span className="text-slate-500">b{e.block.toLocaleString()}</span>
                    <span className="text-slate-600 ml-auto hidden sm:inline">{fmtTime(e.timestamp)}</span>
                    <a href={`${CREDITCOIN_BLOCKSCOUT}/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-200 inline-flex items-center">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button onClick={() => copyTx(e.txHash)} className="text-slate-500 hover:text-white">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {copied && <div className="px-4 py-1 text-[10px] font-mono text-emerald-400">Copied tx hash.</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500 border-t border-white/5 pt-4">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Single-venue mark on CC3 — no cross-venue oracle exists; the engine states this honestly.
        </span>
        <a href={`${CREDITCOIN_BLOCKSCOUT}/address/0x216D62597C60767Cb5A9b4948F75049701ed7016`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-200 inline-flex items-center gap-1 cursor-pointer">
          ReputationPerpetual ↗
        </a>
      </div>
    </div>
  );
};

export default PerpsTerminal;