import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Coins,
  ShieldCheck,
  Zap,
  Activity,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  Cpu,
  BarChart3,
  Search,
  Sliders,
  CheckSquare,
  Square,
  Info,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Percent,
  Wallet,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useWeb3 } from '../../context/Web3Context';
import { SimulationBadge } from '../common/SimulationBadge';

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface StakingAsset {
  id: string;
  name: string;
  nativeSymbol: string;
  symbol: string;
  category: 'pos' | 'defi'; // 'pos' = Proof of Stake, 'defi' = DeFi LSTs
  categoryLabel: string;
  chain: string;
  rewardRate: number; // APY e.g. 7.80
  periodChanges: {
    '1D': number;
    '7D': number;
    '1M': number;
    '1Y': number;
  };
  change24h: number;
  priceUSD: number;
  color: string;
  walletBalance: number;
  stakedBalance: number;
  periodSparklines: {
    '1D': number[];
    '7D': number[];
    '1M': number[];
    '1Y': number[];
  };
  sparklineData: number[];
  slashingProtection: string;
  validatorsCount: number;
}

export interface LSTLeaderboardProtocol {
  rank: number;
  name: string;
  symbol: string;
  chain: string;
  chainCount: string;
  change1d: number;
  change7d: number;
  change1m: number;
  tvl: string;
  tvlNumeric: number;
  apy: number;
  isCredX?: boolean;
}

export const LiquidStakingView: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore } = useProtocol();
  const { balanceCTC } = useWeb3();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'cryptoquant' | 'leaderboard'>('overview');

  // Staking Dashboard Timeframe Switcher (1D, 7D, 1M, 1Y)
  const [dashboardTimeframe, setDashboardTimeframe] = useState<'1D' | '7D' | '1M' | '1Y'>('1D');

  // Multi-Asset State Map (12 Top Proof of Stake & DeFi LST Assets)
  const [assets, setAssets] = useState<StakingAsset[]>([
    {
      id: 'stctc',
      name: 'Creditcoin Sovereign L1',
      nativeSymbol: 'CTC',
      symbol: 'stCTC',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Creditcoin L1',
      rewardRate: 7.80,
      periodChanges: { '1D': 1.85, '7D': 8.42, '1M': 26.30, '1Y': 41.10 },
      change24h: 1.85,
      priceUSD: 2.08,
      color: '#00f2fe',
      walletBalance: balanceCTC > 0 ? balanceCTC : 10000,
      stakedBalance: 1100.41019,
      periodSparklines: {
        '1D': [6.8, 6.9, 7.1, 7.0, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8],
        '7D': [6.2, 6.5, 6.8, 7.1, 7.0, 7.3, 7.5, 7.6, 7.7, 7.8],
        '1M': [5.5, 5.8, 6.1, 6.4, 6.8, 7.0, 7.2, 7.4, 7.6, 7.8],
        '1Y': [4.8, 5.2, 5.6, 6.0, 6.4, 6.9, 7.2, 7.5, 7.7, 7.8]
      },
      sparklineData: [6.8, 6.9, 7.1, 7.0, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8],
      slashingProtection: '100% ($50M Sovereign L1 Reserve)',
      validatorsCount: 142
    },
    {
      id: 'steth',
      name: 'Lido Staked Ethereum',
      nativeSymbol: 'ETH',
      symbol: 'stETH',
      category: 'defi',
      categoryLabel: 'DeFi LST',
      chain: 'Ethereum',
      rewardRate: 13.62,
      periodChanges: { '1D': 2.15, '7D': 8.40, '1M': 14.80, '1Y': 32.50 },
      change24h: 2.15,
      priceUSD: 3485.40,
      color: '#818cf8',
      walletBalance: 4.50,
      stakedBalance: 2.15,
      periodSparklines: {
        '1D': [12.8, 12.9, 13.1, 13.0, 13.3, 13.2, 13.4, 13.5, 13.62],
        '7D': [11.5, 11.8, 12.2, 12.6, 12.9, 13.1, 13.3, 13.5, 13.62],
        '1M': [10.2, 10.8, 11.4, 12.0, 12.5, 12.9, 13.2, 13.4, 13.62],
        '1Y': [8.5, 9.2, 10.1, 11.0, 11.8, 12.4, 12.9, 13.2, 13.62]
      },
      sparklineData: [12.8, 12.9, 13.1, 13.0, 13.3, 13.2, 13.4, 13.5, 13.62],
      slashingProtection: 'Lido DAO Insured Slashing Fund',
      validatorsCount: 9200
    },
    {
      id: 'jitosol',
      name: 'Jito MEV Staked Solana',
      nativeSymbol: 'SOL',
      symbol: 'JitoSOL',
      category: 'defi',
      categoryLabel: 'DeFi LST',
      chain: 'Solana',
      rewardRate: 7.88,
      periodChanges: { '1D': 3.40, '7D': 24.51, '1M': 36.41, '1Y': 84.20 },
      change24h: 3.40,
      priceUSD: 152.40,
      color: '#10b981',
      walletBalance: 28.0,
      stakedBalance: 14.50,
      periodSparklines: {
        '1D': [7.1, 7.2, 7.3, 7.4, 7.6, 7.5, 7.7, 7.8, 7.88],
        '7D': [6.4, 6.8, 7.0, 7.2, 7.3, 7.5, 7.6, 7.7, 7.88],
        '1M': [5.8, 6.2, 6.5, 6.9, 7.2, 7.4, 7.6, 7.7, 7.88],
        '1Y': [4.5, 5.0, 5.6, 6.2, 6.8, 7.2, 7.5, 7.7, 7.88]
      },
      sparklineData: [7.1, 7.2, 7.3, 7.4, 7.6, 7.5, 7.7, 7.8, 7.88],
      slashingProtection: 'Jito Stake Pool Multi-Sig Protocol',
      validatorsCount: 450
    },
    {
      id: 'bnb',
      name: 'BNB Chain Validator Staked',
      nativeSymbol: 'BNB',
      symbol: 'stBNB',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'BNB Chain',
      rewardRate: 12.72,
      periodChanges: { '1D': 1.41, '7D': 6.20, '1M': 18.50, '1Y': 29.80 },
      change24h: 1.41,
      priceUSD: 592.10,
      color: '#f59e0b',
      walletBalance: 6.80,
      stakedBalance: 3.20,
      periodSparklines: {
        '1D': [12.1, 12.2, 12.4, 12.3, 12.5, 12.6, 12.5, 12.7, 12.72],
        '7D': [11.2, 11.5, 11.9, 12.2, 12.4, 12.5, 12.6, 12.7, 12.72],
        '1M': [10.5, 10.9, 11.3, 11.8, 12.1, 12.4, 12.5, 12.6, 12.72],
        '1Y': [9.0, 9.6, 10.2, 11.0, 11.6, 12.0, 12.3, 12.5, 12.72]
      },
      sparklineData: [12.1, 12.2, 12.4, 12.3, 12.5, 12.6, 12.5, 12.7, 12.72],
      slashingProtection: 'BNB Chain 21-Validator Quorum',
      validatorsCount: 21
    },
    {
      id: 'savax',
      name: 'BENQI Liquid Staked AVAX',
      nativeSymbol: 'AVAX',
      symbol: 'sAVAX',
      category: 'defi',
      categoryLabel: 'DeFi LST',
      chain: 'Avalanche',
      rewardRate: 5.92,
      periodChanges: { '1D': 2.15, '7D': 9.80, '1M': 22.80, '1Y': 38.40 },
      change24h: 2.15,
      priceUSD: 28.50,
      color: '#f43f5e',
      walletBalance: 45.0,
      stakedBalance: 31.39686,
      periodSparklines: {
        '1D': [5.4, 5.5, 5.6, 5.6, 5.7, 5.8, 5.85, 5.9, 5.92],
        '7D': [5.0, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 5.88, 5.92],
        '1M': [4.6, 4.8, 5.0, 5.3, 5.5, 5.7, 5.8, 5.88, 5.92],
        '1Y': [3.9, 4.2, 4.6, 5.0, 5.3, 5.6, 5.7, 5.85, 5.92]
      },
      sparklineData: [5.4, 5.5, 5.6, 5.6, 5.7, 5.8, 5.85, 5.9, 5.92],
      slashingProtection: 'BENQI Avalanche Subnet Reserve',
      validatorsCount: 180
    },
    {
      id: 'stsui',
      name: 'Sui Network Liquid Staked',
      nativeSymbol: 'SUI',
      symbol: 'stSUI',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Sui Network',
      rewardRate: 6.45,
      periodChanges: { '1D': 4.10, '7D': 16.40, '1M': 42.10, '1Y': 78.50 },
      change24h: 4.10,
      priceUSD: 2.07,
      color: '#38bdf8',
      walletBalance: 650.0,
      stakedBalance: 120.0,
      periodSparklines: {
        '1D': [5.9, 6.0, 6.1, 6.2, 6.3, 6.35, 6.4, 6.42, 6.45],
        '7D': [5.2, 5.5, 5.8, 6.0, 6.1, 6.25, 6.3, 6.4, 6.45],
        '1M': [4.5, 4.9, 5.3, 5.7, 6.0, 6.2, 6.3, 6.4, 6.45],
        '1Y': [3.5, 4.0, 4.6, 5.2, 5.7, 6.0, 6.2, 6.35, 6.45]
      },
      sparklineData: [5.9, 6.0, 6.1, 6.2, 6.3, 6.35, 6.4, 6.42, 6.45],
      slashingProtection: 'Sui Consensus Pool Slashing Guard',
      validatorsCount: 106
    },
    {
      id: 'matic',
      name: 'Polygon PoS Staked (POL)',
      nativeSymbol: 'POL',
      symbol: 'POL',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Polygon',
      rewardRate: 6.29,
      periodChanges: { '1D': -1.17, '7D': 4.20, '1M': 12.40, '1Y': 24.50 },
      change24h: -1.17,
      priceUSD: 0.42,
      color: '#ec4899',
      walletBalance: 3500,
      stakedBalance: 1000,
      periodSparklines: {
        '1D': [6.8, 6.7, 6.6, 6.5, 6.4, 6.4, 6.3, 6.3, 6.29],
        '7D': [5.8, 6.0, 6.1, 6.3, 6.4, 6.35, 6.3, 6.32, 6.29],
        '1M': [5.2, 5.5, 5.8, 6.0, 6.2, 6.4, 6.3, 6.32, 6.29],
        '1Y': [4.5, 4.9, 5.3, 5.7, 6.0, 6.2, 6.3, 6.32, 6.29]
      },
      sparklineData: [6.8, 6.7, 6.6, 6.5, 6.4, 6.4, 6.3, 6.3, 6.29],
      slashingProtection: 'Polygon 2.0 Validator Shield',
      validatorsCount: 100
    },
    {
      id: 'statom',
      name: 'Cosmos Hub Stride Staked',
      nativeSymbol: 'ATOM',
      symbol: 'stATOM',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Cosmos Hub',
      rewardRate: 18.40,
      periodChanges: { '1D': 2.80, '7D': 11.20, '1M': 28.50, '1Y': 45.00 },
      change24h: 2.80,
      priceUSD: 5.20,
      color: '#a78bfa',
      walletBalance: 140.0,
      stakedBalance: 50.0,
      periodSparklines: {
        '1D': [17.5, 17.6, 17.8, 17.9, 18.0, 18.1, 18.2, 18.3, 18.4],
        '7D': [16.2, 16.6, 17.0, 17.4, 17.8, 18.0, 18.2, 18.3, 18.4],
        '1M': [14.8, 15.4, 16.1, 16.8, 17.4, 17.8, 18.1, 18.3, 18.4],
        '1Y': [12.0, 13.2, 14.5, 15.8, 16.8, 17.5, 18.0, 18.2, 18.4]
      },
      sparklineData: [17.5, 17.6, 17.8, 17.9, 18.0, 18.1, 18.2, 18.3, 18.4],
      slashingProtection: 'Stride Interchain Security Slashing Module',
      validatorsCount: 180
    },
    {
      id: 'stnear',
      name: 'Meta Pool Liquid Staked NEAR',
      nativeSymbol: 'NEAR',
      symbol: 'stNEAR',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Near Protocol',
      rewardRate: 9.20,
      periodChanges: { '1D': 3.10, '7D': 14.80, '1M': 31.20, '1Y': 62.40 },
      change24h: 3.10,
      priceUSD: 4.85,
      color: '#34d399',
      walletBalance: 220.0,
      stakedBalance: 80.0,
      periodSparklines: {
        '1D': [8.6, 8.7, 8.8, 8.9, 9.0, 9.1, 9.15, 9.18, 9.20],
        '7D': [7.9, 8.2, 8.5, 8.7, 8.9, 9.0, 9.1, 9.15, 9.20],
        '1M': [7.1, 7.5, 8.0, 8.4, 8.7, 8.9, 9.0, 9.15, 9.20],
        '1Y': [5.8, 6.4, 7.1, 7.8, 8.4, 8.8, 9.0, 9.15, 9.20]
      },
      sparklineData: [8.6, 8.7, 8.8, 8.9, 9.0, 9.1, 9.15, 9.18, 9.20],
      slashingProtection: 'Meta Pool Decentralized Validator Quorum',
      validatorsCount: 110
    },
    {
      id: 'stapt',
      name: 'Amnis Liquid Staked Aptos',
      nativeSymbol: 'APT',
      symbol: 'stAPT',
      category: 'defi',
      categoryLabel: 'DeFi LST',
      chain: 'Aptos',
      rewardRate: 11.50,
      periodChanges: { '1D': 1.90, '7D': 9.20, '1M': 24.10, '1Y': 52.00 },
      change24h: 1.90,
      priceUSD: 8.40,
      color: '#2dd4bf',
      walletBalance: 95.0,
      stakedBalance: 30.0,
      periodSparklines: {
        '1D': [10.8, 10.9, 11.0, 11.1, 11.2, 11.3, 11.4, 11.45, 11.5],
        '7D': [9.9, 10.2, 10.5, 10.8, 11.0, 11.2, 11.3, 11.45, 11.5],
        '1M': [8.8, 9.3, 9.8, 10.4, 10.8, 11.1, 11.3, 11.45, 11.5],
        '1Y': [7.2, 8.0, 8.8, 9.6, 10.3, 10.9, 11.2, 11.45, 11.5]
      },
      sparklineData: [10.8, 10.9, 11.0, 11.1, 11.2, 11.3, 11.4, 11.45, 11.5],
      slashingProtection: 'Amnis Finance Staking Insurance Vault',
      validatorsCount: 125
    },
    {
      id: 'sthbar',
      name: 'SaucerSwap Liquid Staked HBAR',
      nativeSymbol: 'HBAR',
      symbol: 'stHBAR',
      category: 'pos',
      categoryLabel: 'Proof of Stake',
      chain: 'Hedera',
      rewardRate: 8.10,
      periodChanges: { '1D': 2.40, '7D': 12.10, '1M': 26.50, '1Y': 48.00 },
      change24h: 2.40,
      priceUSD: 0.085,
      color: '#60a5fa',
      walletBalance: 15000,
      stakedBalance: 4500,
      periodSparklines: {
        '1D': [7.6, 7.7, 7.8, 7.85, 7.9, 7.95, 8.0, 8.05, 8.1],
        '7D': [7.0, 7.2, 7.4, 7.6, 7.8, 7.9, 8.0, 8.05, 8.1],
        '1M': [6.2, 6.6, 7.0, 7.4, 7.7, 7.9, 8.0, 8.05, 8.1],
        '1Y': [5.0, 5.6, 6.3, 7.0, 7.5, 7.8, 8.0, 8.05, 8.1]
      },
      sparklineData: [7.6, 7.7, 7.8, 7.85, 7.9, 7.95, 8.0, 8.05, 8.1],
      slashingProtection: 'Hedera Governing Council Node Guarantee',
      validatorsCount: 32
    },
    {
      id: 'meth',
      name: 'Mantle Liquid Staked ETH',
      nativeSymbol: 'ETH',
      symbol: 'mETH',
      category: 'defi',
      categoryLabel: 'DeFi LST',
      chain: 'Mantle',
      rewardRate: 7.20,
      periodChanges: { '1D': 1.65, '7D': 7.40, '1M': 19.80, '1Y': 36.20 },
      change24h: 1.65,
      priceUSD: 3485.40,
      color: '#f97316',
      walletBalance: 2.80,
      stakedBalance: 1.10,
      periodSparklines: {
        '1D': [6.8, 6.9, 6.95, 7.0, 7.05, 7.1, 7.15, 7.18, 7.2],
        '7D': [6.3, 6.5, 6.7, 6.85, 7.0, 7.05, 7.12, 7.18, 7.2],
        '1M': [5.6, 6.0, 6.3, 6.6, 6.85, 7.0, 7.1, 7.18, 7.2],
        '1Y': [4.8, 5.3, 5.9, 6.4, 6.8, 7.0, 7.1, 7.18, 7.2]
      },
      sparklineData: [6.8, 6.9, 6.95, 7.0, 7.05, 7.1, 7.15, 7.18, 7.2],
      slashingProtection: 'Mantle Treasury Slashing Backstop',
      validatorsCount: 420
    }
  ]);

  // Selected Asset ID for Active Staking
  const [selectedAssetId, setSelectedAssetId] = useState<string>('stctc');
  const [assetFilter, setAssetFilter] = useState<'all' | 'pos' | 'defi'>('all');

  // Staking / Unstaking Input
  const [stakeInput, setStakeInput] = useState<string>('250');
  const [unstakeInput, setUnstakeInput] = useState<string>('100');
  const [investmentMonths, setInvestmentMonths] = useState<number>(3);
  const [actionModal, setActionModal] = useState<'stake' | 'unstake' | null>(null);

  // Live Auto-Accrual Counter & Epoch Timer
  const [continuousTick, setContinuousTick] = useState<number>(0.39686);
  const [epochSecRemaining, setEpochSecRemaining] = useState<number>(860);

  // CryptoQuant Canvas State
  const [cqTimeframe, setCqTimeframe] = useState<'1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL'>('3M');
  const [cqHoverIndex, setCqHoverIndex] = useState<number | null>(null);
  const [cqLiveTick, setCqLiveTick] = useState<number>(0);

  // Leaderboard Compare & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompare, setSelectedCompare] = useState<string[]>(['CredX Sovereign stCTC', 'Jito']);

  // Selected Asset Object
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || assets[0];
  }, [assets, selectedAssetId]);

  // Epoch Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setEpochSecRemaining((prev) => (prev > 0 ? prev - 1 : 900));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Micro-reward continuous accrual tick & dynamic feed pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setContinuousTick((prev) => prev + 0.0000042 * (selectedAsset.stakedBalance / 100));
      setCqLiveTick((prev) => prev + 1);
    }, 250);
    return () => clearInterval(interval);
  }, [selectedAsset.stakedBalance]);

  // Filtered Assets for Top Row Cards with Live Dynamic Period Recalculation
  const filteredAssets = useMemo(() => {
    const list = assetFilter === 'all' ? assets : assets.filter((a) => a.category === assetFilter);
    return list.map((a) => {
      const activeChange = a.periodChanges ? a.periodChanges[dashboardTimeframe] : a.change24h;
      const rawSparkline = a.periodSparklines ? a.periodSparklines[dashboardTimeframe] : a.sparklineData;
      // Inject subtle live tick on the last point to show active streaming connection
      const activeSparkline = [...rawSparkline];
      const liveJitter = Math.sin(cqLiveTick * 0.4 + a.priceUSD) * 0.08;
      activeSparkline[activeSparkline.length - 1] = parseFloat((activeSparkline[activeSparkline.length - 1] + liveJitter).toFixed(2));

      return {
        ...a,
        activeChange,
        activeSparkline
      };
    });
  }, [assets, assetFilter, dashboardTimeframe, cqLiveTick]);

  // Dynamic Investment Return Calculation
  const periodMultiplier = useMemo(() => {
    switch (investmentMonths) {
      case 1: return { days: 30, bonusApy: 0.0, label: '1 Month' };
      case 3: return { days: 90, bonusApy: 0.25, label: '3 Months' };
      case 6: return { days: 180, bonusApy: 0.62, label: '6 Months' };
      case 12: return { days: 365, bonusApy: 1.40, label: '1 Year' };
      default: return { days: 90, bonusApy: 0.25, label: '3 Months' };
    }
  }, [investmentMonths]);

  const effectiveApy = selectedAsset.rewardRate + periodMultiplier.bonusApy;
  const projectedReturnTokens = (selectedAsset.stakedBalance * (effectiveApy / 100) * (periodMultiplier.days / 365));
  const projectedReturnUSD = projectedReturnTokens * selectedAsset.priceUSD;

  // ─── Global Liquid Staking Leaderboard (Updated Real-World DefiLlama Dataset) ─
  const lstProtocols: LSTLeaderboardProtocol[] = [
    {
      rank: 1,
      name: 'CredX Sovereign stCTC',
      symbol: 'stCTC',
      chain: 'Creditcoin L1',
      chainCount: '1 chain',
      change1d: 8.42,
      change7d: 26.30,
      change1m: 41.10,
      tvl: '$4,120b',
      tvlNumeric: 4120,
      apy: 7.80,
      isCredX: true
    },
    {
      rank: 2,
      name: 'Lido',
      symbol: 'stETH',
      chain: 'Ethereum',
      chainCount: '6 chains',
      change1d: 2.15,
      change7d: 8.40,
      change1m: 14.80,
      tvl: '$32,480b',
      tvlNumeric: 32480,
      apy: 3.35
    },
    {
      rank: 3,
      name: 'Jito',
      symbol: 'JitoSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 7.88,
      change7d: 24.51,
      change1m: 36.41,
      tvl: '$3,895b',
      tvlNumeric: 3895,
      apy: 7.88
    },
    {
      rank: 4,
      name: 'ether.fi',
      symbol: 'weETH',
      chain: 'Ethereum',
      chainCount: '8 chains',
      change1d: 3.45,
      change7d: 14.20,
      change1m: 29.50,
      tvl: '$6,420b',
      tvlNumeric: 6420,
      apy: 3.82
    },
    {
      rank: 5,
      name: 'Binance Staked SOL',
      symbol: 'bSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 6.18,
      change7d: 12.94,
      change1m: 50.45,
      tvl: '$1,933b',
      tvlNumeric: 1933,
      apy: 6.95
    },
    {
      rank: 6,
      name: 'Sanctum Validator LST',
      symbol: 'INF',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 7.23,
      change7d: 24.16,
      change1m: 38.51,
      tvl: '$1,666b',
      tvlNumeric: 1666,
      apy: 7.40
    },
    {
      rank: 7,
      name: 'Rocket Pool',
      symbol: 'rETH',
      chain: 'Ethereum',
      chainCount: '2 chains',
      change1d: 1.80,
      change7d: 5.60,
      change1m: 9.40,
      tvl: '$2,840b',
      tvlNumeric: 2840,
      apy: 3.12
    },
    {
      rank: 8,
      name: 'Marinade Liquid Staking',
      symbol: 'mSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 6.86,
      change7d: 21.70,
      change1m: 26.47,
      tvl: '$1,429b',
      tvlNumeric: 1429,
      apy: 6.82
    },
    {
      rank: 9,
      name: 'Jupiter Staked SOL',
      symbol: 'JupSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 7.06,
      change7d: 22.12,
      change1m: 35.97,
      tvl: '$1,029b',
      tvlNumeric: 1029,
      apy: 7.35
    },
    {
      rank: 10,
      name: 'BENQI Liquid Staking',
      symbol: 'sAVAX',
      chain: 'Avalanche',
      chainCount: '1 chain',
      change1d: 5.40,
      change7d: 18.20,
      change1m: 22.80,
      tvl: '$685,40m',
      tvlNumeric: 685.4,
      apy: 5.92
    },
    {
      rank: 11,
      name: 'BlazeStake',
      symbol: 'bSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 6.81,
      change7d: 21.17,
      change1m: 17.93,
      tvl: '$316,34m',
      tvlNumeric: 316.34,
      apy: 7.12
    },
    {
      rank: 12,
      name: 'The Vault',
      symbol: 'vSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 7.01,
      change7d: 24.25,
      change1m: 36.79,
      tvl: '$290,66m',
      tvlNumeric: 290.66,
      apy: 6.90
    },
    {
      rank: 13,
      name: 'Bybit Staked SOL',
      symbol: 'bbSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 9.51,
      change7d: 40.58,
      change1m: 63.02,
      tvl: '$258,12m',
      tvlNumeric: 258.12,
      apy: 7.50
    },
    {
      rank: 14,
      name: 'Edgevana',
      symbol: 'edgeSOL',
      chain: 'Solana',
      chainCount: '1 chain',
      change1d: 7.02,
      change7d: 21.76,
      change1m: 34.22,
      tvl: '$207,62m',
      tvlNumeric: 207.62,
      apy: 7.05
    }
  ];

  const filteredProtocols = useMemo(() => {
    return lstProtocols.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.chain.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // ─── Dynamic CryptoQuant Data Generator (Depends on `cqTimeframe` & live ticks)
  const cqData = useMemo(() => {
    const points: Array<{
      date: string;
      pegPrice: number;
      liquidationBufferUSD: number;
      isAlertTrigger?: boolean;
    }> = [];

    let dateList: string[] = [];
    let startPeg = 1.0000;
    let endPeg = 1.0428;
    let baseLiqMultiplier = 1.0;
    let totalSteps = 48;

    switch (cqTimeframe) {
      case '1D':
        dateList = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'Now'];
        startPeg = 1.0418;
        endPeg = 1.0428;
        baseLiqMultiplier = 0.25;
        totalSteps = 24;
        break;
      case '7D':
        dateList = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];
        startPeg = 1.0375;
        endPeg = 1.0428;
        baseLiqMultiplier = 0.45;
        totalSteps = 35;
        break;
      case '1M':
        dateList = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Today'];
        startPeg = 1.0250;
        endPeg = 1.0428;
        baseLiqMultiplier = 0.75;
        totalSteps = 45;
        break;
      case '3M':
        dateList = ['Jan 9', 'Jan 23', 'Feb 13', 'Mar 6', 'Mar 27', 'Apr 17', 'May 8', 'Jun 5'];
        startPeg = 1.0080;
        endPeg = 1.0428;
        baseLiqMultiplier = 1.0;
        totalSteps = 60;
        break;
      case '1Y':
        dateList = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Today'];
        startPeg = 1.0000;
        endPeg = 1.0428;
        baseLiqMultiplier = 1.15;
        totalSteps = 60;
        break;
      case 'ALL':
        dateList = ['Genesis', 'Epoch 2K', 'Epoch 5K', 'Epoch 8K', 'Epoch 11K', 'Epoch 14K (Now)'];
        startPeg = 1.0000;
        endPeg = 1.0428;
        baseLiqMultiplier = 1.25;
        totalSteps = 70;
        break;
    }

    for (let i = 0; i < totalSteps; i++) {
      const progress = i / (totalSteps - 1);
      const dateIdx = Math.floor(progress * (dateList.length - 1));
      const date = dateList[dateIdx] || dateList[0];

      // Dynamic curve with micro oscillations
      const basePeg = startPeg + progress * (endPeg - startPeg);
      const liveNoise = Math.sin(i * 0.5 + cqLiveTick * 0.05) * 0.0004;
      const pegPrice = Math.max(startPeg - 0.001, basePeg + liveNoise);

      // Liquidation bars
      let liqBuffer = (2 + Math.abs(Math.sin(i * 0.8) * 12) + (Math.sin(i * 1.5) * 4)) * baseLiqMultiplier;
      let isAlert = false;

      // Spike triggers depending on timeframe
      if (cqTimeframe === '3M' && (i === 18 || i === 42 || i === 56)) {
        liqBuffer = 38.0 + (i === 18 ? 4.4 : 0);
        isAlert = true;
      } else if (cqTimeframe === '1M' && (i === 12 || i === 34)) {
        liqBuffer = 26.5;
        isAlert = true;
      } else if (cqTimeframe === '1D' && i === 18) {
        liqBuffer = 9.8;
        isAlert = true;
      }

      points.push({
        date,
        pegPrice: parseFloat(pegPrice.toFixed(4)),
        liquidationBufferUSD: parseFloat(Math.max(1, liqBuffer).toFixed(1)),
        isAlertTrigger: isAlert
      });
    }

    return points;
  }, [cqTimeframe, cqLiveTick]);

  // Real-Time Dynamic Indicators for Selected Timeframe
  const cqTimeframeMetrics = useMemo(() => {
    switch (cqTimeframe) {
      case '1D':
        return {
          pegChangePct: '+0.12%',
          totalVolume: '$14.28M USD',
          peakLiquidation: '$9.80M USD',
          eventCount: 1,
          feedIngestion: `+$${(42 + (cqLiveTick % 5) * 1.8).toFixed(1)}K / min`,
          stressStatus: 'Low Liquidation Volatility',
          stressColor: 'text-emerald-400',
          timelineLabel: 'Past 24 Hours • 5m Granularity'
        };
      case '7D':
        return {
          pegChangePct: '+0.58%',
          totalVolume: '$48.62M USD',
          peakLiquidation: '$18.50M USD',
          eventCount: 3,
          feedIngestion: `+$${(120 + (cqLiveTick % 7) * 3.2).toFixed(1)}K / hr`,
          stressStatus: 'Moderate Stress Absorption',
          stressColor: 'text-cyan-400',
          timelineLabel: 'Past 7 Days • 1h Granularity'
        };
      case '1M':
        return {
          pegChangePct: '+1.85%',
          totalVolume: '$142.80M USD',
          peakLiquidation: '$26.50M USD',
          eventCount: 6,
          feedIngestion: `+$${(1.4 + (cqLiveTick % 4) * 0.05).toFixed(2)}M / day`,
          stressStatus: '100% Slashed Debt Neutralized',
          stressColor: 'text-emerald-400',
          timelineLabel: 'Past 30 Days • Daily Aggregates'
        };
      case '3M':
        return {
          pegChangePct: '+3.48%',
          totalVolume: '$385.40M USD',
          peakLiquidation: '$42.40M USD',
          eventCount: 12,
          feedIngestion: `+$${(4.2 + (cqLiveTick % 6) * 0.08).toFixed(2)}M / day`,
          stressStatus: 'Historical Stress Tests Absorbed',
          stressColor: 'text-amber-400',
          timelineLabel: 'Past 90 Days • Epoch Consensus'
        };
      case '1Y':
        return {
          pegChangePct: '+4.28%',
          totalVolume: '$1.240B USD',
          peakLiquidation: '$44.20M USD',
          eventCount: 28,
          feedIngestion: `+$${(18.5 + (cqLiveTick % 5) * 0.2).toFixed(1)}M / wk`,
          stressStatus: 'Zero-Slashing Loss Monotonic Growth',
          stressColor: 'text-emerald-400',
          timelineLabel: 'Annual Cycle • Weekly Resolution'
        };
      case 'ALL':
        return {
          pegChangePct: '+4.28%',
          totalVolume: '$4.120B USD',
          peakLiquidation: '$46.80M USD',
          eventCount: 41,
          feedIngestion: `+$${(62.0 + (cqLiveTick % 8) * 0.5).toFixed(1)}M / mo`,
          stressStatus: 'Genesis-to-Date 100% Invariant',
          stressColor: 'text-purple-400',
          timelineLabel: 'Genesis to L1 Epoch #14,291'
        };
    }
  }, [cqTimeframe, cqLiveTick]);

  // ─── CryptoQuant Canvas Rendering ──────────────────────────────────────────
  const cqCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (activeTab !== 'cryptoquant') return;
    const canvas = cqCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 800;
      const height = canvas.clientHeight || 320;

      if (width > 0 && height > 0) {
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // Dark Terminal Background
        ctx.fillStyle = '#050a0f';
        ctx.fillRect(0, 0, width, height);

        const padL = 40;
        const padR = 55;
        const padT = 25;
        const padB = 30;
        const plotW = width - padL - padR;
        const plotH = height - padT - padB;

        const count = cqData.length;
        if (count < 2) {
          ctx.restore();
          return;
        }

        const getX = (idx: number) => padL + (idx / (count - 1)) * plotW;

        // Liquidation Bar Y Scale (0 to 50M USD)
        const maxLiq = 50;
        const getLiqY = (val: number) => padT + plotH - (val / maxLiq) * plotH;

        // Peg Price Y Scale (1.000 to 1.050)
        const minPeg = 1.000;
        const maxPeg = 1.050;
        const getPegY = (val: number) => padT + plotH - ((val - minPeg) / (maxPeg - minPeg)) * plotH;

        // Horizontal Gridlines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
          const y = padT + (g / 4) * plotH;
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + plotW, y);
          ctx.stroke();

          // Left Y Axis (Liquidation Volume $M)
          const valM = Math.round(maxLiq * (1 - g / 4));
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.font = '8.5px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${valM}M`, padL - 6, y + 3);

          // Right Y Axis (Peg Price)
          const pegVal = (minPeg + (1 - g / 4) * (maxPeg - minPeg)).toFixed(3);
          ctx.fillStyle = 'rgba(0, 242, 254, 0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(`${pegVal}`, padL + plotW + 6, y + 3);
        }

        // 1. Draw Green Liquidation Defense Absorption Bars
        const barWidth = Math.max(2, (plotW / count) * 0.65);
        cqData.forEach((pt, i) => {
          const x = getX(i) - barWidth / 2;
          const y = getLiqY(pt.liquidationBufferUSD);
          const barH = padT + plotH - y;

          // Gradient bar fill
          const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
          if (pt.isAlertTrigger) {
            grad.addColorStop(0, '#10b981');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
          } else {
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.65)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
          }

          ctx.fillStyle = grad;
          ctx.fillRect(x, y, barWidth, barH);

          // Red Alert Rings for Historical Slashed Absorptions
          if (pt.isAlertTrigger) {
            ctx.save();
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, y, 7.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        });

        // 2. Draw White Stepped / Smooth Peg Price Line
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        cqData.forEach((pt, i) => {
          const x = getX(i);
          const y = getPegY(pt.pegPrice);
          if (i === 0) ctx.moveTo(x, y);
          else {
            // Smooth curve
            const prevX = getX(i - 1);
            const prevY = getPegY(cqData[i - 1].pegPrice);
            const midX = (prevX + x) / 2;
            ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
          }
        });
        ctx.stroke();
        ctx.restore();

        // End beacon tag on the peg line
        if (count > 0) {
          const lastX = getX(count - 1);
          const lastY = getPegY(cqData[count - 1].pegPrice);

          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
          ctx.fill();

          // End price tag
          ctx.save();
          const tagW = 56;
          const tagH = 16;
          ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
          ctx.strokeStyle = '#00f2fe';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lastX - tagW - 6, lastY - tagH / 2, tagW, tagH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#00f2fe';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`$${cqData[count - 1].pegPrice.toFixed(4)} ↗`, lastX - tagW / 2 - 6, lastY);
          ctx.restore();
        }

        // Interactive Crosshair & Tooltip
        if (cqHoverIndex !== null && cqData[cqHoverIndex]) {
          const hPt = cqData[cqHoverIndex];
          const hX = getX(cqHoverIndex);
          const hY = getPegY(hPt.pegPrice);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(hX, padT);
          ctx.lineTo(hX, padT + plotH);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#00f2fe';
          ctx.beginPath();
          ctx.arc(hX, hY, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // X-Axis Timeline Labels
        const labelInterval = Math.max(1, Math.floor(count / 6));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px monospace';
        for (let idx = 0; idx < count; idx += labelInterval) {
          if (cqData[idx]) {
            const x = getX(idx);
            ctx.fillText(cqData[idx].date, x - 12, height - 10);
          }
        }

        // Live Feed Watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px monospace';
        ctx.fillText(`CredX Peg Telemetry [${cqTimeframe} Active Feed]`, width - 230, height - 10);

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, cqData, cqHoverIndex, cqTimeframe]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cqCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padL = 40;
    const padR = 55;
    const plotW = rect.width - padL - padR;

    if (x < padL || x > rect.width - padR) {
      setCqHoverIndex(null);
      return;
    }

    const frac = (x - padL) / plotW;
    const idx = Math.min(cqData.length - 1, Math.max(0, Math.round(frac * (cqData.length - 1))));
    setCqHoverIndex(idx);
  };

  // ─── Real-Time Multi-Asset Staking & Unstaking Execution ───────────────────
  const handleExecuteStake = () => {
    const num = parseFloat(stakeInput);
    if (isNaN(num) || num <= 0) {
      showToast('Invalid Amount', 'Please enter a valid stake amount.', 'error');
      return;
    }

    if (num > selectedAsset.walletBalance) {
      showToast('Insufficient Balance', `You have ${selectedAsset.walletBalance.toLocaleString()} ${selectedAsset.nativeSymbol} available in your wallet.`, 'error');
      return;
    }

    // Update state reactively for the specific selected asset
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id === selectedAsset.id) {
          return {
            ...a,
            walletBalance: a.walletBalance - num,
            stakedBalance: a.stakedBalance + num
          };
        }
        return a;
      })
    );

    playSound('fanfare');
    boostScore(25, `${selectedAsset.symbol} Liquid Staking Mint`);

    showToast(
      'Mint Successful',
      `Staked ${num.toLocaleString()} ${selectedAsset.nativeSymbol} and minted ${num.toLocaleString()} ${selectedAsset.symbol} (+25 CTS Points)!`,
      'success'
    );
    setActionModal(null);
  };

  const handleExecuteUnstake = () => {
    const num = parseFloat(unstakeInput);
    if (isNaN(num) || num <= 0) {
      showToast('Invalid Amount', 'Please enter a valid unstake amount.', 'error');
      return;
    }

    if (num > selectedAsset.stakedBalance) {
      showToast('Exceeds Staked Balance', `You have ${selectedAsset.stakedBalance.toLocaleString()} ${selectedAsset.symbol} staked.`, 'error');
      return;
    }

    // Update state reactively
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id === selectedAsset.id) {
          return {
            ...a,
            walletBalance: a.walletBalance + num,
            stakedBalance: a.stakedBalance - num
          };
        }
        return a;
      })
    );

    playSound('success');
    showToast(
      'Instant 0-Slip Unstake Complete',
      `Swapped ${num.toLocaleString()} ${selectedAsset.symbol} back to ${selectedAsset.nativeSymbol} via the 0-slippage unbonding reserve.`,
      'info'
    );
    setActionModal(null);
  };

  const toggleCompare = (protocolName: string) => {
    setSelectedCompare((prev) =>
      prev.includes(protocolName) ? prev.filter((p) => p !== protocolName) : [...prev, protocolName]
    );
  };

  return (
    <div className="space-y-6 font-sans select-none text-slate-200">
      {/* SIMULATED banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="SIMULATED LIQUID STAKING"
          note="stCTC mint, peg solvency and ledger are local simulations — no liquid staking contract is deployed on Creditcoin testnet."
        />
        <span className="font-mono">
          Staking amounts, APYs, epoch counts and the peg-solvency ledger are locally simulated;
          no liquid-staking contract exists on testnet. Global leaderboard rows are a static
          DefiLlama-inspired dataset.
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: Master Status & Enterprise Sub-Navigation
         ═══════════════════════════════════════════════════════════════════ */}
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
            <p className="text-xs text-slate-400 max-w-2xl">
              Stake 12 multi-chain crypto assets (CTC, ETH, SOL, BNB, AVAX, SUI, POL, ATOM, NEAR, APT, HBAR, MNT) to mint liquid yield tokens, earning continuous validator consensus rewards while retaining 100% portable collateral value for zero-collateral credit loans with zero unbonding lockups.
            </p>
          </div>

          {/* Quick Metrics & Live Epoch Countdown */}
          <div className="flex items-center gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/60 border border-cyan-500/20 text-center">
              <span className="text-[10px] text-slate-400 block">L1 Epoch</span>
              <span className="text-white font-bold">#14,291</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-cyan-500/20 text-center">
              <span className="text-[10px] text-slate-400 block">Next Epoch</span>
              <span className="text-cyan-300 font-bold">{Math.floor(epochSecRemaining / 60)}m {epochSecRemaining % 60}s</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-emerald-500/20 text-center">
              <span className="text-[10px] text-emerald-400 block">stCTC Peg</span>
              <span className="text-emerald-300 font-bold">1.0428 : 1.0</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/60 border border-purple-500/20 text-center">
              <span className="text-[10px] text-purple-400 block">Global TVL</span>
              <span className="text-purple-300 font-bold">$4.120B</span>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-cyan-500/15">
          {[
            { id: 'overview', label: 'Staking Dashboard & Portfolio', icon: Sliders },
            { id: 'cryptoquant', label: 'Peg Solvency & Liquidation Defense (CryptoQuant)', icon: Activity },
            { id: 'leaderboard', label: 'Global LST Leaderboard (DefiLlama)', icon: BarChart3 },
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
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: TOP STAKING ASSETS & PORTFOLIO HERO CARD
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Staking Assets Row + CredX Sovereign Vault Card */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Left: Top Staking Assets Multi-Card Grid (xl:col-span-8) */}
            <div className="xl:col-span-8 rounded-3xl p-5 bg-[#020d14] border border-cyan-500/20 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Top Staking Assets
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Stream ({cqLiveTick})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Click any asset card below to load into the active staking terminal.</span>
                </div>

                {/* Controls: Category Filter + Timeframe Switcher */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                  {/* Category Filter */}
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => setAssetFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        assetFilter === 'all'
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({assets.length})
                    </button>
                    <button
                      onClick={() => setAssetFilter('pos')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        assetFilter === 'pos'
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Proof of Stake ({assets.filter((a) => a.category === 'pos').length})
                    </button>
                    <button
                      onClick={() => setAssetFilter('defi')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        assetFilter === 'defi'
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      DeFi LSTs ({assets.filter((a) => a.category === 'defi').length})
                    </button>
                  </div>

                  {/* Dynamic Timeframe Switcher for Staking Dashboard */}
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
                    {(['1D', '7D', '1M', '1Y'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => {
                          setDashboardTimeframe(tf);
                          playSound('click');
                        }}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          dashboardTimeframe === tf
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf === '1D' ? '24h' : tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asset Cards Grid (Clickable to switch active staking position) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setStakeInput((asset.walletBalance * 0.25).toFixed(2));
                        setUnstakeInput((asset.stakedBalance * 0.25).toFixed(2));
                        playSound('click');
                        showToast(
                          'Active Staking Asset Selected',
                          `Loaded ${asset.name} (${asset.symbol}) into the active staking terminal.`,
                          'info'
                        );
                      }}
                      className={`p-4 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-[165px] border ${
                        isSelected
                          ? 'bg-[#031c26] border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.25)] scale-[1.02]'
                          : 'bg-black/50 border-white/10 hover:border-cyan-500/40 hover:bg-[#03151f]'
                      }`}
                    >
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{ backgroundColor: `${asset.color}20`, color: asset.color }}
                          >
                            {asset.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-mono uppercase">{asset.categoryLabel} &bull; {asset.chain}</span>
                            <span className="text-xs font-bold text-white truncate max-w-[120px] block">{asset.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-cyan-400 text-slate-950 uppercase font-mono">
                              ACTIVE
                            </span>
                          )}
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            asset.activeChange >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                          }`}>
                            {asset.activeChange >= 0 ? `+${asset.activeChange}%` : `${asset.activeChange}%`}
                          </span>
                        </div>
                      </div>

                      {/* Reward Rate & APY */}
                      <div className="space-y-0.5 pt-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Reward APY ({dashboardTimeframe}):</span>
                          <span>$${asset.priceUSD.toLocaleString()}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-mono font-black text-white">{asset.rewardRate.toFixed(2)}%</span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">Auto-Compounding</span>
                          {asset.stakedBalance > 0 && (
                            <span className="text-[10px] text-cyan-300 font-mono font-bold ml-auto">
                              {`${asset.stakedBalance.toFixed(2)} ${asset.symbol}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini Sparkline Curve */}
                      <div className="relative w-full h-[36px] pt-1">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id={`grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={asset.color} stopOpacity="0.35" />
                              <stop offset="100%" stopColor={asset.color} stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d={`M 0 25 Q 25 ${asset.activeChange >= 0 ? 12 : 22}, 50 ${asset.activeChange >= 0 ? 15 : 20} T 100 ${asset.activeChange >= 0 ? 4 : 26}`}
                            fill="none"
                            stroke={asset.color}
                            strokeWidth="2.2"
                          />
                          <path
                            d={`M 0 25 Q 25 ${asset.activeChange >= 0 ? 12 : 22}, 50 ${asset.activeChange >= 0 ? 15 : 20} T 100 ${asset.activeChange >= 0 ? 4 : 26} L 100 30 L 0 30 Z`}
                            fill={`url(#grad-${asset.id})`}
                          />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: CredX Liquid Staking Portfolio Hero Card (xl:col-span-4) */}
            <div className="xl:col-span-4 rounded-3xl p-6 bg-gradient-to-br from-[#201138] via-[#150a26] to-[#0b0515] border border-purple-500/35 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-purple-300 uppercase tracking-widest block font-bold">CredX Sovereign L1 Vault</span>
                      <h4 className="text-sm font-black text-white">Liquid Staking Portfolio</h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-[10px] font-mono text-purple-200">
                    Active
                  </span>
                </div>

                <p className="text-xs text-purple-200/80 leading-relaxed">
                  An enterprise multi-chain liquid staking portal allowing zero-unbonding-delay yield compounding &amp; portable credit collateral.
                </p>

                {/* Staked Position Overview for Selected Asset */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-purple-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300/70">Selected Asset</span>
                    <span className="text-white font-bold">{selectedAsset.name} ({selectedAsset.symbol})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300/70">Your Staked Position</span>
                    <span className="text-white font-bold">{(selectedAsset.stakedBalance + continuousTick).toFixed(5)} {selectedAsset.symbol}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300/70">Total Value USD</span>
                    <span className="text-emerald-300 font-bold">
                      $${((selectedAsset.stakedBalance + continuousTick) * selectedAsset.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300/70">Reward Rate</span>
                    <span className="text-cyan-300 font-bold">{selectedAsset.rewardRate.toFixed(2)}% APY</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="relative pt-4 space-y-2 font-mono">
                <button
                  onClick={() => {
                    setActionModal('stake');
                    playSound('click');
                  }}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-400 hover:from-purple-400 hover:to-indigo-400 text-white shadow-lg shadow-purple-500/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Stake &amp; Mint {selectedAsset.symbol}</span>
                </button>
                <button
                  onClick={() => {
                    setActionModal('unstake');
                    playSound('click');
                  }}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-purple-200 border border-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Instant 0-Slippage Unstake</span>
                </button>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              SECTION 2: "YOUR ACTIVE STAKINGS" (Dynamic for ANY Selected Asset)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="p-6 rounded-3xl bg-[#020f17] border border-cyan-500/25 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Real-time Node Telemetry</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-cyan-400" />
                  Your Active Stakings: <span className="text-cyan-300 font-mono">{selectedAsset.name} ({selectedAsset.symbol})</span>
                </h3>
              </div>

              {/* Asset Dropdown Switcher */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400">Switch Asset:</span>
                <select
                  value={selectedAssetId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedAssetId(newId);
                    const found = assets.find((a) => a.id === newId);
                    if (found) {
                      setStakeInput((found.walletBalance * 0.25).toFixed(2));
                      setUnstakeInput((found.stakedBalance * 0.25).toFixed(2));
                      playSound('click');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#041a24] border border-cyan-500/30 text-white font-mono text-xs font-bold outline-none cursor-pointer"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.symbol}) — {a.rewardRate.toFixed(2)}% APY
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setActionModal('stake');
                    playSound('click');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/30 transition cursor-pointer"
                >
                  + Stake More
                </button>
              </div>
            </div>

            {/* Main Active Position Card + Dynamic Slider Box */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Dynamic Staked Balance Hero Display (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: `${selectedAsset.color}25`, color: selectedAsset.color }}
                  >
                    {selectedAsset.symbol.slice(0, 2)}
                  </div>
                  <span className="text-sm font-bold text-white">Stake {selectedAsset.name}</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {selectedAsset.chain}
                  </span>
                </div>

                {/* Big Live Number Display with Continuous Accrual */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      {(selectedAsset.stakedBalance + continuousTick).toFixed(5)}
                    </span>
                    <span className="text-base font-bold" style={{ color: selectedAsset.color }}>
                      {selectedAsset.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                    <span>
                      &asymp; $${((selectedAsset.stakedBalance + continuousTick) * selectedAsset.priceUSD).toFixed(2)} USD
                    </span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{((selectedAsset.stakedBalance * (selectedAsset.rewardRate / 100)) / 365).toFixed(4)} {selectedAsset.symbol} / day
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setActionModal('stake');
                      playSound('click');
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition cursor-pointer shadow-md shadow-cyan-500/20"
                  >
                    Stake / Mint {selectedAsset.symbol}
                  </button>
                  <button
                    onClick={() => {
                      setActionModal('unstake');
                      playSound('click');
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold font-mono text-xs transition cursor-pointer"
                  >
                    Unstake
                  </button>
                </div>
              </div>

              {/* Investment Period Slider */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-black/60 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    Investment Period Projection ({selectedAsset.symbol})
                  </span>
                  <span className="text-xs font-mono text-cyan-300 font-bold">
                    Effective APY: {effectiveApy.toFixed(2)}%
                  </span>
                </div>

                {/* Milestones */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setInvestmentMonths(m)}
                        className={`cursor-pointer transition ${
                          investmentMonths === m ? 'text-cyan-300 font-bold scale-105' : 'hover:text-slate-200'
                        }`}
                      >
                        {m === 12 ? '1 Year' : `${m} Months`}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={investmentMonths}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const milestones = [1, 3, 6, 12];
                      const closest = milestones.reduce((prev, curr) =>
                        Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                      );
                      setInvestmentMonths(closest);
                    }}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Calculation Banner */}
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Projected Compounded Reward ({periodMultiplier.label})</span>
                    <span className="text-emerald-300 font-bold text-sm">
                      +{projectedReturnTokens.toFixed(4)} {selectedAsset.symbol} (+$${projectedReturnUSD.toFixed(2)} USD)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Auto-Restake Status</span>
                    <span className="text-cyan-300 font-bold">Continuous Compound</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Bottom Telemetry Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-white/5 font-mono">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] uppercase text-slate-400 block">Momentum ({dashboardTimeframe})</span>
                <span className={`text-lg font-bold ${selectedAsset.periodChanges[dashboardTimeframe] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedAsset.periodChanges[dashboardTimeframe] >= 0 ? `+${selectedAsset.periodChanges[dashboardTimeframe]}%` : `${selectedAsset.periodChanges[dashboardTimeframe]}%`}
                </span>
                <span className="text-[9px] text-slate-500 block">Active node velocity</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] uppercase text-slate-400 block">Asset Price</span>
                <span className="text-lg font-bold text-white">$${selectedAsset.priceUSD.toLocaleString()}</span>
                <span className="text-[9px] text-emerald-400 block">Live Price USD</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] uppercase text-slate-400 block">Risk Assessment</span>
                <span className="text-lg font-bold text-emerald-400">99.4% Safe</span>
                <span className="text-[9px] text-slate-500 block">{selectedAsset.slashingProtection}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] uppercase text-slate-400 block">Reward Spread</span>
                <span className="text-lg font-bold text-cyan-300">{selectedAsset.rewardRate.toFixed(2)}% – {(selectedAsset.rewardRate + 5.8).toFixed(2)}%</span>
                <span className="text-[9px] text-slate-500 block">Boosted by OCCR credit</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: CRYPTOQUANT PEG SOLVENCY (Dynamic Timeframe Switching)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cryptoquant' && (
        <div className="p-6 rounded-3xl bg-[#030d14] border border-cyan-500/30 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Creditcoin: Long Liquidations USD - All Exchanges, All Symbol
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Continuous on-chain monitoring of stCTC exchange peg price (USD) vs. protocol slashing &amp; liquidation defense absorption volume ($M).
              </p>
            </div>

            {/* Timeframe Switcher & Legend */}
            <div className="flex items-center gap-4 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                <span className="text-white">Price / Peg USD</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                <span className="text-emerald-400">Long Liquidations USD</span>
              </div>

              {/* Dynamic Timeframe Pills (1D, 7D, 1M, 3M, 1Y, ALL) */}
              <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
                {(['1D', '7D', '1M', '3M', '1Y', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setCqTimeframe(tf);
                      playSound('click');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      cqTimeframe === tf
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Indicators for Active Timeframe */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
            {/* KPI 1: Exchange Peg */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>stCTC Peg Rate</span>
                <span className="text-emerald-400 font-bold">{cqTimeframeMetrics.pegChangePct}</span>
              </div>
              <div className="text-lg font-black text-white">
                1.0428 <span className="text-xs text-cyan-300">: 1.0000</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                {cqTimeframeMetrics.timelineLabel}
              </span>
            </div>

            {/* KPI 2: Absorbed Volume */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Period Absorbed Vol</span>
                <span className="text-cyan-400 font-bold">{cqTimeframe} Active</span>
              </div>
              <div className="text-lg font-black text-emerald-400">
                {cqTimeframeMetrics.totalVolume}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                Ingestion: {cqTimeframeMetrics.feedIngestion}
              </span>
            </div>

            {/* KPI 3: Max Stress Absorption Event */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Peak Stress Absorption</span>
                <span className="text-amber-400 font-bold">{cqTimeframeMetrics.eventCount} Spikes</span>
              </div>
              <div className="text-lg font-black text-white">
                {cqTimeframeMetrics.peakLiquidation}
              </div>
              <span className={`text-[10px] font-bold block truncate ${cqTimeframeMetrics.stressColor}`}>
                {cqTimeframeMetrics.stressStatus}
              </span>
            </div>

            {/* KPI 4: Live WebSocket Status */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync Feed
                </span>
                <span className="text-slate-400">12ms</span>
              </div>
              <div className="text-lg font-black text-cyan-300 flex items-center gap-1">
                <span>#14,291</span>
                <span className="text-xs text-slate-400">.{cqLiveTick}</span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                Reserve: $50M Sovereign L1 Shield
              </span>
            </div>
          </div>

          {/* CryptoQuant Live Canvas */}
          <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-[#050a0f] border border-white/10">
            <canvas
              ref={cqCanvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => setCqHoverIndex(null)}
              className="w-full h-full block cursor-crosshair"
            />

            {/* Interactive Hover Tooltip */}
            {cqHoverIndex !== null && cqData[cqHoverIndex] && (
              <div className="absolute top-4 left-14 pointer-events-none p-3 rounded-xl bg-black/95 border border-emerald-500/40 font-mono text-xs shadow-2xl space-y-1">
                <div className="text-[10px] text-slate-400">{cqData[cqHoverIndex].date} &bull; Timeframe: {cqTimeframe}</div>
                <div className="text-white">
                  Peg Price: <strong className="text-cyan-300 font-bold">$${cqData[cqHoverIndex].pegPrice.toFixed(4)} USD</strong>
                </div>
                <div className="text-emerald-400">
                  Slashing Absorption: <strong className="font-bold">$${cqData[cqHoverIndex].liquidationBufferUSD}M USD</strong>
                </div>
                {cqData[cqHoverIndex].isAlertTrigger && (
                  <div className="text-[10px] text-rose-400 font-bold uppercase">
                    &bull; Liquidation Absorption Spike (100% Reserve Backed)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Telemetry Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs pt-2">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Red Dashed Circles</span>
              <p className="text-slate-300 text-[11px]">
                Historical liquidation stress events absorbed with 0 de-pegging via the Creditcoin L1 insurance reserve.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Green Vertical Bars</span>
              <p className="text-slate-300 text-[11px]">
                Volume of liquidated debt instantly absorbed without reducing continuous stCTC staking yields.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase block">Timeframe Status</span>
              <p className="text-slate-300 text-[11px]">
                Active Feed: <strong className="text-emerald-400">{cqTimeframe} Resolution</strong> &bull; Non-decreasing peg ratio.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: GLOBAL LST LEADERBOARD (Updated Global Ecosystem Data)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leaderboard' && (
        <div className="p-6 rounded-3xl bg-[#020e17] border border-cyan-500/25 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Global Liquid Staking Leaderboard
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Verified real-time TVL, APY, and price momentum across global liquid staking protocols (DefiLlama API Sync).
              </p>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search protocol or token..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white outline-none focus:border-cyan-400 w-56"
                />
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#03151f] text-slate-400 text-[11px] border-b border-white/10">
                <tr>
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4 w-20 text-center">Compare</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 text-right">APY</th>
                  <th className="py-3 px-4 text-right">1d Change</th>
                  <th className="py-3 px-4 text-right">7d Change</th>
                  <th className="py-3 px-4 text-right">1m Change</th>
                  <th className="py-3 px-4 text-right">TVL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProtocols.map((proto) => {
                  const isChecked = selectedCompare.includes(proto.name);
                  return (
                    <tr
                      key={proto.rank}
                      className={`hover:bg-white/5 transition ${
                        proto.isCredX ? 'bg-cyan-950/25 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 font-bold text-white">
                        {proto.rank}
                      </td>

                      {/* Compare Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleCompare(proto.name)}
                          className="text-slate-400 hover:text-cyan-300 transition cursor-pointer inline-flex items-center justify-center"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name & Chain */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{proto.name}</span>
                          <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                            {proto.chain}
                          </span>
                          {proto.isCredX && (
                            <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-400/30">
                              L1 Native
                            </span>
                          )}
                        </div>
                      </td>

                      {/* APY */}
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        {proto.apy.toFixed(2)}%
                      </td>

                      {/* 1d Change */}
                      <td className={`py-3.5 px-4 text-right ${proto.change1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {proto.change1d >= 0 ? `+${proto.change1d.toFixed(2)}%` : `${proto.change1d.toFixed(2)}%`}
                      </td>

                      {/* 7d Change */}
                      <td className={`py-3.5 px-4 text-right ${proto.change7d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {proto.change7d >= 0 ? `+${proto.change7d.toFixed(2)}%` : `${proto.change7d.toFixed(2)}%`}
                      </td>

                      {/* 1m Change */}
                      <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                        +{proto.change1m.toFixed(2)}%
                      </td>

                      {/* TVL */}
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {proto.tvl}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: MULTI-ASSET STAKE & INSTANT UNSTAKE
         ═══════════════════════════════════════════════════════════════════ */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl p-6 bg-[#03151f] border border-cyan-500/40 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-mono text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                {actionModal === 'stake' ? (
                  <>
                    <Zap className="w-5 h-5 text-cyan-400" />
                    <span>Stake &amp; Mint {selectedAsset.symbol}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 text-cyan-400" />
                    <span>Instant 0-Slippage Unstake ({selectedAsset.symbol})</span>
                  </>
                )}
              </h4>
              <button
                onClick={() => setActionModal(null)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            {actionModal === 'stake' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Deposit {selectedAsset.nativeSymbol} ({selectedAsset.chain})</span>
                    <span>Wallet: <strong className="text-white">{selectedAsset.walletBalance.toLocaleString()} {selectedAsset.nativeSymbol}</strong></span>
                  </div>
                  <input
                    type="number"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-transparent text-2xl font-bold text-cyan-300 outline-none"
                  />
                  <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setStakeInput(((selectedAsset.walletBalance * pct) / 100).toFixed(2))}
                        className="px-2 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 transition cursor-pointer"
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mint Ratio:</span>
                    <span className="text-white font-bold">1 {selectedAsset.nativeSymbol} = 1 {selectedAsset.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Validator APR:</span>
                    <span className="text-emerald-400 font-bold">{selectedAsset.rewardRate.toFixed(2)}% (Continuous Auto-Compound)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Slashing Protection:</span>
                    <span className="text-cyan-300 font-bold">{selectedAsset.slashingProtection}</span>
                  </div>
                </div>

                <button
                  onClick={handleExecuteStake}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-xl shadow-cyan-500/30 transition cursor-pointer"
                >
                  Confirm Stake &amp; Mint {selectedAsset.symbol}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Unstake {selectedAsset.symbol}</span>
                    <span>Staked: <strong className="text-cyan-300">{selectedAsset.stakedBalance.toLocaleString()} {selectedAsset.symbol}</strong></span>
                  </div>
                  <input
                    type="number"
                    value={unstakeInput}
                    onChange={(e) => setUnstakeInput(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-transparent text-2xl font-bold text-white outline-none"
                  />
                  <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setUnstakeInput(((selectedAsset.stakedBalance * pct) / 100).toFixed(2))}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition cursor-pointer"
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unbonding Fee:</span>
                    <span className="text-emerald-400 font-bold">0.00% (Instant Reserve)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Settlement Speed:</span>
                    <span className="text-white font-bold">Immediate (Single-Block)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Receive Asset:</span>
                    <span className="text-cyan-300 font-bold">Native {selectedAsset.nativeSymbol} ({selectedAsset.chain})</span>
                  </div>
                </div>

                <button
                  onClick={handleExecuteUnstake}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/15 hover:bg-white/25 text-white shadow-xl transition cursor-pointer"
                >
                  Instant Unstake to Native {selectedAsset.nativeSymbol}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidStakingView;
