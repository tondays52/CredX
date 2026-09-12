import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap,
  ShieldCheck,
  TrendingUp,
  Activity,
  ArrowRight,
  DollarSign,
  RefreshCw,
  Layers,
  Sparkles,
  Percent,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink,
  ChevronRight,
  Sliders,
  Terminal as TerminalIcon,
  AlertCircle,
  Info,
  Lock,
  Play,
  Flame,
  BarChart3,
  HelpCircle,
  Check,
  X,
  Copy
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useWeb3 } from '../../context/Web3Context';
import { SimulationBadge } from '../common/SimulationBadge';
import posthog, { isPostHogEnabled } from '../../posthog';
import FlashLoanModal from '../modals/FlashLoanModal';

interface ArbitrageOpp {
  id: string;
  pair: string;
  strategy: 'arbitrage' | 'liquidation' | 'collateral-swap';
  dexA: string;
  dexB: string;
  spreadPct: number;
  capitalReq: number;
  asset: string;
  netProfitUSD: number;
  gasUSD: number;
  confidence: number;
  categoryLabel: string;
}

const INITIAL_OPPORTUNITIES: ArbitrageOpp[] = [
  {
    id: 'opp-1',
    pair: 'cUSD / USDT',
    strategy: 'arbitrage',
    dexA: 'Uniswap v3',
    dexB: 'Curve v2',
    spreadPct: 0.38,
    capitalReq: 250000,
    asset: 'cUSD',
    netProfitUSD: 950.0,
    gasUSD: 4.8,
    confidence: 99.4,
    categoryLabel: 'DEX Spread',
  },
  {
    id: 'opp-2',
    pair: 'WETH / USDC',
    strategy: 'arbitrage',
    dexA: 'Balancer v2',
    dexB: 'CredX DEX',
    spreadPct: 0.44,
    capitalReq: 500000,
    asset: 'WETH',
    netProfitUSD: 2200.0,
    gasUSD: 6.5,
    confidence: 98.8,
    categoryLabel: 'L1 AMM Route',
  },
  {
    id: 'opp-3',
    pair: 'WBTC Aave Health Factor 0.94',
    strategy: 'liquidation',
    dexA: 'Aave v3 Pool',
    dexB: 'CredX Liquidator',
    spreadPct: 8.5,
    capitalReq: 320000,
    asset: 'WBTC',
    netProfitUSD: 27200.0,
    gasUSD: 16.2,
    confidence: 96.5,
    categoryLabel: 'High Yield Liquidation',
  },
  {
    id: 'opp-4',
    pair: 'CTC / USD DePIN Peg',
    strategy: 'collateral-swap',
    dexA: 'Creditcoin L1',
    dexB: 'Arbitrum Bridge',
    spreadPct: 0.31,
    capitalReq: 100000,
    asset: 'CTC',
    netProfitUSD: 310.0,
    gasUSD: 2.1,
    confidence: 99.8,
    categoryLabel: 'Cross-L1 DePIN',
  },
  {
    id: 'opp-5',
    pair: 'stCTC / CTC Peg Yield Arb',
    strategy: 'arbitrage',
    dexA: 'CredX AMM',
    dexB: 'Curve TriCrypto',
    spreadPct: 0.62,
    capitalReq: 400000,
    asset: 'CTC',
    netProfitUSD: 2480.0,
    gasUSD: 5.1,
    confidence: 99.1,
    categoryLabel: 'LST Peg Discrepancy',
  },
  {
    id: 'opp-6',
    pair: 'USDC / DAI Stability Rebalance',
    strategy: 'arbitrage',
    dexA: 'Maker PSM',
    dexB: 'Curve 3pool',
    spreadPct: 0.21,
    capitalReq: 1000000,
    asset: 'USDC',
    netProfitUSD: 2100.0,
    gasUSD: 7.4,
    confidence: 99.9,
    categoryLabel: 'Stable Rebalance',
  },
  {
    id: 'opp-7',
    pair: 'ETH / stETH Curve De-peg Seize',
    strategy: 'collateral-swap',
    dexA: 'Lido stETH Vault',
    dexB: 'CredX Router',
    spreadPct: 0.52,
    capitalReq: 750000,
    asset: 'WETH',
    netProfitUSD: 3900.0,
    gasUSD: 8.9,
    confidence: 98.3,
    categoryLabel: 'Collateral Switch',
  },
  {
    id: 'opp-8',
    pair: 'Morpho Blue Bad Debt Auction',
    strategy: 'liquidation',
    dexA: 'Morpho Blue',
    dexB: 'CredX Vault',
    spreadPct: 6.8,
    capitalReq: 180000,
    asset: 'cUSD',
    netProfitUSD: 12240.0,
    gasUSD: 14.5,
    confidence: 97.2,
    categoryLabel: 'Morpho Seize',
  },
];

const ASSET_CONFIG: Record<string, { available: number; symbol: string; icon: string; decimals: number }> = {
  cUSD: { available: 15200000, symbol: 'cUSD', icon: '💵', decimals: 6 },
  USDC: { available: 12800000, symbol: 'USDC', icon: '🔵', decimals: 6 },
  CTC: { available: 8500000, symbol: 'CTC', icon: '⚡', decimals: 18 },
  WETH: { available: 10400000, symbol: 'WETH', icon: '🔷', decimals: 18 },
  WBTC: { available: 4600000, symbol: 'WBTC', icon: '₿', decimals: 8 },
};

export const FlashLoanView: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore, tier } = useProtocol();
  const { balanceCTC } = useWeb3();

  // Navigation & View Modes
  const [viewMode, setViewMode] = useState<'market-lens' | 'atomic-pipeline'>('market-lens');
  const [timeframe, setTimeframe] = useState<'all' | '1y' | '90d' | '30d'>('all');
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'arbitrage' | 'liquidation' | 'collateral-swap'>('all');

  // Flash Loan Parameters
  const [flashModalOpen, setFlashModalOpen] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState('250000');
  const [selectedAsset, setSelectedAsset] = useState<keyof typeof ASSET_CONFIG>('cUSD');
  const [selectedStrategy, setSelectedStrategy] = useState<'arbitrage' | 'collateral-swap' | 'liquidation'>('arbitrage');
  const [maxSlippage, setMaxSlippage] = useState<'0.1%' | '0.5%' | '1.0%'>('0.5%');
  const [mevProtection, setMevProtection] = useState(true);

  // Execution & Simulation States
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [showSpecsModal, setShowSpecsModal] = useState(false);

  // Live Opportunities & Tickers
  const [opportunities, setOpportunities] = useState<ArbitrageOpp[]>(INITIAL_OPPORTUNITIES);
  const [lastFlushedOppId, setLastFlushedOppId] = useState<string | null>(null);

  // Canvas Crosshair State
  const [hoverData, setHoverData] = useState<{
    date: string;
    activeLoans: number;
    tvl: number;
    savings: number;
    x: number;
    y: number;
  } | null>(null);

  // Live Accruals
  const [liveActiveLoans, setLiveActiveLoans] = useState(16.34);
  const [liveTVL, setLiveTVL] = useState(42.52);
  const [liveVolume24h, setLiveVolume24h] = useState(142.85);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mathematical computations
  const numBorrow = parseFloat(borrowAmount) || 0;
  const feeRate = 0.0001; // 0.01% (1 bp Super-Prime)
  const credXFee = numBorrow * feeRate;
  const aaveFee = numBorrow * 0.0009; // 0.09% (9 bps standard)
  const uniFee = numBorrow * 0.003; // 0.30% (30 bps)
  const savings = Math.max(0, aaveFee - credXFee);
  const estGrossRevenue = numBorrow * (selectedStrategy === 'liquidation' ? 0.065 : selectedStrategy === 'arbitrage' ? 0.0042 : 0.0031);
  const estGasUSD = selectedStrategy === 'liquidation' ? 14.5 : 5.2;
  const estNetProfit = Math.max(0, estGrossRevenue - credXFee - estGasUSD);

  // Real-time micro-accruals & orderbook depth jitter
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      setLiveActiveLoans(16.34 + Math.sin(now * 1.8) * 0.08);
      setLiveTVL(42.52 + Math.sin(now * 1.4) * 0.15);
      setLiveVolume24h(142.85 + Math.sin(now * 2.2) * 0.4);

      // Jitter one random opportunity's spread slightly to simulate live orderbook depth
      setOpportunities((prev) => {
        const randIdx = Math.floor(Math.random() * prev.length); // NOSONAR
        const opp = prev[randIdx];
        const delta = (Math.random() - 0.5) * 0.02; // NOSONAR
        const newSpread = Math.max(0.1, +(opp.spreadPct + delta).toFixed(2));
        const newProfit = Math.round((opp.capitalReq * (newSpread / 100)) - (opp.capitalReq * 0.0001) - opp.gasUSD);

        const updated = [...prev];
        updated[randIdx] = {
          ...opp,
          spreadPct: newSpread,
          netProfitUSD: Math.max(50, newProfit),
        };
        setLastFlushedOppId(opp.id);
        return updated;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  // Filtered Opportunities
  const filteredOpportunities = useMemo(() => {
    if (strategyFilter === 'all') return opportunities;
    return opportunities.filter((o) => o.strategy === strategyFilter);
  }, [opportunities, strategyFilter]);

  // 60 FPS Canvas Renderer (Dual-Mode: Token Terminal Lens & Atomic Pipeline)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 700;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 280;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const tNow = Date.now() / 1000;

      if (viewMode === 'market-lens') {
        // ==========================================
        // TOKEN TERMINAL DUAL-CURVE CHART
        // ==========================================
        ctx.fillStyle = '#07090e';
        ctx.fillRect(0, 0, width, height);

        const paddingLeft = 70;
        const paddingRight = 30;
        const paddingTop = 36;
        const paddingBottom = 32;
        const plotWidth = width - paddingLeft - paddingRight;
        const plotHeight = height - paddingTop - paddingBottom;

        // Horizontal Gridlines ($0, $25b, $50b, $75b, $100b)
        const yLevels = [100, 75, 50, 25, 0];
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        yLevels.forEach((lvl, idx) => {
          const y = paddingTop + (idx / (yLevels.length - 1)) * plotHeight;
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.font = '10px monospace';
          ctx.fillText('$' + lvl + 'b', 18, y + 3);
        });

        // Rotated Y-Axis Label
        ctx.save();
        ctx.translate(14, paddingTop + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '9px monospace';
        ctx.fillText('Active loans, Total value locked', 0, 0);
        ctx.restore();

        // Watermark: token terminal_
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('token terminal_', paddingLeft + plotWidth / 2, paddingTop + plotHeight / 2 + 10);
        ctx.restore();

        // Multi-Cycle Token Terminal Dataset (Jan '21 to Jan '26)
        const totalPoints = timeframe === '30d' ? 30 : timeframe === '90d' ? 45 : timeframe === '1y' ? 52 : 61;
        const tvlPoints: number[] = [];
        const loanPoints: number[] = [];

        for (let i = 0; i < totalPoints; i++) {
          const t = i / (totalPoints - 1);
          let tvl = 0;
          let loans = 0;

          if (timeframe === 'all') {
            if (t < 0.2) {
              const p = t / 0.2;
              tvl = 2 + Math.sin(p * Math.PI * 0.5) * 34;
              loans = 0.5 + Math.sin(p * Math.PI * 0.5) * 14;
            } else if (t < 0.45) {
              const p = (t - 0.2) / 0.25;
              tvl = 36 - Math.sin(p * Math.PI * 0.5) * 28 + Math.sin(i * 1.5) * 1.5;
              loans = 14.5 - Math.sin(p * Math.PI * 0.5) * 11.5 + Math.sin(i * 1.5) * 0.6;
            } else if (t < 0.85) {
              const p = (t - 0.45) / 0.4;
              tvl = 8 + Math.pow(p, 1.4) * 68 + Math.sin(i * 1.2) * 2.8;
              loans = 3 + Math.pow(p, 1.4) * 32 + Math.sin(i * 1.2) * 1.2;
            } else {
              const p = (t - 0.85) / 0.15;
              const liveTvlJitter = i === totalPoints - 1 ? Math.sin(tNow * 1.8) * 0.2 : 0;
              const liveLoanJitter = i === totalPoints - 1 ? Math.sin(tNow * 1.8) * 0.08 : 0;
              tvl = 76 - Math.sin(p * Math.PI * 0.5) * 33.5 + liveTvlJitter;
              loans = 35 - Math.sin(p * Math.PI * 0.5) * 18.7 + liveLoanJitter;
            }
          } else if (timeframe === '1y') {
            const p = t;
            tvl = 32 + Math.sin(p * Math.PI * 0.8) * 16 + Math.sin(i * 0.6) * 1.8;
            loans = 11 + Math.sin(p * Math.PI * 0.8) * 7 + Math.sin(i * 0.6) * 0.9;
          } else if (timeframe === '90d') {
            const p = t;
            tvl = 38 + p * 4.5 + Math.sin(i * 0.8) * 1.2;
            loans = 14 + p * 2.3 + Math.sin(i * 0.8) * 0.6;
          } else {
            // 30d
            const p = t;
            tvl = 41 + p * 1.5 + Math.sin(i * 1.1) * 0.8;
            loans = 15.6 + p * 0.7 + Math.sin(i * 1.1) * 0.4;
          }

          tvlPoints.push(Math.max(0, tvl));
          loanPoints.push(Math.max(0, loans));
        }

        const getX = (i: number) => paddingLeft + (i / (totalPoints - 1)) * plotWidth;
        const getY = (val: number) => paddingTop + plotHeight - (val / 100) * plotHeight;

        // 1. Blue TVL Curve Area Fill
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(tvlPoints[0]));
        for (let i = 1; i < totalPoints; i++) {
          const prevX = getX(i - 1);
          const prevY = getY(tvlPoints[i - 1]);
          const currX = getX(i);
          const currY = getY(tvlPoints[i]);
          const midX = (prevX + currX) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
        }
        ctx.lineTo(getX(totalPoints - 1), paddingTop + plotHeight);
        ctx.lineTo(getX(0), paddingTop + plotHeight);
        ctx.closePath();

        const tvlGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotHeight);
        tvlGrad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
        tvlGrad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        ctx.fillStyle = tvlGrad;
        ctx.fill();

        // Blue TVL Stroke Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(tvlPoints[0]));
        for (let i = 1; i < totalPoints; i++) {
          const prevX = getX(i - 1);
          const prevY = getY(tvlPoints[i - 1]);
          const currX = getX(i);
          const currY = getY(tvlPoints[i]);
          const midX = (prevX + currX) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
        }
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#2563eb';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 2. Green Active Loans Curve Area Fill
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(loanPoints[0]));
        for (let i = 1; i < totalPoints; i++) {
          const prevX = getX(i - 1);
          const prevY = getY(loanPoints[i - 1]);
          const currX = getX(i);
          const currY = getY(loanPoints[i]);
          const midX = (prevX + currX) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
        }
        ctx.lineTo(getX(totalPoints - 1), paddingTop + plotHeight);
        ctx.lineTo(getX(0), paddingTop + plotHeight);
        ctx.closePath();

        const loanGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotHeight);
        loanGrad.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
        loanGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        ctx.fillStyle = loanGrad;
        ctx.fill();

        // Green Active Loans Stroke Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(loanPoints[0]));
        for (let i = 1; i < totalPoints; i++) {
          const prevX = getX(i - 1);
          const prevY = getY(loanPoints[i - 1]);
          const currX = getX(i);
          const currY = getY(loanPoints[i]);
          const midX = (prevX + currX) / 2;
          ctx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
        }
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#059669';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // End Beacons & Radar Pulses
        const lastX = getX(totalPoints - 1);
        const lastTvlY = getY(tvlPoints[totalPoints - 1]);
        const lastLoanY = getY(loanPoints[totalPoints - 1]);
        const pulse = (tNow * 2) % 1;

        // Blue TVL Radar
        ctx.beginPath();
        ctx.arc(lastX, lastTvlY, 3.5 + pulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59, 130, 246, ' + Math.max(0, 0.8 - pulse * 0.8) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lastX, lastTvlY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();

        // Green Loans Radar
        ctx.beginPath();
        ctx.arc(lastX, lastLoanY, 3.5 + pulse * 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16, 185, 129, ' + Math.max(0, 0.8 - pulse * 0.8) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lastX, lastLoanY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();

        // Interactive Hover Crosshair
        if (hoverData) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(hoverData.x, paddingTop);
          ctx.lineTo(hoverData.x, paddingTop + plotHeight);
          ctx.stroke();
          ctx.restore();

          const idx = Math.min(totalPoints - 1, Math.max(0, Math.round(((hoverData.x - paddingLeft) / plotWidth) * (totalPoints - 1))));
          const hTvlY = getY(tvlPoints[idx]);
          const hLoanY = getY(loanPoints[idx]);

          ctx.beginPath();
          ctx.arc(hoverData.x, hTvlY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(hoverData.x, hLoanY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
        }

        // Timeline Labels
        const timeLabels =
          timeframe === 'all'
            ? ["Jan '21", "Jul '21", "Jan '22", "Jul '22", "Jan '23", "Jul '23", "Jan '24", "Jul '24", "Jan '25", "Jul '25", "Jan '26"]
            : timeframe === '1y'
            ? ["Jan '25", "Mar '25", "May '25", "Jul '25", "Sep '25", "Nov '25", "Jan '26"]
            : timeframe === '90d'
            ? ['Nov 2025', 'Dec 2025', 'Jan 2026']
            : ['Day 1', 'Day 10', 'Day 20', 'Day 30'];

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '10px monospace';
        timeLabels.forEach((lbl, idx) => {
          const x = paddingLeft + (idx / (timeLabels.length - 1)) * plotWidth - 14;
          ctx.fillText(lbl, x, height - 10);
        });
      } else {
        // ==========================================
        // 6-NODE SINGLE-BLOCK ATOMIC PIPELINE
        // ==========================================
        ctx.fillStyle = '#020912';
        ctx.fillRect(0, 0, width, height);

        const paddingLeft = 65;
        const paddingRight = 65;
        const centerY = height / 2;

        const nodes = [
          { id: 'vault', label: 'CREDX VAULT', sub: '0x0FD2 Dispatch', x: paddingLeft, y: centerY, color: '#38bdf8' },
          { id: 'gate', label: 'CREDIT GATE', sub: 'Super-Prime Invariant', x: paddingLeft + (width - paddingLeft - paddingRight) * 0.2, y: centerY - 45, color: '#00f2fe' },
          { id: 'dexA', label: 'DEX A ROUTER', sub: 'Uniswap / Balancer', x: paddingLeft + (width - paddingLeft - paddingRight) * 0.42, y: centerY - 45, color: '#818cf8' },
          { id: 'dexB', label: 'DEX B / LIQUIDATOR', sub: 'Arbitrage Realized', x: paddingLeft + (width - paddingLeft - paddingRight) * 0.64, y: centerY - 45, color: '#f59e0b' },
          { id: 'repay', label: 'LOAN REPAYMENT', sub: 'Principal + 0.01%', x: paddingLeft + (width - paddingLeft - paddingRight) * 0.82, y: centerY + 45, color: '#a855f7' },
          { id: 'settle', label: 'USER WALLET', sub: 'Net Profit Retained', x: width - paddingRight, y: centerY, color: '#10b981' },
        ];

        const drawTrace = (from: any, to: any, speed: number, color: string) => {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          const midX = (from.x + to.x) / 2;
          ctx.bezierCurveTo(midX, from.y, midX, to.y, to.x, to.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 2;
          ctx.stroke();

          const p = (tNow * speed) % 1;
          const t = p;
          const px = Math.pow(1 - t, 3) * from.x + 3 * Math.pow(1 - t, 2) * t * midX + 3 * (1 - t) * Math.pow(t, 2) * midX + Math.pow(t, 3) * to.x;
          const py = Math.pow(1 - t, 3) * from.y + 3 * Math.pow(1 - t, 2) * t * from.y + 3 * (1 - t) * Math.pow(t, 2) * to.y + Math.pow(t, 3) * to.y;

          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        };

        drawTrace(nodes[0], nodes[1], 0.7, '#38bdf8');
        drawTrace(nodes[1], nodes[2], 0.7, '#00f2fe');
        drawTrace(nodes[2], nodes[3], 0.7, '#818cf8');
        drawTrace(nodes[3], nodes[4], 0.7, '#f59e0b');
        drawTrace(nodes[4], nodes[0], 0.5, '#a855f7');
        drawTrace(nodes[4], nodes[5], 0.7, '#10b981');

        nodes.forEach((node) => {
          const pulse = (tNow * 2) % 1;

          ctx.beginPath();
          ctx.arc(node.x, node.y, 16 + pulse * 6, 0, Math.PI * 2);
          ctx.strokeStyle = node.color + Math.floor((1 - pulse) * 120).toString(16).padStart(2, '0');
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#061726';
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - 20);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '8px monospace';
          ctx.fillText(node.sub, node.x, node.y + 26);
        });

        ctx.textAlign = 'left';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('SINGLE-BLOCK ATOMIC ARBITRAGE & LIQUIDATION PIPELINE • ERC-3156 INVARIANT', 20, 20);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px monospace';
        ctx.fillText('Gas: ~142,850 gwei • Latency: 42ms • Loss-Free Reversible', width - 20, 20);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [viewMode, timeframe, hoverData]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewMode !== 'market-lens') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingLeft = 70;
    const paddingRight = 30;
    const plotWidth = rect.width - paddingLeft - paddingRight;

    if (x >= paddingLeft && x <= rect.width - paddingRight) {
      const pct = (x - paddingLeft) / plotWidth;
      const totalMonths = 60;
      const monthIdx = Math.round(pct * totalMonths);
      const startYear = 2021;
      const year = startYear + Math.floor(monthIdx / 12);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[monthIdx % 12];

      const estTvl = 10 + Math.pow(pct, 1.3) * 60 + Math.sin(pct * Math.PI * 3) * 12;
      const estLoans = 4 + Math.pow(pct, 1.3) * 28 + Math.sin(pct * Math.PI * 3) * 6;
      const estSavings = estLoans * 0.0008 * 1000;

      setHoverData({
        date: month + ' ' + year,
        activeLoans: Math.max(1, estLoans),
        tvl: Math.max(2, estTvl),
        savings: estSavings,
        x,
        y,
      });
    } else {
      setHoverData(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoverData(null);
  };

  const handleSelectOpp = (opp: ArbitrageOpp) => {
    setBorrowAmount(opp.capitalReq.toString());
    setSelectedAsset(opp.asset as any);
    setSelectedStrategy(opp.strategy);
    playSound('click');
    showToast(
      'Opportunity Loaded',
      'Configured ' + opp.strategy.toUpperCase() + ' route: $' + opp.capitalReq.toLocaleString() + ' ' + opp.asset + ' (' + opp.pair + ') with estimated net profit +$' + opp.netProfitUSD.toLocaleString() + '.',
      'info'
    );
  };

  const handleSimulateExecution = () => {
    if (numBorrow <= 0) {
      showToast('Invalid Amount', 'Please enter a valid borrow amount.', 'error');
      return;
    }

    setIsExecuting(true);
    setExecutionLogs([]);
    playSound('click');

    const logs = [
      '[Block #28,941,022] Initiating flashLoan($' + numBorrow.toLocaleString() + ' ' + selectedAsset + ') via CredXHub Precompile 0x0FD2...',
      '[Credit Invariant] Verified caller credit tier: SUPER-PRIME (780+ CTS) -> Discount fee locked at 1 bp (0.01%).',
      '[Precompile Transfer] 0x0FD2 dispatched $' + numBorrow.toLocaleString() + ' ' + selectedAsset + ' to Receiver contract.',
      '[Callback Trigger] Executing onFlashLoan() -> Routed multi-call through ' + (selectedStrategy === 'arbitrage' ? 'Uniswap v3 & Curve v2' : selectedStrategy === 'liquidation' ? 'Aave v3 Liquidator' : 'DePIN Collateral Switch') + '...',
      '[MEV Defense] Flashbots private RPC bundle confirmed with 0 MEV leakage and 0 frontrun penalty.',
      '[Revenue Settled] Swaps verified: Generated gross revenue +$' + estGrossRevenue.toFixed(2) + ' USD.',
      '[Precompile Repayment] Pulled principal ($' + numBorrow.toLocaleString() + ') + 1 bp fee ($' + credXFee.toFixed(2) + ') back to CredX Vault.',
      '[Atomic Invariant Check] ERC-3156 state check: Solvency intact. Transaction finalized in single block!',
      '[Profit Retained] Net yield deposited to caller: +$' + estNetProfit.toFixed(2) + ' USD (+35 CTS Reputation Points)!',
    ];

    logs.forEach((log, idx) => {
      setTimeout(() => {
        setExecutionLogs((prev) => [...prev, log]);
        if (idx === logs.length - 1) {
          setIsExecuting(false);
          playSound('fanfare');
          if (isPostHogEnabled) {
            posthog.capture('flash_loan_executed', {
              asset: selectedAsset,
              strategy: selectedStrategy,
              amount: numBorrow,
              profit: estNetProfit,
            });
          }
          boostScore(35, 'Flash Loan Atomic Execution');
          showToast(
            'Flash Loan Executed in 1 Block',
            'Borrowed $' + numBorrow.toLocaleString() + ' ' + selectedAsset + ', settled in single block with +$' + estNetProfit.toFixed(2) + ' net profit (+35 CTS Points)! Saved $' + savings.toFixed(2) + ' vs Aave.',
            'success',
            6000
          );
        }
      }, (idx + 1) * 320);
    });
  };

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* SIMULATED banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="SIMULATED FLASH-LOAN UI"
          note="ReputationFlashLoan.sol is deployed, but this UI runs simulated opportunities and receiver flows locally without submitting transactions."
        />
        <span className="font-mono">
          Opportunties, PnL and the atomic pipeline visuals are local simulations. The on-chain
          ReputationFlashLoan contract exists on testnet but is exercised only by the credit-aware
          demo in other panels — this UI does not submit wallet transactions.
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          1. Institutional Header & Live Metric KPI Hub
         ═══════════════════════════════════════════════════════════════ */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#02131e] via-[#031c2d] to-[#010912] border border-cyan-500/25 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-mono text-[10px] font-bold tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                CREDX ENTERPRISE DEFI &bull; SUPER-PRIME PROTOCOL
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-200 font-mono text-[10px] font-bold">
                LOCAL SIMULATION (REAL txs via ReputationFlashLoan.sol elsewhere)
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Zap className="w-7 h-7 text-cyan-400 fill-cyan-400/20" />
              0-Collateral Flash Loans
            </h2>
            <p className="text-xs lg:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Borrow up to <strong className="text-white">$10,000,000</strong> in a single block with zero upfront collateral.
              Settled atomically with <strong className="text-cyan-300">0.01% fee (1 bp)</strong> via Creditcoin L1 Precompile <code className="text-slate-300 font-mono bg-black/40 px-1 py-0.5 rounded">0x0FD2</code>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSpecsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Specs &amp; ERC-3156</span>
            </button>
            <button
              onClick={() => setFlashModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-mono text-xs font-black shadow-lg shadow-cyan-500/20 hover:from-cyan-300 hover:to-teal-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Quick Flash Modal</span>
            </button>
          </div>
        </div>

        {/* 4 Live Metric KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
          {/* KPI 1 */}
          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-cyan-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>24h Flash Volume</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              ${liveVolume24h.toFixed(2)}M
            </div>
            <div className="text-[10px] font-mono text-emerald-400 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +14.2% (24h)
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-emerald-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>CredX Super-Prime Fee</span>
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono">
              0.01% <span className="text-xs text-slate-400 font-normal">(1 bp)</span>
            </div>
            <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
              88.9% cheaper than Aave (0.09%)
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-blue-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Atomic Invariant Speed</span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              1 Block <span className="text-xs text-slate-400 font-normal">(~42ms)</span>
            </div>
            <div className="text-[10px] font-mono text-blue-300 mt-0.5">
              100% loss-free atomic revert
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-3.5 rounded-2xl bg-[#031522]/90 border border-amber-500/20 shadow-md">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Total Borrow Capacity</span>
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 font-mono">
              $50.00M USD
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              Instant liquidity across 5 pools
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. Token Terminal Market Lens & Pipeline Canvas Container
         ═══════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-3xl bg-[#031520] border border-blue-500/25 shadow-2xl space-y-4">
        {/* Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-[#07090e] rounded-2xl border border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Title */}
            <div className="flex items-center gap-1.5 text-base font-bold text-white font-mono">
              <span>{viewMode === 'market-lens' ? 'Token Terminal Market Lens' : 'Atomic Pipeline Architecture'}</span>
            </div>

            {/* Metric Badge 1: Active loans */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <div>
                <div className="text-[10px] text-slate-400 font-mono leading-none">Active loans</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">
                  ${liveActiveLoans.toFixed(1)} B <span className="text-[10px] text-slate-500 font-normal">Latest</span>
                </div>
              </div>
            </div>

            {/* Metric Badge 2: Total value locked */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
              <div>
                <div className="text-[10px] text-slate-400 font-mono leading-none">Total value locked</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">
                  ${liveTVL.toFixed(1)} B <span className="text-[10px] text-slate-500 font-normal">Latest</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-black/80 border border-white/10 text-[11px]">
              <button
                onClick={() => {
                  setViewMode('market-lens');
                  playSound('click');
                }}
                className={'px-3 py-1 rounded-lg font-bold transition cursor-pointer ' + (
                  viewMode === 'market-lens'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Market Lens
              </button>
              <button
                onClick={() => {
                  setViewMode('atomic-pipeline');
                  playSound('click');
                }}
                className={'px-3 py-1 rounded-lg font-bold transition cursor-pointer ' + (
                  viewMode === 'atomic-pipeline'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Atomic Pipeline
              </button>
            </div>

            {/* Timeframe selector */}
            {viewMode === 'market-lens' && (
              <div className="flex items-center p-1 rounded-xl bg-black/80 border border-white/10 text-[10px]">
                {(['all', '1y', '90d', '30d'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTimeframe(tf);
                      playSound('click');
                    }}
                    className={'px-2.5 py-1 rounded-lg font-bold uppercase transition cursor-pointer ' + (
                      timeframe === tf
                        ? 'bg-white/15 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {tf === 'all' ? 'All Time' : tf}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hover Crosshair Telemetry Banner */}
        {hoverData && (
          <div className="p-2.5 rounded-xl bg-black/80 border border-cyan-500/30 flex items-center justify-between font-mono text-xs animate-in fade-in duration-200">
            <span className="text-white font-bold">{hoverData.date}</span>
            <span className="text-[#3b82f6] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> TVL: ${hoverData.tvl.toFixed(1)}B
            </span>
            <span className="text-[#10b981] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Active Loans: ${hoverData.activeLoans.toFixed(1)}B
            </span>
            <span className="text-cyan-300 font-bold">
              Utilization: {((hoverData.activeLoans / hoverData.tvl) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Dual Mode Canvas */}
        <div className="relative w-full h-[280px] rounded-2xl overflow-hidden bg-[#07090e] border border-cyan-500/20 shadow-inner">
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="w-full h-full block cursor-crosshair"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. Live Cross-DEX Arbitrage, Liquidation & Collateral Swap Radar
         ═══════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-3xl bg-[#031520] border border-blue-500/20 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Live Cross-DEX Arbitrage &amp; Liquidation Radar
            </h4>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              8 Active Routes Detected
            </span>
          </div>

          {/* Strategy Filter Pills */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {[
              { id: 'all', label: 'All Routes (8)' },
              { id: 'arbitrage', label: 'DEX Arbitrage (4)' },
              { id: 'liquidation', label: 'Liquidations (2)' },
              { id: 'collateral-swap', label: 'Collateral Swaps (2)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setStrategyFilter(f.id as any);
                  playSound('click');
                }}
                className={'px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ' + (
                  strategyFilter === f.id
                    ? 'bg-blue-500/25 text-cyan-300 border border-cyan-500/40'
                    : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 text-[11px]">
                <th className="pb-2.5 font-semibold">Target Route</th>
                <th className="pb-2.5 font-semibold">Strategy</th>
                <th className="pb-2.5 font-semibold">Spread / Bonus</th>
                <th className="pb-2.5 font-semibold">Capital Required</th>
                <th className="pb-2.5 font-semibold">Est. Net Profit</th>
                <th className="pb-2.5 font-semibold">Confidence</th>
                <th className="pb-2.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOpportunities.map((opp) => {
                const isFlushed = lastFlushedOppId === opp.id;
                return (
                  <tr
                    key={opp.id}
                    className={'transition-colors duration-500 ' + (
                      isFlushed ? 'bg-cyan-500/10' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <td className="py-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{opp.pair}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {opp.dexA} &rarr; {opp.dexB}
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={'px-2 py-0.5 rounded-md text-[10px] font-bold ' + (
                          opp.strategy === 'arbitrage'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : opp.strategy === 'liquidation'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        )}
                      >
                        {opp.categoryLabel}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        +{opp.spreadPct.toFixed(2)}%
                        {isFlushed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                      </span>
                    </td>
                    <td className="py-3 text-slate-200 font-bold">
                      ${opp.capitalReq.toLocaleString()} {opp.asset}
                    </td>
                    <td className="py-3 font-bold text-cyan-300">
                      +${opp.netProfitUSD.toLocaleString()} USD
                      <div className="text-[10px] text-slate-500">Gas: ~${opp.gasUSD.toFixed(2)}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                            style={{ width: opp.confidence + '%' }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">{opp.confidence.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleSelectOpp(opp)}
                        className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <span>Load Route</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          4. Execution Simulator & Benchmark Grid
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Reputation Fee Tier & Live Comparison */}
        <div className="lg:col-span-6 rounded-3xl p-6 bg-gradient-to-br from-[#031522] to-[#010a12] border border-blue-500/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Fee Benchmark vs Aave &amp; Uniswap
            </h4>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/15 px-3 py-1 rounded-full border border-cyan-500/30 font-bold">
              0.01% Super-Prime Active
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* CredX Tiered Rate */}
            <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 flex items-center justify-between">
              <div>
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  CredX Super-Prime (0.01% / 1 bp)
                </span>
                <span className="text-[10px] text-slate-400">Reputation-discounted precompile single-block liquidity</span>
              </div>
              <span className="text-base font-black text-emerald-400">${credXFee.toFixed(2)} USD</span>
            </div>

            {/* Aave Standard */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-slate-400">
              <div>
                <span className="font-bold text-slate-300 block">Aave v3 Standard Fee (0.09% / 9 bps)</span>
                <span className="text-[10px] text-slate-500">Standard uncollateralized loan protocol</span>
              </div>
              <span className="text-sm font-bold text-rose-400 line-through">${aaveFee.toFixed(2)} USD</span>
            </div>

            {/* Uniswap Flash Swap */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-slate-400">
              <div>
                <span className="font-bold text-slate-300 block">Uniswap v3 Flash Swap (0.30% / 30 bps)</span>
                <span className="text-[10px] text-slate-500">AMM pool fee on flash borrower</span>
              </div>
              <span className="text-sm font-bold text-rose-400 line-through">${uniFee.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Instant Savings Callout */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between font-mono text-xs">
            <span className="text-emerald-300 font-bold">Capital Retained vs Aave v3:</span>
            <span className="text-lg font-black text-emerald-400">+${savings.toFixed(2)} USD (88.9% Saved)</span>
          </div>

          {/* Execution Terminal Console */}
          {executionLogs.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-black/90 border border-cyan-500/30 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold pb-1 border-b border-white/10">
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Single-Block EVM Execution Trace</span>
              </div>
              {executionLogs.map((lg, i) => (
                <div key={i} className="text-slate-300 leading-relaxed font-mono">
                  {lg}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Execution Configuration & Launch Ticket */}
        <div className="lg:col-span-6 rounded-3xl p-6 bg-gradient-to-br from-[#02131d] to-[#01080e] border border-blue-500/30 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Configure Single-Block Execution
            </h4>
            <span className="text-xs font-mono text-slate-400">ERC-3156 Standard</span>
          </div>

          {/* Strategy Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400">Strategy Payload</label>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              {[
                { id: 'arbitrage', label: 'DEX Arbitrage' },
                { id: 'collateral-swap', label: 'Collateral Swap' },
                { id: 'liquidation', label: 'Liquidations' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStrategy(s.id as any);
                    playSound('click');
                  }}
                  className={'py-2 rounded-xl text-center font-bold transition cursor-pointer ' + (
                    selectedStrategy === s.id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset & Requested Capital Input */}
          <div className="p-4 rounded-2xl bg-black/50 border border-blue-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Borrow Asset</span>
              <span>Available Pool: <strong>${(ASSET_CONFIG[selectedAsset].available / 1000000).toFixed(1)}M {selectedAsset}</strong></span>
            </div>

            <div className="flex items-center gap-2 font-mono">
              {(Object.keys(ASSET_CONFIG) as Array<keyof typeof ASSET_CONFIG>).map((ast) => (
                <button
                  key={ast}
                  onClick={() => {
                    setSelectedAsset(ast);
                    playSound('click');
                  }}
                  className={'px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ' + (
                    selectedAsset === ast
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  )}
                >
                  <span>{ASSET_CONFIG[ast].icon}</span>
                  <span>{ast}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 font-mono pt-2">
              <input
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="250000"
                className="w-full bg-transparent text-2xl font-bold text-blue-300 outline-none"
              />
              <span className="text-sm font-bold text-white bg-[#041a2a] px-3 py-1.5 rounded-xl border border-blue-500/30">
                {selectedAsset}
              </span>
            </div>

            {/* Quick Amounts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-[10px]">
              {['50,000', '100,000', '250,000', '500,000', '1,000,000', '5,000,000'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setBorrowAmount(amt.replace(/,/g, ''));
                    playSound('click');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition cursor-pointer"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Execution Safety Controls */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] block">Max Slippage Tolerance</span>
              <div className="flex items-center gap-1">
                {(['0.1%', '0.5%', '1.0%'] as const).map((slip) => (
                  <button
                    key={slip}
                    onClick={() => setMaxSlippage(slip)}
                    className={'px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ' + (
                      maxSlippage === slip
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {slip}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] block">MEV Protection</span>
              <button
                onClick={() => setMevProtection(!mevProtection)}
                className={'flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer ' + (
                  mevProtection ? 'text-emerald-400' : 'text-slate-400'
                )}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{mevProtection ? 'Flashbots RPC (Active)' : 'Public Mempool'}</span>
              </button>
            </div>
          </div>

          {/* Execution Summary Ticket */}
          <div className="p-3 rounded-xl bg-[#031522] border border-cyan-500/20 font-mono text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Gross Projected Revenue:</span>
              <span className="text-white font-bold">+${estGrossRevenue.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>CredX Precompile Fee (0.01%):</span>
              <span className="text-emerald-400 font-bold">-${credXFee.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Estimated Gas Cost:</span>
              <span className="text-slate-300 font-bold">~${estGasUSD.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-white/10 text-sm font-bold">
              <span className="text-white">Est. Net Profit (Single Block):</span>
              <span className="text-emerald-400">+${estNetProfit.toFixed(2)} USD</span>
            </div>
          </div>

          {/* Execution Button */}
          <button
            disabled={isExecuting}
            onClick={handleSimulateExecution}
            className="w-full py-4 rounded-2xl font-bold font-mono text-sm bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-slate-950 shadow-xl shadow-blue-500/25 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating Single-Block Execution &amp; Repayment...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Simulate &amp; Execute Flash Loan (${numBorrow.toLocaleString()} {selectedAsset})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          5. Specifications & ERC-3156 Modal
         ═══════════════════════════════════════════════════════════════ */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#04121d] border border-cyan-500/30 rounded-3xl p-6 max-w-xl w-full space-y-4 font-mono shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                CredX Precompile 0x0FD2 Architecture
              </h3>
              <button
                onClick={() => setShowSpecsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <strong className="text-white">Creditcoin L1 Precompile 0x0FD2</strong> executes ultra-low-gas atomic flash lending natively at the consensus layer, bypassing heavy EVM smart contract state storage overhead.
              </p>

              <div className="p-3 rounded-xl bg-black/50 border border-cyan-500/20 space-y-1.5">
                <div className="text-cyan-300 font-bold">ERC-3156 Flash Lender Standard</div>
                <div className="text-slate-400 text-[11px]">
                  <code>function maxFlashLoan(address token) external view returns (uint256);</code>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <code>function flashFee(address token, uint256 amount) external view returns (uint256);</code>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <code>function flashLoan(IERC3156FlashBorrower receiver, address token, uint256 amount, bytes data) external returns (bool);</code>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-white font-bold">Key Institutional Invariants:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Zero Upfront Collateral:</strong> No capital locked prior to borrowing.</li>
                  <li><strong className="text-slate-200">Single-Block Atomicity:</strong> If caller does not repay principal + 0.01% within the same transaction, the entire block state reverts with 0 borrower capital loss.</li>
                  <li><strong className="text-slate-200">Super-Prime Discount:</strong> CredX Credit Tier 780+ CTS score secures the 0.01% (1 bp) protocol rate vs 0.09% Aave standard.</li>
                  <li><strong className="text-slate-200">Private RPC Flashbots Bundle:</strong> Fully insulated against predatory MEV frontrunning and sandwich attacks.</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowSpecsModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Close Specifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Flash Modal */}
      <FlashLoanModal isOpen={flashModalOpen} onClose={() => setFlashModalOpen(false)} />
    </div>
  );
};

export default FlashLoanView;
