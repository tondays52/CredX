import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import BorrowModal from '../modals/BorrowModal';
import RepayModal from '../modals/RepayModal';
import SBTModal from '../modals/SBTModal';
import SBTPassportTab from './SBTPassportTab';
import { LoanPosition } from '../../types/protocol';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface PoolData {
  id: string;
  name: string;
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
  feeApr: string;
  feeAprRaw: number;
  emissionApr: string;
  change24h: number;
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
    const drift = (Math.random() - 0.48) * cfg.volatility; // NOSONAR
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
// Main Component
// ─────────────────────────────────────────────────────────────
export const OverviewTab: React.FC = () => {
  const { isConnected, balanceCTC } = useWeb3();
  const { tier, score, sbtMinted, mintSBT } = useProtocol();

  // ── Timeframe & indicator states ──────────────────────────
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '1M' | '6M' | '1Y'>('6M');
  const [showMA, setShowMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [indicator, setIndicator] = useState<'RSI' | 'MACD' | 'BB'>('RSI');

  // ── Tab & search state ────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'pools' | 'tokens'>('pools');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // ── Filter Dropdown States ────────────────────────────────
  const [tokenFilter, setTokenFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('Any');
  const [volatilityFilter, setVolatilityFilter] = useState('Any');
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

  // ── Live CTC Price from CoinGecko ─────────────────────────
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
      // CoinGecko free API — creditcoin id = "creditcoin-2"
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=creditcoin-2&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_high_low=true',
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      const d = json['creditcoin-2'];
      if (d) {
        setPriceData({
          price: d.usd ?? 1.87,
          change24h: d.usd_24h_change ?? 4.23,
          high24h: d.usd_24h_high ?? 1.94,
          low24h: d.usd_24h_low ?? 1.71,
          marketCap: d.usd_market_cap ?? 428_200_000,
          volume24h: d.usd_24h_vol ?? 32_011_000,
          loading: false,
          error: false,
          lastUpdated: new Date(),
        });
      } else {
        throw new Error('No data');
      }
    } catch {
      setPriceData((prev) => ({ ...prev, loading: false, error: true }));
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

  // ── Portfolio value ────────────────────────────────────────
  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10_000;
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

  // ── Tokens data ──────────────────────────────────────────
  const allTokens = [
    { id: 'ctc', symbol: 'CTC', name: 'Creditcoin', color: '#00FF66', price: ctcPrice, change24h: priceData.change24h, volume: priceData.volume24h, marketCap: priceData.marketCap, tvl: 214_000_000, pools: 12 },
    { id: 'usdc', symbol: 'USDC', name: 'USD Coin', color: '#2775CA', price: 1.0001, change24h: 0.01, volume: 45_200_000, marketCap: 32_000_000_000, tvl: 58_400_000, pools: 8 },
    { id: 'weth', symbol: 'WETH', name: 'Wrapped Ether', color: '#627EEA', price: 3_241.50, change24h: -2.14, volume: 128_300_000, marketCap: 390_000_000_000, tvl: 123_700_000, pools: 4 },
    { id: 'usdt', symbol: 'USDT', name: 'Tether USD', color: '#26A17B', price: 0.9998, change24h: -0.02, volume: 22_100_000, marketCap: 112_000_000_000, tvl: 18_400_000, pools: 5 },
    { id: 'rwa', symbol: 'TBILL', name: 'RWA Treasury Bill', color: '#F59E0B', price: 100.42, change24h: 0.08, volume: 8_700_000, marketCap: 1_200_000_000, tvl: 52_600_000, pools: 3 },
  ];

  const filteredTokens = allTokens.filter((t) => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortFilter === 'TVL') return b.tvl - a.tvl;
    if (sortFilter === 'Volume') return b.volume - a.volume;
    if (sortFilter === 'APR') return b.marketCap - a.marketCap;
    return b.tvl - a.tvl;
  });

  // ── Pools data ─────────────────────────────────────────────
  const allPools: PoolData[] = [
    {
      id: 'usdc-ctc',
      name: 'USDC / CTC',
      tokens: ['USDC', 'CTC'],
      tokenColors: ['#2775CA', '#00FF66'],
      tokenSymbols: ['$', 'C'],
      badge: 'Basic Volatile',
      badgeColor: '#00e5ff',
      feeTier: '0.3%',
      volumeTotal: '$27.56M',
      volumeRaw: 27_560_000,
      volumeBreakdown: '13.81M USDC • 20.75M CTC',
      feesTotal: '$82,673',
      feesRaw: 82_673,
      feesBreakdown: '41,456 USDC • 62,267 CTC',
      tvl: '$39.1M',
      tvlRaw: 39_100_000,
      tvlBreakdown: '19.47M USDC • 29.63M CTC',
      feeApr: 'N/A',
      feeAprRaw: 0,
      emissionApr: '23,420',
      change24h: 4.1,
    },
    {
      id: 'weth-ctc',
      name: 'WETH / CTC',
      tokens: ['WETH', 'CTC'],
      tokenColors: ['#627EEA', '#00FF66'],
      tokenSymbols: ['Ξ', 'C'],
      badge: 'Concentrated',
      badgeColor: '#a78bfa',
      feeTier: '0.05%',
      volumeTotal: '$895.48M',
      volumeRaw: 895_480_000,
      volumeBreakdown: '139K WETH • 430M CTC',
      feesTotal: '$296,406',
      feesRaw: 296_406,
      feesBreakdown: '46 WETH • 142K USDC',
      tvl: '$123.7M',
      tvlRaw: 123_700_000,
      tvlBreakdown: '4,226 WETH • 9.6M CTC',
      feeApr: 'N/A',
      feeAprRaw: 0,
      emissionApr: '804,450',
      change24h: -1.8,
    },
    {
      id: 'rwa-ctc',
      name: 'RWA-TBILL / CTC',
      tokens: ['RWA', 'CTC'],
      tokenColors: ['#F59E0B', '#00FF66'],
      tokenSymbols: ['🏛', 'C'],
      badge: 'Institutional',
      badgeColor: '#f59e0b',
      feeTier: '0.02%',
      volumeTotal: '$68.90M',
      volumeRaw: 68_900_000,
      volumeBreakdown: '34.45M TBILL • 34.45M CTC',
      feesTotal: '$42,100',
      feesRaw: 42_100,
      feesBreakdown: '21K TBILL • 42K CTC',
      tvl: '$52.6M',
      tvlRaw: 52_600_000,
      tvlBreakdown: '26.30M TBILL • 26.30M CTC',
      feeApr: '5.20%',
      feeAprRaw: 5.2,
      emissionApr: '14,800',
      change24h: 2.7,
    },
    {
      id: 'usdt-ctc',
      name: 'USDT / CTC',
      tokens: ['USDT', 'CTC'],
      tokenColors: ['#26A17B', '#00FF66'],
      tokenSymbols: ['T', 'C'],
      badge: 'Stable Pair',
      badgeColor: '#34d399',
      feeTier: '0.3%',
      volumeTotal: '$14.22M',
      volumeRaw: 14_220_000,
      volumeBreakdown: '7.11M USDT • 7.11M CTC',
      feesTotal: '$42,660',
      feesRaw: 42_660,
      feesBreakdown: '21,330 USDT • 21,330 CTC',
      tvl: '$18.4M',
      tvlRaw: 18_400_000,
      tvlBreakdown: '9.2M USDT • 9.2M CTC',
      feeApr: '3.80%',
      feeAprRaw: 3.8,
      emissionApr: '8,200',
      change24h: 0.3,
    },
  ];

  // ── Filtered & sorted pools ────────────────────────────────
  const filteredPools = allPools
    .filter((p) => {
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (tokenFilter !== 'All' && !p.name.includes(tokenFilter)) return false;
      if (typeFilter !== 'Any') {
        const typeMap: Record<string, string[]> = {
          Volatile: ['Basic Volatile', 'Concentrated'],
          Stable: ['Stable Pair'],
          Institutional: ['Institutional'],
        };
        if (typeMap[typeFilter] && !typeMap[typeFilter].includes(p.badge)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortFilter === 'TVL') return b.tvlRaw - a.tvlRaw;
      if (sortFilter === 'Volume') return b.volumeRaw - a.volumeRaw;
      if (sortFilter === 'Fees') return b.feesRaw - a.feesRaw;
      if (sortFilter === 'APR') return b.feeAprRaw - a.feeAprRaw;
      return 0;
    });

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

  // ── Metric cards ───────────────────────────────────────────
  const totalTVL = allPools.reduce((s, p) => s + p.tvlRaw, 0);
  const totalVolume = allPools.reduce((s, p) => s + p.volumeRaw, 0);
  const totalFees = allPools.reduce((s, p) => s + p.feesRaw, 0);

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

  return (
    <div className="w-full space-y-6 select-none font-sans">
      {/* ═══════════════════════════════════════════════════
          CTC PRICE TICKER BAR
      ═══════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#070b0e] border border-cyan-500/15 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-[#00FF66]/20 border border-[#00FF66]/40 flex items-center justify-center text-[10px] font-black text-[#00FF66]">C</div>
          <span className="text-xs font-bold text-white">CTC</span>
          <span className="text-[10px] text-gray-500 font-mono">Creditcoin</span>
        </div>

        {priceData.loading ? (
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
        ) : priceData.error ? (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="w-3 h-3" /> API unavailable · using cached
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
            { label: 'Mkt Cap', val: fmtCompact(priceData.marketCap), color: '#22d3ee' },
            { label: '24H Vol', val: fmtCompact(priceData.volume24h), color: '#a78bfa' },
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
              Updated {priceData.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchCTCPrice}
            disabled={priceData.loading}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
            title="Refresh price"
          >
            <RefreshCw className={`w-3 h-3 ${priceData.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN LAYOUT: Left (chart + pools) + Right (sidebar)
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ─── LEFT COLUMN ─────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">

          {/* ── CHART CARD ──────────────────────────────── */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/20 p-6 md:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs font-semibold text-gray-400 block tracking-wide">Portfolio Balance</span>
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
                  <span className="text-xs font-mono text-gray-500">{userWalletCTC.toLocaleString()} CTC</span>
                  <span className="text-xs font-mono text-cyan-400">@ {fmtPrice(ctcPrice)}</span>
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
                  title="Borrow / Tune"
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
                  const barH = 15 + Math.random() * 20; // NOSONAR
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

                {/* Line */}
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
                    {/* Dot */}
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
                  <span className="text-[10px] text-gray-500">· Live computed from chart data</span>
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
                  {/* RSI gauge */}
                  <div className="relative h-5 rounded-full overflow-hidden bg-white/[0.04] border border-white/10">
                    {/* zone marks */}
                    <div className="absolute left-[30%] top-0 h-full w-px bg-white/20" />
                    <div className="absolute left-[70%] top-0 h-full w-px bg-white/20" />
                    {/* oversold zone */}
                    <div className="absolute left-0 w-[30%] h-full bg-[#00FF66]/10" />
                    {/* overbought zone */}
                    <div className="absolute right-0 w-[30%] h-full bg-red-500/10" />
                    {/* fill */}
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

          {/* ── METRIC CARDS ROW ──────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-xs text-gray-400 font-medium">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Protocol Liquidity Overview</span>
              <span className="text-gray-600">· All pools combined</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Volume Card */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/[0.07] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Volume</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalVolume)}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>vs. prev. period</span>
                    <span className="text-cyan-400 font-bold">+{(((totalVolume - totalVolume * 0.8) / (totalVolume * 0.8)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="w-[92%] h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee] transition-all duration-700" />
                  </div>
                </div>
              </div>

              {/* Fees Card */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/[0.07] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Total Fees</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalFees)}</div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-gray-500">24h fee distribution</span>
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
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[136px] group hover:border-cyan-500/30 transition-all">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#00FF66]/[0.05] rounded-full blur-xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#00FF66]" />
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">TVL</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">{fmtCompact(totalTVL)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-gray-500">Weekly activity</span>
                  <div className="flex items-center justify-between">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div className={`w-4 h-3 rounded-sm transition-all ${
                          idx >= 1 && idx <= 5 ? 'bg-[#00FF66] shadow-[0_0_6px_#00FF66]' : 'bg-white/10'
                        }`} />
                        <span className="text-[9px] font-mono text-gray-500">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── POOLS / TOKENS TABLE (switches based on activeTab) ── */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/15 p-6 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/[0.04] rounded-full blur-2xl pointer-events-none" />

            {/* Table controls row */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  {activeTab === 'pools' ? 'Liquidity Pools' : 'Listed Tokens'}
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  ({activeTab === 'pools' ? `${filteredPools.length}/${allPools.length}` : `${filteredTokens.length}/${allTokens.length}`})
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
                    {activeTab === 'pools' && <option value="Fees" className="bg-[#070b0e]">Sort: Fees</option>}
                    <option value="APR" className="bg-[#070b0e]">{activeTab === 'pools' ? 'Sort: APR' : 'Sort: Mkt Cap'}</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  {activeTab === 'pools' ? 'New Position' : 'Swap'}
                </button>
              </div>
            </div>

            {/* ── POOLS VIEW ── */}
            {activeTab === 'pools' && (
              <>
                <div className="grid grid-cols-12 gap-2 text-[10px] font-mono text-gray-500 pb-3 border-b border-white/[0.06] px-2 uppercase tracking-wider">
                  <span className="col-span-4">Pool</span>
                  <span className="col-span-2 text-right">Volume</span>
                  <span className="col-span-2 text-right">Fees</span>
                  <span className={`col-span-2 text-right flex items-center justify-end gap-1 ${sortFilter === 'TVL' ? 'text-cyan-400 font-bold' : ''}`}>
                    TVL {sortFilter === 'TVL' && '↓'}
                  </span>
                  <span className="col-span-1 text-right hidden sm:block">APR</span>
                  <span className="col-span-1 text-right">24h</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {filteredPools.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">No pools match your filters</div>
                  ) : filteredPools.map((pool) => (
                    <div
                      key={pool.id}
                      className="grid grid-cols-12 gap-2 py-4 px-2 items-center hover:bg-white/[0.025] transition-all rounded-xl group cursor-pointer"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="flex items-center -space-x-2 shrink-0">
                          <div className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-white shadow-md z-10" style={{ backgroundColor: pool.tokenColors[0] }}>
                            {pool.tokenSymbols[0]}
                          </div>
                          <div className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-black shadow-md z-0" style={{ backgroundColor: pool.tokenColors[1] }}>
                            {pool.tokenSymbols[1]}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">{pool.name}</span>
                            <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-400">{pool.feeTier}</span>
                          </div>
                          <span className="text-[10px] block truncate font-mono mt-0.5" style={{ color: pool.badgeColor + 'cc' }}>{pool.badge}</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{pool.volumeTotal}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{pool.volumeBreakdown}</div>
                      </div>
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{pool.feesTotal}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{pool.feesBreakdown}</div>
                      </div>
                      <div className="col-span-2 text-right font-mono">
                        <div className="text-xs font-bold text-white">{pool.tvl}</div>
                        <div className="text-[9px] text-gray-600 hidden md:block truncate">{pool.tvlBreakdown}</div>
                      </div>
                      <div className="col-span-1 text-right font-mono text-xs hidden sm:block">
                        {pool.feeApr === 'N/A' ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <span className="text-[#00FF66] font-bold">{pool.feeApr}</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right font-mono">
                        <span className={`text-xs font-bold ${pool.change24h >= 0 ? 'text-[#00FF66]' : 'text-red-400'}`}>
                          {pool.change24h >= 0 ? '+' : ''}{pool.change24h.toFixed(1)}%
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setBorrowModalOpen(true); }}
                          className="text-[9px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer block text-right mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          + Deposit
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
                      className="grid grid-cols-12 gap-2 py-4 px-2 items-center hover:bg-white/[0.025] transition-all rounded-xl group cursor-pointer"
                    >
                      {/* Token info */}
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
                        <button
                          onClick={(e) => { e.stopPropagation(); setBorrowModalOpen(true); }}
                          className="text-[9px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer block text-right mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Swap
                        </button>
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
          <div className="p-3 rounded-2xl bg-[#070b0e] border border-cyan-500/15 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <button
                  onClick={() => { setActiveTab('pools'); setShowSearch(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'pools' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Pools <span className="text-[10px] font-mono opacity-50">{allPools.length}</span>
                </button>
                <button
                  onClick={() => { setActiveTab('tokens'); setShowSearch(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'tokens' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Tokens <span className="text-[10px] font-mono opacity-50">385</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch((v) => !v)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    showSearch ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' : 'bg-white/[0.04] border-white/10 text-gray-400 hover:text-cyan-400'
                  }`}
                  title="Search pools"
                >
                  {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="p-2 rounded-xl bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.5)] transition-transform hover:scale-105 cursor-pointer"
                  title="Add Liquidity"
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
                  autoFocus
                  type="text"
                  placeholder="Search by pool or token..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Filter: TYPE — only shown for Pools tab */}
          {activeTab === 'pools' && (
            <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Pool Type</span>
              <div className="flex flex-wrap gap-1.5">
                {['Any', 'Volatile', 'Stable', 'Institutional'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      typeFilter === t
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                        : 'border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter: TOKEN — only shown for Pools tab */}
          {activeTab === 'pools' && (
            <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Token Filter</span>
              <div className="relative">
                <select
                  value={tokenFilter}
                  onChange={(e) => setTokenFilter(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
                >
                  <option value="All" className="bg-[#070b0e]">All Tokens</option>
                  <option value="CTC" className="bg-[#070b0e]">Creditcoin (CTC)</option>
                  <option value="RWA" className="bg-[#070b0e]">RWA Treasury Notes</option>
                  <option value="USDC" className="bg-[#070b0e]">Stables (USDC / USDT)</option>
                  <option value="WETH" className="bg-[#070b0e]">WETH</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Tokens info panel — shown when tokens tab active */}
          {activeTab === 'tokens' && (
            <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Market Overview</span>
              {allTokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ backgroundColor: t.color + '25', color: t.color }}>{t.symbol[0]}</div>
                    <span className="text-xs font-bold text-white">{t.symbol}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-white">{fmtPrice(t.price)}</div>
                    <div className={`text-[10px] font-mono font-bold ${t.change24h >= 0 ? 'text-[#00FF66]' : 'text-red-400'}`}>
                      {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter: SORT */}
          <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Sort By</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: 'TVL', label: 'TVL' },
                { val: 'Volume', label: 'Volume 24h' },
                { val: 'APR', label: 'Fee APR' },
                { val: 'Fees', label: 'Fees Gen.' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setSortFilter(opt.val)}
                  className={`py-2 rounded-xl text-[11px] font-semibold transition-all cursor-pointer border ${
                    sortFilter === opt.val
                      ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                      : 'border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* SBT Passport Card */}
          <div className="p-4 rounded-[20px] bg-[#070b0e] border border-purple-500/20 space-y-3 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-purple-500/[0.08] rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">SBT Passport</span>
              {sbtMinted && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] font-bold">ACTIVE</span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-mono leading-relaxed">
              {sbtMinted
                ? 'Your on-chain credit identity is active. Use it to access uncollateralized lending pools.'
                : 'Mint your Soul-Bound Token to unlock credit facilities and under-collateralized borrowing.'}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-gray-600">Credit Score</span>
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

          {/* Quick actions */}
          <div className="p-4 rounded-[20px] bg-[#070b0e] border border-cyan-500/15 space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-gray-500 block uppercase">Quick Actions</span>
            <div className="space-y-2">
              <button
                onClick={() => setBorrowModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Borrow Against Collateral</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => setSbtModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span>SBT / Identity</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => setBorrowModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/20 text-xs font-bold text-[#00FF66] hover:bg-[#00FF66]/15 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Provide Liquidity</span>
                </div>
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          CREDIT PASSPORT (embedded SBT tab)
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
