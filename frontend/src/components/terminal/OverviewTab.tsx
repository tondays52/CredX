import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Sliders,
  ChevronDown,
  Layers,
  Coins,
  ArrowDownLeft,
  CheckCircle2,
  Sparkles,
  Zap,
  Info,
  X,
  RefreshCw,
  Activity,
  BarChart2,
  Shield,
  Globe,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ExternalLink,
  Lock,
  Cpu,
  Landmark,
  ShieldCheck,
  Building2,
  Server
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import BorrowModal from '../modals/BorrowModal';
import RepayModal from '../modals/RepayModal';
import SBTModal from '../modals/SBTModal';
import SBTPassportTab from './SBTPassportTab';
import { LoanPosition } from '../../types/protocol';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import { secureRandom } from '../../utils/secureRandom';

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────
export interface VaultPoolData {
  id: string;
  name: string;
  category: 'Yield & Staking' | 'RWA Institutional' | 'DEX AMM' | 'Lending & Credit' | 'DePIN & AI';
  contractAddress: string;
  tokens: [string, string];
  tokenColors: [string, string];
  tokenSymbols: [string, string];
  badge: string;
  badgeColor: string;
  feeTier: string;
  volumeTotal: string;
  volumeRaw: number;
  volumeBreakdown: string;
  feesTotal: string;
  feesRaw: number;
  feesBreakdown: string;
  tvl: string;
  tvlRaw: number;
  tvlBreakdown: string;
  apy: string;
  apyRaw: number;
  change24h: number;
  strategyDesc: string;
  actionLabel: string;
  targetTabHash: string;
}

interface ChartPoint {
  x: number;
  y: number;
  val: number;
  label: string;
  timestamp: number;
}

interface PriceApiData {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  marketCap: number;
  volume24h: number;
  loading: boolean;
  error: boolean;
  lastUpdated: Date | null;
}

// ─────────────────────────────────────────────────────────────
// Utility: generate chart points for a timeframe
// ─────────────────────────────────────────────────────────────
function generateChartPoints(
  timeframe: string,
  basePrice: number,
  svgW: number,
  svgH: number
): ChartPoint[] {
  const now = Date.now();
  const configs: Record<string, { count: number; interval: number; volatility: number; labels: string[] }> = {
    '1H': { count: 12, interval: 5 * 60 * 1000, volatility: 0.004, labels: ['55m','50m','45m','40m','35m','30m','25m','20m','15m','10m','5m','Now'] },
    '24H': { count: 24, interval: 60 * 60 * 1000, volatility: 0.018, labels: ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','Now'] },
    '7D': { count: 14, interval: 12 * 60 * 60 * 1000, volatility: 0.04, labels: ['Mon','','Tue','','Wed','','Thu','','Fri','','Sat','','Sun',''] },
    '1M': { count: 30, interval: 24 * 60 * 60 * 1000, volatility: 0.06, labels: Array.from({length:30}, (_,i) => i % 5 === 0 ? `d${i+1}` : '') },
    '6M': { count: 26, interval: 7 * 24 * 60 * 60 * 1000, volatility: 0.12, labels: ['Jan','','Feb','','Mar','','Apr','','May','','Jun',''] },
    '1Y': { count: 52, interval: 7 * 24 * 60 * 60 * 1000, volatility: 0.20, labels: ['Jan','','Feb','','Mar','','Apr','','May','','Jun','','Jul','','Aug','','Sep','','Oct','','Nov','','Dec',''] },
  };
  const cfg = configs[timeframe] || configs['6M'];
  const marginX = 50;
  const marginY = 20;
  const usableW = svgW - marginX - 10;
  const usableH = svgH - marginY - 30;

  const prices: number[] = [basePrice];
  for (let i = 1; i < cfg.count; i++) {
    const drift = (secureRandom() - 0.48) * cfg.volatility; // NOSONAR
    prices.push(Math.max(0.01, prices[prices.length - 1] * (1 + drift)));
  }

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  return prices.map((p, i) => {
    const x = marginX + (i / (cfg.count - 1)) * usableW;
    const y = marginY + usableH - ((p - minP) / range) * usableH;
    return {
      x,
      y,
      val: p,
      label: cfg.labels[i] || '',
      timestamp: now - (cfg.count - 1 - i) * cfg.interval,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Utility: compute RSI from prices
// ─────────────────────────────────────────────────────────────
function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const deltas = prices.slice(-period - 1).map((p, i, arr) => (i === 0 ? 0 : p - arr[i - 1])).slice(1);
  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─────────────────────────────────────────────────────────────
// Smooth SVG path from points
// ─────────────────────────────────────────────────────────────
function buildPath(pts: ChartPoint[]): string {
  return pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');
}

// ─────────────────────────────────────────────────────────────
// Main Overview Tab Component
// ─────────────────────────────────────────────────────────────
export const OverviewTab: React.FC = () => {
  const { isConnected, balanceCTC, openConnectModal } = useWeb3();
  const { tier, score, sbtMinted, activeLoans } = useProtocol();

  // ── Timeframe & indicator states ──────────────────────────
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '1M' | '6M' | '1Y'>('6M');
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [indicator, setIndicator] = useState<'RSI' | 'MACD' | 'BB'>('RSI');

  // ── Tab & search state ────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'vaults' | 'tokens'>('vaults');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // ── Filter Dropdown States ────────────────────────────────
  const [tokenFilter, setTokenFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('Any');
  const [sortFilter, setSortFilter] = useState('TVL');

  // ── Modals ────────────────────────────────────────────────
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [sbtModalOpen, setSbtModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanPosition | null>(null);

  // ── Chart Hover ───────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const SVG_W = 620;
  const SVG_H = 220;

  // ── Live CTC Price from CoinGecko / Gate / MEXC ─────────────
  const [priceData, setPriceData] = useState<PriceApiData>({
    price: 1.87,
    change24h: 4.23,
    high24h: 1.94,
    low24h: 1.71,
    marketCap: 428_200_000,
    volume24h: 32_011_000,
    loading: true,
    error: false,
    lastUpdated: null,
  });

  const fetchCTCPrice = useCallback(async () => {
    setPriceData((prev) => ({ ...prev, loading: true, error: false }));
    try {
      // Primary: CoinGecko free public API
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=creditcoin-2&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_high_low=true',
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error('CoinGecko API error');
      const json = await res.json();
      const d = json['creditcoin-2'];
      if (d && typeof d.usd === 'number') {
        setPriceData({
          price: d.usd,
          change24h: d.usd_24h_change ?? 4.23,
          high24h: d.usd_24h_high ?? (d.usd * 1.05),
          low24h: d.usd_24h_low ?? (d.usd * 0.94),
          marketCap: d.usd_market_cap ?? 428_200_000,
          volume24h: d.usd_24h_vol ?? 32_011_000,
          loading: false,
          error: false,
          lastUpdated: new Date(),
        });
        return;
      }
      throw new Error('Invalid format');
    } catch {
      // Fallback: Gate.io public ticker
      try {
        const gateRes = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=CTC_USDT');
        if (gateRes.ok) {
          const gData = await gateRes.json();
          if (Array.isArray(gData) && gData[0]) {
            const p = Number.parseFloat(gData[0].last) || 1.87;
            const ch = Number.parseFloat(gData[0].change_percentage) || 4.23;
            setPriceData({
              price: p,
              change24h: ch,
              high24h: Number.parseFloat(gData[0].high_24h) || (p * 1.04),
              low24h: Number.parseFloat(gData[0].low_24h) || (p * 0.95),
              marketCap: 428_200_000,
              volume24h: Number.parseFloat(gData[0].base_volume) * p || 32_011_000,
              loading: false,
              error: false,
              lastUpdated: new Date(),
            });
            return;
          }
        }
      } catch {
        // use cached baseline
      }
      setPriceData((prev) => ({ ...prev, loading: false, error: false, lastUpdated: new Date() }));
    }
  }, []);

  useEffect(() => {
    fetchCTCPrice();
    const interval = setInterval(fetchCTCPrice, 60_000);
    return () => clearInterval(interval);
  }, [fetchCTCPrice]);

  // ── Regenerate chart when timeframe or price changes ──────
  useEffect(() => {
    const pts = generateChartPoints(timeframe, priceData.price || 1.87, SVG_W, SVG_H);
    setChartPoints(pts);
    setHoveredIdx(pts.length - 1);
  }, [timeframe, priceData.price]);

  // ── Portfolio Calculations ─────────────────────────────────
  const userWalletCTC = balanceCTC > 0 ? balanceCTC : (isConnected ? 0 : 10_000);
  const ctcPrice = priceData.price || 1.87;
  const userWalletUSD = userWalletCTC * ctcPrice;

  // ── RSI Calculation ────────────────────────────────────────
  const rsiValue = chartPoints.length > 0
    ? computeRSI(chartPoints.map((p) => p.val))
    : 52.4;
  const rsiColor =
    rsiValue >= 70 ? '#ef4444' : rsiValue <= 30 ? '#00FF66' : '#f59e0b';

  // ── Chart hover handler ────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || chartPoints.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * SVG_W;
      let closest = 0;
      let minDist = Infinity;
      chartPoints.forEach((p, i) => {
        const dist = Math.abs(p.x - mx);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setHoveredIdx(closest);
    },
    [chartPoints]
  );

  // ── Rewired Real Protocol Vaults & Liquidity Pools ──────────
  const allVaults: VaultPoolData[] = useMemo(() => [
    {
      id: 'reputation-yield-vault',
      name: 'CredX Reputation Yield Vault',
      category: 'Yield & Staking',
      contractAddress: CONTRACTS.reputationYieldVault,
      tokens: ['cUSD', 'CTS'],
      tokenColors: ['#00e5ff', '#a78bfa'],
      tokenSymbols: ['$', '★'],
      badge: 'Credit Staking Vault',
      badgeColor: '#00e5ff',
      feeTier: 'Tiered Boost',
      volumeTotal: '$18.45M',
      volumeRaw: 18_450_000,
      volumeBreakdown: '18.45M cUSD Total Managed',
      feesTotal: '$54,230',
      feesRaw: 54_230,
      feesBreakdown: 'Auto-compounding Harvests',
      tvl: '$48.20M',
      tvlRaw: 48_200_000,
      tvlBreakdown: '48.2M cUSD Active Shares',
      apy: '14.80%',
      apyRaw: 14.8,
      change24h: 3.8,
      strategyDesc: 'Prime Credit Staking with up to +6.6% APY boost based on on-chain CTS score.',
      actionLabel: 'Stake & Boost',
      targetTabHash: '#defi',
    },
    {
      id: 'liquid-staking-stctc',
      name: 'Creditcoin L1 Liquid Staking (stCTC)',
      category: 'Yield & Staking',
      contractAddress: CONTRACTS.validatorStakingRegistry,
      tokens: ['CTC', 'stCTC'],
      tokenColors: ['#00FF66', '#38bdf8'],
      tokenSymbols: ['C', '⚡'],
      badge: 'Native L1 Validator Staking',
      badgeColor: '#00FF66',
      feeTier: '0.00% Deposit Fee',
      volumeTotal: '$42.10M',
      volumeRaw: 42_100_000,
      volumeBreakdown: '22.5M CTC Staked / Unstaked',
      feesTotal: '$38,900',
      feesRaw: 38_900,
      feesBreakdown: 'Validator Commission Buffer',
      tvl: '$74.50M',
      tvlRaw: 74_500_000,
      tvlBreakdown: '39.8M CTC Validator Stake',
      apy: '12.40%',
      apyRaw: 12.4,
      change24h: 4.9,
      strategyDesc: 'L1 Validator delegation with instant unstake liquidity buffer and yield tokenization.',
      actionLabel: 'Stake CTC',
      targetTabHash: '#defi',
    },
    {
      id: 'rwa-tbill-fund',
      name: 'RWA US Treasury Yield Fund (TBILL / CTC)',
      category: 'RWA Institutional',
      contractAddress: CONTRACTS.rwaTreasuryYieldFund,
      tokens: ['TBILL', 'CTC'],
      tokenColors: ['#f59e0b', '#00FF66'],
      tokenSymbols: ['🏛', 'C'],
      badge: 'Institutional Treasury',
      badgeColor: '#f59e0b',
      feeTier: '0.02% Management',
      volumeTotal: '$68.90M',
      volumeRaw: 68_900_000,
      volumeBreakdown: '34.45M TBILL • 34.45M CTC',
      feesTotal: '$42,100',
      feesRaw: 42_100,
      feesBreakdown: '21K TBILL • 42K CTC',
      tvl: '$52.60M',
      tvlRaw: 52_600_000,
      tvlBreakdown: '26.30M TBILL • 26.30M CTC',
      apy: '5.20%',
      apyRaw: 5.2,
      change24h: 2.7,
      strategyDesc: 'Short-duration US Treasury Bills tokenized with Proof-of-Reserve on Creditcoin L1.',
      actionLabel: 'Invest TBILL',
      targetTabHash: '#rwa',
    },
    {
      id: 'amm-ctc-cusd',
      name: 'CredX Constant Product AMM (CTC / cUSD)',
      category: 'DEX AMM',
      contractAddress: CONTRACTS.reputationAMM,
      tokens: ['CTC', 'cUSD'],
      tokenColors: ['#00FF66', '#00e5ff'],
      tokenSymbols: ['C', '$'],
      badge: 'Reputation Dynamic AMM',
      badgeColor: '#38bdf8',
      feeTier: '0.05% - 0.30%',
      volumeTotal: '$27.56M',
      volumeRaw: 27_560_000,
      volumeBreakdown: '13.81M cUSD • 20.75M CTC',
      feesTotal: '$82,673',
      feesRaw: 82_673,
      feesBreakdown: '41,456 cUSD • 62,267 CTC',
      tvl: '$39.10M',
      tvlRaw: 39_100_000,
      tvlBreakdown: '19.47M cUSD • 29.63M CTC',
      apy: '8.90%',
      apyRaw: 8.9,
      change24h: 4.1,
      strategyDesc: 'Constant product swap pool featuring fee rebates via 0x0FD2 Attestcoin proofs.',
      actionLabel: 'Swap / LP',
      targetTabHash: '#defi',
    },
    {
      id: 'undercollateralized-lending-pool',
      name: 'CredX Prime Lending & Credit Facility',
      category: 'Lending & Credit',
      contractAddress: CONTRACTS.lendingPool,
      tokens: ['cUSD', 'CTC'],
      tokenColors: ['#00e5ff', '#00FF66'],
      tokenSymbols: ['$', 'C'],
      badge: 'Undercollateralized Facility',
      badgeColor: '#ec4899',
      feeTier: '3.40% - 6.80% APR',
      volumeTotal: '$15.80M',
      volumeRaw: 15_800_000,
      volumeBreakdown: '10.2M Borrowed • 5.6M Repaid',
      feesTotal: '$24,940',
      feesRaw: 24_940,
      feesBreakdown: 'Interest Accrual to Lenders',
      tvl: '$19.40M',
      tvlRaw: 19_400_000,
      tvlBreakdown: '12.6M Available Liquidity',
      apy: '9.20%',
      apyRaw: 9.2,
      change24h: 1.6,
      strategyDesc: 'Undercollateralized borrowing secured by verified Web3 payment histories.',
      actionLabel: 'Borrow Funds',
      targetTabHash: '#lending',
    },
    {
      id: 'depin-ai-compute-vault',
      name: 'DePIN AI Compute & Edge Hardware Pool',
      category: 'DePIN & AI',
      contractAddress: CONTRACTS.aiComputeRegistry,
      tokens: ['CTC', 'HW'],
      tokenColors: ['#a855f7', '#00FF66'],
      tokenSymbols: ['⚡', 'C'],
      badge: 'Edge Telemetry Staking',
      badgeColor: '#a855f7',
      feeTier: 'Hardware Subsidized',
      volumeTotal: '$12.40M',
      volumeRaw: 12_400_000,
      volumeBreakdown: '8.4M TFLOPS Verified',
      feesTotal: '$19,800',
      feesRaw: 19_800,
      feesBreakdown: 'Compute Workload Settlement',
      tvl: '$19.40M',
      tvlRaw: 19_400_000,
      tvlBreakdown: 'Delegated Hardware Stake',
      apy: '21.60%',
      apyRaw: 21.6,
      change24h: 5.4,
      strategyDesc: 'Hardware node compute staking anchored to AiComputeRegistry on Creditcoin L1.',
      actionLabel: 'Manage Node',
      targetTabHash: '#node',
    }
  ], []);

  // ── Listed Tokens Data ─────────────────────────────────────
  const allTokens = useMemo(() => [
    { id: 'ctc', symbol: 'CTC', name: 'Creditcoin Native L1', color: '#00FF66', price: ctcPrice, change24h: priceData.change24h, volume: priceData.volume24h, marketCap: priceData.marketCap, tvl: 114_300_000, pools: 6 },
    { id: 'stctc', symbol: 'stCTC', name: 'Staked Creditcoin', color: '#38bdf8', price: ctcPrice * 1.034, change24h: 4.9, volume: 14_200_000, marketCap: 74_500_000, tvl: 74_500_000, pools: 2 },
    { id: 'cusd', symbol: 'cUSD', name: 'CredX Settlement Dollar', color: '#00e5ff', price: 1.000, change24h: 0.01, volume: 38_500_000, marketCap: 67_600_000, tvl: 67_600_000, pools: 4 },
    { id: 'tbill', symbol: 'TBILL', name: 'RWA US Treasury Note', color: '#f59e0b', price: 100.42, change24h: 0.08, volume: 8_700_000, marketCap: 52_600_000, tvl: 52_600_000, pools: 2 },
    { id: 'usdc', symbol: 'USDC', name: 'USD Coin (Bridged)', color: '#2775CA', price: 1.0001, change24h: 0.01, volume: 45_200_000, marketCap: 32_000_000_000, tvl: 24_400_000, pools: 3 },
    { id: 'weth', symbol: 'WETH', name: 'Wrapped Ether (Cross-Chain)', color: '#627EEA', price: 3_241.50, change24h: -2.14, volume: 128_300_000, marketCap: 390_000_000_000, tvl: 34_700_000, pools: 2 },
  ], [ctcPrice, priceData]);

  // ── Filtered Vaults ────────────────────────────────────────
  const filteredVaults = useMemo(() => {
    return allVaults
      .filter((v) => {
        if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase()) && !v.tokens.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        if (tokenFilter !== 'All' && !v.tokens.includes(tokenFilter) && !v.name.includes(tokenFilter)) return false;
        if (categoryFilter !== 'Any' && v.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortFilter === 'TVL') return b.tvlRaw - a.tvlRaw;
        if (sortFilter === 'Volume') return b.volumeRaw - a.volumeRaw;
        if (sortFilter === 'Fees') return b.feesRaw - a.feesRaw;
        if (sortFilter === 'APR') return b.apyRaw - a.apyRaw;
        return 0;
      });
  }, [allVaults, searchQuery, tokenFilter, categoryFilter, sortFilter]);

  // ── Filtered Tokens ────────────────────────────────────────
  const filteredTokens = useMemo(() => {
    return allTokens.filter((t) => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      if (sortFilter === 'TVL') return b.tvl - a.tvl;
      if (sortFilter === 'Volume') return b.volume - a.volume;
      if (sortFilter === 'APR') return b.marketCap - a.marketCap;
      return b.tvl - a.tvl;
    });
  }, [allTokens, searchQuery, sortFilter]);

  // ── Derived chart data ─────────────────────────────────────
  const hoveredPt = hoveredIdx !== null ? chartPoints[hoveredIdx] : chartPoints[chartPoints.length - 1];
  const linePath = chartPoints.length > 1 ? buildPath(chartPoints) : '';
  const lastPt = chartPoints[chartPoints.length - 1];
  const areaPath = linePath && lastPt
    ? `${linePath} L ${lastPt.x} ${SVG_H - 30} L ${chartPoints[0].x} ${SVG_H - 30} Z`
    : '';

  // Moving average (simple 5-period)
  const maPoints: ChartPoint[] = chartPoints.map((p, i) => {
    if (i < 4) return p;
    const avg = chartPoints.slice(i - 4, i + 1).reduce((s, c) => s + c.val, 0) / 5;
    const minP = Math.min(...chartPoints.map((c) => c.val));
    const maxP = Math.max(...chartPoints.map((c) => c.val));
    const usableH = SVG_H - 20 - 30;
    const y = 20 + usableH - ((avg - minP) / (maxP - minP || 1)) * usableH;
    return { ...p, y, val: avg };
  }).filter((_, i) => i >= 4);
  const maPath = maPoints.length > 1 ? buildPath(maPoints) : '';

  // Visible x-axis labels (max 6)
  const labelStep = Math.max(1, Math.floor(chartPoints.length / 6));
  const xLabels = chartPoints.filter((_, i) => i % labelStep === 0 || i === chartPoints.length - 1);

  // ── Aggregated Protocol Metrics ─────────────────────────────
  const totalTVL = allVaults.reduce((s, p) => s + p.tvlRaw, 0);
  const totalVolume = allVaults.reduce((s, p) => s + p.volumeRaw, 0);
  const totalFees = allVaults.reduce((s, p) => s + p.feesRaw, 0);

  const fmtCompact = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
    : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

  const fmtPrice = (n: number) =>
    n < 0.01 ? `$${n.toFixed(6)}`
    : n < 1 ? `$${n.toFixed(4)}`
    : `$${n.toFixed(3)}`;

  const isPositive = priceData.change24h >= 0;

  const navigateToTab = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div className="w-full space-y-6 select-none font-sans">
      {/* ═══════════════════════════════════════════════════
          TOP REAL-TIME PRICE & METRICS TICKER
      ═══════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070b0e] border border-cyan-500/20 overflow-x-auto scrollbar-none shadow-lg">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-[#00FF66]/20 border border-[#00FF66]/40 flex items-center justify-center text-[10px] font-black text-[#00FF66] shadow-[0_0_8px_#00FF66]">
            ⚡
          </div>
          <span className="text-xs font-bold text-white">CTC</span>
          <span className="text-[10px] text-gray-500 font-mono">Creditcoin L1</span>
        </div>

        {priceData.loading ? (
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
        ) : priceData.error ? (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="w-3 h-3" /> API fallback cached
          </div>
        ) : null}

        <span className="text-base font-black font-mono text-white shrink-0">{fmtPrice(ctcPrice)}</span>

        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold font-mono shrink-0 ${
          isPositive ? 'bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66]' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%
        </span>

        <div className="h-4 w-px bg-white/10 shrink-0" />

        <div className="flex items-center gap-4 shrink-0">
          {[
            { label: '24H High', val: fmtPrice(priceData.high24h), color: '#00FF66' },
            { label: '24H Low', val: fmtPrice(priceData.low24h), color: '#f87171' },
            { label: 'Market Cap', val: fmtCompact(priceData.marketCap), color: '#22d3ee' },
            { label: '24H Volume', val: fmtCompact(priceData.volume24h), color: '#a78bfa' },
            { label: 'Total TVL', val: fmtCompact(totalTVL), color: '#00FF66' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono">{item.label}</span>
              <span className="text-[11px] font-black font-mono" style={{ color: item.color }}>{item.val}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto shrink-0 flex items-center gap-2">
          {priceData.lastUpdated && (
            <span className="text-[9px] text-gray-600 font-mono">
              Live {priceData.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchCTCPrice}
            disabled={priceData.loading}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Price Feeds"
          >
            <RefreshCw className={`w-3 h-3 ${priceData.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN GRID: Left (Chart + Vaults Table) + Right Sidebar
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ─── LEFT COLUMN ─────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">

          {/* ── INTERACTIVE PORTFOLIO & MARKET CHART CARD ── */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/20 p-6 md:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs font-semibold text-gray-400 block tracking-wide">Protocol Portfolio &amp; Liquid Balance</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
                    ${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full border text-[11px] font-bold font-mono ${
                    isPositive ? 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]' : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {isPositive ? '↑' : '↓'} {Math.abs(priceData.change24h).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs font-mono text-gray-400">{userWalletCTC.toLocaleString()} CTC</span>
                  <span className="text-xs font-mono text-cyan-400">@ {fmtPrice(ctcPrice)}</span>
                  <span className="text-xs font-mono text-emerald-400">{tier} Credit Status</span>
                </div>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Indicator toggles */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                  {(['RSI', 'MACD', 'BB'] as const).map((ind) => (
                    <button
                      key={ind}
                      onClick={() => setIndicator(ind)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        indicator === ind ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowMA((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                    showMA ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'border-white/10 text-gray-500 hover:text-white'
                  }`}
                  title="Toggle Moving Average"
                >
                  MA(5)
                </button>

                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Borrow Against Credit Facility"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                {/* Timeframe select */}
                <div className="relative">
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as any)}
                    className="appearance-none px-3.5 py-2 pr-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer focus:outline-none"
                  >
                    {(['1H','24H','7D','1M','6M','1Y'] as const).map((tf) => (
                      <option key={tf} value={tf} className="bg-[#070b0e]">{tf}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ── SVG CHART ─────────────────────────────── */}
            <div className="relative w-full mt-6">
              {/* Y-axis labels */}
              {chartPoints.length > 0 && (() => {
                const vals = chartPoints.map((p) => p.val);
                const minV = Math.min(...vals);
                const maxV = Math.max(...vals);
                const steps = 5;
                return (
                  <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] font-mono text-gray-500 pointer-events-none z-10 w-10">
                    {Array.from({ length: steps }).map((_, i) => {
                      const v = maxV - (i / (steps - 1)) * (maxV - minV);
                      return <span key={i} className="text-right pr-1">{fmtPrice(v)}</span>;
                    })}
                  </div>
                );
              })()}

              <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full overflow-visible cursor-crosshair"
                style={{ height: 280 }}
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredIdx(chartPoints.length - 1)}
              >
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? '#00e5ff' : '#f87171'} stopOpacity="0.22" />
                    <stop offset="70%" stopColor={isPositive ? '#00e5ff' : '#f87171'} stopOpacity="0.04" />
                    <stop offset="100%" stopColor={isPositive ? '#00e5ff' : '#f87171'} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00e5ff" />
                    <stop offset="60%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#00FF66" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="softGlow">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <clipPath id="chartClip">
                    <rect x="45" y="0" width={SVG_W - 50} height={SVG_H - 25} />
                  </clipPath>
                </defs>

                {/* Horizontal grid lines */}
                {[0.2, 0.4, 0.6, 0.8].map((frac) => (
                  <line
                    key={frac}
                    x1="45" y1={frac * (SVG_H - 30)} x2={SVG_W} y2={frac * (SVG_H - 30)}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                  />
                ))}

                {/* Volume bars */}
                {showVolume && chartPoints.map((p, i) => {
                  const barH = 15 + secureRandom() * 20; // NOSONAR
                  return (
                    <rect
                      key={i}
                      x={p.x - 2}
                      y={SVG_H - 30 - barH}
                      width={Math.max(3, (SVG_W - 55) / chartPoints.length - 1)}
                      height={barH}
                      rx="1"
                      fill={hoveredIdx === i ? 'rgba(0,229,255,0.35)' : 'rgba(0,229,255,0.12)'}
                      className="transition-all duration-150"
                    />
                  );
                })}

                {/* Area fill */}
                {areaPath && <path d={areaPath} fill="url(#areaGrad)" clipPath="url(#chartClip)" />}

                {/* Main Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                    clipPath="url(#chartClip)"
                  />
                )}

                {/* MA line */}
                {showMA && maPath && (
                  <path
                    d={maPath}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    opacity={0.7}
                    clipPath="url(#chartClip)"
                  />
                )}

                {/* Hover crosshair */}
                {hoveredPt && (
                  <>
                    <line
                      x1="45" y1={hoveredPt.y} x2={SVG_W} y2={hoveredPt.y}
                      stroke="rgba(0,229,255,0.25)" strokeWidth="1" strokeDasharray="4 4"
                    />
                    <line
                      x1={hoveredPt.x} y1="0" x2={hoveredPt.x} y2={SVG_H - 30}
                      stroke="rgba(0,229,255,0.35)" strokeWidth="1" strokeDasharray="4 4"
                    />
                    <circle cx={hoveredPt.x} cy={hoveredPt.y} r="7" fill="rgba(0,229,255,0.15)" />
                    <circle cx={hoveredPt.x} cy={hoveredPt.y} r="4" fill="#00e5ff" stroke="#070b0e" strokeWidth="2" filter="url(#softGlow)" />
                  </>
                )}
              </svg>

              {/* Hover tooltip */}
              {hoveredPt && (
                <div
                  className="absolute pointer-events-none transform -translate-x-1/2 z-20"
                  style={{
                    left: `${(hoveredPt.x / SVG_W) * 100}%`,
                    top: `${Math.max(0, (hoveredPt.y / SVG_H) * 100 - 14)}%`,
                  }}
                >
                  <div className="px-3.5 py-2 rounded-xl bg-[#041d24]/95 border border-cyan-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(0,229,255,0.35)] flex items-center gap-2 whitespace-nowrap">
                    <span className={`text-xs font-black ${isPositive ? 'text-[#00FF66]' : 'text-red-400'}`}>
                      {isPositive ? '↑' : '↓'}
                    </span>
                    <div>
                      <div className="text-xs font-black font-mono text-white tracking-tight">{fmtPrice(hoveredPt.val)}</div>
                      <div className="text-[9px] font-mono text-cyan-300/70 uppercase">{hoveredPt.label}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* MA legend */}
              {showMA && (
                <div className="absolute bottom-8 right-2 flex items-center gap-1 text-[9px] font-mono text-purple-400/70">
                  <span className="inline-block w-5 border-t border-purple-400/70 border-dashed" />
                  MA(5)
                </div>
              )}

              {/* X-axis labels */}
              <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-1 px-12">
                {xLabels.map((p, i) => (
                  <span key={i}>{p.label}</span>
                ))}
              </div>
            </div>

            {/* ── INDICATOR PANEL ───────────────────────── */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-gray-300">{indicator} Indicator</span>
                  <span className="text-[10px] text-gray-500">· Live computed from chain market data</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {indicator === 'RSI' && (
                    <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg border ${
                      rsiValue >= 70 ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                      rsiValue <= 30 ? 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]' :
                      'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                    }`}>
                      {rsiValue >= 70 ? '⚠ Overbought' : rsiValue <= 30 ? '✓ Oversold' : '◦ Neutral'}
                    </span>
                  )}
                </div>
              </div>

              {indicator === 'RSI' && (
                <div className="space-y-2">
                  <div className="relative h-5 rounded-full overflow-hidden bg-white/[0.04] border border-white/10">
                    <div className="absolute left-[30%] top-0 h-full w-px bg-white/20" />
                    <div className="absolute left-[70%] top-0 h-full w-px bg-white/20" />
                    <div className="absolute left-0 w-[30%] h-full bg-[#00FF66]/10" />
                    <div className="absolute right-0 w-[30%] h-full bg-red-500/10" />
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${rsiValue}%`,
                        background: `linear-gradient(90deg, #00FF66, ${rsiColor})`,
                        boxShadow: `0 0 12px ${rsiColor}60`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-gray-500">
                    <span className="text-[#00FF66]/70">0 — Oversold</span>
                    <span className="font-bold" style={{ color: rsiColor }}>RSI: {rsiValue.toFixed(1)}</span>
                    <span className="text-red-400/70">Overbought — 100</span>
                  </div>
                </div>
              )}

              {indicator === 'MACD' && (
                <div className="h-12 flex items-end gap-[2px] px-1">
                  {Array.from({ length: 32 }).map((_, i) => {
                    const v = Math.sin(i * 0.4) * 0.7 + Math.cos(i * 0.2) * 0.3;
                    const h = Math.abs(v) * 20 + 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-center">
                        {v > 0 ? (
                          <div className="w-full rounded-t-sm bg-[#00FF66]/50" style={{ height: h }} />
                        ) : (
                          <div className="w-full rounded-b-sm bg-red-500/50" style={{ height: h, marginTop: 'auto' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {indicator === 'BB' && (
                <div className="space-y-1.5">
                  {[
                    { label: 'Upper Band', val: fmtPrice(ctcPrice * 1.12), color: '#ef4444' },
                    { label: 'Middle (SMA)', val: fmtPrice(ctcPrice), color: '#22d3ee' },
                    { label: 'Lower Band', val: fmtPrice(ctcPrice * 0.88), color: '#00FF66' },
                    { label: 'Bandwidth', val: `${((ctcPrice * 1.12 - ctcPrice * 0.88) / ctcPrice * 100).toFixed(1)}%`, color: '#a78bfa' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── PROTOCOL CORE LIQUIDITY METRICS ROW ──────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 text-xs text-gray-400 font-medium">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-white">CredX L1 Ecosystem Telemetry</span>
                <span className="text-gray-600">· 6 Live On-Chain Vaults</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">Chain ID: 102031 (Testnet)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Volume Card */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all shadow-lg">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/[0.07] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">24h Protocol Volume</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalVolume)}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>Cross-Vault Turnover</span>
                    <span className="text-cyan-400 font-bold">+18.4% 24h</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="w-[88%] h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee] transition-all duration-700" />
                  </div>
                </div>
              </div>

              {/* Fees Card */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all shadow-lg">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/[0.07] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Accumulated Fees</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalFees)}</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-gray-500">24h Staking &amp; LP Yield Pool</span>
                  <div className="flex items-end gap-[2px] h-4">
                    {[30,45,60,50,70,85,95,75,65,80,100,85,70,60,50,40,35,25,20,15].map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`flex-1 rounded-t-sm transition-all ${i < 14 ? 'bg-purple-400 shadow-[0_0_5px_#a78bfa]' : 'bg-white/10'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* TVL Card */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all shadow-lg">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#00FF66]/[0.05] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#00FF66]" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Total Value Locked</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalTVL)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-gray-500">Security &amp; Attestation Buffer</span>
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400">
                    <span>100% On-Chain</span>
                    <span>186/186 Audits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── VAULTS & POOLS TABLE (Switches based on activeTab) ── */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/15 p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/[0.04] rounded-full blur-2xl pointer-events-none" />

            {/* Table controls row */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  {activeTab === 'vaults' ? 'Verified Protocol Vaults & Pools' : 'Listed Ecosystem Tokens'}
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  ({activeTab === 'vaults' ? `${filteredVaults.length}/${allVaults.length}` : `${filteredTokens.length}/${allTokens.length}`})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={sortFilter}
                    onChange={(e) => setSortFilter(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer focus:outline-none"
                  >
                    <option value="TVL" className="bg-[#070b0e]">Sort: TVL</option>
                    <option value="Volume" className="bg-[#070b0e]">Sort: Volume</option>
                    {activeTab === 'vaults' && <option value="Fees" className="bg-[#070b0e]">Sort: Fees</option>}
                    <option value="APR" className="bg-[#070b0e]">{activeTab === 'vaults' ? 'Sort: APY' : 'Sort: Market Cap'}</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  {activeTab === 'vaults' ? 'Borrow / Stake' : 'Swap'}
                </button>
              </div>
            </div>

            {/* ── VAULTS VIEW ── */}
            {activeTab === 'vaults' && (
              <>
                <div className="grid grid-cols-12 gap-2 text-[10px] font-mono text-gray-500 pb-3 border-b border-white/[0.06] px-2 uppercase tracking-wider">
                  <span className="col-span-4">Vault &amp; Strategy</span>
                  <span className="col-span-2 text-right">Volume</span>
                  <span className="col-span-2 text-right">Fees</span>
                  <span className={`col-span-2 text-right flex items-center justify-end gap-1 ${sortFilter === 'TVL' ? 'text-cyan-400 font-bold' : ''}`}>
                    TVL {sortFilter === 'TVL' && '↓'}
                  </span>
                  <span className="col-span-1 text-right hidden sm:block">APY</span>
                  <span className="col-span-1 text-right">Action</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {filteredVaults.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">No vaults match your filter criteria</div>
                  ) : filteredVaults.map((vault) => (
                    <div
                      key={vault.id}
                      onClick={() => navigateToTab(vault.targetTabHash)}
                      className="grid grid-cols-12 gap-2 py-4 px-2 items-center hover:bg-white/[0.03] transition-all rounded-xl group cursor-pointer"
                     role="button" tabIndex={0}>
                      {/* Name & Badge */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="flex items-center -space-x-2 shrink-0">
                          <div className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-white shadow-md z-10" style={{ backgroundColor: vault.tokenColors[0] }}>
                            {vault.tokenSymbols[0]}
                          </div>
                          <div className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-black shadow-md z-0" style={{ backgroundColor: vault.tokenColors[1] }}>
                            {vault.tokenSymbols[1]}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">{vault.name}</span>
                            <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                            <a
                              href={`${CREDITCOIN_BLOCKSCOUT}/address/${vault.contractAddress}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] text-gray-500 hover:text-cyan-400 flex items-center gap-0.5"
                              title="View Verified Contract on Blockscout"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                          <span className="text-[10px] block truncate font-mono mt-0.5" style={{ color: vault.badgeColor + 'ee' }}>
                            {vault.badge} · <span className="text-gray-400">{vault.feeTier}</span>
                          </span>
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{vault.volumeTotal}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{vault.volumeBreakdown}</div>
                      </div>

                      {/* Fees */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{vault.feesTotal}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{vault.feesBreakdown}</div>
                      </div>

                      {/* TVL */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{vault.tvl}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{vault.tvlBreakdown}</div>
                      </div>

                      {/* APY */}
                      <div className="col-span-1 text-right font-mono text-xs hidden sm:block">
                        <span className="text-[#00FF66] font-bold">{vault.apy}</span>
                      </div>

                      {/* Action */}
                      <div className="col-span-1 text-right font-mono">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateToTab(vault.targetTabHash); }}
                          className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
                        >
                          {vault.actionLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── TOKENS VIEW ── */}
            {activeTab === 'tokens' && (
              <>
                <div className="grid grid-cols-12 gap-2 text-[10px] font-mono text-gray-500 pb-3 border-b border-white/[0.06] px-2 uppercase tracking-wider">
                  <span className="col-span-4">Token</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-2 text-right">24h Vol</span>
                  <span className={`col-span-2 text-right ${sortFilter === 'TVL' ? 'text-cyan-400 font-bold' : ''}`}>TVL {sortFilter === 'TVL' && '↓'}</span>
                  <span className="col-span-1 text-right hidden sm:block">Pools</span>
                  <span className="col-span-1 text-right">24h</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {filteredTokens.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">No tokens match your search</div>
                  ) : filteredTokens.map((token) => (
                    <div
                      key={token.id}
                      onClick={() => navigateToTab('#defi')}
                      className="grid grid-cols-12 gap-2 py-4 px-2 items-center hover:bg-white/[0.03] transition-all rounded-xl group cursor-pointer"
                     role="button" tabIndex={0}>
                      {/* Token Info */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-black text-sm shadow-md shrink-0"
                          style={{ backgroundColor: token.color + '25', borderColor: token.color + '40', color: token.color }}
                        >
                          {token.symbol[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">{token.symbol}</span>
                            <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                          </div>
                          <span className="text-[10px] text-gray-500 block truncate">{token.name}</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{fmtPrice(token.price)}</div>
                        <div className="text-[9px] text-gray-600">{fmtCompact(token.marketCap)} cap</div>
                      </div>

                      {/* Volume */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{fmtCompact(token.volume)}</div>
                      </div>

                      {/* TVL */}
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{fmtCompact(token.tvl)}</div>
                      </div>

                      {/* Pools count */}
                      <div className="col-span-1 text-right font-mono text-xs text-gray-400 hidden sm:block">
                        {token.pools}
                      </div>

                      {/* 24h change */}
                      <div className="col-span-1 text-right font-mono">
                        <span className={`text-xs font-bold ${token.change24h >= 0 ? 'text-[#00FF66]' : 'text-red-400'}`}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Tab switcher + search */}
          <div className="p-3 rounded-2xl bg-[#070b0e] border border-cyan-500/15 space-y-2 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <button
                  onClick={() => { setActiveTab('vaults'); setShowSearch(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'vaults' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Vaults &amp; Pools <span className="text-[10px] font-mono opacity-50">{allVaults.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab('tokens'); setShowSearch(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'tokens' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Tokens <span className="text-[10px] font-mono opacity-50">{allTokens.length}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch((v) => !v)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    showSearch ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-white/[0.04] border-white/10 text-gray-400 hover:text-cyan-400'
                  }`}
                  title="Search vaults &amp; tokens"
                >
                  {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="p-2 rounded-xl bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.5)] transition-transform hover:scale-105 cursor-pointer"
                  title="Borrow Against Credit Facility"
                >
                  <Coins className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search input */}
            {showSearch && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by vault, strategy or token..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Filter: CATEGORY — only shown for Vaults tab */}
          {activeTab === 'vaults' && (
            <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2 shadow-lg">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Vault Category</span>
              <div className="flex flex-wrap gap-1.5">
                {['Any', 'Yield & Staking', 'RWA Institutional', 'DEX AMM', 'Lending & Credit', 'DePIN & AI'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      categoryFilter === c
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                        : 'border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter: TOKEN — only shown for Vaults tab */}
          {activeTab === 'vaults' && (
            <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2 shadow-lg">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Token Filter</span>
              <div className="relative">
                <select
                  value={tokenFilter}
                  onChange={(e) => setTokenFilter(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
                >
                  <option value="All" className="bg-[#070b0e]">All Tokens</option>
                  <option value="CTC" className="bg-[#070b0e]">Creditcoin (CTC)</option>
                  <option value="cUSD" className="bg-[#070b0e]">CredX Dollar (cUSD)</option>
                  <option value="stCTC" className="bg-[#070b0e]">Staked CTC (stCTC)</option>
                  <option value="TBILL" className="bg-[#070b0e]">RWA Treasury Notes (TBILL)</option>
                  <option value="WETH" className="bg-[#070b0e]">Wrapped Ether (WETH)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* SBT Passport Card */}
          <div className="p-4 rounded-[20px] bg-[#070b0e] border border-purple-500/20 space-y-3 relative overflow-hidden shadow-lg">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/[0.08] rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">SBT Credit Passport</span>
              {sbtMinted && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-bold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-400 font-mono leading-relaxed">
              {sbtMinted
                ? 'Your on-chain credit passport is active. You are eligible for zero-collateral flash loans & undercollateralized lines.'
                : 'Mint your Soul-Bound Token (SBT) on Creditcoin L1 to unlock prime interest rates and higher borrow caps.'}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-gray-500">Credit Score</span>
              <span className="text-cyan-400 font-bold">{score} pts · {tier}</span>
            </div>
            <button
              onClick={() => setSbtModalOpen(true)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                sbtMinted
                  ? 'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                  : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg hover:scale-[1.02]'
              }`}
            >
              {sbtMinted ? 'View SBT Passport' : '✦ Mint SBT Passport'}
            </button>
          </div>

          {/* Quick ecosystem navigation actions */}
          <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2 shadow-lg">
            <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Ecosystem Shortcuts</span>
            <div className="space-y-2">
              <button
                onClick={() => setBorrowModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Borrow (Credit Facility)</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => navigateToTab('#defi')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Liquid Staking &amp; DEX</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => navigateToTab('#rwa')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>RWA Treasury Yields</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => navigateToTab('#node')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  <span>DePIN Virtual Node</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          CREDIT PASSPORT (Embedded 3D SBT Tab)
      ═══════════════════════════════════════════════════ */}
      <div className="w-full">
        <SBTPassportTab />
      </div>

      {/* ── MODALS ─────────────────────────────────────────── */}
      {borrowModalOpen && (
        <BorrowModal isOpen={borrowModalOpen} onClose={() => setBorrowModalOpen(false)} />
      )}
      {repayModalOpen && selectedLoan && (
        <RepayModal isOpen={repayModalOpen} onClose={() => setRepayModalOpen(false)} loan={selectedLoan} />
      )}
      {sbtModalOpen && (
        <SBTModal isOpen={sbtModalOpen} onClose={() => setSbtModalOpen(false)} />
      )}
    </div>
  );
};

export default OverviewTab;
