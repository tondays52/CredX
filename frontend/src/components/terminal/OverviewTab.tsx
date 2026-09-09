import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  Sliders,
  ChevronDown,
  Layers,
  Coins,
  ArrowDownLeft,
  CheckCircle2,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import BorrowModal from '../modals/BorrowModal';
import RepayModal from '../modals/RepayModal';
import SBTModal from '../modals/SBTModal';
import { LoanPosition } from '../../types/protocol';

interface PoolData {
  id: string;
  name: string;
  tokens: [string, string];
  tokenColors: [string, string];
  tokenSymbols: [string, string];
  badge: string;
  feeTier: string;
  volumeTotal: string;
  volumeBreakdown: string;
  feesTotal: string;
  feesBreakdown: string;
  tvl: string;
  tvlBreakdown: string;
  feeApr: string;
  emissionApr: string;
}

export const OverviewTab: React.FC = () => {
  const { isConnected, balanceCTC } = useWeb3();
  const { tier, score } = useProtocol();

  const [timeframe, setTimeframe] = useState<'24H' | '7D' | '1M' | '6 Month' | '1Y'>('6 Month');
  const [activeTab, setActiveTab] = useState<'pools' | 'tokens'>('pools');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter Dropdown States
  const [tokenFilter, setTokenFilter] = useState('Listed & Emerging');
  const [typeFilter, setTypeFilter] = useState('Any');
  const [volatilityFilter, setVolatilityFilter] = useState('Any');
  const [autopilotFilter, setAutopilotFilter] = useState('Inactive');
  const [advancedFilter, setAdvancedFilter] = useState('Inactive');
  const [sortFilter, setSortFilter] = useState('TVL');

  // Modals
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [sbtModalOpen, setSbtModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanPosition | null>(null);

  // Active hover point for the chart tooltip
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: string; month: string } | null>({
    x: 460,
    y: 75,
    val: '$36,126.00',
    month: 'May'
  });

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const pools: PoolData[] = [
    {
      id: 'usdc-ctc',
      name: 'USDC / CTC',
      tokens: ['USDC', 'CTC'],
      tokenColors: ['#2775CA', '#00FF66'],
      tokenSymbols: ['$', 'C'],
      badge: 'Basic Volatile',
      feeTier: '0.3%',
      volumeTotal: '$27.56M',
      volumeBreakdown: '13.81M USDC • 20.75M CTC',
      feesTotal: '$82,673.19',
      feesBreakdown: '41,456.48 USDC • 62,266.9 CTC',
      tvl: '$39.1M',
      tvlBreakdown: '19.47M USDC • 29.63M CTC',
      feeApr: 'N/A',
      emissionApr: '23,420/0'
    },
    {
      id: 'weth-ctc',
      name: 'WETH / CTC',
      tokens: ['WETH', 'CTC'],
      tokenColors: ['#627EEA', '#00FF66'],
      tokenSymbols: ['Ξ', 'C'],
      badge: 'Concentrated Volatile 100',
      feeTier: '0.05%',
      volumeTotal: '$895.48M',
      volumeBreakdown: '139,383.99 WETH • 430.37M CTC',
      feesTotal: '$296,405.93',
      feesBreakdown: '46.13 WETH • 142,454.06 USDC',
      tvl: '$123.7M',
      tvlBreakdown: '4,226.28 WETH • 9,624,501 CTC',
      feeApr: 'N/A',
      emissionApr: '804,450/0'
    },
    {
      id: 'rwa-ctc',
      name: 'RWA-TBILL / CTC',
      tokens: ['RWA', 'CTC'],
      tokenColors: ['#F59E0B', '#00FF66'],
      tokenSymbols: ['🏛', 'C'],
      badge: 'Institutional Yield',
      feeTier: '0.02%',
      volumeTotal: '$68.90M',
      volumeBreakdown: '34.45M TBILL • 34.45M CTC',
      feesTotal: '$42,100.50',
      feesBreakdown: '21,050.25 TBILL • 42,100 CTC',
      tvl: '$52.6M',
      tvlBreakdown: '26.30M TBILL • 26.30M CTC',
      feeApr: '5.20%',
      emissionApr: '14,800/0'
    }
  ];

  // SVG Chart path points
  const points = [
    { x: 50, y: 155, val: '$22,400.00', month: 'Jan' },
    { x: 120, y: 140, val: '$24,800.00', month: 'Jan' },
    { x: 190, y: 165, val: '$21,200.00', month: 'Feb' },
    { x: 260, y: 120, val: '$29,500.00', month: 'Feb' },
    { x: 330, y: 110, val: '$31,400.00', month: 'Mar' },
    { x: 400, y: 160, val: '$22,800.00', month: 'Apr' },
    { x: 460, y: 75, val: '$36,126.00', month: 'May' },
    { x: 530, y: 120, val: '$29,800.00', month: 'May' },
    { x: 600, y: 105, val: '$32,400.00', month: 'Jun' }
  ];

  const svgPath = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${svgPath} L 600 210 L 50 210 Z`;

  // 24 Equalizer Bars for Fees Card
  const feeBars = [
    30, 45, 60, 50, 70, 85, 95, 75, 65, 80, 100, 85, 70, 60, 50, 40, 35, 25, 20, 15, 12, 10, 8, 5
  ];

  return (
    <div className="w-full space-y-6 select-none font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================
            LEFT COLUMN (approx 72% width)
        ======================================================== */}
        <div className="lg:col-span-8 space-y-6">
          {/* TOP CARD: Balance / Portfolio Chart Card */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/20 p-6 md:p-8 relative overflow-hidden shadow-2xl">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/[0.07] rounded-full blur-[100px] pointer-events-none" />

            {/* Header: Balance & Dropdowns */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs font-semibold text-gray-400 block tracking-wide">
                  Balance
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight font-mono">
                    ${userWalletUSD > 0 ? userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '4,999.95'}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[11px] font-bold font-mono">
                    ↑ 20%
                  </span>
                </div>
              </div>

              {/* Right Controls: Filter & Timeframe */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBorrowModalOpen(true)}
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Tune & Borrow"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                <div className="relative">
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value as any)}
                    className="appearance-none px-4 py-2 pr-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer focus:outline-none"
                  >
                    <option value="24H" className="bg-[#070b0e]">24H</option>
                    <option value="7D" className="bg-[#070b0e]">7D</option>
                    <option value="1M" className="bg-[#070b0e]">1M</option>
                    <option value="6 Month" className="bg-[#070b0e]">6 Month</option>
                    <option value="1Y" className="bg-[#070b0e]">1Y</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Interactive SVG Chart Area */}
            <div className="relative w-full h-[260px] sm:h-[300px] mt-6">
              {/* Y-Axis scale labels */}
              <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] font-mono text-gray-500 pointer-events-none">
                <span>40k</span>
                <span>35k</span>
                <span>30k</span>
                <span>25k</span>
                <span>20k</span>
              </div>

              {/* SVG Curve, Area, and Volume Histogram */}
              <svg
                viewBox="0 0 640 240"
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Cyan area gradient fill */}
                  <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="#00e5ff" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Cyan line stroke gradient */}
                  <linearGradient id="cyanLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00e5ff" />
                    <stop offset="50%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#00FF66" />
                  </linearGradient>

                  {/* Soft glow filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Vertical Histogram Bars (Volume Bars along the bottom) */}
                {Array.from({ length: 48 }).map((_, idx) => {
                  const barX = 50 + idx * 11.5;
                  const barH = 10 + Math.sin(idx * 0.45) * 18 + (idx > 30 ? 25 : 8);
                  return (
                    <rect
                      key={idx}
                      x={barX}
                      y={210 - barH}
                      width="4"
                      height={barH}
                      rx="1"
                      className="fill-cyan-500/20 hover:fill-cyan-400/50 transition-colors"
                    />
                  );
                })}

                {/* Area Gradient under curve */}
                <path d={areaPath} fill="url(#cyanAreaGrad)" />

                {/* Glowing Wave Curve Line */}
                <path
                  d={svgPath}
                  fill="none"
                  stroke="url(#cyanLineGrad)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                />

                {/* Hover / Active Crosshair Lines */}
                {hoveredPoint && (
                  <>
                    {/* Horizontal Dashed Line */}
                    <line
                      x1="50"
                      y1={hoveredPoint.y}
                      x2="600"
                      y2={hoveredPoint.y}
                      stroke="rgba(0, 229, 255, 0.35)"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />

                    {/* Vertical Dashed Line */}
                    <line
                      x1={hoveredPoint.x}
                      y1="20"
                      x2={hoveredPoint.x}
                      y2="210"
                      stroke="rgba(0, 229, 255, 0.45)"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />

                    {/* Glowing Target Dot */}
                    <circle
                      cx={hoveredPoint.x}
                      cy={hoveredPoint.y}
                      r="6"
                      className="fill-cyan-300 stroke-[#070b0e] stroke-2 shadow-lg"
                      filter="url(#glow)"
                    />
                  </>
                )}
              </svg>

              {/* Floating Tooltip matching user's image: "$36,126.00 Total" */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
                  style={{
                    left: `${(hoveredPoint.x / 640) * 100}%`,
                    top: `${(hoveredPoint.y / 240) * 100}%`
                  }}
                >
                  <div className="px-3.5 py-1.5 rounded-xl bg-[#041d24]/90 border border-cyan-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(0,229,255,0.4)] flex items-center gap-2">
                    <span className="text-[#00FF66] text-xs font-black">↑</span>
                    <div>
                      <div className="text-xs font-black font-mono text-white tracking-tight">
                        {hoveredPoint.val}
                      </div>
                      <div className="text-[9px] font-mono text-cyan-300/70 uppercase">
                        Total &bull; {hoveredPoint.month}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* X-Axis Month Labels */}
              <div className="absolute left-10 right-2 bottom-0 flex justify-between text-[11px] font-mono text-gray-500">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION: "Provide liquidity." Header + 3 Metric Cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1 text-xs text-gray-400 font-medium">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Provide liquidity.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Metric Card 1: Volume */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[128px]">
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    $3.16B
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>Volume</span>
                    <span className="text-cyan-400 font-bold">99%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="w-[99%] h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]" />
                  </div>
                </div>
              </div>

              {/* Metric Card 2: Fees */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[128px]">
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    $32,011.00
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-mono text-gray-400 block">Fees</span>
                  {/* Equalizer Audio Bar Visualizer */}
                  <div className="flex items-end gap-[3px] h-4">
                    {feeBars.map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`flex-1 rounded-t-sm transition-all ${
                          i < 14 ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Metric Card 3: TVL */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 relative overflow-hidden flex flex-col justify-between h-[128px]">
                <div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                    $428.2M
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono text-gray-400 block">TVL</span>
                  {/* Weekly Steps: S M T W T F S */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 pt-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-3.5 h-2.5 rounded-sm ${
                            idx >= 1 && idx <= 4
                              ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
                              : 'bg-white/10'
                          }`}
                        />
                        <span>{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: Pools Table */}
          <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/15 p-6 relative overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-mono text-gray-400 pb-4 border-b border-white/[0.08] px-2">
              <span className="col-span-4">pools</span>
              <span className="col-span-2 text-right">Volume</span>
              <span className="col-span-2 text-right">Fees</span>
              <span className="col-span-2 text-right flex items-center justify-end gap-1 text-cyan-400 font-bold">
                TVL ↓
              </span>
              <span className="col-span-1 text-right hidden sm:block">Fee APR</span>
              <span className="col-span-1 text-right">Emission APR</span>
            </div>

            {/* Pool Rows */}
            <div className="divide-y divide-white/[0.04]">
              {pools.map((pool) => (
                <div
                  key={pool.id}
                  className="grid grid-cols-12 gap-2 py-4 px-2 items-center hover:bg-white/[0.02] transition-colors rounded-xl group"
                >
                  {/* Pool Tokens & Badges */}
                  <div className="col-span-4 flex items-center gap-3">
                    {/* Overlapping Token Circles */}
                    <div className="flex items-center -space-x-2 shrink-0">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-white shadow-md z-10"
                        style={{ backgroundColor: pool.tokenColors[0] }}
                      >
                        {pool.tokenSymbols[0]}
                      </div>
                      <div
                        className="w-8 h-8 rounded-full border-2 border-[#070b0e] flex items-center justify-center font-bold text-xs text-black shadow-md z-0"
                        style={{ backgroundColor: pool.tokenColors[1] }}
                      >
                        {pool.tokenSymbols[1]}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {pool.name}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-300">
                          {pool.feeTier}
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-400/80 block truncate">
                        {pool.badge}
                      </span>
                    </div>
                  </div>

                  {/* Volume */}
                  <div className="col-span-2 text-right font-mono">
                    <div className="text-xs sm:text-sm font-bold text-white">{pool.volumeTotal}</div>
                    <div className="text-[9px] text-gray-500 hidden md:block truncate">{pool.volumeBreakdown}</div>
                  </div>

                  {/* Fees */}
                  <div className="col-span-2 text-right font-mono">
                    <div className="text-xs sm:text-sm font-bold text-white">{pool.feesTotal}</div>
                    <div className="text-[9px] text-gray-500 hidden md:block truncate">{pool.feesBreakdown}</div>
                  </div>

                  {/* TVL */}
                  <div className="col-span-2 text-right font-mono">
                    <div className="text-xs sm:text-sm font-bold text-white">{pool.tvl}</div>
                    <div className="text-[9px] text-gray-500 hidden md:block truncate">{pool.tvlBreakdown}</div>
                  </div>

                  {/* Fee APR */}
                  <div className="col-span-1 text-right font-mono text-xs text-gray-400 hidden sm:block">
                    {pool.feeApr}
                  </div>

                  {/* Emission APR & Deposit Action */}
                  <div className="col-span-1 text-right font-mono">
                    <div className="text-xs font-bold text-white">{pool.emissionApr}</div>
                    <button
                      onClick={() => setBorrowModalOpen(true)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer block text-right mt-0.5"
                    >
                      + New deposit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT SIDEBAR (approx 28% width) Filter Stack
        ======================================================== */}
        <div className="lg:col-span-4 space-y-4">
          {/* Top Tabs: pools (2,104) / Tokens! (385) + Search */}
          <div className="p-3 rounded-2xl bg-[#070b0e] border border-cyan-500/15 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('pools')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pools'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                pools <span className="text-[10px] font-mono opacity-60">2104</span>
              </button>

              <button
                onClick={() => setActiveTab('tokens')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tokens'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Tokens! <span className="text-[10px] font-mono opacity-60">385</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-cyan-400 transition-colors cursor-pointer"
                title="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-2 rounded-xl bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.5)] transition-transform hover:scale-105 cursor-pointer"
                title="Liquidity layers"
              >
                <Coins className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Card 1: TOKEN */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              TOKEN
            </span>
            <div className="relative">
              <select
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="Listed & Emerging" className="bg-[#070b0e]">Listed & Emerging</option>
                <option value="Creditcoin Native (CTC)" className="bg-[#070b0e]">Creditcoin Native (CTC)</option>
                <option value="RWA Treasury Notes" className="bg-[#070b0e]">RWA Treasury Notes</option>
                <option value="Stables (USDC / USDT)" className="bg-[#070b0e]">Stables (USDC / USDT)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter Card 2: TYPE */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              TYPE
            </span>
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="Any" className="bg-[#070b0e]">Any</option>
                <option value="Volatile" className="bg-[#070b0e]">Volatile</option>
                <option value="Concentrated" className="bg-[#070b0e]">Concentrated</option>
                <option value="Stable" className="bg-[#070b0e]">Stable</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter Card 3: VOLATILITY */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              VOLATILITY
            </span>
            <div className="relative">
              <select
                value={volatilityFilter}
                onChange={(e) => setVolatilityFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="Any" className="bg-[#070b0e]">Any</option>
                <option value="Low (0-15%)" className="bg-[#070b0e]">Low (0-15%)</option>
                <option value="Medium (15-50%)" className="bg-[#070b0e]">Medium (15-50%)</option>
                <option value="High (>50%)" className="bg-[#070b0e]">High (&gt;50%)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter Card 4: AUTOPILOT */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              AUTOPILOT
            </span>
            <div className="relative">
              <select
                value={autopilotFilter}
                onChange={(e) => setAutopilotFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="Inactive" className="bg-[#070b0e]">Inactive</option>
                <option value="Active (AI Auto-Rebalance)" className="bg-[#070b0e]">Active (AI Auto-Rebalance)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter Card 5: ADVANCED */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              ADVANCED
            </span>
            <div className="relative">
              <select
                value={advancedFilter}
                onChange={(e) => setAdvancedFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="Inactive" className="bg-[#070b0e]">Inactive</option>
                <option value="Active" className="bg-[#070b0e]">Active</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter Card 6: SORT */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/15 space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-white block uppercase">
              SORT
            </span>
            <div className="relative">
              <select
                value={sortFilter}
                onChange={(e) => setSortFilter(e.target.value)}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-semibold text-cyan-400 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
              >
                <option value="TVL" className="bg-[#070b0e]">TVL (Highest to Lowest)</option>
                <option value="Volume" className="bg-[#070b0e]">Volume 24h</option>
                <option value="APR" className="bg-[#070b0e]">Emission APR</option>
                <option value="Fees" className="bg-[#070b0e]">Fees Generated</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Modals for Action buttons */}
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
