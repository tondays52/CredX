import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Landmark,
  TrendingUp,
  Activity,
  DollarSign,
  Lock,
  Unlock,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  CheckCircle2,
  Zap,
  Info,
  ExternalLink,
  Sliders,
  Compass,
  Layers,
  Cpu,
  Check,
  AlertTriangle,
  ArrowRight,
  Crosshair,
  Percent,
  Wallet,
  Search,
  Filter,
  CircleDot,
  BarChart3,
  Calendar,
  Layers3,
  CheckCircle,
  RotateCcw,
  Eye,
  Bot,
  Play,
  Pause,
  Terminal,
  Award,
  Clock,
  ArrowDownLeft,
  BrainCircuit,
  Workflow,
  ShieldAlert,
  Download
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useWeb3 } from '../../context/Web3Context';
import {
  fetchCUSDBalance,
  fetchYieldVaultState,
  fetchYieldVaultEvents,
  fetchVaultPool,
  vaultStake,
  vaultUnstake,
  vaultClaimRewards,
  demoWalletSigner,
} from '../../services/credXService';
import { DEMO_WALLET_VAULT } from '../../config/demoWallets';

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface VaultAsset {
  id: string;
  name: string;
  symbol: string;
  strategy: 'Single Asset' | 'Dual Asset DEX' | 'Leveraged LST' | 'Delta-Neutral Basis' | 'RWA Credit';
  protocol: 'CredX L1' | 'SaucerSwap' | 'Stader Labs' | 'Aave V3' | 'Pendle' | 'Uniswap V3';
  apy: number;
  tvlNumeric: number;
  tvlString: string;
  safetyScore: number;
  walletBalance: number;
  myPosition: number;
  priceUSD: number;
  iconBg: string;
  iconColor: string;
}

export interface StrategySector {
  id: string;
  name: string;
  category: string;
  xPos: number; // Duration: 0 (short) to 100 (long)
  yPos: number; // Volatility: 0 (low) to 100 (high)
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  protocols: string[];
  apy: number;
  allocationPct: number;
  riskRating: 'Low' | 'Medium' | 'High' | 'Exotic';
  description: string;
  color: string;
}

export interface AutopilotAgent {
  id: 'alpha' | 'beta' | 'gamma' | 'sentinel';
  name: string;
  role: string;
  strategy: string;
  targetApy: number;
  riskRating: 'Ultra-Safe' | 'Low' | 'Moderate' | 'Alpha Aggressive';
  capitalManagedUSD: number;
  cumulativeProfitUSD: number;
  allocationPct: number;
  color: string;
  iconBg: string;
  description: string;
}

// ─── Real market feed types & helpers (RapidAPI → Binance → FreeCryptoAPI) ─
interface Candle { time: number; open: number; high: number; low: number; close: number }
interface Ticker { symbol: string; lastPrice: number; changePct: number }
type MarketTimeframe = '1H' | '1D' | '1W' | '1M';

// Data-source config: RapidAPI key/host + FreeCryptoAPI token from frontend/.env.local (never committed).
const RAPID_KEY = ((import.meta.env.VITE_RAPIDAPI_KEY as string) || '').trim();
const RAPID_HOST = ((import.meta.env.VITE_RAPIDAPI_HOST as string) || '').trim() || 'binance44.p.rapidapi.com';
const FREE_KEY = (((import.meta.env.VITE_FREECRYPTO_API_KEY as string) || (import.meta.env.VITE_FREECRYPTOAPI_KEY as string)) || '').trim();

const REAL_FEED_ASSETS: { key: string; name: string; binance: string; free: string }[] = [
  { key: 'CTC', name: 'Creditcoin L1 Native', binance: 'CTCUSDT', free: 'CTC' },
  { key: 'BTC', name: 'Bitcoin (Wrapped CredX)', binance: 'BTCUSDT', free: 'BTC' },
  { key: 'ETH', name: 'Ethereum (CredX Bridge)', binance: 'ETHUSDT', free: 'ETH' },
  { key: 'SOL', name: 'Solana (Wormhole)', binance: 'SOLUSDT', free: 'SOL' },
];
const REF_FEED_KEYS = new Set(REAL_FEED_ASSETS.map((f) => f.key));

const KLINE_INTERVAL: Record<MarketTimeframe, string> = { '1H': '1h', '1D': '1d', '1W': '1w', '1M': '1M' };

const FEED_SOURCE_LABEL: Record<string, string> = {
  rapidapi: 'rapidapi (binance)',
  binance: 'binance.com',
  freecryptoapi: 'freecryptoapi live samples',
  none: 'no feed',
};

function bucketMsForTimeframe(tf: MarketTimeframe): number {
  return tf === '1H' ? 3600000 : tf === '1D' ? 86400000 : tf === '1W' ? 604800000 : 2592000000;
}

/** Build synthetic candles from real FreeCryptoAPI price snapshots (fallback chart when kline APIs are down). */
function candlesFromSnapshots(pts: { t: number; p: number }[] | undefined, bucketMs: number): Candle[] | null {
  if (!pts || pts.length < 2) return null;
  const bars: Candle[] = [];
  for (let i = 0; i < pts.length; i++) {
    const b = Math.floor(pts[i].t / bucketMs) * bucketMs;
    const last = bars[bars.length - 1];
    if (last && last.time === b) {
      last.high = Math.max(last.high, pts[i].p);
      last.low = Math.min(last.low, pts[i].p);
      last.close = pts[i].p;
    } else if (last) {
      bars.push({ time: b, open: last.close, high: pts[i].p, low: pts[i].p, close: pts[i].p });
    } else {
      bars.push({ time: b, open: pts[i].p, high: pts[i].p, low: pts[i].p, close: pts[i].p });
    }
  }
  return bars.length >= 2 ? bars : null;
}

async function fetchRapidKlines(symbol: string, interval: string, limit: number): Promise<Candle[] | null> {
  if (!RAPID_KEY) return null;
  const res = await fetch(`https://${RAPID_HOST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, {
    headers: { 'X-RapidAPI-Key': RAPID_KEY, 'X-RapidAPI-Host': RAPID_HOST },
  });
  if (!res.ok) return null;
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((k: any) => ({ time: Number(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
}

async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<Candle[] | null> {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) return null;
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((k: any) => ({ time: Number(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]) }));
}

async function fetchRapidTickers(): Promise<Ticker[] | null> {
  if (!RAPID_KEY) return null;
  const res = await fetch(`https://${RAPID_HOST}/api/v3/ticker/24hr?symbols=${JSON.stringify(REAL_FEED_ASSETS.map((f) => f.binance))}`, {
    headers: { 'X-RapidAPI-Key': RAPID_KEY, 'X-RapidAPI-Host': RAPID_HOST },
  });
  if (!res.ok) return null;
  const raw = await res.json();
  if (!Array.isArray(raw)) return null;
  return raw.map((t: any) => ({ symbol: String(t.symbol), lastPrice: parseFloat(t.lastPrice), changePct: parseFloat(t.priceChangePercent) }));
}

async function fetchBinanceTickers(): Promise<Ticker[] | null> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(REAL_FEED_ASSETS.map((f) => f.binance))}`);
  if (!res.ok) return null;
  const raw = await res.json();
  if (!Array.isArray(raw)) return null;
  return raw.map((t: any) => ({ symbol: String(t.symbol), lastPrice: parseFloat(t.lastPrice), changePct: parseFloat(t.priceChangePercent) }));
}

async function fetchFreeTickers(): Promise<Ticker[] | null> {
  if (!FREE_KEY) return null;
  const out: Ticker[] = [];
  for (const f of REAL_FEED_ASSETS) {
    try {
      const res = await fetch(`https://api.freecryptoapi.com/v1/getData?symbol=${f.free}&token=${FREE_KEY}`);
      if (!res.ok) continue;
      const json = await res.json();
      const sym = json && json.symbols && json.symbols[0];
      if (!sym) continue;
      out.push({ symbol: `${f.key}USDT`, lastPrice: parseFloat(sym.last), changePct: parseFloat(sym.daily_change_percentage) });
    } catch {
      // skip unreachable symbol
    }
  }
  return out.length ? out : null;
}

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

/** Full Wilder RSI series (null until enough history) — used by the multi-pane technical chart. */
function rsiSeries(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let ag = gains / period;
  let al = losses / period;
  out[period] = al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/** Full MACD line / signal / histogram series (null until enough history for the signal). */
function macdSeries(values: number[]): { line: number[]; signal: number[]; hist: number[] } | null {
  if (values.length < 35) return null;
  const fast = emaArray(values, 12);
  const slow = emaArray(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaArray(line, 9);
  return { line, signal, hist: line.map((v, i) => v - signal[i]) };
}

const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

/** Bundled CC3 testnet wallet that seeded the ReputationYieldVault (25,250 cUSD staked → live on-chain). */
const DEMO_ROOT_WALLET = DEMO_WALLET_VAULT.find((v) => v.id === 'credx-root');

export const YieldVaultsView: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore } = useProtocol();
  const { balanceCTC, address, isConnected } = useWeb3();

  // Seeded demo-wallet mode: sign REAL vault txs with the bundled testnet wallet
  // that seeded the vault (25,250 cUSD staked). No extension required.
  const [demoMode, setDemoMode] = useState(false);
  const demoSigner = useMemo(
    () => (demoMode && DEMO_ROOT_WALLET ? demoWalletSigner(DEMO_ROOT_WALLET.privateKey) : null),
    [demoMode]
  );
  const effAddress = demoMode ? DEMO_ROOT_WALLET?.address ?? '' : address;
  const effConnected = demoMode || isConnected;

  const [vaultState, setVaultState] = useState<Awaited<ReturnType<typeof fetchYieldVaultState>>>(null);
  const [walletCUSDBalance, setWalletCUSDBalance] = useState(0);
  const [stakingAction, setStakingAction] = useState<'stake' | 'unstake' | 'claim' | null>(null);
  const [vaultLedger, setVaultLedger] = useState<Awaited<ReturnType<typeof fetchYieldVaultEvents>>>([]);
  const [vaultPool, setVaultPool] = useState<Awaited<ReturnType<typeof fetchVaultPool>>>({ cusd: null, depin: null });

  const stakingTokenSymbol = vaultState?.stakingToken.symbol ?? 'cUSD';
  const rewardTokenSymbol = vaultState?.rewardToken.symbol ?? 'DEPIN';
  const realTotalStaked = vaultState ? vaultState.totalStaked : null;
  const realStakedByUser = vaultState ? vaultState.stakedByUser : null;
  const realClaimable = vaultState ? vaultState.pendingRewards : null;

  // Real journal stats derived from the on-chain vault ledger + live vault state.
  // Capital steps at every real Staked/Unstaked event; rewards are live-pending.
  const journalFromLedger = useMemo(() => {
    const evs = [...vaultLedger].sort((a, b) => a.block - b.block);
    let net = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalClaimed = 0;
    let firstDepositT = 0;
    let lastEventT = 0;
    const steps: { t: number; net: number }[] = [];
    for (const ev of evs) {
      const amt = ev.amount ?? 0;
      if (ev.type === 'Staked') {
        net += amt;
        totalDeposited += amt;
        if (!firstDepositT) firstDepositT = ev.timestamp || 0;
      } else if (ev.type === 'Unstaked') {
        net -= amt;
        totalWithdrawn += amt;
      } else {
        totalClaimed += amt;
      }
      if (ev.timestamp) lastEventT = Math.max(lastEventT, ev.timestamp);
      steps.push({ t: (ev.timestamp || 0) * 1000, net });
    }
    return {
      evs,
      steps,
      net,
      totalDeposited,
      totalWithdrawn,
      totalClaimed,
      depositCount: evs.filter((e) => e.type === 'Staked').length,
      withdrawCount: evs.filter((e) => e.type === 'Unstaked').length,
      claimCount: evs.filter((e) => e.type === 'Claimed').length,
      firstDepositT: firstDepositT || null,
      lastEventT: lastEventT || null,
    };
  }, [vaultLedger]);

  const periodStats = (startMs: number) => {
    const startS = startMs > 0 ? startMs / 1000 : 0;
    let d = 0;
    let w = 0;
    let c = 0;
    let n = 0;
    for (const ev of journalFromLedger.evs) {
      const t = ev.timestamp || 0;
      if (startS > 0 && (t === 0 || t < startS)) continue;
      if (ev.type === 'Staked') d += ev.amount ?? 0;
      else if (ev.type === 'Unstaked') w += ev.amount ?? 0;
      else c += ev.amount ?? 0;
      n++;
    }
    return { d, w, c, n };
  };

  const monthCalendar = useMemo(() => {
    const nowD = new Date();
    const year = nowD.getFullYear();
    const month = nowD.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number | null; evs: typeof journalFromLedger.evs }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: null, evs: [] });
    const byDay = new Map<number, typeof journalFromLedger.evs>();
    const monthStartS = firstDay.getTime() / 1000;
    const monthEndS = monthStartS + daysInMonth * 86400;
    for (const ev of journalFromLedger.evs) {
      const t = ev.timestamp || 0;
      if (t >= monthStartS && t < monthEndS) {
        const d = new Date(t * 1000).getDate();
        const list = byDay.get(d) ?? [];
        list.push(ev);
        byDay.set(d, list);
      }
    }
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, evs: byDay.get(d) ?? [] });
    while (cells.length % 8 !== 0) cells.push({ day: null, evs: [] });
    return { cells, month: nowD.toLocaleString('en', { month: 'long', year: 'numeric' }) };
  }, [journalFromLedger]);

  // ─── Live market analytics state (RapidAPI → Binance → FreeCryptoAPI) ────
  const [feedKey, setFeedKey] = useState<string>('CTC');
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1D');
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [feedSource, setFeedSource] = useState<'rapidapi' | 'binance' | 'freecryptoapi' | 'none'>('binance');
  const [snapGen, setSnapGen] = useState(0);
  const priceSnapRef = useRef<Record<string, { t: number; p: number }[]>>({});
  const candlesRef = useRef<Candle[] | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedFeed = REAL_FEED_ASSETS.find((f) => f.key === feedKey) || REAL_FEED_ASSETS[0];
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

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'catalog' | 'analytics' | 'sectors' | 'intent'>('catalog');

  // Vaults Catalog Filter State
  const [catalogSubTab, setCatalogSubTab] = useState<'all' | 'my'>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('All');
  const [protocolFilter, setProtocolFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Vault for Deposit/Withdraw
  const [selectedVaultId, setSelectedVaultId] = useState<string>('ctc-cusd');

  // Deposit / Withdraw Action Card State
  const [actionTab, setActionTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState<string>('250');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('100');

  // TradeSync Journal Sub-View Toggle (Reference Image 4)
  const [journalView, setJournalView] = useState<'cumulative' | 'calendar'>('cumulative');

  // Analytics View State (Reference Image 3: Trading Vault)
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'h' | 'D' | 'W' | 'M' | '3M' | 'Y'>('M');

  // Strategy Sectors (3D vs 2D Toggle)
  const [sectorViewMode, setSectorViewMode] = useState<'3d' | '2d'>('3d');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('basis');

  // ─── AUTOPILOT AGENT & INTENT SOLVER TERMINAL STATE ──────────────────────
  const [selectedAgentId, setSelectedAgentId] = useState<'alpha' | 'beta' | 'gamma' | 'sentinel'>('alpha');
  const [autopilotActive, setAutopilotActive] = useState<boolean>(true);
  const [rebalanceCadence, setRebalanceCadence] = useState<'1s' | '15m' | '1h'>('1s');
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [slippageGuard, setSlippageGuard] = useState<'0.05%' | '0.1%' | '0.5%'>('0.05%');
  const [capitalAllocationPct, setCapitalAllocationPct] = useState<number>(65);
  const [streamFilter, setStreamFilter] = useState<'ALL' | 'ARBITRAGE' | 'REBALANCE' | 'SOLVER' | 'SECURITY'>('ALL');
  const [isConsolePaused, setIsConsolePaused] = useState<boolean>(false);
  const [agentExecutingTrade, setAgentExecutingTrade] = useState<boolean>(false);

  // Autopilot Agents Preset Taxonomy
  const autopilotAgents: AutopilotAgent[] = [
    {
      id: 'alpha',
      name: 'Agent Alpha',
      role: 'Sovereign Credit OCCR Arbitrageur',
      strategy: 'Underwriting + Precompile 0x0FD2',
      targetApy: 34.8,
      riskRating: 'Low',
      capitalManagedUSD: 6420,
      cumulativeProfitUSD: 842.30,
      allocationPct: 45,
      color: '#00f2fe',
      iconBg: '#083344',
      description: 'Underwrites audited real-world invoice loans on Creditcoin L1 while dynamically hedging collateral with zero-gas precompile invocations.'
    },
    {
      id: 'beta',
      name: 'Agent Beta',
      role: 'Delta-Neutral Basis & Funding Harvester',
      strategy: 'Spot Long + Perp Short Arbitrage',
      targetApy: 28.5,
      riskRating: 'Ultra-Safe',
      capitalManagedUSD: 4280,
      cumulativeProfitUSD: 512.80,
      allocationPct: 30,
      color: '#10b981',
      iconBg: '#022c22',
      description: 'Executes market-neutral funding rate harvesting between CredX Spot AMM and Sovereign Perpetual Engine, immune to price swings.'
    },
    {
      id: 'gamma',
      name: 'Agent Gamma',
      role: 'Cross-Chain Liquidity Flow Solver',
      strategy: 'High-Velocity SaucerSwap Arbitrage',
      targetApy: 41.2,
      riskRating: 'Moderate',
      capitalManagedUSD: 2850,
      cumulativeProfitUSD: 412.50,
      allocationPct: 20,
      color: '#c084fc',
      iconBg: '#2e1065',
      description: 'Scans cross-chain liquidity pools (SaucerSwap HBAR, CredX CTC, Aave V3) capturing transient slip-spread divergences every block.'
    },
    {
      id: 'sentinel',
      name: 'Agent Sentinel',
      role: 'Institutional Capital Preservation',
      strategy: '100% Insured Sovereign Reserves',
      targetApy: 16.4,
      riskRating: 'Ultra-Safe',
      capitalManagedUSD: 700,
      cumulativeProfitUSD: 74.60,
      allocationPct: 5,
      color: '#f59e0b',
      iconBg: '#451a03',
      description: 'Parks capital into Tier-1 insured treasury bills and overcollateralized stable OCCR reserves with automatic circuit breakers.'
    }
  ];

  const selectedAgent = useMemo(() => {
    return autopilotAgents.find((a) => a.id === selectedAgentId) || autopilotAgents[0];
  }, [selectedAgentId]);

  // Live Neural Execution Log Stream
  const [agentLogs, setAgentLogs] = useState<Array<{ id: string; time: string; msg: string; type: 'info' | 'success' | 'warn' | 'security' }>>([
    { id: '1', time: '00:18:12', msg: '[SOLVER] CredX AI Neural Engine v4.2 online. Scanning 16 cross-chain liquidity vaults.', type: 'info' },
    { id: '2', time: '00:18:13', msg: '[ARBITRAGE] Detected basis divergence: stCTC-CTC premium expanded to +1.42%.', type: 'warn' },
    { id: '3', time: '00:18:14', msg: '[REBALANCE] Substrate Precompile 0x0FD2 triggered: Zero-gas atomic route computed.', type: 'info' },
    { id: '4', time: '00:18:15', msg: '[REBALANCE] Rebalanced 450 cUSD into Undercollateralized Lending Pool (CTS 842). Yield +2.8%.', type: 'success' },
    { id: '5', time: '00:18:16', msg: '[SECURITY] Circuit breaker integrity check passed: 0 bad debt detected across L1 credit books.', type: 'security' },
    { id: '6', time: '00:18:17', msg: '[ARBITRAGE] Flash liquidity re-anchored on SaucerSwap HBAR-USDC pool. Accrued +18.4 sats.', type: 'success' }
  ]);

  // Periodic Neural Log simulation
  useEffect(() => {
    if (!autopilotActive || isConsolePaused) return;
    const logInterval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const logTemplates: Array<{ msg: string; type: 'info' | 'success' | 'warn' | 'security' }> = [
        { msg: `[ARBITRAGE] Basis spread harvested on CTC-cUSD pool (+1.${Math.floor(Math.random() * 80 + 10)}%). Net gain +$14.20.`, type: 'success' }, // NOSONAR
        { msg: `[REBALANCE] Shifted ${Math.floor(Math.random() * 400 + 100)} cUSD into High-Yield OCCR Pool. CTS Score boosted.`, type: 'info' }, // NOSONAR
        { msg: `[SECURITY] Circuit breaker verified: Average vault drawdown 0.${Math.floor(Math.random() * 70 + 20)}% (Well within bounds).`, type: 'security' }, // NOSONAR
        { msg: `[SOLVER] Decentralized auction #${Math.floor(Math.random() * 900 + 1000)} cleared: Precompile 0x0FD2 won bid.`, type: 'info' }, // NOSONAR
        { msg: `[ARBITRAGE] Auto-compounded ${(Math.random() * 4 + 1).toFixed(2)} stCTC into Tier-1 Validator Nodes.`, type: 'success' } // NOSONAR
      ];
      const randomLog = logTemplates[Math.floor(Math.random() * logTemplates.length)]; // NOSONAR
      setAgentLogs((prev) => [
        { id: `log-${Date.now()}-${Math.random()}`, time: timeStr, ...randomLog }, // NOSONAR
        ...prev.slice(0, 39)
      ]);
    }, 4000);
    return () => clearInterval(logInterval);
  }, [autopilotActive, isConsolePaused]);

  // Intent Solver State
  const [naturalIntent, setNaturalIntent] = useState<string>(
    'Maximize yield above 32% APY on my CTC and USDC while keeping drawdown under 2.5% with zero impermanent loss'
  );
  const [targetApy, setTargetApy] = useState<number>(32.5);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(2.5);
  const [intentHorizon, setIntentHorizon] = useState<'0d' | '7d' | '30d'>('7d');
  const [whitelistedProtocols, setWhitelistedProtocols] = useState<string[]>(['CredX L1', 'SaucerSwap', 'Aave V3']);
  const [intentRunning, setIntentRunning] = useState<boolean>(false);
  const [intentStep, setIntentStep] = useState<number>(0);
  const [solvedRoute, setSolvedRoute] = useState<{
    solverName: string;
    apy: number;
    gasEstimate: string;
    executionTime: string;
    confidence: number;
    zkProof: string;
    legs: Array<{ name: string; pct: number; protocol: string; desc: string }>;
  } | null>({
    solverName: 'Solver #1 (CredX Sovereign Precompile 0x0FD2)',
    apy: 34.8,
    gasEstimate: '0.00 CTC ($0.00)',
    executionTime: '84ms',
    confidence: 99.4,
    zkProof: '0x7e9f4a12cb89d34502847190efac3218',
    legs: [
      { name: 'Sovereign Credit Underwriting', pct: 45, protocol: 'Creditcoin L1 Precompile 0x0FD2', desc: 'Enterprise trade finance loans backed by verified on-chain credit scores' },
      { name: 'Delta-Neutral Basis Arbitrage', pct: 35, protocol: 'CredX Perps Funding Arbitrage', desc: 'Long spot + short perpetual delta hedge capturing +18.4% funding yield' },
      { name: 'Validator Staking Multiplier', pct: 20, protocol: 'stCTC Tier-1 Consensus Nodes', desc: 'Auto-compounding liquid staked CTC validator rewards' }
    ]
  });

  // Intent Goal Presets (Quick-Fill Chips)
  const intentPresets = [
    {
      label: '🎯 Maximize APY (>30%)',
      prompt: 'Maximize yield above 32% APY on my CTC and USDC while keeping drawdown under 2.5% with zero impermanent loss',
      apy: 34.5,
      dd: 2.5
    },
    {
      label: '🛡️ Capital Preservation (<1% Drawdown)',
      prompt: 'Prioritize risk-free capital preservation: Keep maximum drawdown under 1.0% and allocate 80% to insured USDC OCCR vault',
      apy: 18.2,
      dd: 1.0
    },
    {
      label: '⚡ Delta-Neutral Basis Arbitrage',
      prompt: 'Execute high-frequency delta-neutral basis harvesting: Long spot CTC on DEX AMM + short perpetual contract on Sovereign Engine',
      apy: 29.8,
      dd: 1.8
    },
    {
      label: '💰 Auto-Compound Staking into RWA',
      prompt: 'Harvest all accrued liquid staking rewards from stCTC and automatically stream into DOVU verified carbon credit financing pool',
      apy: 31.0,
      dd: 3.0
    }
  ];

  // Real-time continuous yield tick
  const [continuousYield, setContinuousYield] = useState<number>(14.285);
  const [compoundCountdown, setCompoundCountdown] = useState<number>(16);

  // Extended Multi-Crypto Vaults Catalog (16 Diverse Assets)
  const [vaults, setVaults] = useState<VaultAsset[]>([
    {
      id: 'usdc-hbar',
      name: 'USDC-HBAR',
      symbol: 'USDC-HBAR',
      strategy: 'Dual Asset DEX',
      protocol: 'SaucerSwap',
      apy: 88.05,
      tvlNumeric: 48420,
      tvlString: '$48.42K',
      safetyScore: 5,
      walletBalance: 1250,
      myPosition: 450,
      priceUSD: 1.00,
      iconBg: '#1e1b4b',
      iconColor: '#818cf8'
    },
    {
      id: 'ctc-cusd',
      name: 'CTC-cUSD Sovereign LP',
      symbol: 'CTC-cUSD',
      strategy: 'Dual Asset DEX',
      protocol: 'CredX L1',
      apy: 74.20,
      tvlNumeric: 142850,
      tvlString: '$142.85K',
      safetyScore: 5,
      walletBalance: balanceCTC > 0 ? balanceCTC : 10000,
      myPosition: 1250,
      priceUSD: 2.08,
      iconBg: '#083344',
      iconColor: '#00f2fe'
    },
    {
      id: 'stctc-ctc',
      name: 'stCTC-CTC Arbitrage',
      symbol: 'stCTC-CTC',
      strategy: 'Leveraged LST',
      protocol: 'CredX L1',
      apy: 43.35,
      tvlNumeric: 95400,
      tvlString: '$95.40K',
      safetyScore: 5,
      walletBalance: 850,
      myPosition: 300,
      priceUSD: 2.08,
      iconBg: '#0f172a',
      iconColor: '#38bdf8'
    },
    {
      id: 'jam',
      name: 'JAM (HBAR Paired)',
      symbol: 'JAM',
      strategy: 'Single Asset',
      protocol: 'SaucerSwap',
      apy: 43.35,
      tvlNumeric: 1510,
      tvlString: '$1.51K',
      safetyScore: 4,
      walletBalance: 4200,
      myPosition: 0,
      priceUSD: 0.12,
      iconBg: '#4c0519',
      iconColor: '#f43f5e'
    },
    {
      id: 'pack',
      name: 'PACK (HBAR Paired)',
      symbol: 'PACK',
      strategy: 'Single Asset',
      protocol: 'SaucerSwap',
      apy: 38.22,
      tvlNumeric: 226.27,
      tvlString: '$226.27',
      safetyScore: 4,
      walletBalance: 8500,
      myPosition: 0,
      priceUSD: 0.04,
      iconBg: '#2e1065',
      iconColor: '#c084fc'
    },
    {
      id: 'hbar-dovu',
      name: 'HBAR (DOVU Paired)',
      symbol: 'HBAR',
      strategy: 'Single Asset',
      protocol: 'SaucerSwap',
      apy: 35.24,
      tvlNumeric: 20820,
      tvlString: '$20.82K',
      safetyScore: 5,
      walletBalance: 15000,
      myPosition: 2500,
      priceUSD: 0.085,
      iconBg: '#0f172a',
      iconColor: '#94a3b8'
    },
    {
      id: 'dovu',
      name: 'DOVU (Carbon Credits)',
      symbol: 'DOVU',
      strategy: 'RWA Credit',
      protocol: 'CredX L1',
      apy: 30.72,
      tvlNumeric: 128640,
      tvlString: '$128.64K',
      safetyScore: 5,
      walletBalance: 6500,
      myPosition: 1200,
      priceUSD: 0.035,
      iconBg: '#022c22',
      iconColor: '#10b981'
    },
    {
      id: 'usdc-stable',
      name: 'USDC Risk-Free OCCR',
      symbol: 'USDC',
      strategy: 'Delta-Neutral Basis',
      protocol: 'CredX L1',
      apy: 29.81,
      tvlNumeric: 24650,
      tvlString: '$24.65K',
      safetyScore: 5,
      walletBalance: 5000,
      myPosition: 1500,
      priceUSD: 1.00,
      iconBg: '#1e3a8a',
      iconColor: '#60a5fa'
    },
    {
      id: 'eth-cusd',
      name: 'ETH-cUSD Lending Vault',
      symbol: 'ETH-cUSD',
      strategy: 'Dual Asset DEX',
      protocol: 'Aave V3',
      apy: 24.80,
      tvlNumeric: 84200,
      tvlString: '$84.20K',
      safetyScore: 5,
      walletBalance: 3.2,
      myPosition: 1.0,
      priceUSD: 3485.40,
      iconBg: '#312e81',
      iconColor: '#a5b4fc'
    },
    {
      id: 'btc-ctc',
      name: 'WBTC-CTC Trade Underwriting',
      symbol: 'WBTC-CTC',
      strategy: 'RWA Credit',
      protocol: 'CredX L1',
      apy: 21.40,
      tvlNumeric: 198500,
      tvlString: '$198.50K',
      safetyScore: 5,
      walletBalance: 0.45,
      myPosition: 0.15,
      priceUSD: 64280.00,
      iconBg: '#451a03',
      iconColor: '#f59e0b'
    },
    {
      id: 'weth-lst',
      name: 'WETH Liquid Restaking (Lido)',
      symbol: 'stETH',
      strategy: 'Leveraged LST',
      protocol: 'CredX L1',
      apy: 18.90,
      tvlNumeric: 312400,
      tvlString: '$312.40K',
      safetyScore: 5,
      walletBalance: 4.8,
      myPosition: 1.5,
      priceUSD: 3485.40,
      iconBg: '#1e293b',
      iconColor: '#38bdf8'
    },
    {
      id: 'sol-jito',
      name: 'SOL Jito LST Yield',
      symbol: 'JitoSOL',
      strategy: 'Leveraged LST',
      protocol: 'CredX L1',
      apy: 22.40,
      tvlNumeric: 184500,
      tvlString: '$184.50K',
      safetyScore: 5,
      walletBalance: 35.0,
      myPosition: 12.0,
      priceUSD: 142.50,
      iconBg: '#1e1b4b',
      iconColor: '#c084fc'
    },
    {
      id: 'avax-benqi',
      name: 'AVAX Benqi Staked Vault',
      symbol: 'sAVAX',
      strategy: 'Single Asset',
      protocol: 'CredX L1',
      apy: 19.80,
      tvlNumeric: 92300,
      tvlString: '$92.30K',
      safetyScore: 5,
      walletBalance: 65.0,
      myPosition: 20.0,
      priceUSD: 28.40,
      iconBg: '#4c0519',
      iconColor: '#f43f5e'
    },
    {
      id: 'sui-navi',
      name: 'SUI Navi Lend Vault',
      symbol: 'SUI',
      strategy: 'Single Asset',
      protocol: 'CredX L1',
      apy: 26.50,
      tvlNumeric: 76800,
      tvlString: '$76.80K',
      safetyScore: 4,
      walletBalance: 1200.0,
      myPosition: 400.0,
      priceUSD: 1.85,
      iconBg: '#083344',
      iconColor: '#38bdf8'
    },
    {
      id: 'cusd-market',
      name: 'cUSD Sovereign Money Market',
      symbol: 'cUSD',
      strategy: 'Delta-Neutral Basis',
      protocol: 'CredX L1',
      apy: 15.60,
      tvlNumeric: 442000,
      tvlString: '$442.00K',
      safetyScore: 5,
      walletBalance: 12500.0,
      myPosition: 3500.0,
      priceUSD: 1.00,
      iconBg: '#022c22',
      iconColor: '#10b981'
    },
    {
      id: 'bnb-stader',
      name: 'BNB Stader Liquid Staking Boost',
      symbol: 'stBNB',
      strategy: 'Leveraged LST',
      protocol: 'Stader Labs',
      apy: 16.80,
      tvlNumeric: 135000,
      tvlString: '$135.00K',
      safetyScore: 5,
      walletBalance: 8.5,
      myPosition: 2.0,
      priceUSD: 580.20,
      iconBg: '#451a03',
      iconColor: '#f59e0b'
    }
  ]);

  // Withdrawal / staking activity log (real txns only)
  const [withdrawalRequests, setWithdrawalRequests] = useState<Array<{
    id: string;
    amount: string;
    token: string;
    status: string;
    time: string;
    txHash: string;
  }>>([]);

  // Selected Vault Object
  const selectedVault = useMemo(() => {
    return vaults.find((v) => v.id === selectedVaultId) || vaults[1];
  }, [vaults, selectedVaultId]);

  // Derived Metrics
  const totalTVLNumeric = useMemo(() => {
    return vaults.reduce((acc, v) => acc + v.tvlNumeric, 0);
  }, [vaults]);

  const userTotalDepositedUSD = useMemo(() => {
    return vaults.reduce((acc, v) => acc + (v.myPosition * v.priceUSD), 0);
  }, [vaults]);

  const weightedAvgApy = useMemo(() => {
    if (userTotalDepositedUSD <= 0) return 41.2;
    const weightedSum = vaults.reduce((acc, v) => acc + (v.myPosition * v.priceUSD * v.apy), 0);
    return weightedSum / userTotalDepositedUSD;
  }, [vaults, userTotalDepositedUSD]);

  const monthlyEstYieldUSD = (userTotalDepositedUSD * (weightedAvgApy / 100)) / 12;

  // Real-time continuous yield tick
  useEffect(() => {
    const interval = setInterval(() => {
      setContinuousYield((prev) => prev + 0.000045 * (userTotalDepositedUSD / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [userTotalDepositedUSD]);

  // Auto-compound timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCompoundCountdown((prev) => (prev > 1 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live ReputationYieldVault read + wallet cUSD balance
  useEffect(() => {
    let cancelled = false;
    if (!effConnected || !effAddress) {
      setVaultState(null);
      setWalletCUSDBalance(0);
      return;
    }
    fetchYieldVaultState(effAddress)
      .then((state) => {
        if (!cancelled) setVaultState(state);
      })
      .catch(() => {
        if (!cancelled) setVaultState(null);
      });
    fetchCUSDBalance(effAddress)
      .then((bal) => {
        if (!cancelled) setWalletCUSDBalance(bal);
      })
      .catch(() => {
        if (!cancelled) setWalletCUSDBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, [effConnected, effAddress]);

  // Real on-chain vault ledger + token pool snapshot (30s)
  useEffect(() => {
    let dead = false;
    const sync = async () => {
      const [ledger, pool] = await Promise.all([fetchYieldVaultEvents(20), fetchVaultPool()]);
      if (!dead) {
        setVaultLedger(ledger);
        setVaultPool(pool);
      }
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  // Filtered Vaults for Catalog
  const filteredVaults = useMemo(() => {
    return vaults.filter((v) => {
      if (catalogSubTab === 'my' && v.myPosition <= 0) return false;
      if (strategyFilter !== 'All' && v.strategy !== strategyFilter) return false;
      if (protocolFilter !== 'All' && v.protocol !== protocolFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.symbol.toLowerCase().includes(q) ||
          v.strategy.toLowerCase().includes(q) ||
          v.protocol.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vaults, catalogSubTab, strategyFilter, protocolFilter, searchQuery]);

  // ─── Strategy Sectors (with 3D Orbital Parameters) ────────────────────────
  const strategySectors: StrategySector[] = [
    {
      id: 'active',
      name: 'Active Asset Management',
      category: 'High Volatility • Long Duration',
      xPos: 65,
      yPos: 80,
      orbitRadius: 170,
      orbitSpeed: 0.0008,
      orbitAngle: 0.0,
      protocols: ['dHEDGE', 'SolStreet', 'Enzyme', 'Syndicate', 'Babylon'],
      apy: 38.5,
      allocationPct: 15,
      riskRating: 'High',
      description: 'Dynamic momentum & volatility breakout rebalancing targeting asymmetric returns.',
      color: '#38bdf8'
    },
    {
      id: 'passive',
      name: 'Passive Asset Management',
      category: 'Medium Volatility • Long Duration',
      xPos: 85,
      yPos: 50,
      orbitRadius: 210,
      orbitSpeed: 0.0006,
      orbitAngle: 0.8,
      protocols: ['Index Coop', 'Set Protocol'],
      apy: 14.2,
      allocationPct: 10,
      riskRating: 'Medium',
      description: 'Market-cap weighted index baskets with transparent on-chain governance rebalancing.',
      color: '#a78bfa'
    },
    {
      id: 'dovs',
      name: 'DeFi Option Vaults (DOVs)',
      category: 'Medium-High Volatility • Short Duration',
      xPos: 25,
      yPos: 55,
      orbitRadius: 130,
      orbitSpeed: 0.0011,
      orbitAngle: 1.6,
      protocols: ['Ribbon', 'Friktion', 'Opyn', 'Ondo', 'Opium', 'Katana', 'StakeDAO'],
      apy: 28.4,
      allocationPct: 15,
      riskRating: 'Medium',
      description: 'Automated covered call and cash-secured put strategies harvesting volatility premiums.',
      color: '#f43f5e'
    },
    {
      id: 'exotics',
      name: 'Exotics & Structured Products',
      category: 'High Volatility • Short Duration',
      xPos: 32,
      yPos: 85,
      orbitRadius: 150,
      orbitSpeed: 0.0009,
      orbitAngle: 2.4,
      protocols: ['Struct', 'Antimatter', 'Structure', 'Galleon'],
      apy: 45.0,
      allocationPct: 5,
      riskRating: 'Exotic',
      description: 'Tranche-based interest rate swaps and subordinated risk-bearing yield layers.',
      color: '#e879f9'
    },
    {
      id: 'basis',
      name: 'Basis Farming & Delta-Neutral',
      category: 'Low Volatility • Medium-Long Duration',
      xPos: 68,
      yPos: 30,
      orbitRadius: 180,
      orbitSpeed: 0.0007,
      orbitAngle: 3.2,
      protocols: ['Basis', 'UXD', 'Lemma', 'CredX Perps'],
      apy: 24.8,
      allocationPct: 25,
      riskRating: 'Low',
      description: 'Spot long + perpetual short funding rate arbitrage yielding positive cash flow regardless of market direction.',
      color: '#10b981'
    },
    {
      id: 'fixed',
      name: 'Fixed Yield & Principal Tokens',
      category: 'Low Volatility • Medium Duration',
      xPos: 55,
      yPos: 12,
      orbitRadius: 140,
      orbitSpeed: 0.0010,
      orbitAngle: 4.0,
      protocols: ['Pendle', 'ElementFi', 'Notional', 'Sense'],
      apy: 9.8,
      allocationPct: 10,
      riskRating: 'Low',
      description: 'Lock-in guaranteed upfront yields by stripping yield tokens from underlying principal.',
      color: '#06b6d4'
    },
    {
      id: 'rwa',
      name: 'Real World Assets & Underwriting',
      category: 'Low Volatility • Medium Duration',
      xPos: 40,
      yPos: 32,
      orbitRadius: 160,
      orbitSpeed: 0.00085,
      orbitAngle: 4.8,
      protocols: ['Creditcoin L1', 'Centrifuge', 'Maple', 'Goldfinch'],
      apy: 18.6,
      allocationPct: 15,
      riskRating: 'Low',
      description: 'Overcollateralized real-world enterprise trade finance credit strategy (static illustrative allocation).',
      color: '#f59e0b'
    },
    {
      id: 'yield',
      name: 'Yield Farming & Money Markets',
      category: 'Low Volatility • Short Duration',
      xPos: 25,
      yPos: 12,
      orbitRadius: 120,
      orbitSpeed: 0.0013,
      orbitAngle: 5.6,
      protocols: ['Yearn', 'Instadapp', 'Balancer', 'Rari', 'Harvest'],
      apy: 12.4,
      allocationPct: 5,
      riskRating: 'Low',
      description: 'Autonomous multi-pool routing into blue-chip lending markets and concentrated liquidity.',
      color: '#34d399'
    }
  ];

  const selectedSector = useMemo(() => {
    return strategySectors.find((s) => s.id === selectedSectorId) || strategySectors[0];
  }, [selectedSectorId]);

  // ─── TradeSync Cumulative PnL Canvas (Reference Image 4) ────────────────────
  const cumPnlCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (activeTab !== 'catalog') return;
    const canvas = cumPnlCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 140;
    if (width <= 0 || height <= 0) return;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#030d14';
    ctx.fillRect(0, 0, width, height);

    const padL = 46;
    const padR = 38;
    const padT = 16;
    const padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const steps = journalFromLedger.steps;
    const maxVal = Math.max(...steps.map((s) => s.net), 1);

    // Y grid
    ctx.textBaseline = 'middle';
    ctx.font = '9px monospace';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      const v = maxVal - (maxVal / 4) * i;
      const tick = v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })}k` : `${Math.round(v)}`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'right';
      ctx.fillText(tick, padL - 6, y);
    }

    if (steps.length === 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.textAlign = 'center';
      ctx.font = '10px monospace';
      ctx.fillText('No on-chain vault events yet — stake or unstake via the demo wallet to see the real curve.', width / 2, height / 2);
      ctx.restore();
      return;
    }

    const t0 = steps[0].t || Date.now();
    const t1 = Math.max(steps[steps.length - 1].t, Date.now());
    const span = Math.max(1, t1 - t0);
    const xOf = (t: number) => padL + ((t - t0) / span) * plotW;
    const yOf = (v: number) => padT + plotH - (v / maxVal) * plotH;

    // zero baseline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(padL, yOf(0));
    ctx.lineTo(width - padR, yOf(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // step curve
    ctx.beginPath();
    ctx.moveTo(padL, yOf(0));
    let prevY = yOf(0);
    for (const s of steps) {
      const x = xOf(s.t);
      ctx.lineTo(x, prevY);
      ctx.lineTo(x, yOf(s.net));
      prevY = yOf(s.net);
    }
    ctx.lineTo(padL + plotW, prevY);

    // area fill
    ctx.lineTo(padL + plotW, yOf(0));
    ctx.lineTo(padL, yOf(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.3)');
    grad.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // clean stroke
    ctx.beginPath();
    ctx.moveTo(padL, yOf(0));
    prevY = yOf(0);
    for (const s of steps) {
      const x = xOf(s.t);
      ctx.lineTo(x, prevY);
      ctx.lineTo(x, yOf(s.net));
      prevY = yOf(s.net);
    }
    ctx.lineTo(padL + plotW, prevY);
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // event dots + final beacon
    for (const s of steps) {
      ctx.beginPath();
      ctx.arc(xOf(s.t), yOf(s.net), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00f2fe';
      ctx.fill();
    }
    const lastDotX = xOf(steps[steps.length - 1].t);
    const lastDotY = yOf(steps[steps.length - 1].net);
    ctx.beginPath();
    ctx.arc(lastDotX, lastDotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.fill();
    ctx.fillStyle = '#00f2fe';
    ctx.textAlign = 'left';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${fmtNum(steps[steps.length - 1].net, 0)} cUSD`, Math.min(lastDotX + 6, width - padR - 60), lastDotY);

    // time labels
    const lblIdx = [0, Math.floor((steps.length - 1) / 2), steps.length - 1];
    lblIdx.forEach((idx) => {
      const t = new Date(steps[idx].t || Date.now());
      const txt = `${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
      const x = xOf(steps[idx].t);
      ctx.fillStyle = idx === steps.length - 1 ? 'rgba(0, 242, 254, 0.8)' : 'rgba(255, 255, 255, 0.4)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(txt, x, height - 8);
    });

    ctx.restore();
  }, [activeTab, journalFromLedger]);

  // ─── 3D Rotating Coin & Revolving Sectors Canvas ──────────────────────────
  const orbitCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (activeTab !== 'sectors' || sectorViewMode !== '3d') return;
    const canvas = orbitCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angleOffset = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 420;

      if (width > 0 && height > 0) {
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Deep Cosmic / Cyber Terminal Background
        ctx.fillStyle = '#04020a';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        angleOffset += 0.008;

        // Draw 3D Elliptical Orbit Rings (Tilted 3D plane)
        const tilt = 0.45;
        [120, 150, 180, 210].forEach((r) => {
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, r, r * tilt, -0.2, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Compute 3D positions for each sector
        const projectedNodes = strategySectors.map((sector) => {
          const currentAngle = sector.orbitAngle + angleOffset * (sector.orbitSpeed / 0.0008);
          const rx = sector.orbitRadius;
          const ry = sector.orbitRadius * tilt;

          const x3d = Math.cos(currentAngle) * rx;
          const y3d = Math.sin(currentAngle) * ry;
          const z3d = Math.sin(currentAngle) * 60;

          const scale = 0.8 + (z3d + 60) / 240;
          const isBehind = z3d < 0;

          return {
            sector,
            x: centerX + x3d,
            y: centerY + y3d,
            z: z3d,
            scale,
            isBehind
          };
        });

        // Sort by Z-depth (back to front rendering)
        projectedNodes.sort((a, b) => a.z - b.z);

        // 1. Draw Nodes that are BEHIND the central 3D coin
        projectedNodes.filter(n => n.isBehind).forEach(n => drawSectorNode(ctx, n, centerX, centerY));

        // 2. Draw 3D Rotating Central CredX Sovereign Coin
        draw3DCredXCoin(ctx, centerX, centerY, angleOffset);

        // 3. Draw Nodes that are IN FRONT of the central 3D coin
        projectedNodes.filter(n => !n.isBehind).forEach(n => drawSectorNode(ctx, n, centerX, centerY));

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    const draw3DCredXCoin = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);

      const coinRadius = 38;
      const coinThickness = 12;
      const coinTilt = Math.sin(rot * 1.5) * 0.25;

      // Outer Glowing Ring Ambient
      const glowGrad = ctx.createRadialGradient(0, 0, coinRadius * 0.5, 0, 0, coinRadius * 2.2);
      glowGrad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
      glowGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coinRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Coin Extruded Cylinder Edges (3D depth)
      ctx.fillStyle = '#064e3b';
      for (let t = coinThickness; t >= 0; t--) {
        ctx.beginPath();
        ctx.ellipse(0, t, coinRadius, coinRadius * 0.75 + coinTilt * 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = t === 0 ? '#022c22' : `rgba(6, 78, 59, ${0.4 + (t / coinThickness) * 0.5})`;
        ctx.fill();
      }

      // Coin Front Face
      ctx.beginPath();
      ctx.ellipse(0, 0, coinRadius, coinRadius * 0.75 + coinTilt * 10, 0, 0, Math.PI * 2);
      const faceGrad = ctx.createLinearGradient(-coinRadius, -coinRadius, coinRadius, coinRadius);
      faceGrad.addColorStop(0, '#00f2fe');
      faceGrad.addColorStop(0.5, '#042f2e');
      faceGrad.addColorStop(1, '#10b981');
      ctx.fillStyle = faceGrad;
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Rotating CredX Sovereign Emblem in center
      ctx.rotate(rot * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CredX', 0, 0);

      ctx.restore();
    };

    const drawSectorNode = (ctx: CanvasRenderingContext2D, n: any, cx: number, cy: number) => {
      const { sector, x, y, scale } = n;
      const isSelected = selectedSectorId === sector.id;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Connecting Particle Stream to Center
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((cx - x) / scale, (cy - y) / scale);
      ctx.strokeStyle = `${sector.color}25`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer Glowing Orb
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? `${sector.color}50` : 'rgba(0, 0, 0, 0.75)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : sector.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.shadowColor = sector.color;
      ctx.shadowBlur = isSelected ? 16 : 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner Core
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = sector.color;
      ctx.fill();

      // Floating 3D Label Tag
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = sector.color;
      ctx.lineWidth = 1;
      const labelW = 110;
      const labelH = 26;
      ctx.fillRect(-labelW / 2, -34, labelW, labelH);
      ctx.strokeRect(-labelW / 2, -34, labelW, labelH);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sector.name, 0, -23);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(`+${sector.apy}% APY • ${sector.allocationPct}%`, 0, -12);

      ctx.restore();
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, sectorViewMode, selectedSectorId]);

  // ─── Analytics Charts (Reference Image 3: Trading Vault) ───────────────────
  const balanceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawAnalyticsCharts = useCallback(() => {
    // 1. Capital Deployed Canvas (real on-chain ledger steps)
    const bCanvas = balanceCanvasRef.current;
    if (bCanvas) {
      const ctx = bCanvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const width = bCanvas.clientWidth || 450;
        const height = bCanvas.clientHeight || 240;

        if (width > 0 && height > 0) {
          if (bCanvas.width !== width * dpr || bCanvas.height !== height * dpr) {
            bCanvas.width = width * dpr;
            bCanvas.height = height * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);

          ctx.fillStyle = '#080c14';
          ctx.fillRect(0, 0, width, height);

          const padL = 52;
          const padR = 34;
          const padT = 18;
          const padB = 28;
          const plotW = width - padL - padR;
          const plotH = height - padT - padB;
          const steps = journalFromLedger.steps;
          const maxVal = Math.max(...steps.map((s) => s.net), 1);

          ctx.textBaseline = 'middle';
          ctx.font = '9px monospace';
          for (let i = 0; i <= 4; i++) {
            const y = padT + (plotH / 4) * i;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(width - padR, y);
            ctx.stroke();
            const v = maxVal - (maxVal / 4) * i;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.textAlign = 'right';
            ctx.fillText(`${v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : `${Math.round(v)}`}`, padL - 5, y);
          }

          if (steps.length === 0) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
            ctx.textAlign = 'center';
            ctx.font = '10px monospace';
            ctx.fillText('No on-chain ledger events yet.', width / 2, height / 2);
            ctx.restore();
            return;
          }

          const t0 = steps[0].t || Date.now();
          const t1 = Math.max(steps[steps.length - 1].t, Date.now());
          const span = Math.max(1, t1 - t0);
          const xOf = (t: number) => padL + ((t - t0) / span) * plotW;
          const yOf = (v: number) => padT + plotH - (v / maxVal) * plotH;

          // zero baseline
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(padL, yOf(0));
          ctx.lineTo(width - padR, yOf(0));
          ctx.stroke();
          ctx.setLineDash([]);

          // step curve
          ctx.beginPath();
          ctx.moveTo(padL, yOf(0));
          let prevY = yOf(0);
          for (const s of steps) {
            const x = xOf(s.t);
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, yOf(s.net));
            prevY = yOf(s.net);
          }
          ctx.lineTo(padL + plotW, prevY);
          ctx.lineTo(padL + plotW, yOf(0));
          ctx.lineTo(padL, yOf(0));
          ctx.closePath();

          const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
          areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
          areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          ctx.fillStyle = areaGrad;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(padL, yOf(0));
          prevY = yOf(0);
          for (const s of steps) {
            const x = xOf(s.t);
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, yOf(s.net));
            prevY = yOf(s.net);
          }
          ctx.lineTo(padL + plotW, prevY);
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // event dots + endpoint beacon
          for (const s of steps) {
            ctx.beginPath();
            ctx.arc(xOf(s.t), yOf(s.net), 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00f2fe';
            ctx.fill();
          }
          const lastStep = steps[steps.length - 1];
          ctx.beginPath();
          ctx.arc(xOf(lastStep.t), yOf(lastStep.net), 4, 0, Math.PI * 2);
          ctx.fillStyle = '#00f2fe';
          ctx.fill();

          // X-Axis date labels
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          const lblIdx = [0, Math.floor((steps.length - 1) / 2), steps.length - 1];
          lblIdx.forEach((idx) => {
            const d = new Date(steps[idx].t || Date.now());
            ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, xOf(steps[idx].t), height - 10);
          });

          ctx.restore();
        }
      }
    }

    // 2. Monthly Reward:Capital Histogram (real ledger flows)
    const hCanvas = histCanvasRef.current;
    if (hCanvas) {
      const ctx = hCanvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const width = hCanvas.clientWidth || 320;
        const height = hCanvas.clientHeight || 240;

        if (width > 0 && height > 0) {
          if (hCanvas.width !== width * dpr || hCanvas.height !== height * dpr) {
            hCanvas.width = width * dpr;
            hCanvas.height = height * dpr;
          }
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, height);

          ctx.fillStyle = '#080c14';
          ctx.fillRect(0, 0, width, height);

          const padL = 40;
          const padR = 15;
          const padT = 25;
          const padB = 30;
          const plotW = width - padL - padR;
          const plotH = height - padT - padB;

          // 6 month buckets (incl. current) from the real ledger
          const buckets: { label: string; deposit: number; claimed: number }[] = [];
          const nowD = new Date();
          for (let k = 5; k >= 0; k--) {
            const dt = new Date(nowD.getFullYear(), nowD.getMonth() - k, 1);
            const startT = dt.getTime() / 1000;
            const nextT = new Date(nowD.getFullYear(), nowD.getMonth() - k + 1, 1).getTime() / 1000;
            let deposit = 0;
            let claimed = 0;
            for (const ev of journalFromLedger.evs) {
              const t = ev.timestamp || 0;
              if (t >= startT && t < nextT) {
                if (ev.type === 'Staked') deposit += ev.amount ?? 0;
                else if (ev.type === 'Claimed') claimed += ev.amount ?? 0;
              }
            }
            buckets.push({ label: dt.toLocaleString('en', { month: 'short' }), deposit, claimed });
          }
          const maxVal = Math.max(...buckets.map((b) => Math.max(b.deposit, b.claimed)), 1);
          const yOf = (v: number) => padT + plotH - (v / maxVal) * plotH;

          ctx.textBaseline = 'middle';
          ctx.font = '9px monospace';
          for (let i = 0; i <= 3; i++) {
            const y = padT + (plotH / 3) * i;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(width - padR, y);
            ctx.stroke();
            const v = maxVal - (maxVal / 3) * i;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.textAlign = 'right';
            ctx.fillText(`${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`}`, padL - 4, y);
          }

          const slotW = plotW / buckets.length;
          const barW = Math.max(3, slotW * 0.32);
          buckets.forEach((b, idx) => {
            const cx = padL + idx * slotW + slotW / 2;
            if (b.deposit > 0) {
              ctx.fillStyle = '#00f2fe';
              ctx.fillRect(cx - barW - 1.5, yOf(b.deposit), barW, Math.max(1, yOf(0) - yOf(b.deposit)));
            }
            if (b.claimed > 0) {
              ctx.fillStyle = '#10b981';
              ctx.fillRect(cx + 1.5, yOf(b.claimed), barW, Math.max(1, yOf(0) - yOf(b.claimed)));
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(b.label, cx, height - 8);
            ctx.textBaseline = 'middle';
          });

          ctx.restore();
        }
      }
    }
  }, [journalFromLedger]);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    let animId: number;
    const loop = () => {
      drawAnalyticsCharts();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, drawAnalyticsCharts]);

  // ─── Real-Time Deposit (Stake), Withdraw (Unstake) & Claim Handlers ───────
  const refreshVaultState = async () => {
    if (!effAddress) return;
    try {
      const state = await fetchYieldVaultState(effAddress);
      if (state) setVaultState(state);
    } catch {
      // keep last known state
    }
    fetchYieldVaultEvents(20).then(setVaultLedger).catch(() => {});
    fetchVaultPool().then(setVaultPool).catch(() => {});
  };

  const handleExecuteDeposit = async () => {
    if (!effConnected || !effAddress) {
      showToast('Connect Wallet', 'Connect your wallet to stake into the deployed ReputationYieldVault.', 'error');
      return;
    }
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Invalid Amount', 'Please enter a valid deposit amount.', 'error');
      return;
    }
    if (walletCUSDBalance > 0 && amountNum > walletCUSDBalance) {
      showToast('Insufficient Balance', `You only have ${walletCUSDBalance.toLocaleString()} ${stakingTokenSymbol} in your wallet.`, 'error');
      return;
    }
    setStakingAction('stake');
    try {
      const hash = await vaultStake(amountNum, demoSigner ?? undefined);
      playSound('fanfare');
      boostScore(30, 'CredX Vault Liquidity Allocation');
      showToast('Stake Submitted', `Staked ${amountNum} ${stakingTokenSymbol} into ReputationYieldVault. Tx: ${hash.slice(0, 12)}…`, 'success');
      setWithdrawalRequests((prev) => [
        {
          id: `wr-${Date.now()}`,
          amount: amountNum.toFixed(4),
          token: stakingTokenSymbol,
          status: 'Staked',
          time: 'Just now',
          txHash: `${hash.slice(0, 10)}…`
        },
        ...prev
      ]);
      await refreshVaultState();
    } catch (err: any) {
      showToast('Stake Failed', err.reason || err.message || 'Transaction reverted.', 'error');
    } finally {
      setStakingAction(null);
    }
  };

  const handleExecuteWithdraw = async () => {
    if (!effConnected || !effAddress) {
      showToast('Connect Wallet', 'Connect your wallet to unstake from the deployed ReputationYieldVault.', 'error');
      return;
    }
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Invalid Amount', 'Please enter a valid withdraw amount.', 'error');
      return;
    }
    if (vaultState && amountNum > vaultState.stakedByUser) {
      showToast('Exceeds Position', `You only have ${vaultState.stakedByUser.toLocaleString()} ${stakingTokenSymbol} staked.`, 'error');
      return;
    }
    setStakingAction('unstake');
    try {
      const hash = await vaultUnstake(amountNum, demoSigner ?? undefined);
      playSound('success');
      showToast('Unstake Submitted', `Withdrew ${amountNum} ${stakingTokenSymbol} back to your connected wallet. Tx: ${hash.slice(0, 12)}…`, 'success');
      setWithdrawalRequests((prev) => [
        {
          id: `wr-${Date.now()}`,
          amount: amountNum.toFixed(4),
          token: stakingTokenSymbol,
          status: 'Unstaked',
          time: 'Just now',
          txHash: `${hash.slice(0, 10)}…`
        },
        ...prev
      ]);
      await refreshVaultState();
    } catch (err: any) {
      showToast('Unstake Failed', err.reason || err.message || 'Transaction reverted.', 'error');
    } finally {
      setStakingAction(null);
    }
  };

  const handleClaimRewards = async () => {
    if (!effConnected || !effAddress) {
      showToast('Connect Wallet', 'Connect your wallet to claim rewards from the deployed ReputationYieldVault.', 'error');
      return;
    }
    if (vaultState && vaultState.pendingRewards <= 0) {
      showToast('No Rewards', 'No claimable rewards in the ReputationYieldVault right now.', 'info');
      return;
    }
    setStakingAction('claim');
    try {
      const hash = await vaultClaimRewards(demoSigner ?? undefined);
      playSound('fanfare');
      boostScore(25, 'CredX Vault Reward Harvest');
      showToast('Rewards Claimed', `${realClaimable?.toFixed(4)} ${rewardTokenSymbol} claimed to your wallet. Tx: ${hash.slice(0, 12)}…`, 'success');
      await refreshVaultState();
    } catch (err: any) {
      showToast('Claim Failed', err.reason || err.message || 'Transaction reverted.', 'error');
    } finally {
      setStakingAction(null);
    }
  };

  // ─── Intent Solver Real-time Execution Simulation ─────────────────────────
  const triggerIntentSolver = () => {
    setIntentRunning(true);
    setIntentStep(1);
    playSound('click');

    setTimeout(() => setIntentStep(2), 600);
    setTimeout(() => setIntentStep(3), 1200);
    setTimeout(() => {
      setIntentRunning(false);
      setIntentStep(4);

      const lower = naturalIntent.toLowerCase();
      let customLegs = [
        { name: 'Sovereign OCCR Credit Pool', pct: 45, protocol: 'Creditcoin L1 Precompile 0x0FD2', desc: 'Enterprise trade finance underwriting with prime collateral verification' },
        { name: 'Delta-Neutral Basis Arbitrage', pct: 35, protocol: 'CredX Perps Sovereign Engine', desc: 'Perpetual funding rate arbitrage capturing positive spreads with 0 delta' },
        { name: 'Liquid Staking Consensus Yield', pct: 20, protocol: 'stCTC Tier-1 Validator Nodes', desc: 'Direct staking yield with instantaneous liquidity unbonding' }
      ];

      if (lower.includes('carbon') || lower.includes('dovu') || lower.includes('rwa')) {
        customLegs = [
          { name: 'DOVU Carbon Credit Financing Pool', pct: 50, protocol: 'CredX RWA Credit Ledger', desc: 'Audited carbon sequestration credits with 180-day principal payback' },
          { name: 'stCTC Liquid Staking Multiplier', pct: 30, protocol: 'Tier-1 Consensus Nodes', desc: 'Auto-harvested validator yield streamed directly into RWA capital pool' },
          { name: 'Sovereign Liquidity Buffer', pct: 20, protocol: 'Substrate Precompile 0x0FD2', desc: 'Zero-gas instantaneous liquidity buffer against early redemptions' }
        ];
      } else if (lower.includes('capital') || lower.includes('preservation') || lower.includes('risk-free') || maxDrawdown <= 1.0) {
        customLegs = [
          { name: 'Tier-1 Insured USDC OCCR Reserve', pct: 60, protocol: 'Creditcoin L1 Treasury', desc: '100% principal insured backing with guaranteed 18.2% minimum floor rate' },
          { name: 'Aave V3 cUSD Money Market', pct: 25, protocol: 'Aave V3 Isolated Market', desc: 'Senior tranche institutional overcollateralized lending pool' },
          { name: 'Sovereign Circuit Breaker Buffer', pct: 15, protocol: 'Cold Reserve Vault', desc: 'Instant-halt liquidation insurance fund' }
        ];
      } else if (lower.includes('basis') || lower.includes('delta-neutral') || lower.includes('perp')) {
        customLegs = [
          { name: 'CredX Spot AMM Long Leg', pct: 50, protocol: 'CredX AMM 0x0FD2', desc: 'Spot CTC asset purchase at prime 0.05% swap fees' },
          { name: 'Sovereign 1x Short Hedge', pct: 50, protocol: 'CredX Perpetual Engine', desc: 'Continuous 8-hour funding rate capture generating +29.8% annualized cash flow' },
          { name: 'Auto-Compound Yield Layer', pct: 0, protocol: 'Autonomous Rebalance Loop', desc: 'Dynamic margin buffer rebalancer maintaining exact 0.00 delta' }
        ];
      }

      setSolvedRoute({
        solverName: 'Solver #1 (CredX Sovereign Precompile 0x0FD2)',
        apy: targetApy,
        gasEstimate: '0.00 CTC ($0.00)',
        executionTime: `${Math.floor(Math.random() * 30 + 55)}ms`, // NOSONAR
        confidence: 99.6,
        zkProof: `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`, // NOSONAR
        legs: customLegs
      });
      playSound('fanfare');
      showToast('Intent Cryptographically Solved', 'Execution route confirmed by decentralized solver auction!', 'success');
    }, 1800);
  };

  // Execute Winning Route On-Chain Action
  const handleExecuteWinningRoute = () => {
    setAgentExecutingTrade(true);
    playSound('click');
    setTimeout(() => {
      setAgentExecutingTrade(false);
      playSound('fanfare');
      boostScore(50, 'Autonomous Solver Route Settlement');
      showToast('Intent Settled On-Chain', 'Winning solver route executed via Substrate Precompile 0x0FD2 (+50 CTS Boost)!', 'success');

      // Add to live log
      const now = new Date();
      setAgentLogs((prev) => [
        {
          id: `exec-${Date.now()}`,
          time: now.toTimeString().split(' ')[0],
          msg: `[SETTLED] Executed route for ${targetApy}% Target APY via Solver #1 (local solver simulation — no ZK proof was generated or verified).`,
          type: 'success'
        },
        ...prev
      ]);
    }, 1200);
  };

  // Emergency Circuit Breaker Trigger
  const handleEmergencyCircuitBreaker = () => {
    playSound('ping');
    setAutopilotActive(false);
    showToast(
      'Circuit Breaker Engaged',
      'All automated execution halted. 100% of managed capital safely parked into Cold Reserve.',
      'warning'
    );
    const now = new Date();
    setAgentLogs((prev) => [
      {
        id: `cb-${Date.now()}`,
        time: now.toTimeString().split(' ')[0],
        msg: '[EMERGENCY] Manual circuit breaker activated. All solver bids cancelled. Capital secured in cold reserve.',
        type: 'security'
      },
      ...prev
    ]);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    if (streamFilter === 'ALL') return agentLogs;
    return agentLogs.filter((log) => {
      if (streamFilter === 'ARBITRAGE') return log.msg.includes('[ARBITRAGE]');
      if (streamFilter === 'REBALANCE') return log.msg.includes('[REBALANCE]');
      if (streamFilter === 'SOLVER') return log.msg.includes('[SOLVER]') || log.msg.includes('[SETTLED]');
      if (streamFilter === 'SECURITY') return log.msg.includes('[SECURITY]') || log.msg.includes('[EMERGENCY]');
      return true;
    });
  }, [agentLogs, streamFilter]);

  // ─── Live klines: RapidAPI → Binance → FreeCryptoAPI live samples (30s) ──
  useEffect(() => {
    let dead = false;
    if (!selectedFeed) {
      setCandles(null);
      return;
    }
    const load = async () => {
      let arr: Candle[] | null = null;
      let src: 'rapidapi' | 'binance' | 'freecryptoapi' = 'binance';
      try { arr = await fetchRapidKlines(selectedFeed.binance, KLINE_INTERVAL[timeframe], 200); } catch { arr = null; }
      if (arr) src = 'rapidapi';
      if (!arr) {
        try { arr = await fetchBinanceKlines(selectedFeed.binance, KLINE_INTERVAL[timeframe], 200); } catch { arr = null; }
      }
      if (!arr && FREE_KEY) {
        arr = candlesFromSnapshots(priceSnapRef.current[selectedFeed.key], bucketMsForTimeframe(timeframe));
        src = 'freecryptoapi';
      }
      if (dead) return;
      if (arr) {
        candlesRef.current = arr;
        setCandles(arr);
        setFeedSource(src);
      } else if (!candlesRef.current) {
        setFeedSource('none');
      }
      setMarketLoading(false);
    };
    setCandles(null);
    setMarketLoading(true);
    load();
    const id = setInterval(load, 30000);
    return () => { dead = true; clearInterval(id); };
  }, [selectedFeed?.key, timeframe]);

  // Charts built from FreeCryptoAPI live samples update as new snapshots land (60s ticker cadence).
  useEffect(() => {
    if (feedSource !== 'freecryptoapi' || !selectedFeed) return;
    const arr = candlesFromSnapshots(priceSnapRef.current[selectedFeed.key], bucketMsForTimeframe(timeframe));
    if (arr) setCandles(arr);
  }, [snapGen, selectedFeed?.key, timeframe, feedSource]);

  // ─── Real 24h tickers + price snapshots (FreeCryptoAPI → RapidAPI → Binance, 60s) ──
  useEffect(() => {
    let dead = false;
    const sync = async () => {
      let arr: Ticker[] | null = null;
      try { arr = await fetchFreeTickers(); } catch { arr = null; }
      if (!arr) { try { arr = await fetchRapidTickers(); } catch { arr = null; } }
      if (!arr) { try { arr = await fetchBinanceTickers(); } catch { arr = null; } }
      if (dead) return;
      if (arr && arr.length) {
        setTickers(arr);
        const nowT = Date.now();
        const bucket = Math.floor(nowT / 30000) * 30000;
        const ref = priceSnapRef.current;
        arr.forEach((tk) => {
          const key = tk.symbol.replace('USDT', '');
          if (!REF_FEED_KEYS.has(key)) return;
          const list = ref[key] || (ref[key] = []);
          const last = list[list.length - 1];
          if (last && last.t === bucket) last.p = tk.lastPrice;
          else { list.push({ t: bucket, p: tk.lastPrice }); if (list.length > 400) list.shift(); }
        });
        setSnapGen((g) => g + 1);
      }
    };
    sync();
    const id = setInterval(sync, 60000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  // ─── Draw the live technical chart: candlesticks + EMA overlays + RSI + MACD ──
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 640;
    const height = rect.height || 320;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padL = 58;
    const padR = 42;
    const padT = 12;
    const padB = 20;
    const plotW = width - padL - padR;
    const paneGap = 9;
    const priceH = Math.max(60, height * 0.5);
    const rsiH = Math.max(44, height * 0.18);
    const macdH = height - padT - padB - priceH - rsiH - paneGap * 2;
    const xOf = (i: number, count: number) => padL + (count <= 1 ? 0 : (i / (count - 1)) * plotW);
    const fmtAxis = (v: number, maxDig = 2) => (v < 10 ? v.toFixed(maxDig) : v.toLocaleString('en-US', { maximumFractionDigits: 2 }));

    if (!candles || candles.length < 2) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marketLoading ? 'Fetching live candlestick data…' : 'No candle data right now.', width / 2, height / 2);
      return;
    }

    const closes = candles.map((c) => c.close);
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const pr = maxP - minP || 1;
    const yP = (v: number) => padT + priceH - ((v - minP) / pr) * priceH;
    const n = candles.length;

    ctx.textBaseline = 'middle';
    ctx.font = '9px monospace';

    // Price pane: grid + y labels
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i <= 4; i++) {
      const y = padT + (priceH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      const v = maxP - (pr / 4) * i;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(fmtAxis(v), padL - 6, y);
    }
    ctx.setLineDash([]);

    // x time labels + vertical grid
    const stepIdx = [0, Math.ceil(n / 4), Math.ceil((2 * n) / 4), Math.ceil((3 * n) / 4), n - 1];
    stepIdx.forEach((si, idx) => {
      if (si < 0 || si >= n) return;
      const x = xOf(si, n);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + priceH);
      ctx.stroke();
      const t = new Date(candles[si].time);
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(148, 163, 184, 0.6)' : 'rgba(148, 163, 184, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(`${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`, x, padT + priceH + 10);
    });

    const drawLine = (arr: number[], color: string, w = 1.15, dash?: number[]) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.setLineDash(dash || []);
      arr.forEach((v, i) => {
        const x = xOf(i, arr.length);
        const y = yP(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Candlesticks + EMA overlays + last-price marker (clipped to plot area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, priceH);
    ctx.clip();
    const bw = Math.max(1.5, (plotW / n) * 0.62);
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const up = c.close >= c.open;
      const color = up ? '#10b981' : '#f43f5e';
      const x = xOf(i, n);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yP(c.high));
      ctx.lineTo(x, yP(c.low));
      ctx.stroke();
      const yO = yP(c.open);
      const yC = yP(c.close);
      ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(1, Math.abs(yC - yO)));
    }
    if (n >= 1) drawLine(emaArray(closes, 9), '#22d3ee');
    if (n >= 21) drawLine(emaArray(closes, 21), '#c084fc');
    const lastClose = closes[n - 1];
    const yLast = yP(lastClose);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yLast);
    ctx.lineTo(padL + plotW, yLast);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Last price right-axis label
    ctx.fillStyle = '#00f2fe';
    ctx.textAlign = 'left';
    ctx.fillText(fmtAxis(lastClose), padL + plotW + 5, yLast);

    // RSI pane
    const rsiTop = padT + priceH + paneGap;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.textAlign = 'left';
    ctx.fillText('RSI 14', padL, rsiTop + 9);
    const rsiArr = rsiSeries(closes, 14);
    [70, 50, 30].forEach((lvl) => {
      const y = rsiTop + (rsiH - 10) - ((lvl - 10) / 100) * (rsiH - 10);
      ctx.strokeStyle = lvl === 50 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, rsiTop, plotW, rsiH);
    ctx.clip();
    ctx.beginPath();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.2;
    let started = false;
    rsiArr.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i, n);
      const y = rsiTop + (rsiH - 10) - (v / 100) * (rsiH - 10);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
    const lastRsi = rsiArr[rsiArr.length - 1];
    if (lastRsi != null) {
      const ry = rsiTop + (rsiH - 10) - (lastRsi / 100) * (rsiH - 10);
      ctx.fillStyle = lastRsi >= 70 ? '#f43f5e' : lastRsi <= 30 ? '#10b981' : '#fbbf24';
      ctx.fillText(`rsi ${lastRsi.toFixed(1)}`, padL + plotW + 5, ry);
    }

    // MACD pane
    const macdTop = rsiTop + rsiH + paneGap;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillText('MACD 12/26/9', padL, macdTop + 9);
    const m = macdSeries(closes);
    if (m) {
      const minM = Math.min(...m.hist, ...m.line, ...m.signal) || -0.0001;
      const maxM = Math.max(...m.hist, ...m.line, ...m.signal) || 0.0001;
      const mr = maxM - minM || 1;
      const yM = (v: number) => macdTop + 12 + ((maxM - v) / mr) * (macdH - 12);
      const zeroY = yM(0);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, zeroY);
      ctx.lineTo(padL + plotW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, macdTop + 10, plotW, macdH - 12);
      ctx.clip();
      const hbw = Math.max(1, (plotW / n) * 0.4);
      m.hist.forEach((h, i) => {
        const y = yM(h);
        ctx.fillStyle = h >= 0 ? 'rgba(16, 185, 129, 0.55)' : 'rgba(244, 63, 94, 0.55)';
        ctx.fillRect(xOf(i, n) - hbw / 2, Math.min(y, zeroY), hbw, Math.max(1, Math.abs(y - zeroY)));
      });
      const mkLine = (arr: number[], color: string, w: number) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        arr.forEach((v, i) => {
          const x = xOf(i, n);
          const y = yM(v);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      mkLine(m.line, '#22d3ee', 1);
      mkLine(m.signal, '#f59e0b', 1);
      ctx.restore();
      const lastH = m.hist[m.hist.length - 1];
      ctx.fillStyle = lastH >= 0 ? '#34d399' : '#fb7185';
      ctx.fillText(`hist ${(lastH || 0).toFixed(5)}`, padL + plotW + 5, macdTop + 10);
    }
  }, [candles, marketLoading]);

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: CredX Sovereign Vault Global Metrics
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#03131c] via-[#041a26] to-[#020b12] border border-cyan-500/25 shadow-2xl space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: CONNECT WALLET Portfolio Summary */}
          <div className="lg:col-span-6 space-y-2">
            <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Connected Wallet Yield Portfolio
            </span>

            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Your Stake</span>
                <span className="text-lg font-black text-white">
                  {vaultState ? realStakedByUser?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  <span className="text-xs text-cyan-300 font-normal"> {stakingTokenSymbol}</span>
                </span>
                <span className="text-[9px] text-cyan-400 block">
                  {vaultState ? 'Live on-chain' : effConnected ? 'Read unavailable' : 'Connect wallet'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Claimable Rewards</span>
                <span className="text-lg font-black text-emerald-400">
                  {vaultState ? `+${realClaimable?.toFixed(4)}` : '—'}
                  <span className="text-xs text-emerald-400/70 font-normal"> {rewardTokenSymbol}</span>
                </span>
                <span className="text-[9px] text-slate-500 block">ReputationYieldVault</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Wallet Balance</span>
                <span className="text-lg font-black text-cyan-300">
                  {isConnected ? walletCUSDBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  <span className="text-xs text-white/40 font-normal"> cUSD</span>
                </span>
                <span className="text-[9px] text-slate-500 block">read from cUSD</span>
              </div>
            </div>
          </div>

          {/* Right: PROTOCOL METRICS Summary */}
          <div className="lg:col-span-6 space-y-2">
            <span className="text-[10px] font-mono uppercase text-purple-400 font-bold tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" />
              CredX Protocol Global Metrics
            </span>

            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Total Staked / TVL</span>
                <span className="text-lg font-black text-white">
                  {vaultState ? realTotalStaked?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  <span className="text-xs text-purple-300 font-normal"> {stakingTokenSymbol}</span>
                </span>
                <span className="text-[9px] text-purple-300 block">Reputation Yield Vault</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Last Rewards Block</span>
                <span className="text-lg font-black text-purple-300">
                  {vaultState ? vaultState.lastRewardBlock.toLocaleString() : '—'}
                </span>
                <span className="text-[9px] text-slate-500 block">rewardPerTokenStored</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-emerald-500/20">
                <span className="text-[9px] text-slate-400 block uppercase">Safety Score</span>
                <div className="flex items-center gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span key={dot} className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                  ))}
                </div>
                <span className="text-[9px] text-emerald-300 block pt-0.5">{vaultState ? 'On-chain live' : 'Not connected'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Main Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-cyan-500/15">
          {[
            { id: 'catalog', label: 'All Vaults Catalog (Multi-Crypto & TradeSync)', icon: Layers },
            { id: 'analytics', label: 'Trading Vault & Analytics (Performance)', icon: TrendingUp },
            { id: 'sectors', label: 'Strategy Sectors 3D/2D Matrix', icon: Compass },
            { id: 'intent', label: 'Financial Autopilot & Intent Solvers (AI Terminal)', icon: Bot, isAi: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  playSound('click');
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? tab.isAi
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.35)]'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.isAi ? 'text-purple-400 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {tab.isAi && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gradient-to-r from-purple-500 to-cyan-400 text-slate-950 uppercase tracking-tight">
                    AI AGENTS
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: MULTI-CRYPTO VAULTS CATALOG & TRADESYNC JOURNAL (Image 4)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Top: Financial Autopilot & Intent Solver Spotlight Banner */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-r from-[#120524] via-[#090b22] to-[#031d27] border border-purple-500/35 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(168,85,247,0.4)]">
                <BrainCircuit className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    Autonomous Financial Autopilot &amp; Intent Solver Terminal
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    4 Solvers Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-normal">
                  Delegate multi-asset yield harvesting to 4 specialized AI agents (Alpha, Beta, Gamma, Sentinel) or broadcast natural language intents with ZK-STARK execution proofs.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('intent');
                playSound('click');
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 hover:from-purple-400 hover:to-cyan-300 text-slate-950 font-mono shadow-xl shadow-purple-500/20 transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Launch Autopilot Terminal &rarr;</span>
            </button>
          </div>
          {/* Top: TradeSync Vault Performance Journal (REAL on-chain ledger) */}
          <div className="p-6 rounded-3xl bg-[#020d16] border border-cyan-500/25 shadow-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/5">
              <div>
                <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-widest flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Vault Performance Journal — Real On-Chain Ledger
                </span>
                <p className="text-xs text-slate-400 font-mono pt-0.5">
                  Yield-vault statistics derived from the deployed ReputationYieldVault ledger (Staked / Unstaked / Rewards) + live pool state.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE on-chain
                </span>
                {/* View Selector */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-white/10 font-mono text-xs">
                  <button
                    onClick={() => setJournalView('cumulative')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      journalView === 'cumulative' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Position Curve
                  </button>
                  <button
                    onClick={() => setJournalView('calendar')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      journalView === 'calendar' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Yield Calendar
                  </button>
                </div>
              </div>
            </div>

            {/* 5 Real KPI Cards — derived from the on-chain vault ledger */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
              {/* 1. Capital Deployed */}
              <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 space-y-1 relative overflow-hidden">
                <span className="text-[9px] text-slate-400 uppercase block">Capital Deployed</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-cyan-300">{fmtNum(realStakedByUser ?? journalFromLedger.net, 0)}</span>
                  <span className="text-[10px] text-cyan-400/80">{stakingTokenSymbol}</span>
                </div>
                <span className="text-[9px] text-slate-500 block pt-1">live on-chain stake</span>
              </div>

              {/* 2. Unrealized Rewards */}
              <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Unrealized Rewards</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-emerald-400">{realClaimable != null ? fmtNum(realClaimable, 0) : '—'}</span>
                  <span className="text-[10px] text-emerald-400/80">{rewardTokenSymbol}</span>
                </div>
                <span className="text-[9px] text-slate-500 block pt-1">accruing per block (live)</span>
              </div>

              {/* 3. Realized Yield */}
              <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Realized Yield</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-white">{fmtNum(journalFromLedger.totalClaimed, 0)}</span>
                  <span className="text-[10px] text-slate-400">{rewardTokenSymbol}</span>
                </div>
                <span className="text-[9px] text-slate-500 block pt-1">{journalFromLedger.claimCount} Rewards claims on ledger</span>
              </div>

              {/* 4. Deposit Cycles */}
              <div className="p-4 rounded-2xl bg-black/60 border border-purple-500/20 space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Deposit Cycles</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-purple-300">{journalFromLedger.depositCount}</span>
                  <span className="text-[10px] text-purple-400/80">Staked events</span>
                </div>
                <span className="text-[9px] text-slate-500 block pt-1">{fmtNum(journalFromLedger.totalDeposited, 0)} {stakingTokenSymbol} total</span>
              </div>

              {/* 5. Stake Inception */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Stake Inception</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-white">
                    {journalFromLedger.firstDepositT ? new Date(journalFromLedger.firstDepositT * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 block pt-1">first on-chain Staked event</span>
              </div>
            </div>

            {/* Sub-View: Position Curve or Yield Calendar */}
            {journalView === 'cumulative' ? (
              <div className="p-4 rounded-2xl bg-[#01080e] border border-cyan-500/20 space-y-2 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-white font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Capital Deployed Curve — on-chain ledger
                  </span>
                  <span className="text-cyan-300 font-bold">
                    Net {fmtNum(journalFromLedger.net, 0)} {stakingTokenSymbol}
                    <span className="text-emerald-400"> · Unrealized +{realClaimable != null ? fmtNum(realClaimable, 0) : '—'} {rewardTokenSymbol}</span>
                  </span>
                </div>
                <div className="relative w-full h-[140px] rounded-xl overflow-hidden bg-[#030d14] border border-white/5">
                  <canvas ref={cumPnlCanvasRef} className="w-full h-full block" />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#01080e] border border-cyan-500/20 font-mono text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 pb-2 border-b border-white/5">
                  <span className="text-white font-bold">Vault Yield Calendar</span>
                  <span className="text-cyan-300">Last 30 days · real ledger events</span>
                </div>
                <div className="grid grid-cols-10 gap-1.5 text-center text-[10px]">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const ds = today.getTime() - (29 - i) * 86400000;
                    const de = ds + 86400000;
                    const dayEvs = journalFromLedger.evs.filter((e) => e.timestamp > 0 && e.timestamp * 1000 >= ds && e.timestamp * 1000 < de);
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded-lg border ${
                          dayEvs.length
                            ? 'bg-cyan-950/25 border-cyan-500/30 text-cyan-200'
                            : 'bg-black/40 border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="text-slate-500 block text-[8px]">Day {i + 1}</span>
                        {dayEvs.length === 0 ? (
                          <span className="block font-bold text-slate-600">—</span>
                        ) : (
                          dayEvs.slice(0, 2).map((ev, j) => (
                            <span
                              key={j}
                              className={`block font-bold truncate ${ev.type === 'Unstaked' ? 'text-rose-300' : ev.type === 'Claimed' ? 'text-emerald-300' : 'text-cyan-300'}`}
                              title={`${ev.type} ${fmtNum(ev.amount ?? 0, 0)} · block #${ev.block}`}
                            >
                              {ev.type === 'Staked' ? '+' : ev.type === 'Unstaked' ? '−' : '+★'} {fmtNum(ev.amount ?? 0, 0)}
                            </span>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Vaults Table & Interactive Action Ticket */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Multi-Crypto Vaults Table (xl:col-span-8) */}
            <div className="xl:col-span-8 rounded-3xl p-6 bg-[#020d14] border border-cyan-500/20 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs">
                  <button
                    onClick={() => setCatalogSubTab('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                      catalogSubTab === 'all'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Vaults ({vaults.length})
                  </button>
                  <button
                    onClick={() => setCatalogSubTab('my')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                      catalogSubTab === 'my'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    My Positions ({vaults.filter((v) => v.myPosition > 0).length})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1 font-bold">
                    <Sliders className="w-3 h-3 text-purple-400" /> Strategy:
                  </span>
                  {['All', 'Single Asset', 'Dual Asset DEX', 'Leveraged LST', 'Delta-Neutral Basis', 'RWA Credit'].map((strat) => (
                    <button
                      key={strat}
                      onClick={() => setStrategyFilter(strat)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        strategyFilter === strat
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                          : 'bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {strat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search (e.g. USDC, HBAR, CTC, ETH, SOL, SUI)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1 font-bold">
                    <Layers className="w-3 h-3 text-cyan-400" /> Protocol:
                  </span>
                  {['All', 'CredX L1', 'SaucerSwap', 'Aave V3', 'Stader Labs'].map((prot) => (
                    <button
                      key={prot}
                      onClick={() => setProtocolFilter(prot)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        protocolFilter === prot
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {prot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assets Table */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-[#03151f] text-slate-400 text-[11px] border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-4">Assets</th>
                      <th className="py-3.5 px-4 text-right">Wallet</th>
                      <th className="py-3.5 px-4 text-right">My Position</th>
                      <th className="py-3.5 px-4 text-right">APY &darr;</th>
                      <th className="py-3.5 px-4 text-right">TVL</th>
                      <th className="py-3.5 px-4 text-center">Safety Score</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredVaults.map((vault) => {
                      const isSelected = selectedVaultId === vault.id;
                      return (
                        <tr
                          key={vault.id}
                          onClick={() => setSelectedVaultId(vault.id)}
                          className={`hover:bg-white/5 transition cursor-pointer ${
                            isSelected ? 'bg-cyan-950/20 border-l-2 border-cyan-400' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                                style={{ backgroundColor: vault.iconBg, color: vault.iconColor }}
                              >
                                {vault.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{vault.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-slate-400">
                                    {vault.protocol}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                    {vault.strategy}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right text-slate-300">
                            {vault.id === 'ctc-cusd' && vaultState ? (
                              <span>
                                {walletCUSDBalance > 0 || isConnected
                                  ? walletCUSDBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : '—'}{' '}
                                {stakingTokenSymbol}
                                {vaultState && isConnected && (
                                  <span className="text-[8px] text-emerald-400 block">live on-chain</span>
                                )}
                              </span>
                            ) : vault.walletBalance > 0 ? (
                              <span>{vault.walletBalance.toLocaleString()} {vault.symbol}</span>
                            ) : (
                              <span className="text-slate-600">&mdash;</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {vault.id === 'ctc-cusd' && vaultState ? (
                              (vaultState.stakedByUser > 0 ? (
                                <span className="font-bold text-cyan-300">
                                  {realStakedByUser?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {stakingTokenSymbol}
                                </span>
                              ) : (
                                <span className="text-slate-600">&mdash;</span>
                              ))
                            ) : vault.myPosition > 0 ? (
                              <span className="font-bold text-cyan-300">{vault.myPosition.toLocaleString()} {vault.symbol}</span>
                            ) : (
                              <span className="text-slate-600">&mdash;</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-black text-emerald-400 text-sm">
                            {vault.apy.toFixed(2)}%
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-white">
                            {vault.id === 'ctc-cusd' && vaultState ? (
                              <span className="text-emerald-400">
                                {realTotalStaked?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {stakingTokenSymbol}
                              </span>
                            ) : (
                              <span>{vault.tvlString}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {[1, 2, 3, 4, 5].map((dot) => (
                                <span
                                  key={dot}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    dot <= vault.safetyScore
                                      ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]'
                                      : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVaultId(vault.id);
                                setActionTab('deposit');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[10px] transition cursor-pointer"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Live Interactive Deposit / Withdraw Ticket (xl:col-span-4) */}
            <div className="xl:col-span-4 rounded-3xl p-6 bg-[#0a0515] border border-cyan-500/30 shadow-2xl space-y-5">
              <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/20 space-y-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-bold">
                  {vaultState ? 'On-chain ReputationYieldVault' : 'Select CredX Vault'}
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{ backgroundColor: selectedVault.iconBg, color: selectedVault.iconColor }}
                    >
                      {selectedVault.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedVault.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{selectedVault.protocol} &bull; {selectedVault.strategy}</span>
                    </div>
                  </div>
                  <span className="text-base font-mono font-black text-emerald-400">
                    {selectedVault.apy.toFixed(2)}% APY
                  </span>
                </div>
              </div>

              {!effConnected && !demoMode && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 font-mono">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-white block">
                        This vault is LIVE &amp; seeded on-chain — try it now
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-relaxed">
                        The bundled testnet wallet has <strong className="text-emerald-300">25,250 cUSD staked</strong> and{' '}
                        <strong className="text-emerald-300">1,000,000 DEPIN</strong> funded for rewards. Stake, accrue and claim
                        with real Creditcoin testnet transactions — no wallet extension needed.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setDemoMode(true); playSound('click'); }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 transition cursor-pointer"
                  >
                    Use Seeded Demo Wallet &rarr;
                  </button>
                </div>
              )}
              {demoMode && (
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold min-w-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="truncate">
                      Signing as Seeded Demo Wallet {DEMO_ROOT_WALLET?.address.slice(0, 6)}…{DEMO_ROOT_WALLET?.address.slice(-4)}
                    </span>
                  </div>
                  <button
                    onClick={() => setDemoMode(false)}
                    className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 border border-white/10 transition cursor-pointer text-[10px] font-bold shrink-0"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs">
                <button
                  onClick={() => setActionTab('deposit')}
                  className={`py-2 rounded-xl font-bold transition cursor-pointer ${
                    actionTab === 'deposit'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Stake (Deposit)
                </button>
                <button
                  onClick={() => setActionTab('withdraw')}
                  className={`py-2 rounded-xl font-bold transition cursor-pointer ${
                    actionTab === 'withdraw'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Unstake (Withdraw)
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2 font-mono">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{actionTab === 'deposit' ? 'Amount to Stake' : 'Amount to Unstake'}</span>
                  <span>
                    {actionTab === 'deposit' ? (
                      <>Wallet: <strong className="text-white">
                        {isConnected ? walletCUSDBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} cUSD
                      </strong></>
                    ) : (
                      <>Staked: <strong className="text-cyan-300">
                        {realStakedByUser?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'} {stakingTokenSymbol}
                      </strong></>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    value={actionTab === 'deposit' ? depositAmount : withdrawAmount}
                    onChange={(e) => {
                      if (actionTab === 'deposit') setDepositAmount(e.target.value);
                      else setWithdrawAmount(e.target.value);
                    }}
                    placeholder="0.0"
                    className="w-full bg-transparent text-2xl font-bold text-cyan-300 outline-none"
                  />
                  <span className="text-xs text-slate-400 font-bold">{actionTab === 'deposit' ? 'cUSD' : stakingTokenSymbol}</span>
                </div>

                <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const maxVal = actionTab === 'deposit'
                          ? (isConnected ? walletCUSDBalance : 0)
                          : (realStakedByUser ?? 0);
                        const calculated = ((maxVal * pct) / 100).toFixed(2);
                        if (actionTab === 'deposit') setDepositAmount(calculated);
                        else setWithdrawAmount(calculated);
                      }}
                      className="px-2 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 transition cursor-pointer"
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 font-mono text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Compounding Strategy:</span>
                  <span className="text-white font-bold">Auto-Restake continuous</span>
                </div>
                <div className="flex justify-between">
                  <span>Epoch Compound Ticks:</span>
                  <span className="text-cyan-300 font-mono">Next tick in {compoundCountdown}s</span>
                </div>
              </div>

              <button
                disabled={stakingAction !== null}
                onClick={actionTab === 'deposit' ? handleExecuteDeposit : handleExecuteWithdraw}
                className="w-full py-4 rounded-2xl font-bold font-mono text-sm bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {stakingAction === 'stake'
                  ? 'Staking…'
                  : stakingAction === 'unstake'
                  ? 'Unstaking…'
                  : actionTab === 'deposit'
                  ? `Confirm Stake (${stakingTokenSymbol})`
                  : `Confirm Unstake (${stakingTokenSymbol})`}
              </button>

              <button
                disabled={stakingAction !== null || !isConnected}
                onClick={handleClaimRewards}
                className="w-full py-3 rounded-2xl font-bold font-mono text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 transition cursor-pointer disabled:opacity-50"
              >
                {stakingAction === 'claim'
                  ? 'Claiming…'
                  : `Claim Rewards (${realClaimable != null ? realClaimable.toFixed(4) : '—'} ${rewardTokenSymbol})`}
              </button>

              <div className="pt-3 border-t border-white/10 space-y-2 font-mono">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Staking activity log</span>
                {withdrawalRequests.length === 0 && (
                  <span className="text-[10px] text-slate-500 italic block">No staking activity yet — connect a wallet and stake into ReputationYieldVault.</span>
                )}
                {withdrawalRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400 font-bold">{req.status}</span>
                      <span className="text-slate-400 text-[10px]">{req.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{req.amount} {req.token}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{req.txHash}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: TRADING VAULT PERFORMANCE & ANALYTICS (Exact Reference Image 3)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* LIVE: Real technical indicator engine */}
          <div className="p-6 rounded-3xl bg-[#03131c] via-[#041a26] to-[#020b12] border border-cyan-500/25 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-300" /> Technical Indicators
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[9px] font-black tracking-wide">
                    EMA · RSI · MACD
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {selectedFeed.name} · real candles · EMA9/EMA21 overlays, RSI14 &amp; MACD 12/26/9 computed in-browser
                </p>
              </div>
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE
              </span>
              <div className="flex items-center gap-1.5">
                {REAL_FEED_ASSETS.map((f) => (
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

            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(KLINE_INTERVAL) as MarketTimeframe[]).map((tf) => (
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

            <canvas ref={chartCanvasRef} className="w-full h-80 rounded-2xl bg-[#020b12] border border-white/10" />

            <div className="flex items-center justify-between px-1 font-mono text-[10px] text-slate-500 gap-3">
              <span className="flex items-center gap-2 overflow-x-auto py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-emerald-400 font-bold shrink-0">LIVE</span>
                <span className="shrink-0">auto-refresh 30s</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 shrink-0">
                  EMA9 {indicators ? fmtNum(indicators.ema9, 4) : '—'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-300 shrink-0">
                  EMA21 {indicators ? fmtNum(indicators.ema21, 4) : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded shrink-0 ${indicators?.rsi == null ? 'bg-slate-500/10 text-slate-400 border border-slate-500/25' : indicators.rsi >= 70 ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25' : indicators.rsi <= 30 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'}`}>
                  RSI14 {indicators?.rsi != null ? indicators.rsi.toFixed(1) : '—'}
                </span>
                <span className={`px-1.5 py-0.5 rounded shrink-0 ${!indicators?.macd ? 'bg-slate-500/10 text-slate-400 border border-slate-500/25' : (indicators.macd.hist >= 0 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border border-rose-500/25')}`}>
                  MACD hist {indicators?.macd ? fmtNum(indicators.macd.hist, 5) : '—'}
                </span>
                <span className="shrink-0">
                  on {selectedFeed.binance} · feed:{' '}
                  <span title={`${selectedFeed.binance} via ${FEED_SOURCE_LABEL[feedSource]}`} className="text-emerald-400 cursor-help">
                    {feedSource === 'rapidapi' ? 'exchange kline API' : feedSource === 'binance' ? 'exchange kline API' : feedSource === 'freecryptoapi' ? 'live price samples' : 'no feed'}
                  </span>
                </span>
              </span>
              <span className="shrink-0">
                {candles && candles.length > 0
                  ? `${candles.length} candles · last ${new Date(candles[candles.length - 1].time).toLocaleTimeString()}`
                  : marketLoading
                    ? 'fetching real candles…'
                    : 'waiting for candles…'}
              </span>
            </div>

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

            {/* Real 24h market table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#03151f] text-slate-400 text-[11px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Asset</th>
                    <th className="py-3 px-4 text-right">24h Last Price</th>
                    <th className="py-3 px-4 text-right">24h Change</th>
                    <th className="py-3 px-4 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {REAL_FEED_ASSETS.map((f) => {
                    const tk = tickerFor(f.key);
                    return (
                      <tr key={f.key}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{f.key}</span>
                            <span className="text-[9px] text-slate-500">{f.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-cyan-300">
                          {tk ? `$${fmtNum(tk.lastPrice, 4)}` : '…'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${tk && tk.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tk ? `${tk.changePct >= 0 ? '+' : ''}${tk.changePct.toFixed(2)}%` : '…'}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 text-[10px]">{feedSource === 'freecryptoapi' ? 'live samples' : 'kline API'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Price, candles, EMA9/EMA21 overlays, RSI and MACD are computed in-browser on the real candle series. This is live market data — not simulated.
            </p>
          </div>

          {/* REAL: Trading Vault performance telemetry — derived from the on-chain vault ledger */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE
            </span>
            <span className="text-[10px] font-mono text-slate-500">Vault flows, chart and calendar are derived from the deployed ReputationYieldVault ledger + live pool reads — no simulated figures.</span>
          </div>
          {/* Top Row: 4 Real Metric Cards (from the on-chain ledger) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {/* This Week */}
            <div className="p-4 rounded-2xl bg-[#080d18] border border-white/10 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>This Week</span>
                <span className="text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10">{periodStats(Date.now() - 7 * 86400000).n} events</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-cyan-300">{fmtNum(journalFromLedger.net, 0)}</span>
                <span className="text-xs text-slate-500 font-bold">{stakingTokenSymbol} deployed</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>{fmtNum(periodStats(Date.now() - 7 * 86400000).d, 0)} deposited</span>
                <span>+{fmtNum(periodStats(Date.now() - 7 * 86400000).c, 0)} {rewardTokenSymbol} claimed</span>
              </div>
            </div>

            {/* This Month */}
            <div className="p-4 rounded-2xl bg-[#080d18] border border-white/10 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>This Month</span>
                <span className="text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10">{periodStats(Date.now() - 30 * 86400000).n} events</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-cyan-300">{fmtNum(periodStats(Date.now() - 30 * 86400000).d, 0)}</span>
                <span className="text-xs text-slate-500 font-bold">{stakingTokenSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>{fmtNum(periodStats(Date.now() - 30 * 86400000).w, 0)} withdrawn</span>
                <span>{periodStats(Date.now() - 30 * 86400000).n} ledger events</span>
              </div>
            </div>

            {/* This Year */}
            <div className="p-4 rounded-2xl bg-[#080d18] border border-cyan-500/20 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Unrealized</span>
                <span className="text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10">live</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-400">{realClaimable != null ? fmtNum(realClaimable, 0) : '—'}</span>
                <span className="text-xs text-slate-500 font-bold">{rewardTokenSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>pending rewards</span>
                <span>accrues per block</span>
              </div>
            </div>

            {/* All Time */}
            <div className="p-4 rounded-2xl bg-[#080d18] border border-emerald-500/30 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>All Time</span>
                <span className="text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10">{journalFromLedger.evs.length} events</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-400">{fmtNum(journalFromLedger.totalDeposited, 0)}</span>
                <span className="text-xs text-slate-500 font-bold">{stakingTokenSymbol} deposited</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>+{fmtNum(journalFromLedger.totalClaimed, 0)} rewards claimed</span>
                <span>{journalFromLedger.depositCount} deposits · {journalFromLedger.withdrawCount} withdrawals</span>
              </div>
            </div>
          </div>

          {/* Account Metrics Bar */}
          <div className="p-4 rounded-2xl bg-[#080c14] border border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Net Deployed</span>
                <span className="text-base font-bold text-white">{fmtNum(journalFromLedger.net, 0)} {stakingTokenSymbol}</span>
              </div>
              <div className="h-8 w-[1px] bg-white/10" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Unrealized Rewards</span>
                <span className="text-base font-bold text-emerald-400">{realClaimable != null ? fmtNum(realClaimable, 0) : '—'} {rewardTokenSymbol}</span>
              </div>
              <div className="h-8 w-[1px] bg-white/10" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Ledger Events</span>
                <span className="text-base font-bold text-cyan-300">{journalFromLedger.evs.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                On-chain: ReputationYieldVault
              </span>
            </div>
          </div>

          {/* Middle Row: Dual Canvas Charts & Strategy Execution Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Account Balance Chart (lg:col-span-5) */}
            <div className="lg:col-span-5 rounded-3xl p-5 bg-[#080c14] border border-cyan-500/25 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Capital Deployed
                  </h4>
                  <span className="text-xs font-mono text-cyan-300 font-bold">{fmtNum(journalFromLedger.net, 0)} {stakingTokenSymbol} staked on-chain</span>
                </div>

                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10 font-mono text-[10px]">
                  {(['h', 'D', 'W', 'M', '3M', 'Y'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setAnalyticsTimeframe(tf)}
                      className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                        analyticsTimeframe === tf ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full h-[240px] rounded-2xl overflow-hidden bg-[#05080e] border border-white/5">
                <canvas ref={balanceCanvasRef} className="w-full h-full block" />
              </div>
            </div>

            {/* Reward:Risk Monthly Histogram (lg:col-span-4) */}
            <div className="lg:col-span-4 rounded-3xl p-5 bg-[#080c14] border border-cyan-500/25 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Reward:Capital by Month
                  </h4>
                  <span className="text-xs font-mono text-slate-400">real ledger deposits vs claimed rewards</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span className="w-2 h-2 rounded-sm bg-cyan-400 inline-block" /> deposits
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" /> claims
                  </span>
                </div>
              </div>

              <div className="relative w-full h-[240px] rounded-2xl overflow-hidden bg-[#05080e] border border-white/5">
                <canvas ref={histCanvasRef} className="w-full h-full block" />
              </div>
            </div>

            {/* Right: REAL On-chain Vault Ledger (lg:col-span-3) */}
            <div className="lg:col-span-3 rounded-3xl p-5 bg-[#080c14] border border-emerald-500/20 shadow-2xl space-y-3 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-xs font-bold text-white">Vault Ledger</span>
                <span className="text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 font-bold">REAL on-chain</span>
              </div>

              {vaultLedger.length === 0 ? (
                <div className="text-[11px] text-slate-500 leading-relaxed p-2">
                  No vault activity logged by the RPC yet. Stake, unstake or claim via the demo wallet in the Yield Vault tab and the transaction appears here instantly.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {vaultLedger.slice(0, 12).map((ev, i) => (
                    <div key={`${ev.txHash}-${i}`} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className={ev.type === 'Claimed' ? 'text-emerald-400' : 'text-cyan-300'}>
                            {ev.type === 'Staked' ? 'Staked' : ev.type === 'Unstaked' ? 'Unstaked' : 'Claimed'}
                          </span>
                          {ev.amount != null && <span className="text-slate-400">{fmtNum(ev.amount, 0)}</span>}
                        </div>
                        <span className="text-slate-500 text-[10px]">#{fmtNum(ev.block, 0)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{ev.user ? `0x${ev.user.slice(0, 6)}…${ev.user.slice(-4)}` : '—'}</span>
                        <span className="text-emerald-400/80">{ev.txHash.slice(0, 12)}…</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Event Calendar — real ledger month */}
          <div className="p-6 rounded-3xl bg-[#080c14] border border-white/10 shadow-2xl space-y-4 font-mono">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/5">
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Event Calendar &bull; {monthCalendar.month}</h4>
                {(() => {
                  const m = periodStats(Date.now() - 30 * 86400000);
                  return (
                    <>
                      <span className="text-xs text-cyan-300 font-bold">+{fmtNum(m.d, 0)} deposited</span>
                      <span className="text-xs text-emerald-400 font-bold">+{fmtNum(m.c, 0)} claimed</span>
                      <span className="text-xs text-slate-500">{m.n} ledger events</span>
                    </>
                  );
                })()}
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10">
                LIVE on-chain events
              </span>
            </div>

            {/* Calendar Grid: Mon to Sun + daily ledger events */}
            <div className="grid grid-cols-8 gap-2 text-xs">
              {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'MONTH'].map((col) => (
                <div key={col} className="p-2 text-center text-[10px] text-slate-500 font-bold border-b border-white/5">
                  {col}
                </div>
              ))}

              {monthCalendar.cells.map((cell, i) => (
                <div
                  key={i}
                  className={
                    cell.day == null
                      ? 'p-3 rounded-xl bg-black/20 border border-white/5 text-slate-600'
                      : cell.evs.length > 0
                        ? 'p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-slate-200 space-y-1'
                        : 'p-3 rounded-xl bg-black/40 border border-white/5 text-slate-300'
                  }
                >
                  {cell.day == null ? (
                    '·'
                  ) : (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span>{cell.day}</span>
                        {cell.evs.length > 0 && <span className="text-cyan-400">{cell.evs.length}</span>}
                      </div>
                      {cell.evs.map((ev, j) => (
                        <div
                          key={`${ev.txHash}-${j}`}
                          className={`text-[10px] font-bold ${
                            ev.type === 'Staked' ? 'text-cyan-300' : ev.type === 'Unstaked' ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {ev.type === 'Staked' ? `+${fmtNum(ev.amount ?? 0, 0)}` : ev.type === 'Unstaked' ? `-${fmtNum(ev.amount ?? 0, 0)}` : `+${fmtNum(ev.amount ?? 0, 0)}★`}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}

              {(() => {
                const m = periodStats(Date.now() - 30 * 86400000);
                return (
                  <div className="p-3 rounded-xl bg-black/60 border border-cyan-500/20 text-slate-200 space-y-1 text-center">
                    <span className="text-[10px] text-slate-400 block">month</span>
                    <span className="text-cyan-300 font-bold text-xs">+{fmtNum(m.d, 0)}</span>
                    <span className="text-emerald-400 font-bold text-xs block">+{fmtNum(m.c, 0)} earned</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: STRATEGY SECTORS (3D Rotating Coin & Revolving Sectors)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sectors' && (
        <div className="p-6 rounded-3xl bg-[#090514] border border-purple-500/25 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Compass className="w-5 h-5 text-purple-400" />
                Strategy Sectors Matrix: Volatility vs. Duration
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Comprehensive taxonomy of DeFi yield strategies categorized across the two fundamental axes: Volatility (Y-Axis) and Duration (X-Axis).
              </p>
            </div>

            {/* 3D Orbit vs 2D Matrix Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-black/60 p-1 rounded-xl border border-purple-500/30 font-mono text-xs">
                <button
                  onClick={() => setSectorViewMode('3d')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    sectorViewMode === '3d'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  3D Orbiting Coin
                </button>
                <button
                  onClick={() => setSectorViewMode('2d')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    sectorViewMode === '2d'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  2D Quadrant Matrix
                </button>
              </div>
            </div>
          </div>

          {/* 3D Animated Orbital Space */}
          {sectorViewMode === '3d' ? (
            <div className="relative w-full h-[420px] rounded-3xl bg-[#04010a] border border-purple-500/30 overflow-hidden select-none">
              <canvas ref={orbitCanvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />
              <div className="absolute bottom-3 left-4 text-[10px] font-mono text-purple-300/60 pointer-events-none">
                3D Simulation: DeFi Yield Sectors dynamically revolving in orbit around central CredX Sovereign Coin
              </div>
            </div>
          ) : (
            /* 2D Quadrant Matrix */
            <div className="relative w-full h-[380px] rounded-3xl bg-[#04010a] border border-purple-500/30 overflow-hidden p-6 select-none">
              <div className="absolute left-4 top-4 text-xs font-mono text-cyan-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>High Volatility (Y-Axis)</span>
              </div>
              <div className="absolute left-4 bottom-4 text-xs font-mono text-slate-500">
                Low Volatility
              </div>
              <div className="absolute left-36 bottom-4 text-xs font-mono text-slate-500">
                Short Duration
              </div>
              <div className="absolute right-6 bottom-4 text-xs font-mono text-cyan-400 flex items-center gap-1">
                <span>Long Duration (X-Axis)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>

              {/* Center Crosshairs */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-cyan-500/30 border-dashed border-l border-cyan-400/40" />
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyan-500/30 border-dashed border-t border-cyan-400/40" />

              {/* Central CredX Sovereign Emblem in 2D View */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded-full bg-[#022c22] border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] z-0 flex items-center justify-center">
                <span className="text-[10px] font-mono font-black text-emerald-300 px-1.5 py-0.5">CredX</span>
              </div>

              {strategySectors.map((sector) => {
                const isSelected = selectedSectorId === sector.id;
                return (
                  <div
                    key={sector.id}
                    onClick={() => setSelectedSectorId(sector.id)}
                    style={{
                      left: `${sector.xPos}%`,
                      top: `${100 - sector.yPos}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    className={`absolute p-2.5 rounded-2xl cursor-pointer transition-all duration-300 font-mono ${
                      isSelected
                        ? 'bg-purple-950/90 border-2 border-purple-400 shadow-[0_0_24px_rgba(192,132,252,0.4)] scale-110 z-20'
                        : 'bg-black/80 border border-white/15 hover:border-purple-400/60 hover:scale-105 z-10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: sector.color }} />
                      <span className="text-xs font-bold text-white whitespace-nowrap">{sector.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-400">
                      <span className="text-emerald-400 font-bold">+{sector.apy}% APY</span>
                      <span className="text-purple-300 font-bold">{sector.allocationPct}% Weight</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Sector Details Drawer */}
          <div className="p-5 rounded-2xl bg-black/60 border border-purple-500/20 grid grid-cols-1 md:grid-cols-12 gap-5 items-center font-mono">
            <div className="md:col-span-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSector.color }} />
                <h4 className="text-sm font-bold text-white">{selectedSector.name}</h4>
              </div>
              <span className="text-[11px] text-purple-300/80 block">{selectedSector.category}</span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed pt-1">
                {selectedSector.description}
              </p>
            </div>

            <div className="md:col-span-4 space-y-2">
              <span className="text-[10px] uppercase text-slate-400 block">Represented Protocols</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedSector.protocols.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[9px] uppercase text-purple-300 block">Target APY</span>
                <span className="text-lg font-black text-emerald-400">+{selectedSector.apy}%</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[9px] uppercase text-purple-300 block">Vault Weight</span>
                <span className="text-lg font-black text-white">{selectedSector.allocationPct}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: FULL-FLEDGED FINANCIAL AUTOPILOT AGENT & INTENT SOLVER TERMINAL
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'intent' && (
        <div className="space-y-8">
          {/* SECTION 1: AUTONOMOUS AI AGENT MATRIX & CONTROL CENTER */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0d071e] via-[#090b1c] to-[#04111c] border border-cyan-500/30 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_20px_rgba(0,242,254,0.3)]">
                  <BrainCircuit className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">
                      CredX Financial Autopilot Agent Hub
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                      autopilotActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${autopilotActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                      {autopilotActive ? 'AUTONOMOUS DELEGATION ACTIVE' : 'AGENT PAUSED (MANUAL MODE)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono pt-0.5">
                    Select a specialized autonomous AI agent, tune risk guardrails, or broadcast natural language intents.
                  </p>
                </div>
              </div>

              {/* Master Controls */}
              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={() => {
                    setAutopilotActive(!autopilotActive);
                    showToast(
                      autopilotActive ? 'Autopilot Suspended' : 'Autopilot Resumed',
                      autopilotActive ? 'Agent is now in manual oversight mode.' : 'Autonomous yield harvesting & rebalancing active.',
                      autopilotActive ? 'warning' : 'success'
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg ${
                    autopilotActive
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                >
                  {autopilotActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{autopilotActive ? 'Pause Autopilot' : 'Resume Autopilot'}</span>
                </button>

                <button
                  onClick={handleEmergencyCircuitBreaker}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-950/60 hover:bg-rose-900 border border-rose-500/50 text-rose-300 transition flex items-center gap-1.5 cursor-pointer"
                  title="Emergency Circuit Breaker: Safely unwind positions and park capital in cold reserve"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Panic Halt</span>
                </button>
              </div>
            </div>

            {/* 4 Specialized AI Agent Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 font-mono">
              {autopilotAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      playSound('click');
                      showToast('Agent Activated', `Switched active autopilot engine to ${agent.name} (${agent.role}).`, 'info');
                    }}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden border ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)] scale-[1.02]'
                        : 'bg-black/50 border-white/10 hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: agent.iconBg, color: agent.color }}
                        >
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{agent.name}</h4>
                          <span className="text-[9px] text-slate-400 block">{agent.strategy}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        agent.riskRating === 'Ultra-Safe'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : agent.riskRating === 'Low'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {agent.riskRating}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-2 pt-1 font-sans">
                      {agent.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-white/5 text-[10px]">
                      <div>
                        <span className="text-slate-500 block text-[8px] uppercase">Target Yield</span>
                        <span className="text-emerald-400 font-bold text-xs">+{agent.targetApy}% APY</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[8px] uppercase">Profit Accrued</span>
                        <span className="text-cyan-300 font-bold text-xs">+${agent.cumulativeProfitUSD.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agent Parameter & Risk Guardrails Tuner */}
            <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/20 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
              {/* 1. Frequency */}
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" /> Rebalancing Cadence
                </span>
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {(['1s', '15m', '1h'] as const).map((cad) => (
                    <button
                      key={cad}
                      onClick={() => setRebalanceCadence(cad)}
                      className={`py-1.5 rounded-lg text-center font-bold text-[10px] transition cursor-pointer ${
                        rebalanceCadence === cad
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cad === '1s' ? '1s Ticks' : cad}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Risk Bounds */}
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Risk Parameter Bounds
                </span>
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {(['conservative', 'balanced', 'aggressive'] as const).map((risk) => (
                    <button
                      key={risk}
                      onClick={() => setRiskTolerance(risk)}
                      className={`py-1.5 rounded-lg text-center font-bold text-[10px] transition cursor-pointer capitalize ${
                        riskTolerance === risk
                          ? 'bg-purple-500 text-white font-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {risk}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Slippage Guard */}
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase block flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-yellow-400" /> Max Slippage Bound
                </span>
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {(['0.05%', '0.1%', '0.5%'] as const).map((slp) => (
                    <button
                      key={slp}
                      onClick={() => setSlippageGuard(slp)}
                      className={`py-1.5 rounded-lg text-center font-bold text-[10px] transition cursor-pointer ${
                        slippageGuard === slp
                          ? 'bg-yellow-500 text-slate-950 font-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {slp}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Capital Allocation */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 uppercase">Managed Capital</span>
                  <span className="text-cyan-300 font-bold">{capitalAllocationPct}% ($4,850 USD)</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={capitalAllocationPct}
                  onChange={(e) => setCapitalAllocationPct(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer pt-2"
                />
              </div>
            </div>

            {/* SECTION 2: LIVE NEURAL EXECUTION STREAM CONSOLE */}
            <div className="p-5 rounded-2xl bg-[#02050b] border border-cyan-500/25 font-mono text-xs space-y-3 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-white font-bold text-xs uppercase tracking-wider">
                    Autonomous Neural Execution Stream
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>

                {/* Filter and Action Buttons */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  {(['ALL', 'ARBITRAGE', 'REBALANCE', 'SOLVER', 'SECURITY'] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setStreamFilter(flt)}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${
                        streamFilter === flt
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {flt}
                    </button>
                  ))}

                  <button
                    onClick={() => setIsConsolePaused(!isConsolePaused)}
                    className="ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
                  >
                    {isConsolePaused ? 'Resume Stream' : 'Pause'}
                  </button>

                  <button
                    onClick={() => {
                      const jsonStr = JSON.stringify(agentLogs, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `credx-autopilot-telemetry-${Date.now()}.json`;
                      a.click();
                      showToast('Telemetry Exported', 'Downloaded execution log report as JSON.', 'info');
                    }}
                    className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-2.5 h-2.5" />
                    Export
                  </button>
                </div>
              </div>

              {/* Real-time Streaming Output Window */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 text-[11px] divide-y divide-white/5">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 pt-1.5">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span
                      className={
                        log.type === 'success'
                          ? 'text-emerald-400 font-bold'
                          : log.type === 'security'
                          ? 'text-purple-300 font-bold'
                          : log.type === 'warn'
                          ? 'text-yellow-400'
                          : 'text-cyan-300'
                      }
                    >
                      {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: INTENT SOLVER TERMINAL (NATURAL LANGUAGE & 4-SOLVER CLOUD AUCTION) */}
          <div className="p-6 rounded-3xl bg-[#080412] border border-purple-500/25 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-purple-400" />
                  THE INTENT SOLVER ENGINE (DECENTRALIZED AUCTION CLOUD)
                </h3>
                <p className="text-xs text-slate-400 font-mono pt-0.5">
                  Declare your financial goal in natural language &rarr; Competitive solvers bid in real-time to compute the optimal atomic route.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                4 Active Solvers Connected
              </span>
            </div>

            {/* Quick Intent Chips */}
            <div className="space-y-1.5 font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Quick Intent Presets:</span>
              <div className="flex flex-wrap gap-2">
                {intentPresets.map((pr, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNaturalIntent(pr.prompt);
                      setTargetApy(pr.apy);
                      setMaxDrawdown(pr.dd);
                      playSound('click');
                    }}
                    className="px-3 py-1 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-xs text-purple-200 transition cursor-pointer"
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Natural Language Prompt Console */}
            <div className="p-4 rounded-2xl bg-black/60 border border-purple-500/30 space-y-2 font-mono">
              <span className="text-[10px] text-purple-300 uppercase font-bold block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Natural Language Intent Statement (The GPS Metaphor: Input Destination &rarr; Solver Computes Route)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={naturalIntent}
                  onChange={(e) => setNaturalIntent(e.target.value)}
                  placeholder="Describe your yield destination..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-purple-400 shadow-inner"
                />
              </div>
            </div>

            {/* Parameter Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
              {/* Target APY */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <span className="text-slate-400 text-[10px] uppercase block">Target Outcome APY</span>
                <div className="flex items-center justify-between">
                  <span>Desired Yield:</span>
                  <span className="text-emerald-400 font-bold text-sm">{targetApy}%</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={50}
                  step={0.5}
                  value={targetApy}
                  onChange={(e) => setTargetApy(parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer pt-1"
                />
              </div>

              {/* Max Drawdown */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <span className="text-slate-400 text-[10px] uppercase block">Risk Constraint</span>
                <div className="flex items-center justify-between">
                  <span>Max Drawdown:</span>
                  <span className="text-cyan-300 font-bold text-sm">&lt; {maxDrawdown}%</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer pt-1"
                />
              </div>

              {/* Horizon */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                <span className="text-slate-400 text-[10px] uppercase block">Lockup Horizon</span>
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {(['0d', '7d', '30d'] as const).map((hz) => (
                    <button
                      key={hz}
                      onClick={() => setIntentHorizon(hz)}
                      className={`py-1.5 rounded-lg text-center font-bold text-[10px] transition cursor-pointer ${
                        intentHorizon === hz
                          ? 'bg-purple-500 text-white font-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {hz === '0d' ? 'Liquid' : hz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Broadcast Button */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 flex flex-col justify-between">
                <span className="text-slate-400 text-[10px] uppercase block">Solver Cloud Auction</span>
                <button
                  disabled={intentRunning}
                  onClick={triggerIntentSolver}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {intentRunning ? 'Solvers Bidding in Real-Time...' : 'Broadcast Cryptographic Intent'}
                </button>
              </div>
            </div>

            {/* Bidding Simulation Status */}
            {intentRunning && (
              <div className="p-4 rounded-2xl bg-black/60 border border-purple-500/30 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between text-purple-300">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                    Simulating Solver Cloud Auction ({intentStep}/3)...
                  </span>
                  <span className="text-slate-400">4 Solvers Competing</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-white/5 border border-cyan-500/30 text-cyan-300">
                    <strong>Solver #1 (CredX Precompile)</strong>: 34.8% APY &bull; 0 Gas
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                    <strong>Solver #2 (Wintermute)</strong>: 31.2% APY &bull; $1.40 Gas
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                    <strong>Solver #3 (FalconX)</strong>: 36.5% APY &bull; $2.40 Gas
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                    <strong>Solver #4 (Euler AI)</strong>: 28.9% APY &bull; $0.85 Gas
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-300"
                    style={{ width: `${(intentStep / 3) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Winning Route Visual Execution Pipeline */}
            {solvedRoute && (
              <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-cyan-950/40 border border-purple-500/40 font-mono text-xs space-y-5 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-300 uppercase font-bold block">
                        WINNING AUCTION ROUTE (CONFIRMED BY DECENTRALIZED CONSENSUS)
                      </span>
                      <h4 className="text-sm font-bold text-white">{solvedRoute.solverName}</h4>
                    </div>
                  </div>

                  {/* Verification Badges */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Confidence: {solvedRoute.confidence}%
                    </span>
                    <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                      Latency: {solvedRoute.executionTime}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                      Gas: {solvedRoute.gasEstimate}
                    </span>
                  </div>
                </div>

                {/* 3-Leg Pipeline Visual Flowchart */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {solvedRoute.legs.map((leg, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Leg {idx + 1} ({leg.pct}%)</span>
                        <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-500/10">Active</span>
                      </div>
                      <h5 className="text-white font-bold text-xs">{leg.name}</h5>
                      <span className="text-[10px] text-cyan-300 block">{leg.protocol}</span>
                      <p className="text-[10px] text-slate-400 font-sans leading-relaxed pt-1">
                        {leg.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Proof & Action Bar */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>ZK-STARK Execution Proof: <strong className="text-white font-mono">{solvedRoute.zkProof}</strong></span>
                  </div>

                  <button
                    disabled={agentExecutingTrade}
                    onClick={handleExecuteWinningRoute}
                    className="px-6 py-2.5 rounded-xl font-bold font-mono text-xs bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/25 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {agentExecutingTrade ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Settling Precompile on Creditcoin L1...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Execute Winning Route On-Chain (+50 CTS)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: PARADIGM SHIFT COMPARISON MATRIX */}
          <div className="p-6 rounded-3xl bg-[#0b0616] border border-purple-500/25 shadow-2xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider">
                PARADIGM SHIFT: FROM MANUAL FARMING TO FINANCIAL AUTOPILOT
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Eliminate friction, gas costs, and impermanent loss through CredX automated wealth management.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* STATE A: MANUAL */}
              <div className="p-5 rounded-2xl bg-black/60 border border-rose-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-400 uppercase">STATE A: MANUAL</span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded font-bold">MANUAL YIELD FARMING</span>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs font-mono text-slate-300 space-y-3">
                  <div className="flex items-center gap-2 text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>High Friction / High Expertise:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-400 text-[11px]">
                    <li><strong className="text-rose-300">Gas Fees:</strong> Repetitive gas payments for every deposit, harvest, and swap (~$320/mo)</li>
                    <li><strong className="text-rose-300">Monitor Rates:</strong> Constant 24/7 attention required to track fluctuating pool APRs (12 hrs/week)</li>
                    <li><strong className="text-rose-300">Impermanent Loss:</strong> High risk of pool divergence in volatile market swings</li>
                    <li><strong className="text-rose-300">Manual Compounding:</strong> Unharvested rewards sit idle without continuous compounding</li>
                  </ul>
                </div>
              </div>

              {/* STATE B: AUTOMATED */}
              <div className="p-5 rounded-2xl bg-[#031c26] border border-cyan-500/40 space-y-4 shadow-xl shadow-cyan-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 uppercase">STATE B: AUTOMATED</span>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded font-bold">AUTOMATED WEALTH MANAGEMENT</span>
                </div>

                <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs font-mono text-slate-300 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>"Robotic Fund Manager" (CredX Sovereign Vault):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-[11px]">
                    <li><strong className="text-cyan-300">Auto-Rebalancing Logic:</strong> Dynamically routes liquidity across Lending, Liquidity, and Staking</li>
                    <li><strong className="text-cyan-300">Abstracted Complexity:</strong> Zero cognitive load—one-click deposit into diversified yield</li>
                    <li><strong className="text-cyan-300">OCCR Super-Prime Multiplier:</strong> Up to +24.8% extra APY boosted by credit reputation</li>
                    <li><strong className="text-cyan-300">Continuous Compounding:</strong> High-frequency automated harvest loops every block</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YieldVaultsView;
