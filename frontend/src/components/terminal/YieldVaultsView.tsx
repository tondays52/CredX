import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Landmark,
  TrendingUp,
  Compass,
  Bot,
  Wallet,
  Lock,
  Unlock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ExternalLink,
  Check,
  AlertTriangle,
  Zap,
  Clock,
  Activity,
  CircleDot,
  Layers,
  Percent,
  DollarSign,
  ShieldCheck,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useWeb3 } from '../../context/Web3Context';
import {
  fetchCUSDBalance,
  fetchTokenBalance,
  fetchYieldVaultState,
  fetchYieldVaultEvents,
  vaultStake,
  vaultUnstake,
  vaultClaimRewards,
} from '../../services/credXService';
import { CONTRACTS } from '../../config/contracts';

type YieldVaultState = NonNullable<Awaited<ReturnType<typeof fetchYieldVaultState>>>;
type YieldVaultEvent = Awaited<ReturnType<typeof fetchYieldVaultEvents>>[number];

// ─── Types ──────────────────────────────────────────────────────────────────
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartSample {
  t: number;
  p: number;
}

interface Ticker {
  symbol: string;
  lastPrice: number;
  changePct: number;
}

type TabId = 'vault' | 'analytics' | 'sectors' | 'autopilot';
type Action = 'stake' | 'unstake' | 'claim';
type Timeframe = '1H' | '1D' | '1W' | '1M';

// ─── Real market / style constants ──────────────────────────────────────────
const TOKEN_STYLE: Record<string, { iconBg: string; iconText: string; color: string }> = {
  cUSD: { iconBg: '#083344', iconText: 'cUSD', color: '#38bdf8' },
  DEPIN: { iconBg: '#14532d', iconText: 'DPN', color: '#4ade80' },
  CTC: { iconBg: '#042f2e', iconText: 'CTC', color: '#00f2fe' },
  BTC: { iconBg: '#451a03', iconText: 'BTC', color: '#f59e0b' },
  ETH: { iconBg: '#1e1e38', iconText: 'ETH', color: '#a78bfa' },
  SOL: { iconBg: '#2e1065', iconText: 'SOL', color: '#c084fc' },
};

const FEED_ASSETS: { key: string; name: string; binance: string }[] = [
  { key: 'CTC', name: 'Creditcoin L1 Native', binance: 'CTCUSDT' },
  { key: 'BTC', name: 'Bitcoin (Wrapped CredX)', binance: 'BTCUSDT' },
  { key: 'ETH', name: 'Ethereum (CredX Bridge)', binance: 'ETHUSDT' },
  { key: 'SOL', name: 'Solana (Wormhole)', binance: 'SOLUSDT' },
];

const KLINE_INTERVAL: Record<Timeframe, string> = { '1H': '1h', '1D': '1d', '1W': '1w', '1M': '1M' };

const BLOCKSCOUT = 'https://creditcoin-testnet.blockscout.com';
const VAULT_ADDRESS = CONTRACTS.reputationYieldVault;
// Default blocks-per-day used only while the observed rate is still sampling.
const DEFAULT_BLOCKS_PER_DAY = 17280;

// ─── Real technical-indicator math (computed on real price series) ──────────
function emaArray(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i === 0 ? values[i] : values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function rsiValue(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return avgG === 0 ? null : 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function macdPoint(values: number[]): { macd: number; signal: number; hist: number } | null {
  if (values.length < 26) return null;
  const fast = emaArray(values, 12);
  const slow = emaArray(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaArray(line, 9);
  const last = values.length - 1;
  return { macd: line[last], signal: signal[last], hist: line[last] - signal[last] };
}

const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

const shortAddr = (a: string): string => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

const badge = (text: string, active: boolean, on: string, off: string): string =>
  active ? `px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${on}` : `px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${off}`;

export const YieldVaultsView: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore } = useProtocol();
  const { balanceCTC, address, isConnected, openConnectModal } = useWeb3();

  // ─── Navigation ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('vault');

  // ─── Real on-chain vault state ────────────────────────────────────────────
  const [vaultState, setVaultState] = useState<YieldVaultState | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [walletCusd, setWalletCusd] = useState(0);
  const [walletDepin, setWalletDepin] = useState(0);
  const [activity, setActivity] = useState<YieldVaultEvent[]>([]);
  const [lastTx, setLastTx] = useState<{ hash: string; label: string } | null>(null);
  const [blocksPerDay, setBlocksPerDay] = useState<number | null>(null);
  const blockRateRef = useRef<{ b: number; t: number } | null>(null);
  const [rewardSamples, setRewardSamples] = useState<ChartSample[]>([]);

  // ─── Stake / unstake / claim action ───────────────────────────────────────
  const [action, setAction] = useState<Action>('stake');
  const [actionAmount, setActionAmount] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // ─── Analytics (real Binance market) ──────────────────────────────────────
  const [feedKey, setFeedKey] = useState<string>('CTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rewardsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real 24h tickers for the market table
  const [tickers, setTickers] = useState<Ticker[]>([]);

  // ─── Sectors (real volatility from real daily candles) ────────────────────
  const [sectorData, setSectorData] = useState<
    { key: string; name: string; vol: number | null }[]
  >(() => FEED_ASSETS.map((f) => ({ key: f.key, name: f.name, vol: null })));

  // ─── Autopilot local simulator ────────────────────────────────────────────
  const [simAmount, setSimAmount] = useState('');
  const [simMode, setSimMode] = useState<'manual' | 'scheduled' | 'restake'>('manual');
  const [simRun, setSimRun] = useState(false);

  const stakingTokenSymbol = vaultState?.stakingToken.symbol ?? 'cUSD';
  const rewardTokenSymbol = vaultState?.rewardToken.symbol ?? 'DEPIN';
  const rewardTokenAddress = vaultState?.rewardToken.address ?? null;
  const creditMult = vaultState?.creditMult ?? 20;

  // ─── Real vault state polling (12s) ───────────────────────────────────────
  const refreshVault = useCallback(async () => {
    setVaultLoading(true);
    try {
      const s = await fetchYieldVaultState(address || '');
      setVaultState(s);
      if (s) {
        const now = Date.now();
        const prev = blockRateRef.current;
        if (prev && now - prev.t > 45000 && s.currentBlock > prev.b) {
          const bps = (s.currentBlock - prev.b) / ((now - prev.t) / 1000);
          if (bps > 0 && bps < 10) setBlocksPerDay(bps * 86400);
        }
        blockRateRef.current = { b: s.currentBlock, t: now };
        if (s.pendingRewards > 0) {
          setRewardSamples((prev) => {
            const last = prev[prev.length - 1];
            if (last && Math.abs(last.p - s.pendingRewards) / last.p < 0.0001) return prev;
            return [...prev, { t: now, p: s.pendingRewards }].slice(-240);
          });
        }
      }
    } catch {
      setVaultState(null);
    } finally {
      setVaultLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshVault();
    const id = setInterval(() => void refreshVault(), 12000);
    return () => clearInterval(id);
  }, [refreshVault]);

  // ─── Real wallet token balances (cUSD + DEPIN) ────────────────────────────
  useEffect(() => {
    if (!isConnected || !address) {
      setWalletCusd(0);
      setWalletDepin(0);
      return;
    }
    let dead = false;
    fetchCUSDBalance(address)
      .then((b) => { if (!dead) setWalletCusd(b); })
      .catch(() => {});
    if (rewardTokenAddress) {
      fetchTokenBalance(address, rewardTokenAddress)
        .then((b) => { if (!dead) setWalletDepin(b); })
        .catch(() => {});
    }
    return () => { dead = true; };
  }, [isConnected, address, rewardTokenAddress]);

  // ─── Real on-chain vault activity feed (25s) ──────────────────────────────
  useEffect(() => {
    let dead = false;
    const load = () =>
      fetchYieldVaultEvents(30)
        .then((a) => { if (!dead) setActivity(a); })
        .catch(() => {});
    void load();
    const id = setInterval(load, 25000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  // ─── Real Binance candles for the analytics chart ─────────────────────────
  useEffect(() => {
    let dead = false;
    const feed = FEED_ASSETS.find((f) => f.key === feedKey);
    if (!feed) {
      setCandles(null);
      return;
    }
    setMarketLoading(true);
    fetch(`https://api.binance.com/api/v3/klines?symbol=${feed.binance}&interval=${KLINE_INTERVAL[timeframe]}&limit=200`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (dead || !Array.isArray(raw) || raw.length === 0) return;
        setCandles(
          raw.map((k: any) => ({
            time: Number(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
          }))
        );
      })
      .catch(() => { if (!dead) setCandles(null); })
      .finally(() => { if (!dead) setMarketLoading(false); });
    return () => { dead = true; };
  }, [feedKey, timeframe]);

  // ─── Real 24h tickers (market table, 60s) ─────────────────────────────────
  useEffect(() => {
    let dead = false;
    const sync = () => {
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(FEED_ASSETS.map((f) => f.binance))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((arr) => {
          if (dead || !Array.isArray(arr)) return;
          setTickers(
            arr.map((t: any) => ({ symbol: String(t.symbol), lastPrice: parseFloat(t.lastPrice), changePct: parseFloat(t.priceChangePercent) }))
          );
        })
        .catch(() => {});
    };
    sync();
    const id = setInterval(sync, 60000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  // ─── Real realized volatility (sectors) from daily candles ────────────────
  useEffect(() => {
    let dead = false;
    Promise.all(
      FEED_ASSETS.map(async (f) => {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${f.binance}&interval=1d&limit=90`);
          if (!res.ok) return { key: f.key, vol: null };
          const raw = await res.json();
          const closes: number[] = (raw as any[]).map((k) => parseFloat(k[4]));
          const rets: number[] = [];
          for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
          if (rets.length < 10) return { key: f.key, vol: null };
          const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
          const vari = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
          return { key: f.key, vol: Math.sqrt(vari) * Math.sqrt(365) * 100 };
        } catch {
          return { key: f.key, vol: null };
        }
      })
    ).then((res) => {
      if (dead) return;
      setSectorData(
        res.map((r) => {
          const f = FEED_ASSETS.find((x) => x.key === r.key)!;
          const vol = r.vol;
          return { key: r.key, name: f.name, vol: vol == null ? null : vol };
        })
      );
    });
    return () => { dead = true; };
  }, []);

  // ─── Derived analytics values ─────────────────────────────────────────────
  const selectedFeed = FEED_ASSETS.find((f) => f.key === feedKey) || FEED_ASSETS[0];
  const activeStyle = TOKEN_STYLE[selectedFeed.key] || TOKEN_STYLE.CTC;

  const chartCloses = useMemo(() => (candles ? candles.map((c) => c.close) : []), [candles]);

  const indicators = useMemo(() => {
    if (chartCloses.length < 2) return null;
    return {
      ema9: emaArray(chartCloses, 9).pop() as number,
      ema21: emaArray(chartCloses, 21).pop() as number,
      rsi: rsiValue(chartCloses),
      macd: macdPoint(chartCloses),
      last: chartCloses[chartCloses.length - 1],
      first: chartCloses[0],
      count: chartCloses.length,
    };
  }, [chartCloses]);

  const marketChange = useMemo(
    () => (indicators && indicators.first > 0 ? ((indicators.last - indicators.first) / indicators.first) * 100 : null),
    [indicators]
  );

  const tickerFor = (key: string) => tickers.find((t) => t.symbol === `${key}USDT`) || null;

  // ─── Reward accrual model (read straight from the deployed contract) ──────
  const blocksPerDayObserved = blocksPerDay ?? DEFAULT_BLOCKS_PER_DAY;
  const rewardPerDayModel = useMemo(
    () => (amt: number) => (amt * creditMult * blocksPerDayObserved) / 100,
    [creditMult, blocksPerDayObserved]
  );

  const projectedRewards = useMemo(() => {
    const staked = vaultState?.stakedByUser ?? 0;
    if (staked <= 0) return null;
    const perDay = rewardPerDayModel(staked);
    const days = [7, 14, 30];
    return {
      perDay,
      series: days.map((d) => ({ day: d, depin: perDay * d })),
    };
  }, [vaultState, rewardPerDayModel]);

  const autopilotProjection = useMemo(() => {
    if (!simRun) return null;
    const amt = parseFloat(simAmount) || 0;
    if (amt <= 0) return null;
    const perDay = rewardPerDayModel(amt);
    return {
      amount: amt,
      perDay,
      series: Array.from({ length: 31 }, (_, i) => ({ day: i, depin: perDay * i })),
    };
  }, [simRun, simAmount, rewardPerDayModel]);

  // ─── Analytics price chart canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = 240;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padLeft = 46;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (chartCloses.length < 2) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(marketLoading ? 'Fetching real Binance candles…' : 'No candles available right now.', width / 2, height / 2);
      return;
    }

    const minVal = Math.min(...chartCloses) * 0.998;
    const maxVal = Math.max(...chartCloses) * 1.002;
    const range = maxVal - minVal || 1;

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      const val = maxVal - (range / 4) * i;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val < 10 ? val.toFixed(4) : val.toLocaleString('en-US', { maximumFractionDigits: 2 }), padLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    const N = chartCloses.length;
    const xOf = (i: number) => padLeft + (i / (N - 1)) * chartW;
    const yOf = (v: number) => padTop + chartH - ((v - minVal) / range) * chartH;

    const drawSeries = (arr: number[], color: string, lineWidth: number) => {
      ctx.beginPath();
      arr.forEach((v, idx) => {
        const x = xOf(idx);
        const y = yOf(v);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    drawSeries(emaArray(chartCloses, 9), '#22d3ee', 1.2);
    drawSeries(emaArray(chartCloses, 21), '#c084fc', 1.2);

    ctx.beginPath();
    chartCloses.forEach((v, idx) => {
      const x = xOf(idx);
      const y = yOf(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.save();
    ctx.lineTo(xOf(N - 1), padTop + chartH);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    chartCloses.forEach((v, idx) => {
      const x = xOf(idx);
      const y = yOf(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastY = yOf(chartCloses[N - 1]);
    ctx.beginPath();
    ctx.arc(xOf(N - 1), lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = activeStyle.color;
    ctx.shadowColor = activeStyle.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ['← oldest', '', '', '', 'Now'].forEach((lbl, i) => {
      ctx.fillText(lbl, padLeft + (i / 4) * chartW, height - 8);
    });
  }, [chartCloses, marketLoading, activeStyle.color]);

  // ─── Real rewards-accrual canvas (live pendingRewards series) ─────────────
  useEffect(() => {
    const canvas = rewardsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = 150;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (rewardSamples.length < 2) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No live reward accrual to plot yet — stake cUSD and this fills from real on-chain reads.', width / 2, height / 2);
      return;
    }

    const padLeft = 46;
    const padRight = 20;
    const padTop = 16;
    const padBottom = 24;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const maxP = Math.max(...rewardSamples.map((s) => s.p)) * 1.05;
    const minP = 0;
    const range = maxP - minP || 1;
    const N = rewardSamples.length;

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      const val = maxP - (range / 3) * i;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(val < 1 ? 6 : 3), padLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    ctx.beginPath();
    rewardSamples.forEach((s, idx) => {
      const x = padLeft + (idx / (N - 1)) * chartW;
      const y = padTop + chartH - ((s.p - minP) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const lastP = rewardSamples[N - 1].p;
    ctx.beginPath();
    ctx.arc(padLeft + chartW, padTop + chartH - ((lastP - minP) / range) * chartH, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4ade80';
    ctx.fill();
  }, [rewardSamples]);

  // ─── Wallet guard ─────────────────────────────────────────────────────────
  const requireWallet = useCallback((): boolean => {
    if (!isConnected && openConnectModal) openConnectModal();
    if (!isConnected || !address) {
      showToast('Connect a Wallet', 'Connect a wallet to interact with the ReputationYieldVault on Creditcoin testnet.', 'error');
      return false;
    }
    return true;
  }, [isConnected, openConnectModal, address, showToast]);

  // ─── Execute real stake / unstake / claim ─────────────────────────────────
  const handleAction = async () => {
    if (!requireWallet()) return;
    const amt = parseFloat(actionAmount);
    if (action !== 'claim') {
      if (!isFinite(amt) || amt <= 0) {
        showToast('Invalid Amount', 'Enter a valid amount.', 'error');
        return;
      }
      if (action === 'stake' && amt > walletCusd) {
        showToast('Insufficient Balance', `You have ${fmtNum(walletCusd)} cUSD.`, 'error');
        return;
      }
      if (action === 'unstake' && amt > (vaultState?.stakedByUser ?? 0)) {
        showToast('Insufficient Stake', `You only have ${fmtNum(vaultState?.stakedByUser ?? 0)} cUSD staked.`, 'error');
        return;
      }
    }
    if (action === 'claim' && (vaultState?.pendingRewards ?? 0) <= 0) {
      showToast('Nothing to Claim', 'You have no pending DEPIN rewards on-chain.', 'error');
      return;
    }
    setActionBusy(true);
    try {
      let hash: string;
      let label: string;
      if (action === 'stake') {
        hash = await vaultStake(amt);
        label = `Staked ${fmtNum(amt)} cUSD`;
      } else if (action === 'unstake') {
        hash = await vaultUnstake(amt);
        label = `Unstaked ${fmtNum(amt)} cUSD`;
      } else {
        hash = await vaultClaimRewards();
        label = `Claimed ${fmtNum(vaultState?.pendingRewards ?? 0, 4)} DEPIN`;
      }
      setLastTx({ hash, label });
      setActionAmount('');
      setSimRun(false);
      showToast('Transaction Sent', `${label} — awaiting confirmation on Creditcoin testnet.`, 'success');
      playSound('success');
      void refreshVault();
    } catch (e: any) {
      showToast('Transaction Failed', e?.shortMessage || e?.message || 'The transaction was rejected.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // ─── Autopilot local-simulator run ────────────────────────────────────────
  const runSimulation = () => {
    if (!requireWallet()) return;
    const amt = parseFloat(simAmount);
    if (!isFinite(amt) || amt <= 0) {
      showToast('Invalid Amount', 'Enter a cUSD amount to simulate.', 'error');
      return;
    }
    if (amt > walletCusd) {
      showToast('Exceeds Balance', `You only have ${fmtNum(walletCusd)} cUSD.`, 'error');
      return;
    }
    setSimRun(true);
    playSound('click');
  };

  const tabs: { id: TabId; label: string; icon: any; badge?: string }[] = [
    { id: 'vault', label: 'Reputation Yield Vault (Live On-Chain)', icon: Landmark },
    { id: 'analytics', label: 'Analytics, Indicators & Yields', icon: TrendingUp },
    { id: 'sectors', label: 'Market Sectors (Real Volatility)', icon: Compass },
    { id: 'autopilot', label: 'Financial Autopilot (Local Simulator)', icon: Bot, badge: 'SIM' },
  ];

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* ═══ HEADER: Live ReputationYieldVault metrics ═══ */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#03131c] via-[#041a26] to-[#020b12] border border-cyan-500/25 shadow-2xl space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-2">
            <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Your Position — ReputationYieldVault
            </span>
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Your Staked cUSD</span>
                <span className="text-lg font-black text-white">
                  {vaultState ? fmtNum(vaultState.stakedByUser, 4) : '—'}
                </span>
                <span className="text-[9px] text-cyan-400 block">
                  {vaultState ? `last reward block #${vaultState.lastRewardBlock.toLocaleString()}` : isConnected ? 'Read unavailable' : 'Connect wallet'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Pending DEPIN Rewards</span>
                <span className="text-lg font-black text-emerald-400">
                  {vaultState ? fmtNum(vaultState.pendingRewards, 6) : '—'}
                </span>
                <span className="text-[9px] text-emerald-400 block">read from stakers() on-chain</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Wallet cUSD</span>
                <span className="text-lg font-black text-cyan-300">
                  {isConnected ? fmtNum(walletCusd, 4) : '—'}
                </span>
                <span className="text-[9px] text-slate-500 block">ERC-20 balance</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Wallet DEPIN</span>
                <span className="text-lg font-black text-emerald-400">
                  {isConnected ? fmtNum(walletDepin, 4) : '—'}
                </span>
                <span className="text-[9px] text-slate-500 block">reward token</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Wallet CTC</span>
                <span className="text-lg font-black text-cyan-300">
                  {isConnected ? (balanceCTC > 0 ? fmtNum(balanceCTC) : '0') : '—'}
                </span>
                <span className="text-[9px] text-slate-500 block">L1 native gas</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Credit Multiplier</span>
                <span className="text-lg font-black text-purple-300">×{creditMult}</span>
                <span className="text-[9px] text-purple-300 block">oracle down → default tier</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-2">
            <span className="text-[10px] font-mono uppercase text-purple-400 font-bold tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              Contract Facts (verified on CC3 testnet)
            </span>
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Total Staked</span>
                <span className="text-lg font-black text-white">—</span>
                <span className="text-[9px] text-slate-500 block">no global getter on vault</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Current Block</span>
                <span className="text-lg font-black text-white">
                  {vaultState ? vaultState.currentBlock.toLocaleString() : '—'}
                </span>
                <span className="text-[9px] text-slate-500 block">blocks/day {blocksPerDay ? fmtNum(blocksPerDay, 0) : 'observing…'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Deployed @</span>
                <span className="text-lg font-black text-purple-300">5,457,751</span>
                <span className="text-[9px] text-slate-500 block">1 tx · never staked</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
              <a
                href={`${BLOCKSCOUT}/address/${VAULT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 font-bold flex items-center gap-1.5 hover:bg-cyan-500/20 transition"
              >
                {shortAddr(VAULT_ADDRESS)} <ExternalLink className="w-3 h-3" />
              </a>
              <span className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-slate-400">
                stake {stakingTokenSymbol} → earn {rewardTokenSymbol}
              </span>
              <button
                onClick={() => { void refreshVault(); playSound('click'); }}
                className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[10px] text-slate-300 font-bold flex items-center gap-1.5 hover:bg-white/5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${vaultLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="flex flex-wrap items-center gap-2 border-t border-cyan-500/15 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); playSound('click'); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? tab.id === 'autopilot'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.35)]'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gradient-to-r from-purple-500 to-cyan-400 text-slate-950 uppercase tracking-tight">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          VAULT TAB — real staking terminal
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action ticket */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-300" /> Vault Action
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Stake cUSD, earn DEPIN. Real transactions on Creditcoin testnet.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {(['stake', 'unstake', 'claim'] as Action[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAction(a); setActionAmount(''); playSound('click'); }}
                    className={`px-3 py-2 rounded-xl text-[11px] font-mono font-bold uppercase transition cursor-pointer ${
                      action === a ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30' : 'bg-black/50 text-slate-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>

              {action !== 'claim' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                      <span>Amount ({stakingTokenSymbol})</span>
                      <span>
                        Available:{' '}
                        <strong className="text-cyan-300">
                          {action === 'stake' ? fmtNum(walletCusd, 4) : fmtNum(vaultState?.stakedByUser ?? 0, 4)}
                        </strong>
                      </span>
                    </div>
                    <input
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min={0}
                      className="w-full bg-black/50 border border-cyan-500/25 rounded-xl px-4 py-3 font-mono text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-600"
                    />
                    {action === 'stake' && !vaultState && (
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                        <Info className="w-3 h-3" /> Vault read unavailable — balances may be stale.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleAction}
                    disabled={actionBusy}
                    className="w-full py-3.5 rounded-xl font-bold font-mono text-sm bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : action === 'stake' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {actionBusy ? 'Broadcasting…' : action === 'stake' ? `Stake ${stakingTokenSymbol}` : `Unstake ${stakingTokenSymbol}`}
                  </button>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/25 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-mono">Claimable now</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {vaultState ? fmtNum(vaultState.pendingRewards, 6) : '—'} <span className="text-xs text-emerald-400/70">{rewardTokenSymbol}</span>
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                  <button
                    onClick={handleAction}
                    disabled={actionBusy || (vaultState?.pendingRewards ?? 0) <= 0}
                    className="w-full py-3.5 rounded-xl font-bold font-mono text-sm bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {actionBusy ? 'Broadcasting…' : 'Claim Rewards'}
                  </button>
                </>
              )}

              {lastTx && (
                <a
                  href={`${BLOCKSCOUT}/tx/${lastTx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" /> {lastTx.label}
                  </span>
                  <span className="flex items-center gap-1">{shortAddr(lastTx.hash)} <ExternalLink className="w-3 h-3" /></span>
                </a>
              )}
            </div>

            {/* Position + economics */}
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-300" /> Your Position
                </h3>
                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    <span className="text-[9px] text-slate-400 block uppercase">Staked</span>
                    <span className="text-lg font-black text-white">{vaultState ? fmtNum(vaultState.stakedByUser, 4) : '—'} <span className="text-xs text-slate-400">{stakingTokenSymbol}</span></span>
                  </div>
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    <span className="text-[9px] text-slate-400 block uppercase">Pending</span>
                    <span className="text-lg font-black text-emerald-400">{vaultState ? fmtNum(vaultState.pendingRewards, 6) : '—'} <span className="text-xs text-slate-400">{rewardTokenSymbol}</span></span>
                  </div>
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    <span className="text-[9px] text-slate-400 block uppercase">Multiplier</span>
                    <span className="text-lg font-black text-purple-300">×{creditMult}</span>
                  </div>
                </div>
                {!vaultState && (
                  <p className="flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                    <AlertTriangle className="w-3 h-3" /> This vault has never been staked (all on-chain positions are zero).
                  </p>
                )}
              </div>

              <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-cyan-300" /> Vault Economics
                  </h3>
                  <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono font-bold text-cyan-300 uppercase">Contract model</span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                  Rewards accrue per block under the deployed contract: <span className="text-cyan-300">≈ staked × creditMultiplier / denomination</span>.
                  The denominator is read on-chain (= <strong className="text-white">100</strong>). The credit-oracle call the vault makes to the hub
                  currently reverts on the testnet, so the contract falls back to the default{' '}
                  <strong className="text-purple-300">×20</strong> multiplier.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-2.5 rounded-xl bg-black/50 border border-purple-500/20">
                    <span className="text-[9px] text-slate-400 block uppercase">Score &lt; 650</span>
                    <span className="text-sm font-black text-purple-300">×10</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/50 border border-purple-500/20">
                    <span className="text-[9px] text-slate-400 block uppercase">Score ≥ 650</span>
                    <span className="text-sm font-black text-purple-300">×15</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/50 border border-cyan-500/30">
                    <span className="text-[9px] text-slate-400 block uppercase">Score ≥ 780 / Default</span>
                    <span className="text-sm font-black text-cyan-300">×20</span>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-slate-500">
                  Multipliers and thresholds were read from the deployed runtime bytecode. APY figures here are projections under this model — never a promise.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real activity feed */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-300" /> On-Chain Activity
              </h3>
              {activity.length === 0 ? (
                <div className="p-5 rounded-2xl bg-black/50 border border-white/10 text-center">
                  <CircleDot className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="mt-2 text-[11px] font-mono text-slate-400">
                    No Staked / Unstaked / claim events yet — the vault has never been used.
                  </p>
                  <p className="text-[10px] font-mono text-slate-600 mt-1">Be the first to stake.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {activity.map((ev, i) => (
                    <a
                      key={`${ev.txHash}-${i}`}
                      href={`${BLOCKSCOUT}/tx/${ev.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 hover:border-cyan-500/30 transition group"
                    >
                      <span className="flex items-center gap-2 font-mono text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            ev.type === 'Staked' ? 'bg-cyan-500/15 text-cyan-300' : ev.type === 'Unstaked' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          {ev.type}
                        </span>
                        <span className="text-slate-400">user {shortAddr(ev.user)}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        block {ev.block}
                        <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Real market table */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Landmark className="w-4 h-4 text-cyan-300" /> Market Context
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px]">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: TOKEN_STYLE.cUSD.iconBg, color: TOKEN_STYLE.cUSD.color }}>
                      cUSD
                    </span>
                    <span className="text-slate-300 font-bold">cUSD</span>
                  </span>
                  <span className="text-white font-bold">$1.0000</span>
                  <span className={badge('peg', true, 'bg-sky-500/15 text-sky-300', '')}>suite stable peg</span>
                </div>
                {FEED_ASSETS.map((f) => {
                  const t = tickerFor(f.key);
                  const st = TOKEN_STYLE[f.key] || TOKEN_STYLE.CTC;
                  const up = (t?.changePct ?? 0) >= 0;
                  return (
                    <div key={f.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px]">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: st.iconBg, color: st.color }}>
                          {st.iconText}
                        </span>
                        <span className="text-slate-300 font-bold">{f.key}</span>
                      </span>
                      <span className="text-white font-bold">{t ? `$${fmtNum(t.lastPrice, 4)}` : '…'}</span>
                      <span className={`flex items-center gap-1 font-bold ${t ? (up ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-600'}`}>
                        {t ? (
                          <>
                            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(t.changePct).toFixed(2)}% <span className="text-slate-600 font-normal">24h</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px]">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: TOKEN_STYLE.DEPIN.iconBg, color: TOKEN_STYLE.DEPIN.color }}>
                      DPN
                    </span>
                    <span className="text-slate-300 font-bold">DEPIN</span>
                  </span>
                  <span className="text-white font-bold">—</span>
                  <span className={badge('nodata', true, 'bg-slate-500/15 text-slate-400', '')}>no market feed (empty pool)</span>
                </div>
              </div>
              <p className="text-[10px] font-mono text-slate-500">
                Prices from Binance public API (24h). cUSD is the suite stablecoin (peg $1.00). DEPIN has no secondary market — the ReputationAMM pool is empty on-chain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ANALYTICS TAB — real indicators on real Binance candles
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#03131c] via-[#041a26] to-[#020b12] border border-cyan-500/25 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-300" /> Technical Indicators — Live Binance Feed
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {selectedFeed.name} ({selectedFeed.binance}) · real candles · real EMA/RSI/MACD math
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {FEED_ASSETS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setFeedKey(f.key); playSound('click'); }}
                    className={`px-3 py-2 rounded-xl text-[11px] font-mono font-bold transition cursor-pointer ${
                      feedKey === f.key ? 'bg-cyan-500 text-slate-950' : 'bg-black/50 text-slate-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {f.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(Object.keys(KLINE_INTERVAL) as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => { setTimeframe(tf); playSound('click'); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                    timeframe === tf ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50' : 'bg-black/40 text-slate-500 border border-white/10 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
              {indicators && (
                <span className="ml-auto text-[10px] font-mono text-slate-400">
                  last <strong className="text-white">${fmtNum(indicators.last, 4)}</strong>
                  <span className={`ml-2 font-bold ${marketChange != null && marketChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {marketChange != null ? `${marketChange >= 0 ? '+' : ''}${marketChange.toFixed(2)}%` : ''}
                  </span>
                </span>
              )}
            </div>

            <canvas ref={chartCanvasRef} className="w-full h-60 rounded-2xl bg-[#020b12] border border-white/10" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">EMA 9</span>
                <span className="text-base font-black text-cyan-300 font-mono">{indicators ? fmtNum(indicators.ema9, 4) : '—'}</span>
                {indicators && <span className="text-[10px] font-mono text-slate-500">{indicators.ema9 > indicators.ema21 ? 'bullish (above EMA21)' : 'bearish (below EMA21)'}</span>}
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">EMA 21</span>
                <span className="text-base font-black text-purple-300 font-mono">{indicators ? fmtNum(indicators.ema21, 4) : '—'}</span>
                {indicators && <span className="text-[10px] font-mono text-slate-500">{indicators.ema9 > indicators.ema21 ? 'trend confirmation' : 'risk signal'}</span>}
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/20">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">RSI 14</span>
                <span className={`text-base font-black font-mono ${indicators?.rsi == null ? '' : indicators.rsi >= 70 ? 'text-rose-400' : indicators.rsi <= 30 ? 'text-emerald-400' : 'text-white'}`}>
                  {indicators?.rsi == null ? '—' : fmtNum(indicators.rsi, 1)}
                </span>
                {indicators?.rsi != null && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {indicators.rsi >= 70 ? 'overbought' : indicators.rsi <= 30 ? 'oversold' : 'neutral'}
                  </span>
                )}
              </div>
              <div className="p-3 rounded-2xl bg-black/50 border border-yellow-500/20">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">MACD (12/26/9)</span>
                {indicators?.macd ? (
                  <>
                    <span className={`text-base font-black font-mono ${indicators.macd.hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtNum(indicators.macd.hist, 5)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      line {fmtNum(indicators.macd.macd, 4)} · signal {fmtNum(indicators.macd.signal, 4)} · {indicators.macd.hist >= 0 ? 'momentum +' : 'momentum −'}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-black text-slate-500 font-mono">—</span>
                )}
              </div>
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Price, EMA9/EMA21 overlays and chips are computed in-browser on the real Binance candle series. This is live market data — not simulated.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real rewards accrual */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-emerald-500/25 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Live Reward Accrual (on-chain)
              </h3>
              <canvas ref={rewardsCanvasRef} className="w-full h-40 rounded-2xl bg-[#020b12] border border-white/10" />
              <p className="text-[10px] font-mono text-slate-500">
                Real <span className="text-emerald-400">pendingRewards</span> reads from <span className="text-white">stakers({shortAddr(address || '0x0')})</span>, sampled every 12s while your position accrues.
              </p>
            </div>

            {/* Honest projection model */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-4 h-4 text-cyan-300" /> Yield Projection (model)
                </h3>
                <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[9px] font-mono font-bold text-amber-300 uppercase">projection</span>
              </div>
              {projectedRewards ? (
                <>
                  <p className="text-[11px] font-mono text-slate-400">
                    With your real stake of <strong className="text-white">{fmtNum(vaultState?.stakedByUser ?? 0, 4)} cUSD</strong> at <strong className="text-purple-300">×{creditMult}</strong> and the observed network rate of{' '}
                    <strong className="text-white">{fmtNum(blocksPerDayObserved, 0)} blocks/day</strong>:
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center font-mono">
                    {projectedRewards.series.map((s) => (
                      <div key={s.day} className="p-3 rounded-2xl bg-black/50 border border-emerald-500/20">
                        <span className="text-[9px] text-slate-400 block uppercase">Day {s.day}</span>
                        <span className="text-base font-black text-emerald-400">+{fmtNum(s.depin, 4)}</span>
                        <span className="text-[9px] text-slate-500 block">{rewardTokenSymbol}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-amber-300/80 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Linear model using the deployed per-block formula. Rewards are only claimable if you have a live on-chain position — this is a projection, not an APY promise.
                  </p>
                </>
              ) : (
                <p className="text-[11px] font-mono text-slate-400">
                  Stake cUSD in the vault to see your projected <span className="text-emerald-400">{rewardTokenSymbol}</span> accrual under the deployed model.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTORS TAB — real volatility map
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sectors' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-300" /> Market Sectors — Real Volatility Map
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Annualized realized volatility computed in-browser from real Binance daily candles (last 90 days). X-axis = strategy duration — only single-asset spot is real on the testnet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FEED_ASSETS.map((f) => {
                const s = sectorData.find((x) => x.key === f.key);
                const st = TOKEN_STYLE[f.key] || TOKEN_STYLE.CTC;
                const vol = s?.vol ?? null;
                const bucket = vol == null ? 'no data' : vol < 20 ? 'Low Volatility' : vol < 50 ? 'Medium' : vol < 100 ? 'High' : 'Exotic';
                const barPct = vol == null ? 0 : Math.min(100, vol);
                return (
                  <div key={f.key} className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-mono text-xs">
                        <span className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black" style={{ background: st.iconBg, color: st.color }}>{st.iconText}</span>
                        <span className="text-white font-bold">{f.key}</span>
                        <span className="text-slate-500 text-[10px]">{f.name}</span>
                      </span>
                      <span
                        className={`px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase ${
                          bucket === 'Exotic' ? 'bg-rose-500/15 text-rose-300' : bucket === 'High' ? 'bg-amber-500/15 text-amber-300' : bucket === 'Medium' ? 'bg-yellow-500/10 text-yellow-200' : vol == null ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {bucket}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                        {vol != null && (
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: st.color }} />
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-white w-20 text-right shrink-0">
                        {vol == null ? '—' : `${vol.toFixed(1)}% vol`}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500">
                      Duration: <span className="text-slate-300">single-asset spot</span> · 365d annualized, {sectorData.find((x) => x.key === f.key)?.vol != null ? 'from 90 daily candles' : 'fetching real candles…'}
                    </p>
                  </div>
                );
              })}

              <div className="p-4 rounded-2xl bg-black/50 border border-sky-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black" style={{ background: TOKEN_STYLE.cUSD.iconBg, color: TOKEN_STYLE.cUSD.color }}>cUSD</span>
                    <span className="text-white font-bold">cUSD</span>
                    <span className="text-slate-500 text-[10px]">Creditcoin Stable USD</span>
                  </span>
                  <span className="px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300">pegged</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '2%', background: TOKEN_STYLE.cUSD.color }} />
                  </div>
                  <span className="font-mono text-xs font-bold text-white w-20 text-right shrink-0">0% vol</span>
                </div>
                <p className="text-[10px] font-mono text-slate-500">Suite stablecoin — peg fixed at <span className="text-slate-300">$1.00</span> by definition.</p>
              </div>

              <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black" style={{ background: TOKEN_STYLE.DEPIN.iconBg, color: TOKEN_STYLE.DEPIN.color }}>DPN</span>
                    <span className="text-white font-bold">DEPIN</span>
                    <span className="text-slate-500 text-[10px]">reward token</span>
                  </span>
                  <span className="px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase bg-slate-500/10 text-slate-400">no feed</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden" />
                  <span className="font-mono text-xs font-bold text-slate-500 w-20 text-right shrink-0">—</span>
                </div>
                <p className="text-[10px] font-mono text-slate-500">Reward token of the ReputationYieldVault. No secondary market — ReputationAMM pool is empty on-chain.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AUTOPILOT TAB — honest local simulator
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'autopilot' && (
        <div className="space-y-6">
          {/* Disclaimer banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#2b0a1a] via-[#1b0a2e] to-[#0a1a2b] border border-purple-500/35 shadow-2xl flex items-start gap-3.5 font-mono">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">Local Simulator — No On-Chain Autopilot</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                There is no autopilot or intent-solver contract deployed on the testnet, so this terminal runs <strong className="text-white">entirely in your browser</strong>.
                It is anchored to <strong className="text-cyan-300">real inputs</strong> — your real wallet balances, your real vault position, the real network block rate and real market prices.
                No wallet transaction is sent.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real inputs */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-cyan-500/25 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-300" /> Real Inputs
              </h3>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Wallet cUSD</span>
                  <span className="text-base font-black text-cyan-300">{isConnected ? fmtNum(walletCusd, 4) : '—'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Wallet DEPIN</span>
                  <span className="text-base font-black text-emerald-400">{isConnected ? fmtNum(walletDepin, 4) : '—'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Vault Staked</span>
                  <span className="text-base font-black text-white">{vaultState ? fmtNum(vaultState.stakedByUser, 4) : '—'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Pending DEPIN</span>
                  <span className="text-base font-black text-emerald-400">{vaultState ? fmtNum(vaultState.pendingRewards, 6) : '—'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Network Rate</span>
                  <span className="text-base font-black text-white">{blocksPerDay ? `${fmtNum(blocksPerDay, 0)} b/d` : 'observing…'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-[9px] text-slate-400 block uppercase">Current Block</span>
                  <span className="text-base font-black text-white">{vaultState ? vaultState.currentBlock.toLocaleString() : '—'}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20 font-mono text-[11px] space-y-2">
                <span className="text-[10px] text-emerald-300 uppercase font-bold block">Live market context</span>
                {FEED_ASSETS.map((f) => {
                  const t = tickerFor(f.key);
                  return (
                    <div key={f.key} className="flex items-center justify-between">
                      <span className="text-slate-400">{f.key} / USDT</span>
                      <span className="text-white">{t ? `$${fmtNum(t.lastPrice, 4)}` : '…'}</span>
                      <span className={t && t.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {t ? `${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(2)}%` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulator */}
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-purple-500/25 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-300" /> Simulated Allocation
              </h3>

              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                  <span>cUSD to allocate (simulated)</span>
                  <span>max {isConnected ? fmtNum(walletCusd, 4) : '—'} cUSD</span>
                </div>
                <input
                  value={simAmount}
                  onChange={(e) => { setSimAmount(e.target.value); setSimRun(false); }}
                  placeholder="0.00"
                  type="number"
                  min={0}
                  className="w-full bg-black/50 border border-purple-500/25 rounded-xl px-4 py-3 font-mono text-white text-sm outline-none focus:border-purple-400 placeholder:text-slate-600"
                />
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">Operating mode</span>
                <div className="flex items-center gap-2">
                  {([
                    { id: 'manual', label: 'Manual' },
                    { id: 'scheduled', label: 'Scheduled Harvest' },
                    { id: 'restake', label: 'Re-Stake Loop' },
                  ] as const).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSimMode(m.id); setSimRun(false); playSound('click'); }}
                      className={`px-3 py-2 rounded-xl text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                        simMode === m.id ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50' : 'bg-black/50 text-slate-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-mono text-slate-500">
                  {simMode === 'manual' && 'Same as the Vault tab — stake docs, claim when you want. Fully on-chain actions.'}
                  {simMode === 'scheduled' && 'Imagined calendar harvest. No autopilot contract exists on the testnet — this is a local idea, not a live system.'}
                  {simMode === 'restake' && 'Reward re-stake loop. Note: the deployed vault only accepts cUSD, so DEPIN rewards cannot be compounded back into stake.'}
                </p>
              </div>

              <button
                onClick={runSimulation}
                disabled={actionBusy}
                className="w-full py-3.5 rounded-xl font-bold font-mono text-sm bg-gradient-to-r from-purple-500 to-cyan-400 hover:from-purple-400 hover:to-cyan-300 text-slate-950 shadow-xl shadow-purple-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Run Local Projection
              </button>
            </div>
          </div>

          {autopilotProjection && (
            <div className="p-6 rounded-3xl bg-[#03131c]/80 border border-purple-500/25 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-300" /> Projected {rewardTokenSymbol} Accrual
                </h3>
                <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[9px] font-mono font-bold text-amber-300 uppercase">simulated</span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Simulating <strong className="text-white">{fmtNum(autopilotProjection.amount, 4)} cUSD</strong> staked at <strong className="text-purple-300">×{creditMult}</strong> multiplier, assuming <strong className="text-white">{fmtNum(blocksPerDayObserved, 0)} blocks/day</strong> (observed). ~{' '}
                <strong className="text-emerald-400">{fmtNum(autopilotProjection.perDay, 6)} {rewardTokenSymbol}/day</strong> under the deployed model.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center font-mono">
                {[7, 14, 30].map((day) => {
                  const row = autopilotProjection.series[day];
                  return (
                    <div key={day} className="p-4 rounded-2xl bg-black/50 border border-emerald-500/20">
                      <span className="text-[10px] text-slate-400 block uppercase">Day {day}</span>
                      <span className="text-xl font-black text-emerald-400">+{fmtNum(row.depin, 4)}</span>
                      <span className="text-[10px] text-slate-500 block">{rewardTokenSymbol} projected</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-mono text-amber-300/80 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Browser-local projection using the deployed vault's linear per-block model. No autopilot contract exists on the testnet — nothing here is sent to the chain.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default YieldVaultsView;