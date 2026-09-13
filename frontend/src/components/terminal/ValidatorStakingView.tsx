import React, { useState, useEffect, useMemo } from 'react';
import GlassCard from '../common/GlassCard';
import {
  ShieldCheck,
  Wallet,
  RefreshCw,
  Loader2,
  CircleCheck,
  TriangleAlert,
  ExternalLink,
  Radio,
  Landmark,
  Server,
  Scale,
  Database,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  HandCoins,
  Percent,
} from 'lucide-react';
import useValidatorStakingLive from '../../hooks/useValidatorStakingLive';
import { useWalletPicker } from '../../context/WalletPickerContext';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { fetchDePINState, requestHardwareLoan, repayHardwareLoan, toGeoOrbitHexId } from '../../services/credXService';

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 4 }) : '…');
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const ValidatorStakingView: React.FC = () => {
  const {
    state, validators, ledger, loading, busy, error, lastTx, txLog,
    myValidator, myTotalPending, myTotalStake, activeSignerLabel, openPicker,
    register, stake, unstake, claim, claimCommission, refresh, contract, account,
  } = useValidatorStakingLive();

  const { getSigner: getPickerSigner, openPicker: openLoanPicker } = useWalletPicker();

  const [subTab, setSubTab] = useState<'validators' | 'financing' | 'ledger'>('validators');

  // Register form
  const [tagInput, setTagInput] = useState('VSTKRTK1');
  const [commission, setCommission] = useState(1000);

  // Per-validator amounts
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // Financing state (real DePINInfrastructureHub hardware loans)
  const [depin, setDepin] = useState<Awaited<ReturnType<typeof fetchDePINState>>>(null);
  const [loanInput, setLoanInput] = useState('1000');
  const [loanBusy, setLoanBusy] = useState<'request' | 'repay' | null>(null);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanTx, setLoanTx] = useState<string | null>(null);

  const depinSymbol = depin?.depinToken?.symbol || 'DEPIN';

  useEffect(() => {
    let alive = true;
    fetchDePINState(account, null).then((d) => { if (alive) setDepin(d); });
    return () => { alive = false; };
  }, [account]);

  const busyAny = busy !== null || loanBusy !== null;
  const amountFor = (op: string) => parseFloat(amounts[op] ?? '0') || 0;

  const registerValidatorSlot = () => register(toGeoOrbitHexId(tagInput), commission);
  const doStake = (op: string) => stake(op, amountFor(op));
  const doUnstake = (op: string) => unstake(op, amountFor(op));

  const doRequestLoan = async () => {
    const amt = parseFloat(loanInput);
    if (!amt || amt <= 0) { setLoanError('Enter a valid amount.'); return; }
    if (depin && amt > depin.maxHardwareLoanAmount) { setLoanError(`Max hardware loan is ${fmt(depin.maxHardwareLoanAmount)} ${depinSymbol}.`); return; }
    if (depin && depin.loanAmount > 0) { setLoanError('Repay the existing loan first.'); return; }
    setLoanError(null); setLoanTx(null); setLoanBusy('request');
    try {
      const s = await getPickerSigner();
      if (!s) { openLoanPicker(); return; }
      const hash = await requestHardwareLoan(amt, s);
      setLoanTx(hash);
      await new Promise((r) => setTimeout(r, 1500));
      const d = await fetchDePINState(account, null);
      if (d) setDepin(d);
    } catch (e: any) {
      setLoanError(e?.reason || e?.message || 'Loan request failed');
    } finally {
      setLoanBusy(null);
    }
  };

  const doRepayLoan = async () => {
    const amt = depin?.loanAmount ?? 0;
    if (amt <= 0) return;
    setLoanError(null); setLoanTx(null); setLoanBusy('repay');
    try {
      const s = await getPickerSigner();
      if (!s) { openLoanPicker(); return; }
      const hash = await repayHardwareLoan(amt, s);
      setLoanTx(hash);
      await new Promise((r) => setTimeout(r, 1500));
      const d = await fetchDePINState(account, null);
      if (d) setDepin(d);
    } catch (e: any) {
      setLoanError(e?.reason || e?.message || 'Repayment failed');
    } finally {
      setLoanBusy(null);
    }
  };

  const loanBlocksLeft = depin && depin.loanAmount > 0 ? depin.loanDueBlock - depin.currentBlock : 0;

  const commissionPct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HERO HEADER — LIVE ValidatorStakingRegistry                              */}
      {/* ========================================================================= */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30 bg-gradient-to-r from-black via-[#04121c] to-[#071a26]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                LIVE — ValidatorStakingRegistry on Creditcoin Testnet
              </span>
              <a
                href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-cyan-300 font-mono text-[10px]"
              >
                {contract.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
              </a>
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/60 text-xs font-mono">
                {state?.validatorCount ?? '…'} validators · {state ? fmt(state.totalStaked) : '…'} {depinSymbol} staked
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Validator Staking — real on-chain validator registry &amp; rewards pool
            </h2>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
              Operators with a Prime credit score ({'>='} {state?.minOperatorScore ?? 700} CTS) register as validators directly on
              Creditcoin. Anyone can delegate {depinSymbol} to a validator's pool and earn per-block rewards, split with the
              operator's commission. Delegations are liquid (unstake any time) and every stake, unstake, reward and
              commission claim is a real transaction on CC3.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs space-y-1">
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Reward Rate</span>
                <span className="text-cyan-400 font-bold">{state ? `${fmt(state.rewardPerBlock)} CREDX / DEPIN / block` : '…'}</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Operator Gate</span>
                <span className="text-emerald-400 font-bold">{'>='} {state?.minOperatorScore ?? 700} CTS</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Commission Cap</span>
                <span className="text-white font-bold">{state ? commissionPct(state.maxCommissionBps) : '…'}</span>
              </div>
            </div>

            <button
              onClick={refresh}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/30 disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Reading Registry...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Live registry + account banner */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">My Total Deposited</span>
            <span className="text-white font-bold">{fmt(myTotalStake)} {depinSymbol}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">My Pending Rewards</span>
            <span className="text-emerald-400 font-bold">{fmt(myTotalPending)} CREDX</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">CREDX Issued</span>
            <span className="text-amber-300 font-bold">{state ? fmt(state.totalRewardUnitsIssued) : '…'}</span>
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
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Server className="w-3 h-3" /> Validators</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state?.validatorCount ?? '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Scale className="w-3 h-3" /> Total Staked</span>
          <span className="text-lg font-black font-mono text-white mt-0.5 block">{state ? fmt(state.totalStaked) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Layers className="w-3 h-3" /> CREDX Issued</span>
          <span className="text-lg font-black font-mono text-amber-300 mt-0.5 block">{state ? fmt(state.totalRewardUnitsIssued) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><HandCoins className="w-3 h-3" /> Commission Paid</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{state ? fmt(state.totalCommissionClaimed) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><Percent className="w-3 h-3" /> Reward / block</span>
          <span className="text-lg font-black font-mono text-cyan-300 mt-0.5 block">{state ? fmt(state.rewardPerBlock) : '…'}</span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
          <span className="text-[10px] uppercase font-mono text-white/40 block flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Min Score</span>
          <span className="text-lg font-black font-mono text-emerald-300 mt-0.5 block">{state ? `≥${state.minOperatorScore}` : '…'}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TABS                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08]">
        {([
          { key: 'validators' as const, icon: Server, label: 'Validators & Delegate' },
          { key: 'financing' as const, icon: Landmark, label: 'Hardware Financing' },
          { key: 'ledger' as const, icon: Database, label: 'On-Chain Ledger' },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
              subTab === key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
                : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 — VALIDATORS (real registry directory + delegation)                */}
      {/* ========================================================================= */}
      {subTab === 'validators' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Registered validators on the live registry
              </span>
              <span className="text-[11px] font-mono text-white/40">operator tags are on-chain identities; rewards accrue per block and split by commission</span>
            </div>
            <button
              onClick={refresh}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-mono font-bold text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {validators.length === 0 ? (
            <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] text-xs font-mono text-white/50">
              No validators registered on-chain yet. Register this wallet below.
            </div>
          ) : (
            <div className={`grid gap-4 ${validators.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {validators.map((v) => (
                <GlassCard key={v.validatorId} className="p-5 hover:border-cyan-500/40 transition space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                          #{v.validatorId} · {v.nodeTag}
                        </span>
                        <a
                          href={`${CREDITCOIN_BLOCKSCOUT}/address/${v.operator}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-mono text-white/40 hover:text-cyan-300 inline-flex items-center gap-1"
                        >
                          {shortAddr(v.operator)} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        commission {commissionPct(v.commissionBps)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-4 font-mono text-xs">
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">Pool Staked</span>
                        <span className="text-white font-bold text-sm">{fmt(v.totalStaked)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">My Stake</span>
                        <span className="text-cyan-300 font-bold text-sm">{fmt(v.myStake)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] text-white/40 block">My Pending</span>
                        <span className="text-amber-300 font-bold text-sm">{fmt(v.myPendingRewards)} CREDX</span>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] text-white/70 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/40">{v.operator.toLowerCase() === account.toLowerCase() ? 'This is your validator' : 'Operator commission due'}:</span>
                        <span className="text-emerald-400 font-bold">{v.pendingCommission > 0 ? `${fmt(v.pendingCommission)} CREDX` : '0 CREDX'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Commission claimed so far:</span>
                        <span className="text-white font-bold">{fmt(v.claimedCommission)} CREDX</span>
                      </div>
                    </div>
                  </div>

                  {v.myStake > 0 && v.myPendingRewards > 0 ? (
                    <button
                      onClick={() => claim(v.operator)}
                      disabled={busyAny}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs font-mono transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {busy === 'claim' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HandCoins className="w-3.5 h-3.5" />}
                      Claim {fmt(v.myPendingRewards)} CREDX
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <input
                          type="number"
                          min={1}
                          value={amounts[v.operator] ?? ''}
                          onChange={(e) => setAmounts((p) => ({ ...p, [v.operator]: e.target.value }))}
                          placeholder="Amount (DEPIN)"
                          className="w-full px-2.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => doStake(v.operator)}
                          disabled={busyAny || !amountFor(v.operator)}
                          className="px-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-[11px] font-mono transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {busy === 'stake' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />} Stake
                        </button>
                        <button
                          onClick={() => doUnstake(v.operator)}
                          disabled={busyAny || !v.myStake || !amountFor(v.operator)}
                          className="px-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-[11px] font-mono transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {busy === 'unstake' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpFromLine className="w-3.5 h-3.5 text-cyan-400" />} Unstake
                        </button>
                      </div>
                    </div>
                  )}

                  {v.operator.toLowerCase() === account.toLowerCase() && (
                    <button
                      onClick={claimCommission}
                      disabled={busyAny || v.pendingCommission <= 0}
                      className="w-full py-2.5 rounded-xl bg-emerald-500/[0.12] border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs font-mono transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      Claim Commission {fmt(v.pendingCommission)} CREDX
                    </button>
                  )}
                </GlassCard>
              ))}
            </div>
          )}

          {/* Register form */}
          {!myValidator ? (
            <GlassCard className="p-5 border-cyan-500/30 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Register This Wallet as a Validator
                </span>
                <p className="text-[11px] text-white/60">
                  Requires a Prime credit score ({'>='} {state?.minOperatorScore ?? 700} CTS) — checked on-chain at registration. Set your
                  operator tag and commission cut (capped at {state ? commissionPct(state.maxCommissionBps) : '50%'}).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Node Tag</span>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="VSTKRTK1"
                    maxLength={8}
                    className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-[9px] text-white/30">→ bytes4 {toGeoOrbitHexId(tagInput)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Commission (bps · 1–{state?.maxCommissionBps ?? 5000})</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={state?.maxCommissionBps ?? 5000}
                      value={commission}
                      onChange={(e) => setCommission(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-[11px] font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
                <div className="space-y-1 self-end">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Delegator Share</span>
                  <div className="px-2.5 py-2 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-emerald-300 font-bold">
                    {(((10000 - commission) / 100).toFixed(commission % 100 === 0 ? 0 : 1))}% of rewards
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
                  onClick={registerValidatorSlot}
                  disabled={busyAny}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {busy === 'register' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />} Register Validator
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
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/25 text-xs font-mono text-emerald-300 flex items-center gap-2">
              <Radio className="w-4 h-4 shrink-0" />
              This wallet is validator #{myValidator.validatorId} ({myValidator.nodeTag}) at {commissionPct(myValidator.commissionBps)} commission — claim commission from its card above.
            </div>
          )}

          <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] font-mono text-[10px] text-white/40 leading-relaxed space-y-1.5">
            <p>Validator tags, commission splits and delegations are operator-signed records anchored on CC3 — an honest delegation ledger, not a claim of executing third-party validation workloads.</p>
            <p>Rewards accrue per block as pool CREDX units (no token transfer): your share = stake × blocks × rate × (100% − commission). Delegations are liquid — unstake returns {depinSymbol} immediately.</p>
            <p>Registration is gated on-chain by the caller's Creditcoin CTS credit score ({'>='} {state?.minOperatorScore ?? 700}).</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 — HARDWARE FINANCING (real DePINInfrastructureHub loans)            */}
      {/* ========================================================================= */}
      {subTab === 'financing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-7 p-6 space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Hardware Financing — live DePINInfrastructureHub
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Underwrite node hardware capex</h3>
              <p className="text-xs text-white/60 mt-1">
                Undercollateralized hardware loans from DePINInfrastructureHub for top-tier operators. Caller score must be
                {'>='} 750 CTS (on-chain check). Repay any time to clear the line.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                <span className="text-white/40 text-[10px] uppercase block">Your {depinSymbol} Balance</span>
                <span className="text-emerald-400 font-bold">{depin ? fmt(depin.depinBalance) : '…'}</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                <span className="text-white/40 text-[10px] uppercase block">Max Hardware Loan</span>
                <span className="text-emerald-400 font-bold">{depin ? fmt(depin.maxHardwareLoanAmount) : '…'}</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
                <span className="text-white/40 text-[10px] uppercase block">Active Loan</span>
                <span className="text-white font-bold">{depin ? (depin.loanAmount > 0 ? `${fmt(depin.loanAmount)} ${depinSymbol}` : 'None') : '…'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Loan Amount ({depinSymbol})</span>
                <span className="text-emerald-400 font-mono">Max: {depin ? fmt(depin.maxHardwareLoanAmount) : '--'}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={loanInput}
                  onChange={(e) => setLoanInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition"
                  placeholder="1000"
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    onClick={() => setLoanInput(depin ? depin.maxHardwareLoanAmount.toFixed(0) : '0')}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={doRequestLoan}
                disabled={loanBusy !== null || (depin?.loanAmount ?? 0) > 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ArrowDownToLine className="w-4 h-4" />
                {loanBusy === 'request' ? 'Requesting...' : depin && depin.loanAmount > 0 ? 'Loan Active' : `Request Loan (${loanInput || '0'} ${depinSymbol})`}
              </button>
              <button
                onClick={doRepayLoan}
                disabled={loanBusy !== null || !depin || depin.loanAmount <= 0}
                className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <ArrowUpFromLine className="w-4 h-4 text-emerald-400" />
                {loanBusy === 'repay' ? 'Repaying...' : 'Repay Loan'}
              </button>
            </div>

            {loanError ? (
              <div className="flex items-start gap-2 text-[11px] text-rose-300 font-mono">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {loanError}
              </div>
            ) : null}
            {loanTx ? (
              <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
                <CircleCheck className="w-3.5 h-3.5 shrink-0" /> tx {loanTx.slice(0, 10)}…
                <a href={`${CREDITCOIN_BLOCKSCOUT}/tx/${loanTx}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/40 hover:text-emerald-300">
                  blockscout <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : null}
          </GlassCard>

          <div className="lg:col-span-5 space-y-4">
            <GlassCard className="p-5 border-cyan-500/30 space-y-3">
              <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> Loan Position
                <button onClick={openPicker} className="text-cyan-300 font-bold flex items-center gap-1 hover:opacity-80 transition ml-1">
                  <Wallet className="w-3 h-3" /> {activeSignerLabel.toUpperCase()}
                </button>
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-white/70">
                <div className="flex justify-between"><span className="text-white/40">Loan Due Block:</span><span className="text-white font-bold">{depin && depin.loanAmount > 0 ? `#${depin.loanDueBlock.toLocaleString()}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Current Block:</span><span className="text-white font-bold">{depin ? `#${depin.currentBlock.toLocaleString()}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Term:</span><span className="text-white font-bold">216,000 blocks</span></div>
                <div className="flex justify-between"><span className="text-white/40">Status:</span>
                  <span className={`font-bold ${depin && depin.loanAmount > 0 ? (loanBlocksLeft <= 0 ? 'text-red-400' : 'text-emerald-400') : 'text-white/40'}`}>
                    {depin && depin.loanAmount > 0 ? (loanBlocksLeft <= 0 ? 'OVERDUE' : `${loanBlocksLeft.toLocaleString()} blocks left`) : 'No active loan'}
                  </span>
                </div>
              </div>
            </GlassCard>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] font-mono text-[10px] text-white/40 leading-relaxed space-y-1.5">
              <p>Caller gate: {'>='} 750 CTS (on-chain check on requestHardwareLoan).</p>
              <p>Loan asset: {depinSymbol} (DEPIN_TOKEN on the hub). Repayment clears the full balance via repayHardwareLoan.</p>
              <p>Allocation: node hardware capex financing under DePINInfrastructureHub.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3 — ON-CHAIN LEDGER (real events via getLogs)                         */}
      {/* ========================================================================= */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> ValidatorStakingRegistry events · {ledger.length} (via eth_getLogs)
              </span>
              <span className="text-[11px] font-mono text-white/40">live from <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${contract}#events`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-cyan-300 underline">blockscout</a></span>
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
              No staking events in the recent window yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left font-mono text-xs bg-black/60">
                <thead className="bg-white/[0.04] text-white/50 text-[10px] uppercase border-b border-white/10">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Amount / Detail</th>
                    <th className="p-3">Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {ledger.map((l, i) => {
                    const actor = l.user ?? l.operator;
                    const kindLabel =
                      l.kind === 'registered' ? 'REGISTERED'
                      : l.kind === 'staked' ? 'STAKED'
                      : l.kind === 'unstaked' ? 'UNSTAKED'
                      : l.kind === 'rewards' ? 'REWARDS'
                      : 'COMMISSION';
                    const kindColor =
                      l.kind === 'registered' ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
                      : l.kind === 'staked' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                      : l.kind === 'unstaked' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                      : l.kind === 'rewards' ? 'text-purple-300 bg-purple-500/10 border-purple-500/30'
                      : 'text-rose-300 bg-rose-500/10 border-rose-500/30';
                    return (
                      <tr key={`${l.blockNumber}-${i}`} className="hover:bg-white/[0.02] transition">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${kindColor}`}>{kindLabel}</span>
                        </td>
                        <td className="p-3">
                          <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${actor}`} target="_blank" rel="noreferrer" className="text-white/80 hover:underline inline-flex items-center gap-1">
                            {shortAddr(actor)} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </td>
                        <td className="p-3 text-white/60">
                          {l.operator.toLowerCase() === actor.toLowerCase() ? 'self' : shortAddr(l.operator)}
                        </td>
                        <td className="p-3 text-white font-bold">
                          {l.kind === 'registered'
                            ? `${l.nodeTag} · ${commissionPct(l.commissionBps ?? 0)} comm`
                            : l.kind === 'rewards' || l.kind === 'commission'
                            ? `+${fmt(l.amount ?? 0)} CREDX`
                            : `${fmt(l.amount ?? 0)} ${depinSymbol}`}
                        </td>
                        <td className="p-3 text-white/40" title={new Date((l.timestamp || 0) * 1000).toLocaleString()}>
                          b{l.blockNumber.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidatorStakingView;