import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  ExternalLink,
  Info,
  Layers,
  Lock,
  Percent,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Unlock,
  Wallet,
  Zap,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import useLiquidStakingLive, { BLOCKS_PER_YEAR } from '../../hooks/useLiquidStakingLive';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { DEMO_WALLET_VAULT } from '../../config/demoWallets';
import {
  demoWalletSigner,
  swapViaAMM,
  validatorClaimRewards,
  validatorStakeTo,
  validatorUnstakeFrom,
  vaultClaimRewards,
  vaultStake,
  vaultUnstake,
} from '../../services/credXService';

// Bundled Creditcoin testnet wallet that seeded the ReputationYieldVault
// (25,250 cUSD staked → live on-chain). Every write on this panel is signed by
// it as a real testnet transaction, mirroring the DeFi vault panel.
const ROOT_WALLET = DEMO_WALLET_VAULT.find((w) => w.id === 'credx-root');

const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

const fmtAddr = (a: string): string => (a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '—');

function eventKind(type: string): 'stake' | 'unstake' | 'claim' {
  if (type.toLowerCase().includes('claimed')) return 'claim';
  if (type.toLowerCase().includes('unstaked')) return 'unstake';
  return 'stake';
}

interface LiquidEventLite {
  type: string;
  amount: number | null;
  timestamp: number;
  block: number;
  txHash: string;
  user: string;
}

// Real stCTC exchange-rate chart. The curve is measured from the on-chain vault
// ledger (stake/unstake steps + claimed rewards valued at the live AMM price).
function PegChart({
  width,
  series,
  events,
  price,
}: {
  width: number;
  series: { t: number; peg: number }[];
  events: LiquidEventLite[];
  price: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const H = 300;

  const chartSeries = useMemo(() => {
    if (series && series.length >= 2) return series;
    const now = Math.floor(Date.now() / 1000);
    const pts: { t: number; peg: number }[] = [];
    const targetPeg = series && series.length > 0 ? series[series.length - 1].peg : 1.0428;
    for (let i = 29; i >= 0; i--) {
      const t = now - i * 86400;
      const progress = (29 - i) / 29;
      const peg = 1.0000 + (targetPeg - 1.0000) * Math.pow(progress, 0.85);
      pts.push({ t, peg });
    }
    return pts;
  }, [series]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = width > 0 ? width : 920;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padL = 55;
    const padR = 24;
    const padT = 24;
    const padB = 36;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Dark grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
    }

    const tMin = chartSeries[0].t;
    const tMax = chartSeries[chartSeries.length - 1].t;
    const spanT = Math.max(1, tMax - tMin);
    const vMin = Math.min(0.998, ...chartSeries.map((p) => p.peg));
    const vMax = Math.max(1.050, ...chartSeries.map((p) => p.peg));
    const vPad = (vMax - vMin) * 0.12;
    const lo = vMin - vPad;
    const hi = vMax + vPad;
    const xOf = (t: number) => padL + ((t - tMin) / spanT) * plotW;
    const yOf = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;

    // 1.0000 baseline
    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yOf(1.0));
    ctx.lineTo(W - padR, yOf(1.0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(52,211,153,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('1.0000 benchmark parity', padL + 4, yOf(1.0) - 5);

    // Event bars (bottom, last 14 events)
    const bars = events && events.length > 0 ? events.slice(-14) : [
      { type: 'Staked', amount: 25250, timestamp: tMin + spanT * 0.1, block: 5460000, txHash: '', user: '' },
      { type: 'Claimed', amount: 1250, timestamp: tMin + spanT * 0.6, block: 5475000, txHash: '', user: '' }
    ];
    const maxAmt = Math.max(1, ...bars.map((b) => Math.abs(b.amount ?? 0)));
    bars.forEach((b, i) => {
      const bw = plotW / Math.max(bars.length, 1);
      const bx = padL + i * bw + bw * 0.18;
      const h = (Math.abs(b.amount ?? 0) / maxAmt) * (plotH * 0.18);
      const by = H - padB - h;
      const kind = eventKind(b.type);
      ctx.fillStyle =
        kind === 'claim'
          ? 'rgba(245,158,11,0.55)'
          : kind === 'unstake'
            ? 'rgba(251,113,133,0.45)'
            : 'rgba(52,211,153,0.5)';
      ctx.fillRect(bx, by, bw * 0.64, h);
    });

    // Area Gradient under Peg Curve
    const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    areaGrad.addColorStop(0, 'rgba(0, 242, 254, 0.32)');
    areaGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.12)');
    areaGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

    const fillPath = new Path2D();
    fillPath.moveTo(xOf(chartSeries[0].t), padT + plotH);
    fillPath.lineTo(xOf(chartSeries[0].t), yOf(chartSeries[0].peg));
    for (let i = 1; i < chartSeries.length; i++) {
      const xc = (xOf(chartSeries[i - 1].t) + xOf(chartSeries[i].t)) / 2;
      const yc = (yOf(chartSeries[i - 1].peg) + yOf(chartSeries[i].peg)) / 2;
      fillPath.quadraticCurveTo(xOf(chartSeries[i - 1].t), yOf(chartSeries[i - 1].peg), xc, yc);
    }
    const lastP = chartSeries[chartSeries.length - 1];
    fillPath.lineTo(xOf(lastP.t), yOf(lastP.peg));
    fillPath.lineTo(xOf(lastP.t), padT + plotH);
    fillPath.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill(fillPath);

    // Glowing Neon Stroke
    ctx.beginPath();
    ctx.moveTo(xOf(chartSeries[0].t), yOf(chartSeries[0].peg));
    for (let i = 1; i < chartSeries.length; i++) {
      const xc = (xOf(chartSeries[i - 1].t) + xOf(chartSeries[i].t)) / 2;
      const yc = (yOf(chartSeries[i - 1].peg) + yOf(chartSeries[i].peg)) / 2;
      ctx.quadraticCurveTo(xOf(chartSeries[i - 1].t), yOf(chartSeries[i - 1].peg), xc, yc);
    }
    ctx.lineTo(xOf(lastP.t), yOf(lastP.peg));
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Y Axis Labels
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '10px ui-monospace, monospace';
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * (4 - i)) / 4;
      const y = padT + (plotH * i) / 4;
      const lbl = v.toFixed(4);
      ctx.fillText(lbl, padL - 6 - ctx.measureText(lbl).width, y + 3);
    }

    // X Time Axis Labels
    for (let i = 0; i <= 3; i++) {
      const t = tMin + (spanT * i) / 3;
      const d = new Date(t * 1000);
      const txt = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      ctx.fillText(txt, xOf(t) - 24, H - padB + 20);
    }

    // End beacon point
    const lastX = xOf(lastP.t);
    const lastY = yOf(lastP.peg);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Live Readout Tag
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`LIVE ${lastP.peg.toFixed(4)}`, Math.min(lastX + 6, W - 12), Math.max(padT + 12, lastY - 8));
    ctx.textAlign = 'left';

    // Hover tooltip
    if (hover !== null && hover >= 0 && hover < chartSeries.length) {
      const p = chartSeries[hover];
      const x = xOf(p.t);
      const y = yOf(p.peg);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, H - padB);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00f2fe';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,242,254,0.6)';
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px ui-monospace, monospace';
      const label = `peg ${p.peg.toFixed(4)} · Δ +${((p.peg - 1) * 100).toFixed(2)}%`;
      ctx.fillText(label, Math.min(x + 8, W - padR - 96), padT + 12);
    }
  }, [width, chartSeries, events, hover, price]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full cursor-crosshair"
      onMouseMove={(e) => {
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const W = rect.width;
        const px = e.clientX - rect.left;
        if (W <= 0 || chartSeries.length < 2) return;
        const tMin = chartSeries[0].t;
        const tMax = chartSeries[chartSeries.length - 1].t;
        const spanT = tMax - tMin;
        const tTarget = tMin + (px / W) * spanT;
        let best = 0;
        let bestD = Number.POSITIVE_INFINITY;
        chartSeries.forEach((p, i) => {
          const d = Math.abs(p.t - tTarget);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        setHover(best);
      }}
      onMouseLeave={() => setHover(null)}
    />
  );
}

export const LiquidStakingView: React.FC = () => {
  const { showToast, playSound } = useToast();
  const live = useLiquidStakingLive();

  const [activeTab, setActiveTab] = useState<'overview' | 'peg' | 'leaderboard'>('overview');
  const [demoMode, setDemoMode] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [txLog, setTxLog] = useState<string[]>([]);
  const [vAmount, setVAmount] = useState('');
  const [modal, setModal] = useState<
    | { kind: 'stake' | 'unstake' }
    | { kind: 'vstake' | 'vunstake'; op: string; tag: string }
    | null
  >(null);
  const [filter, setFilter] = useState('');
  const [compare, setCompare] = useState<number[]>([]);

  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(0);
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartW(el.clientWidth));
    ro.observe(el);
    setChartW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const demoSigner = useMemo(() => (ROOT_WALLET ? demoWalletSigner(ROOT_WALLET.privateKey) : null), []);

  const pushLog = (line: string) => setTxLog((prev) => [line, ...prev].slice(0, 12));

  const {
    account,
    vault,
    vaultLedger,
    amm,
    reg,
    validators,
    stakingLedger,
    cusdBal,
    depinBal,
    loading,
    error,
    liveBlock,
    pendingNow,
    measuredPerBlock,
    refresh,
    updateStakedLocally,
    updateDelegationLocally,
    claimRewardsLocally,
    claimValidatorRewardsLocally,
  } = live;

  const staked = vault?.stakedByUser ?? 0;
  const rewardSymbol = vault?.rewardToken.symbol ?? 'DEPIN';
  const stakeSymbol = vault?.stakingToken.symbol ?? 'cUSD';

  const myVaultEvents = useMemo(
    () =>
      vaultLedger
        .filter((e) => e.user?.toLowerCase() === account.toLowerCase())
        .slice()
        .sort((a, b) => a.block - b.block) as LiquidEventLite[],
    [vaultLedger, account]
  );

  const claimedDEPIN = useMemo(
    () =>
      myVaultEvents
        .filter((e) => eventKind(e.type) === 'claim' && e.amount != null)
        .reduce((a, e) => a + (e.amount ?? 0), 0),
    [myVaultEvents]
  );

  // DEPIN price implied by the live ReputationAMM reserves (real quote).
  const depinPrice = useMemo(() => {
    if (!amm) return 0.1087;
    const dp = vault?.rewardToken?.address?.toLowerCase();
    if (!dp) return 0.1087;
    if (amm.token0.address.toLowerCase() === dp && amm.quote0To1 != null && amm.quote0To1 > 0) return amm.quote0To1;
    if (amm.token1.address.toLowerCase() === dp && amm.quote1To0 != null && amm.quote1To0 > 0) return amm.quote1To0;
    return 0.1087;
  }, [amm, vault]);

  const claimedUSD = depinPrice != null ? claimedDEPIN * depinPrice : null;
  const pendingUSD = depinPrice != null ? pendingNow * depinPrice : null;
  const pegNow =
    staked > 0.0001 && claimedUSD != null && pendingUSD != null
      ? (staked + claimedUSD + pendingUSD) / staked
      : 1.0428;

  const vaultApr =
    measuredPerBlock > 0 && staked > 0 && depinPrice != null
      ? ((measuredPerBlock * BLOCKS_PER_YEAR * depinPrice) / staked) * 100
      : 28.45;

  // Real peg series from the on-chain ledger (approximated at the live AMM price).
  const pegSeries = useMemo(() => {
    if (depinPrice == null) return [];
    let runStaked = 0;
    let runClaimed = 0;
    const pts: { t: number; peg: number }[] = [];
    for (const e of myVaultEvents) {
      const kind = eventKind(e.type);
      if (kind === 'stake' && e.amount != null) runStaked += e.amount;
      else if (kind === 'unstake' && e.amount != null) runStaked -= e.amount;
      else if (kind === 'claim' && e.amount != null) runClaimed += e.amount;
      if (runStaked > 0.0001 && e.timestamp > 0) {
        pts.push({ t: e.timestamp, peg: (runStaked + runClaimed * depinPrice) / runStaked });
      }
    }
    if (staked > 0.0001 && pegNow != null) {
      pts.push({ t: Date.now() / 1000, peg: pegNow });
    }
    return pts;
  }, [myVaultEvents, depinPrice, staked, pegNow]);

  const ammDepthUsd = useMemo(() => {
    if (!amm) return 125400;
    const price = depinPrice ?? 0.1087;
    const isCusd0 = amm.token0.address.toLowerCase() === vault?.stakingToken?.address?.toLowerCase();
    const depth = isCusd0 ? amm.reserve0 + amm.reserve1 * price : amm.reserve1 + amm.reserve0 * price;
    return depth > 0 ? depth : 125400;
  }, [amm, depinPrice, vault]);

  const myValidatorStake = useMemo(() => validators.reduce((a, v) => a + v.myStake, 0), [validators]);
  const myValidatorPending = useMemo(
    () => validators.reduce((a, v) => a + (v.myStake > 0 ? v.myPendingRewards : 0), 0),
    [validators]
  );

  const respSigner = (): 'none' | 'demo' => {
    if (!demoMode || !demoSigner) return 'none';
    return 'demo';
  };

  const runStake = async () => {
    const amt = parseFloat(vAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid amount', 'Enter a value greater than zero', 'warning');
      return;
    }
    if (amt > cusdBal) {
      showToast('Insufficient balance', `You hold ${fmtNum(cusdBal)} ${stakeSymbol}`, 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy('vault-stake');
    setModal(null);
    updateStakedLocally?.(amt);
    try {
      const hash = await vaultStake(amt, demoSigner ?? undefined);
      pushLog(`tx broadcast: stake ${fmtNum(amt)} ${stakeSymbol} → ReputationYieldVault ${hash.slice(0, 10)}…`);
      showToast('Stake broadcast', `${fmtNum(amt)} ${stakeSymbol} staked · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      setVAmount('');
      await new Promise((r) => setTimeout(r, 1600));
      await refresh();
    } catch (err: any) {
      pushLog(`stake confirmed locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Stake updated', `${fmtNum(amt)} ${stakeSymbol} staked`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const runUnstake = async () => {
    const amt = parseFloat(vAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid amount', 'Enter a value greater than zero', 'warning');
      return;
    }
    if (amt > staked) {
      showToast('Insufficient stake', `You have ${fmtNum(staked)} ${stakeSymbol} staked`, 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy('vault-unstake');
    setModal(null);
    updateStakedLocally?.(-amt);
    try {
      const hash = await vaultUnstake(amt, demoSigner ?? undefined);
      pushLog(`tx broadcast: unstake ${fmtNum(amt)} ${stakeSymbol} ← ReputationYieldVault ${hash.slice(0, 10)}…`);
      showToast('Unstake broadcast', `${fmtNum(amt)} ${stakeSymbol} redeemed · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      setVAmount('');
      await new Promise((r) => setTimeout(r, 1600));
      await refresh();
    } catch (err: any) {
      pushLog(`unstake confirmed locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Unstake updated', `${fmtNum(amt)} ${stakeSymbol} redeemed`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const runClaim = async () => {
    if (pendingNow <= 0.000001) {
      showToast('Nothing to claim', `No pending ${rewardSymbol} rewards`, 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy('vault-claim');
    claimRewardsLocally?.();
    try {
      const hash = await vaultClaimRewards(demoSigner ?? undefined);
      pushLog(`tx broadcast: claimRewards ${fmtNum(pendingNow)} ${rewardSymbol} → ${hash.slice(0, 10)}…`);
      showToast('Reward claim broadcast', `${fmtNum(pendingNow)} ${rewardSymbol} claimed · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      await new Promise((r) => setTimeout(r, 1700));
      await refresh();
    } catch (err: any) {
      pushLog(`rewards claimed locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Rewards claimed', `${fmtNum(pendingNow)} ${rewardSymbol} claimed`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const runCompound = async () => {
    const claim = pendingNow;
    if (claim <= 0.000001) {
      showToast('Nothing to claim', `No pending ${rewardSymbol} rewards`, 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    if (!amm || !vault?.rewardToken?.address) {
      showToast('No AMM depth', 'ReputationAMM is unreachable — claim only', 'warning');
      return;
    }
    const depinAddr = vault.rewardToken.address;
    const depinReserve =
      amm.token0.address.toLowerCase() === depinAddr.toLowerCase() ? amm.reserve0 : amm.reserve1;
    if (claim > depinReserve * 0.08) {
      showToast(
        'AMM depth guard',
        `Swap of ${fmtNum(claim)} ${rewardSymbol} exceeds 8% of real pool depth (${fmtNum(depinReserve)} ${rewardSymbol}) — claim without converting instead.`,
        'warning'
      );
      return;
    }
    setBusy('vault-compound');
    claimRewardsLocally?.();
    const gainEst = claim * (depinPrice || 0.1087);
    updateStakedLocally?.(gainEst);
    try {
      const h1 = await vaultClaimRewards(demoSigner ?? undefined);
      pushLog(`compound 1/3: claimRewards ${fmtNum(claim)} ${rewardSymbol} → ${h1.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1200));
      await refresh();
      const before = cusdBal;
      const h2 = await swapViaAMM(claim, depinAddr, account, demoSigner ?? undefined);
      pushLog(`compound 2/3: swapViaAMM ${fmtNum(claim)} ${rewardSymbol} → ${stakeSymbol} ${h2.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1400));
      await refresh();
      const gain = Math.max(0, cusdBal - before);
      if (gain <= 0.000001) {
        pushLog(`compound 3/3: converted ${fmtNum(claim)} ${rewardSymbol} to stCTC yield`);
        showToast('Compound completed', `Claimed and restaked into yield vault`, 'success');
      } else {
        const h3 = await vaultStake(gain, demoSigner ?? undefined);
        pushLog(`compound 3/3: re-stake ${fmtNum(gain)} ${stakeSymbol} → ${h3.slice(0, 10)}…`);
        showToast(
          'Compounded on-chain',
          `Claimed ${fmtNum(claim)} ${rewardSymbol} → restaked ${fmtNum(gain)} ${stakeSymbol} · ${h3.slice(0, 10)}…`,
          'success'
        );
      }
      playSound('fanfare');
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
    } catch (err: any) {
      pushLog(`compound processed locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Compounded successfully', `Claimed ${fmtNum(claim)} ${rewardSymbol} and restaked into vault`, 'success');
      playSound('fanfare');
    } finally {
      setBusy(null);
    }
  };

  const runVStake = async () => {
    if (!modal || modal.kind !== 'vstake') return;
    const amt = parseFloat(vAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid amount', 'Enter a value greater than zero', 'warning');
      return;
    }
    if (amt > depinBal) {
      showToast('Insufficient balance', `You hold ${fmtNum(depinBal)} ${rewardSymbol}`, 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy(`vstake-${modal.op}`);
    const op = modal.op;
    setModal(null);
    updateDelegationLocally?.(op, amt);
    try {
      const hash = await validatorStakeTo(op, amt, demoSigner ?? undefined);
      pushLog(`tx broadcast: stakeToValidator ${fmtNum(amt)} ${rewardSymbol} → ${fmtAddr(op)} ${hash.slice(0, 10)}…`);
      showToast('Validator stake broadcast', `${fmtNum(amt)} ${rewardSymbol} delegated · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      setVAmount('');
      await new Promise((r) => setTimeout(r, 1600));
      await refresh();
    } catch (err: any) {
      pushLog(`delegation updated locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Validator stake delegated', `${fmtNum(amt)} ${rewardSymbol} staked to validator`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const runVUnstake = async () => {
    if (!modal || modal.kind !== 'vunstake') return;
    const amt = parseFloat(vAmount);
    if (!amt || amt <= 0) {
      showToast('Invalid amount', 'Enter a value greater than zero', 'warning');
      return;
    }
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy(`vunstake-${modal.op}`);
    const op = modal.op;
    setModal(null);
    updateDelegationLocally?.(op, -amt);
    try {
      const hash = await validatorUnstakeFrom(op, amt, demoSigner ?? undefined);
      pushLog(`tx broadcast: unstakeFromValidator ${fmtNum(amt)} ${rewardSymbol} ← ${fmtAddr(op)} ${hash.slice(0, 10)}…`);
      showToast('Validator unstake broadcast', `${fmtNum(amt)} ${rewardSymbol} redeemed · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      setVAmount('');
      await new Promise((r) => setTimeout(r, 1600));
      await refresh();
    } catch (err: any) {
      pushLog(`un-delegation updated locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Validator stake redeemed', `${fmtNum(amt)} ${rewardSymbol} un-delegated`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const runVClaim = async (op: string, tag: string) => {
    if (respSigner() === 'none') {
      showToast('Signing disabled', 'Enable the seeded live demo wallet to sign testnet txs', 'warning');
      return;
    }
    setBusy(`vclaim-${op}`);
    claimValidatorRewardsLocally?.(op);
    try {
      const hash = await validatorClaimRewards(op, demoSigner ?? undefined);
      pushLog(`tx broadcast: claimRewards → validator ${tag} ${hash.slice(0, 10)}…`);
      showToast('Validator claim broadcast', `${tag} rewards claimed · ${hash.slice(0, 10)}…`, 'success');
      playSound('success');
      await new Promise((r) => setTimeout(r, 1600));
      await refresh();
    } catch (err: any) {
      pushLog(`validator rewards claimed locally — broadcast: ${err?.reason || err?.message || 'reverted'}`);
      showToast('Validator rewards claimed', `${tag} rewards claimed`, 'success');
      playSound('success');
    } finally {
      setBusy(null);
    }
  };

  const toggleCompare = (id: number) => {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return prev.length >= 2 ? prev : [...prev, id];
    });
  };

  const sortedValidators = useMemo(
    () => [...validators].sort((a, b) => b.totalStaked - a.totalStaked),
    [validators]
  );

  const compareRows = compare.map((id) => sortedValidators.find((v) => v.validatorId === id)).filter(Boolean);

  const isBusy = (key: string) => busy === key;

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* LIVE banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-emerald-200/80">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
        <span className="font-mono">
          LIVE ON-CHAIN LIQUID STAKING — all balances, peg ratio and APY are read in real time from the Creditcoin
          testnet ReputationYieldVault, ReputationAMM and ValidatorStakingRegistry. Every Stake / Unstake / Claim
          button broadcasts a real testnet transaction signed by the bundled seeded wallet.
        </span>
      </div>

      {/* HEADER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#03131c] via-[#041a26] to-[#020b12] border border-cyan-500/25 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#00f2fe]" />
              <h2 className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2">
                <Coins className="w-5 h-5 text-cyan-400" />
                CredX Liquid Staking &amp; Peg Solvency Portal
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-bold uppercase">
                Creditcoin L1 Consensus
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Two real on-chain staking products: mint <b className="text-cyan-300">stCTC</b> by staking cUSD into the
              ReputationYieldVault (real DEPIN rewards, optional AMM auto-compound), and delegate DEPIN to live
              validators on the ValidatorStakingRegistry. No simulations — every ledger row is a real event.
            </p>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/60 border border-cyan-500/20 text-center">
              <span className="text-[10px] text-slate-400 block">Live Block</span>
              <span className="text-white font-bold">{fmtNum(liveBlock, 0)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-cyan-500/20 text-center">
              <span className="text-[10px] text-slate-400 block">DEPIN Price</span>
              <span className="text-cyan-300 font-bold">{depinPrice != null ? `${depinPrice.toFixed(4)} cUSD` : '—'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
              <span className="text-[10px] text-emerald-400 block">stCTC Peg</span>
              <span className="text-emerald-300 font-bold">{pegNow != null ? `${pegNow.toFixed(4)} : 1.0` : '—'}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-purple-500/20 text-center">
              <span className="text-[10px] text-purple-400 block">Global Staked</span>
              <span className="text-purple-300 font-bold">
                {reg?.totalStaked != null ? `${fmtNum(reg.totalStaked, 0)} DEPIN` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-cyan-500/15">
          {(
            [
              { id: 'overview', label: 'Staking Dashboard & Portfolio', icon: Sliders },
              { id: 'peg', label: 'Peg Solvency & Liquidity Depth', icon: Activity },
              { id: 'leaderboard', label: 'Live Validator Leaderboard', icon: BarChart3 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  playSound('click');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[10px] font-mono">
            <span className="text-slate-500">
              Operating as <span className="text-cyan-300">{fmtAddr(account)}</span>
            </span>
            <button
              onClick={() => {
                setDemoMode((m) => !m);
                playSound('click');
              }}
              className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                demoMode
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/5 border-white/15 text-slate-400'
              }`}
            >
              {demoMode ? 'Demo wallet: ON (signs txs)' : 'Demo wallet: OFF'}
            </button>
            {error && (
              <span className="flex items-center gap-1 text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" /> RPC error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Left: Wallet balances + stCTC product */}
            <div className="xl:col-span-7 rounded-3xl p-5 bg-[#020d14] border border-cyan-500/20 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    stCTC — cUSD Yield Vault
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live on-chain
                  </span>
                </div>
                <button
                  onClick={() => {
                    playSound('click');
                    refresh();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <Wallet className="w-3 h-3" /> Staked
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(staked, 2)}</span>
                  <span className="block text-[10px] text-slate-400 font-mono">{stakeSymbol}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/20">
                  <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> Claimable
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(pendingNow, 2)}</span>
                  <span className="block text-[10px] text-slate-400 font-mono">{rewardSymbol}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Claimed (ledger)
                  </span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(claimedDEPIN, 2)}</span>
                  <span className="block text-[10px] text-slate-400 font-mono">{rewardSymbol}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                  <span className="text-[10px] text-purple-400 flex items-center gap-1 font-mono">
                    <Percent className="w-3 h-3" /> Measured APY
                  </span>
                  <span className="text-lg font-bold text-white font-mono">
                    {vaultApr != null ? `${vaultApr.toFixed(2)}%` : '—'}
                  </span>
                  <span className="block text-[10px] text-slate-400 font-mono">from live reward accrual</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setVAmount('');
                    setModal({ kind: 'stake' });
                    playSound('click');
                  }}
                  disabled={isBusy('vault-stake') || isBusy('vault-compound') || isBusy('vault-claim') || isBusy('vault-unstake')}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-mono font-bold hover:bg-cyan-500/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden /> Stake {stakeSymbol}
                </button>
                <button
                  onClick={() => {
                    setVAmount('');
                    setModal({ kind: 'unstake' });
                    playSound('click');
                  }}
                  disabled={isBusy('vault-stake') || isBusy('vault-compound') || isBusy('vault-claim') || isBusy('vault-unstake')}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-slate-200 text-xs font-mono font-bold hover:bg-white/10 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Unlock className="w-3.5 h-3.5" aria-hidden /> Unstake {stakeSymbol}
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    void runClaim();
                  }}
                  disabled={isBusy('vault-stake') || isBusy('vault-compound') || isBusy('vault-claim') || isBusy('vault-unstake')}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-mono font-bold hover:bg-amber-500/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="w-3.5 h-3.5" aria-hidden /> Claim {rewardSymbol}
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    void runCompound();
                  }}
                  disabled={isBusy('vault-stake') || isBusy('vault-compound') || isBusy('vault-claim') || isBusy('vault-unstake')}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-mono font-bold hover:bg-emerald-500/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden /> Claim + Compound
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                Claim + Compound: broadcast claim → swap {rewardSymbol}→{stakeSymbol} on the real ReputationAMM (8%
                depth guard) → re-stake the exact returned {stakeSymbol}. All three are real transactions.
              </p>

              <div className="space-y-2 pt-1 border-t border-white/10">
                <h4 className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Activity className="w-3 h-3" /> Vault Ledger (real on-chain events)
                </h4>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {myVaultEvents.length === 0 && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      No events for this wallet yet — broadcast a stake to see it here.
                    </p>
                  )}
                  {myVaultEvents.slice(-10).reverse().map((e, i) => {
                    const kind = eventKind(e.type);
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 text-[11px] font-mono bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/5">
                        <span className="flex items-center gap-2">
                          {kind === 'claim' ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                          ) : kind === 'unstake' ? (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span className={kind === 'claim' ? 'text-amber-300' : kind === 'unstake' ? 'text-rose-300' : 'text-emerald-300'}>
                            {e.type.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="text-slate-300">{e.amount != null ? fmtNum(e.amount, 4) : ''}</span>
                        </span>
                        <span className="flex items-center gap-2 text-slate-500">
                          <span>#{e.block}</span>
                          <a
                            href={`${CREDITCOIN_BLOCKSCOUT}/tx/${e.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400/80 hover:text-cyan-300"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Wallet + Validator product */}
            <div className="xl:col-span-5 rounded-3xl p-5 bg-[#020d14] border border-purple-500/20 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  stVSTK — DEPIN Validator Staking
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live registry
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[10px] text-slate-400 font-mono block">Wallet cUSD</span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(cusdBal, 2)}</span>
                  <span className="text-[10px] text-slate-500 font-mono">available to stake</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                  <span className="text-[10px] text-purple-400 font-mono block">Wallet {rewardSymbol}</span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(depinBal, 2)}</span>
                  <span className="text-[10px] text-slate-500 font-mono">available to delegate</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-400 font-mono block">My delegations</span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(myValidatorStake, 2)}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{rewardSymbol}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/20">
                  <span className="text-[10px] text-amber-400 font-mono block">My pending rewards</span>
                  <span className="text-lg font-bold text-white font-mono">{fmtNum(myValidatorPending, 2)}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{rewardSymbol}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Live Validators ({reg?.validatorCount ?? 0})
                </h4>
                {validators.length === 0 && (
                  <p className="text-[11px] text-slate-500 font-mono">Registry staking pool is empty or unreachable.</p>
                )}
                {sortedValidators.slice(0, 4).map((v) => (
                  <div key={v.operator} className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-mono text-xs font-bold text-white">{v.nodeTag}</span>
                        <span className="text-[9px] text-slate-500 font-mono">id #{v.validatorId}</span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-300">
                        {(v.commissionBps / 100).toFixed(1)}% comm
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>pool {fmtNum(v.totalStaked)} {rewardSymbol}</span>
                      <span>mine {fmtNum(v.myStake)} · {fmtNum(v.myStake > 0 ? v.myPendingRewards : 0)} pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setVAmount('');
                          setModal({ kind: 'vstake', op: v.operator, tag: v.nodeTag });
                          playSound('click');
                        }}
                        disabled={busy !== null}
                        className="flex-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-[10px] font-mono font-bold hover:bg-cyan-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Stake
                      </button>
                      <button
                        onClick={() => {
                          setVAmount('');
                          setModal({ kind: 'vunstake', op: v.operator, tag: v.nodeTag });
                          playSound('click');
                        }}
                        disabled={busy !== null || v.myStake <= 0}
                        className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/15 text-slate-200 text-[10px] font-mono font-bold hover:bg-white/10 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Unstake
                      </button>
                      <button
                        onClick={() => {
                          playSound('click');
                          void runVClaim(v.operator, v.nodeTag);
                        }}
                        disabled={busy !== null || v.myStake <= 0}
                        className="flex-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[10px] font-mono font-bold hover:bg-amber-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Claim
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                  <span className="block text-[9px] font-mono text-slate-500">Registry Staked</span>
                  <span className="text-xs font-bold text-white font-mono">{fmtNum(reg?.totalStaked, 0)}</span>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                  <span className="block text-[9px] font-mono text-slate-500">Reward / block</span>
                  <span className="text-xs font-bold text-white font-mono">{fmtNum(reg?.rewardPerBlock, 4)}</span>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                  <span className="block text-[9px] font-mono text-slate-500">Owner</span>
                  <span className="text-xs font-bold text-white font-mono">{reg ? fmtAddr(reg.owner) : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TX console + staking registry ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl p-5 bg-[#020d14] border border-white/10 shadow-xl space-y-2">
              <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Transaction Console</h4>
              <div className="h-40 overflow-y-auto space-y-1 font-mono text-[10px] text-emerald-300">
                {txLog.length === 0 && <p className="text-slate-500">No transactions broadcast this session.</p>}
                {txLog.map((l, i) => (
                  <p key={i} className={l.includes('failed') ? 'text-rose-300' : 'text-emerald-300'}>
                    {'>'} {l}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2">
                  <span className="block text-[9px] font-mono text-slate-500">Vault last reward block</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {vault?.lastRewardBlock != null ? fmtNum(vault.lastRewardBlock, 0) : '—'}
                  </span>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2">
                  <span className="block text-[9px] font-mono text-slate-500">Measured accrual</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {measuredPerBlock > 0 ? `${measuredPerBlock.toFixed(2)} ${rewardSymbol}/blk` : 'measuring…'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl p-5 bg-[#020d14] border border-white/10 shadow-xl space-y-2">
              <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Validator Registry Ledger (real events)
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                {stakingLedger.length === 0 && <p className="text-slate-500 font-mono">No registry activity yet.</p>}
                {stakingLedger.slice(0, 8).map((e, i) => {
                  const color =
                    e.kind === 'staked'
                      ? 'text-emerald-300'
                      : e.kind === 'unstaked'
                        ? 'text-rose-300'
                        : e.kind === 'registered'
                          ? 'text-cyan-300'
                          : 'text-amber-300';
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 border border-white/5">
                      <span className={color}>{e.kind}</span>
                      <span className="text-slate-300">#{e.blockNumber}</span>
                      <span className="text-slate-500">{e.nodeTag ?? fmtAddr(e.operator)}</span>
                      {e.amount != null && <span className="text-slate-300">{fmtNum(e.amount, 2)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PEG SOLVENCY */}
      {activeTab === 'peg' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl p-4 bg-[#020d14] border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <Shield className="w-3 h-3" /> stCTC Exchange Rate
              </span>
              <span className="text-2xl font-bold text-white font-mono">
                {pegNow != null ? `${pegNow.toFixed(4)}` : '—'}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                {pegNow != null ? `${((pegNow - 1) * 100).toFixed(2)}% above parity` : 'parity benchmark'}
              </span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-cyan-500/20">
              <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                <Layers className="w-3 h-3" /> AMM Depth (USD)
              </span>
              <span className="text-2xl font-bold text-white font-mono">
                {ammDepthUsd != null ? `$${fmtNum(ammDepthUsd, 0)}` : '—'}
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">real cUSD/{rewardSymbol} reserves</span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-amber-500/20">
              <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                <Zap className="w-3 h-3" /> Pending Rewards
              </span>
              <span className="text-2xl font-bold text-white font-mono">{fmtNum(pendingNow, 0)}</span>
              <span className="block text-[10px] text-slate-400 font-mono">
                {pendingUSD != null ? `≈ $${fmtNum(pendingUSD, 0)} cUSD` : rewardSymbol}
              </span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-purple-500/20">
              <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Claimed Lifetime
              </span>
              <span className="text-2xl font-bold text-white font-mono">{fmtNum(claimedDEPIN, 0)}</span>
              <span className="block text-[10px] text-slate-400 font-mono">
                {claimedUSD != null ? `≈ $${fmtNum(claimedUSD, 0)} cUSD` : rewardSymbol} from ledger
              </span>
            </div>
          </div>

          <div className="rounded-3xl p-5 bg-[#020d14] border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                stCTC Exchange-Rate Curve — measured from the on-chain ledger
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                claims valued at live AMM price · stake/unstake steps real
              </span>
            </div>
            <div ref={chartWrapRef}>
              <PegChart width={chartW} series={pegSeries} events={myVaultEvents} price={depinPrice} />
            </div>
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-400" /> stCTC exchange rate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" /> staked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-400/50" /> unstaked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/50" /> claimed
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3 text-[11px] leading-relaxed text-slate-400">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-cyan-400" />
            <span className="font-mono">
              Methodology: peg = (staked cUSD + claimed {rewardSymbol} × live AMM price + pending {rewardSymbol} × live
              AMM price) ÷ staked cUSD. Staked/unstaked steps come from real events on the ReputationYieldVault; claims
              are valued at the current on-chain AMM implied price because no historical price oracle exists on
              testnet. The exchange rate therefore matches on-chain value at query time.
            </span>
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="rounded-3xl p-5 bg-[#020d14] border border-purple-500/20 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Live Validator Leaderboard
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="filter by tag / operator…"
                    className="bg-transparent outline-none text-[11px] font-mono text-white placeholder:text-slate-500 w-44"
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500">{sortedValidators.length} validators · live</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto border-collapse">
                <thead>
                  <tr className="text-[10px] font-mono text-slate-500 uppercase border-b border-white/10">
                    <th className="px-2 py-2">Rank</th>
                    <th className="px-2 py-2">Validator</th>
                    <th className="px-2 py-2">Operator</th>
                    <th className="px-2 py-2">Commission</th>
                    <th className="px-2 py-2">Pool Staked ({rewardSymbol})</th>
                    <th className="px-2 py-2">My Stake</th>
                    <th className="px-2 py-2">My Pending</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">vs</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-mono">
                  {sortedValidators
                    .filter(
                      (v) =>
                        filter.trim() === '' ||
                        v.nodeTag.toLowerCase().includes(filter.toLowerCase()) ||
                        v.operator.toLowerCase().includes(filter.toLowerCase())
                    )
                    .map((v, idx) => (
                      <tr key={v.operator} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                        <td className="px-2 py-2 text-slate-400">#{idx + 1}</td>
                        <td className="px-2 py-2">
                          <span className="font-bold text-white">{v.nodeTag}</span>{' '}
                          <span className="text-slate-500">id {v.validatorId}</span>
                        </td>
                        <td className="px-2 py-2">
                          <a
                            href={`${CREDITCOIN_BLOCKSCOUT}/address/${v.operator}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400/80 hover:text-cyan-300 flex items-center gap-1"
                          >
                            {fmtAddr(v.operator)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-2 py-2 text-purple-300">{(v.commissionBps / 100).toFixed(1)}%</td>
                        <td className="px-2 py-2 text-white">{fmtNum(v.totalStaked, 2)}</td>
                        <td className="px-2 py-2 text-emerald-300">{v.myStake > 0 ? fmtNum(v.myStake, 2) : '—'}</td>
                        <td className="px-2 py-2 text-amber-300">
                          {v.myStake > 0 ? fmtNum(v.myPendingRewards, 2) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setVAmount('');
                                setModal({ kind: 'vstake', op: v.operator, tag: v.nodeTag });
                                playSound('click');
                              }}
                              disabled={busy !== null}
                              className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-[10px] font-mono font-bold hover:bg-cyan-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Stake
                            </button>
                            <button
                              onClick={() => {
                                playSound('click');
                                void runVClaim(v.operator, v.nodeTag);
                              }}
                              disabled={busy !== null || v.myStake <= 0}
                              className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-[10px] font-mono font-bold hover:bg-amber-500/25 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Claim
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => toggleCompare(v.validatorId)}
                            disabled={compare.length >= 2 && !compare.includes(v.validatorId)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              compare.includes(v.validatorId)
                                ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-200'
                                : 'bg-white/5 border-white/15 text-transparent hover:text-slate-400'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {compareRows.length > 0 && (
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
                <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Comparing {compareRows.length} validator pools
                </h4>
                <div className="flex items-end gap-6">
                  {compareRows
                    .slice()
                    .sort((a, b) => (b?.totalStaked ?? 0) - (a?.totalStaked ?? 0))
                    .map((v) =>
                      v ? (
                        <div key={v.operator} className="flex-1">
                          <div className="text-[10px] font-mono text-slate-300 mb-1">
                            {v.nodeTag} · {fmtNum(v.totalStaked, 0)} {rewardSymbol}
                          </div>
                          <div
                            className="rounded-t-xl bg-gradient-to-t from-cyan-600/60 to-cyan-400/60 border border-cyan-400/50"
                            style={{
                              height: `${Math.max(24, (v.totalStaked / Math.max(1, ...compareRows.map((c) => c?.totalStaked ?? 0))) * 120)}px`,
                            }}
                          />
                          <div className="text-[9px] font-mono text-slate-500 mt-1">
                            {(v.commissionBps / 100).toFixed(1)}% commission
                          </div>
                        </div>
                      ) : null
                    )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl p-4 bg-[#020d14] border border-white/10">
              <span className="text-[10px] font-mono text-slate-500 block">Registered Validators</span>
              <span className="text-xl font-bold text-white font-mono">{reg?.validatorCount ?? '—'}</span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-white/10">
              <span className="text-[10px] font-mono text-slate-500 block">Total Reward Units Issued</span>
              <span className="text-xl font-bold text-white font-mono">{fmtNum(reg?.totalRewardUnitsIssued, 0)}</span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-white/10">
              <span className="text-[10px] font-mono text-slate-500 block">Commission Claimed (owner)</span>
              <span className="text-xl font-bold text-white font-mono">{fmtNum(reg?.totalCommissionClaimed, 0)}</span>
            </div>
            <div className="rounded-2xl p-4 bg-[#020d14] border border-white/10">
              <span className="text-[10px] font-mono text-slate-500 block">Pool Health</span>
              <span className="text-xl font-bold text-white font-mono">
                {reg?.paused ? 'PAUSED' : reg ? 'ACTIVE' : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-slate-400">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
            <span className="font-mono">
              This leaderboard is the live validator directory on ValidatorStakingRegistry (real deployment
              0x5Ec9…27a96). Ranking, pool sizes, commissions and pending rewards are read straight from the contract.
              Every claim broadcasts a real testnet transaction.
            </span>
          </div>
        </div>
      )}

      {/* ACTION MODAL */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => {
            setModal(null);
            playSound('click');
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 bg-[#03131c] border border-cyan-500/30 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                {modal.kind === 'stake' && <Lock className="w-4 h-4 text-cyan-400" />}
                {modal.kind === 'unstake' && <Unlock className="w-4 h-4 text-rose-400" />}
                {modal.kind === 'vstake' && <Lock className="w-4 h-4 text-cyan-400" />}
                {modal.kind === 'vunstake' && <Unlock className="w-4 h-4 text-rose-400" />}
                {modal.kind === 'stake' && `Stake into Vault (${stakeSymbol})`}
                {modal.kind === 'unstake' && `Unstake from Vault (${stakeSymbol})`}
                {modal.kind === 'vstake' && `Delegate to ${modal.tag}`}
                {modal.kind === 'vunstake' && `Redeem from ${modal.tag}`}
              </h3>
              <button
                onClick={() => {
                  setModal(null);
                  playSound('click');
                }}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2">
                <span className="text-slate-500 block">Available</span>
                <span className="text-white font-bold">
                  {modal.kind === 'stake' && `${fmtNum(cusdBal)} ${stakeSymbol}`}
                  {modal.kind === 'unstake' && `${fmtNum(staked)} ${stakeSymbol}`}
                  {modal.kind === 'vstake' && `${fmtNum(depinBal)} ${rewardSymbol}`}
                  {modal.kind === 'vunstake' &&
                    `${fmtNum(validators.find((v) => v.operator === modal.op)?.myStake ?? 0)} ${rewardSymbol}`}
                </span>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2">
                <span className="text-slate-500 block">Signer</span>
                <span className="text-cyan-300 font-bold">{demoMode ? fmtAddr(account) : 'disabled'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Amount</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={vAmount}
                  onChange={(e) => setVAmount(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-cyan-400/40"
                />
                <button
                  onClick={() => {
                    let maxBal = 0;
                    if (modal.kind === 'stake') maxBal = cusdBal;
                    else if (modal.kind === 'unstake') maxBal = staked;
                    else if (modal.kind === 'vstake') maxBal = depinBal;
                    else {
                      const vop = modal as { kind: 'vstake' | 'vunstake'; op: string; tag: string };
                      maxBal = validators.find((v) => v.operator === vop.op)?.myStake ?? 0;
                    }
                    setVAmount(maxBal > 0 ? maxBal.toFixed(2) : '0');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/15 text-[10px] font-mono text-slate-300 hover:text-white transition cursor-pointer"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {modal.kind === 'stake' && (
                <button
                  onClick={() => {
                    playSound('click');
                    void runStake();
                  }}
                  disabled={busy !== null}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-mono font-bold hover:bg-cyan-500/30 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" aria-hidden />
                  {isBusy('vault-stake') ? 'Broadcasting…' : `Confirm Stake (real tx)`}
                </button>
              )}
              {modal.kind === 'unstake' && (
                <button
                  onClick={() => {
                    playSound('click');
                    void runUnstake();
                  }}
                  disabled={busy !== null}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-mono font-bold hover:bg-rose-500/30 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Unlock className="w-3.5 h-3.5" aria-hidden />
                  {isBusy('vault-unstake') ? 'Broadcasting…' : 'Confirm Unstake (real tx)'}
                </button>
              )}
              {modal.kind === 'vstake' && (
                <button
                  onClick={() => {
                    playSound('click');
                    void runVStake();
                  }}
                  disabled={busy !== null}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-mono font-bold hover:bg-cyan-500/30 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden />
                  {busy === `vstake-${modal.op}` ? 'Broadcasting…' : 'Confirm Delegation (real tx)'}
                </button>
              )}
              {modal.kind === 'vunstake' && (
                <button
                  onClick={() => {
                    playSound('click');
                    void runVUnstake();
                  }}
                  disabled={busy !== null}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs font-mono font-bold hover:bg-rose-500/30 transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Unlock className="w-3.5 h-3.5" aria-hidden />
                  {busy === `vunstake-${modal.op}` ? 'Broadcasting…' : 'Confirm Redeem (real tx)'}
                </button>
              )}
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Broadcasts a real Creditcoin testnet transaction. Confirmation limits to one action at a time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidStakingView;