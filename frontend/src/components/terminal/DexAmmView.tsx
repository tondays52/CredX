import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import SimulationBadge from '../common/SimulationBadge';
import {
  fetchAMMState,
  addAMMLiquidity,
  removeAMMLiquidity,
  swapViaAMM,
  fetchCUSDBalance,
  txHashShort,
} from '../../services/credXService';
import {
  ArrowLeftRight,
  TrendingUp,
  Settings,
  ChevronDown,
  ArrowDownUp,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Layers,
  Check,
  Flame,
  BarChart2,
  Info
} from 'lucide-react';

export interface SwapToken {
  symbol: string;
  name: string;
  priceUSD: number;
  balance: number;
  decimals: number;
  iconBg: string;
  iconText: string;
  color: string;
  satsRate: number;
  change24h: number;
  volume24h: string;
  marketCap: string;
  supply: string;
  holders: string;
  category: string;
  address?: string;
}

interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

type AMMState = NonNullable<Awaited<ReturnType<typeof fetchAMMState>>>;

const AVAILABLE_TOKENS: Record<string, SwapToken> = {
  CTC: {
    symbol: 'CTC',
    name: 'Creditcoin L1 Native',
    priceUSD: 2.08,
    balance: 10000,
    decimals: 18,
    iconBg: '#042f2e',
    iconText: 'CTC',
    color: '#00f2fe',
    satsRate: 3240,
    change24h: 5.21,
    volume24h: '$1.24M',
    marketCap: '$381.2M',
    supply: '99.98M CTC',
    holders: '93,276',
    category: 'Creditcoin L1 Consensus'
  },
  stCTC: {
    symbol: 'stCTC',
    name: 'Liquid Staked Creditcoin',
    priceUSD: 2.16,
    balance: 2450,
    decimals: 18,
    iconBg: '#064e3b',
    iconText: 'stCTC',
    color: '#34d399',
    satsRate: 3360,
    change24h: 7.80,
    volume24h: '$840.5K',
    marketCap: '$142.6M',
    supply: '66.02M stCTC',
    holders: '41,890',
    category: 'Sovereign LST'
  },
  cUSD: {
    symbol: 'cUSD',
    name: 'Creditcoin Stable USD',
    priceUSD: 1.00,
    balance: 25000,
    decimals: 18,
    iconBg: '#083344',
    iconText: 'cUSD',
    color: '#38bdf8',
    satsRate: 1555,
    change24h: 0.02,
    volume24h: '$3.85M',
    marketCap: '$210.0M',
    supply: '210.00M cUSD',
    holders: '118,450',
    category: 'L1 Pegged Stable'
  },
  tbUSD: {
    symbol: 'tbUSD',
    name: 'Treasury Backed USD',
    priceUSD: 1.00,
    balance: 5000,
    decimals: 18,
    iconBg: '#1e1b4b',
    iconText: 'tbUSD',
    color: '#818cf8',
    satsRate: 1555,
    change24h: 0.01,
    volume24h: '$1.12M',
    marketCap: '$95.4M',
    supply: '95.40M tbUSD',
    holders: '28,120',
    category: 'RWA Vault Asset'
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin (Wrapped CredX)',
    priceUSD: 64280.50,
    balance: 0.45,
    decimals: 8,
    iconBg: '#451a03',
    iconText: 'BTC',
    color: '#f59e0b',
    satsRate: 100000000,
    change24h: 2.14,
    volume24h: '$18.4M',
    marketCap: '$1.26T',
    supply: '19.7M BTC',
    holders: '840,200',
    category: 'Cross-Chain Runes'
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum (CredX Bridge)',
    priceUSD: 3485.40,
    balance: 3.20,
    decimals: 18,
    iconBg: '#1e1e38',
    iconText: 'ETH',
    color: '#a78bfa',
    satsRate: 5422000,
    change24h: -0.85,
    volume24h: '$9.2M',
    marketCap: '$418.5M',
    supply: '120.2M ETH',
    holders: '512,000',
    category: 'EVM Layer 1'
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana (Wormhole)',
    priceUSD: 152.40,
    balance: 18.5,
    decimals: 9,
    iconBg: '#2e1065',
    iconText: 'SOL',
    color: '#c084fc',
    satsRate: 237000,
    change24h: 4.62,
    volume24h: '$4.6M',
    marketCap: '$71.2B',
    supply: '467.1M SOL',
    holders: '320,100',
    category: 'High-Throughput L1'
  },
  DEPIN: {
    symbol: 'DEPIN',
    name: 'DePIN Infrastructure Unit',
    priceUSD: 4.50,
    balance: 1200,
    decimals: 18,
    iconBg: '#14532d',
    iconText: 'DPN',
    color: '#4ade80',
    satsRate: 7000,
    change24h: 9.35,
    volume24h: '$620.0K',
    marketCap: '$45.0M',
    supply: '10.0M DEPIN',
    holders: '19,500',
    category: 'CredX DePIN Track'
  }
};

interface TransactionItem {
  id: string;
  type: 'Swap' | 'Add Liquidity' | 'Remove Liquidity';
  details: string;
  txHash: string;
  status: 'Confirmed' | 'Pending' | 'Failed';
  time: string;
}

export const DexAmmView: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { boostScore } = useProtocol();
  const { showToast, playSound } = useToast();

  // Selected Active Primary Token for Header & Chart
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('CTC');

  // Swap Form State
  const [fromToken, setFromToken] = useState<string>('CTC');
  const [toToken, setToToken] = useState<string>('cUSD');
  const [fromAmount, setFromAmount] = useState<string>('0.50');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.1);
  const [isSlippageOpen, setIsSlippageOpen] = useState<boolean>(false);
  const [isRouteExpanded, setIsRouteExpanded] = useState<boolean>(true);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Timeframe for Price Chart
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1D');

  // Mentions Checkbox States
  const [mentionFilters, setMentionFilters] = useState<Record<string, boolean>>({
    'CredX L1 Mentions': true,
    'DEX Swaps 24h': true,
    'Staking Inflows': false,
    'Bridge Volume': false,
    'Social Echoes': false
  });

  // Recent Transactions Stream
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Canvas Refs
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sentimentCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ammState, setAmmState] = useState<AMMState | null>(null);
  const [poolLoading, setPoolLoading] = useState<boolean>(false);
  const [cusdBalance, setCusdBalance] = useState<number>(0);
  const [depositAmt0, setDepositAmt0] = useState<string>('');
  const [depositAmt1, setDepositAmt1] = useState<string>('');
  const [withdrawAmt, setWithdrawAmt] = useState<string>('');
  const [poolBusy, setPoolBusy] = useState<'deposit' | 'withdraw' | null>(null);

  const poolLive = ammState !== null;

  const refreshPoolState = useCallback(async () => {
    if (!isConnected || !address) {
      setAmmState(null);
      setCusdBalance(0);
      return;
    }
    setPoolLoading(true);
    try {
      const s = await fetchAMMState(address);
      setAmmState(s);
      if (s) {
        setFromToken((prev) => (prev === s.token0.symbol || prev === s.token1.symbol ? prev : s.token0.symbol));
        setToToken((prev) => (prev === s.token0.symbol || prev === s.token1.symbol ? prev : s.token1.symbol));
      }
    } catch {
      setAmmState(null);
    } finally {
      setPoolLoading(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    void refreshPoolState();
  }, [refreshPoolState]);

  useEffect(() => {
    if (!isConnected || !address) {
      setCusdBalance(0);
      return;
    }
    let cancelled = false;
    fetchCUSDBalance(address)
      .then((bal) => { if (!cancelled) setCusdBalance(bal); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isConnected, address]);

  const poolTokens = useMemo<SwapToken[]>(() => {
    if (!ammState) return [];
    const synth = (meta: TokenMeta, index: number): SwapToken => {
      const known = AVAILABLE_TOKENS[meta.symbol];
      if (known) return { ...known, address: meta.address, decimals: meta.decimals };
      const other = index === 0 ? ammState.token1 : ammState.token0;
      const otherKnown = AVAILABLE_TOKENS[other.symbol];
      let priceUSD = 0;
      if (otherKnown && ammState.reserve0 > 0) {
        priceUSD = index === 0
          ? (otherKnown.priceUSD * ammState.reserve1) / ammState.reserve0
          : (otherKnown.priceUSD * ammState.reserve0) / ammState.reserve1;
      }
      return {
        symbol: meta.symbol,
        name: meta.name || meta.symbol,
        priceUSD,
        balance: 0,
        decimals: meta.decimals,
        iconBg: index === 0 ? '#042f2e' : '#083344',
        iconText: meta.symbol.slice(0, 3),
        color: index === 0 ? '#00f2fe' : '#38bdf8',
        satsRate: 0,
        change24h: 0,
        volume24h: '—',
        marketCap: '—',
        supply: '—',
        holders: '—',
        category: 'AMM Pool Asset',
        address: meta.address,
      };
    };
    return [synth(ammState.token0, 0), synth(ammState.token1, 1)];
  }, [ammState]);

  const swapTokenLookup = useMemo(() => {
    const map: Record<string, SwapToken> = { ...AVAILABLE_TOKENS };
    poolTokens.forEach((t) => { map[t.symbol] = t; });
    return map;
  }, [poolTokens]);

  const swapTokenKeys = useMemo(() => {
    if (ammState) return poolTokens.map((t) => t.symbol);
    return Object.keys(AVAILABLE_TOKENS);
  }, [ammState, poolTokens]);

  // Active Token Objects
  const activeToken = AVAILABLE_TOKENS[selectedTokenKey] || AVAILABLE_TOKENS.CTC;
  const fromTokenObj = swapTokenLookup[fromToken] || AVAILABLE_TOKENS.CTC;
  const toTokenObj = swapTokenLookup[toToken] || AVAILABLE_TOKENS.cUSD;

  // Real-time Live Price Tick Simulation
  const [liveTick, setLiveTick] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTick((prev) => prev + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Compute Swap Exchange Rates
  const poolQuote = useMemo(() => {
    if (!ammState) return null;
    if (fromTokenObj.symbol === ammState.token0.symbol && toTokenObj.symbol === ammState.token1.symbol) {
      return { rate: ammState.quote0To1, real: true };
    }
    if (fromTokenObj.symbol === ammState.token1.symbol && toTokenObj.symbol === ammState.token0.symbol) {
      return { rate: ammState.quote1To0, real: true };
    }
    return null;
  }, [ammState, fromTokenObj, toTokenObj]);

  const pToken0Usd = useMemo(() => {
    if (!ammState) return null;
    const k0 = AVAILABLE_TOKENS[ammState.token0.symbol];
    if (k0) return k0.priceUSD;
    const k1 = AVAILABLE_TOKENS[ammState.token1.symbol];
    if (k1 && ammState.reserve0 > 0) return (k1.priceUSD * ammState.reserve1) / ammState.reserve0;
    return null;
  }, [ammState]);

  const pToken1Usd = useMemo(() => {
    if (!ammState) return null;
    const k1 = AVAILABLE_TOKENS[ammState.token1.symbol];
    if (k1) return k1.priceUSD;
    if (pToken0Usd != null && ammState.reserve1 > 0) return (pToken0Usd * ammState.reserve0) / ammState.reserve1;
    return null;
  }, [ammState, pToken0Usd]);

  const poolTvl = useMemo(() => {
    if (!ammState || pToken0Usd == null || pToken1Usd == null) return null;
    return ammState.reserve0 * pToken0Usd + ammState.reserve1 * pToken1Usd;
  }, [ammState, pToken0Usd, pToken1Usd]);

  const reserve0Pct = useMemo(() => {
    if (!ammState || poolTvl == null || pToken0Usd == null) return null;
    return (ammState.reserve0 * pToken0Usd) / poolTvl;
  }, [ammState, poolTvl, pToken0Usd]);

  const lpSharePct = useMemo(() => {
    if (!ammState || ammState.lpTotalSupply <= 0) return null;
    return (ammState.lpBalance / ammState.lpTotalSupply) * 100;
  }, [ammState]);

  const rateFromTo = fromTokenObj.priceUSD / toTokenObj.priceUSD;
  const swapRate = poolQuote ? poolQuote.rate : rateFromTo;
  const fromAmtNum = parseFloat(fromAmount) || 0;
  const estimatedReceive = (fromAmtNum * swapRate * (poolQuote ? 1 : 1 - 0.0005)).toFixed(toTokenObj.priceUSD < 1 ? 6 : 4);
  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const fromBalance = useMemo(() => {
    if (ammState) {
      if (fromTokenObj.symbol === 'cUSD') return cusdBalance;
      if (fromTokenObj.symbol === 'CTC') return balanceCTC > 0 ? balanceCTC : 0;
      return 0;
    }
    return fromToken === 'CTC' ? userWalletCTC : fromTokenObj.balance;
  }, [ammState, fromToken, fromTokenObj, cusdBalance, balanceCTC, userWalletCTC]);

  // Handle Max Button
  const handleMaxPay = () => {
    setFromAmount(fromBalance.toString());
  };

  // Swap Direction Flip
  const handleFlipDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setSelectedTokenKey(toToken);
  };

  // Execute Swap
  const handleExecuteSwap = async () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }

    if (!isConnected || !address) {
      showToast('Connect a Wallet', 'Connect a wallet to execute swaps on Creditcoin Testnet.', 'error');
      return;
    }

    if (!ammState) {
      showToast('Pool Unavailable', 'Could not read the live ReputationAMM pool. Try reconnecting your wallet.', 'error');
      return;
    }

    if (fromAmtNum <= 0) {
      showToast('Invalid Amount', 'Please enter a valid amount to swap.', 'error');
      return;
    }

    if (fromAmtNum > fromBalance) {
      showToast('Insufficient Balance', `You only have ${fromBalance.toLocaleString()} ${fromToken}.`, 'error');
      return;
    }

    const tokenIn = poolTokens.find((t) => t.symbol === fromToken);
    if (!tokenIn?.address) {
      showToast('Unsupported Pair', `${fromToken} is not a token in the live ReputationAMM pool.`, 'error');
      return;
    }

    setIsSwapping(true);
    playSound('click');

    try {
      const hash = await swapViaAMM(fromAmtNum, tokenIn.address, address);
      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        type: 'Swap',
        details: `${fromAmtNum.toLocaleString()} ${fromToken} → ${estimatedReceive} ${toToken}`,
        txHash: txHashShort(hash),
        status: 'Confirmed',
        time: 'Just now'
      };
      setTransactions((prev) => [newTx, ...prev.slice(0, 4)]);
      boostScore(25, 'DEX Liquidity Swap');
      playSound('fanfare');

      if (isPostHogEnabled) {
        posthog.capture('swap_executed', {
          from_token: fromToken,
          to_token: toToken,
          amount: fromAmtNum,
          estimated_receive: Number(estimatedReceive)
        });
      }

      void refreshPoolState();

      showToast(
        'Swap Executed on Creditcoin L1',
        `Swapped ${fromAmtNum} ${fromToken} for ≈ ${estimatedReceive} ${toToken} — tx ${txHashShort(hash)}.`,
        'success',
        4500
      );
    } catch (err: any) {
      showToast(
        'Swap Failed',
        err?.shortMessage || err?.message || 'Transaction rejected — the pool may have reverted your swap.',
        'error',
        5000
      );
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }

    if (!isConnected || !address || !ammState) {
      showToast('Connect a Wallet', 'Connect a wallet to add liquidity on Creditcoin Testnet.', 'error');
      return;
    }

    const a0 = parseFloat(depositAmt0) || 0;
    const a1 = parseFloat(depositAmt1) || 0;
    if (a0 <= 0 || a1 <= 0) {
      showToast('Invalid Amounts', 'Enter both token amounts to add liquidity.', 'error');
      return;
    }

    setPoolBusy('deposit');
    playSound('click');

    try {
      const hash = await addAMMLiquidity(a0, a1);
      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        type: 'Add Liquidity',
        details: `${a0.toLocaleString()} ${ammState.token0.symbol} + ${a1.toLocaleString()} ${ammState.token1.symbol}`,
        txHash: txHashShort(hash),
        status: 'Confirmed',
        time: 'Just now'
      };
      setTransactions((prev) => [newTx, ...prev.slice(0, 4)]);
      setDepositAmt0('');
      setDepositAmt1('');
      playSound('fanfare');
      void refreshPoolState();
      showToast(
        'Liquidity Added',
        `Deposited ${a0} ${ammState.token0.symbol} + ${a1} ${ammState.token1.symbol} — tx ${txHashShort(hash)}.`,
        'success',
        4500
      );
    } catch (err: any) {
      showToast(
        'Add Liquidity Failed',
        err?.shortMessage || err?.message || 'Transaction rejected.',
        'error',
        5000
      );
    } finally {
      setPoolBusy(null);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }

    if (!isConnected || !address || !ammState) {
      showToast('Connect a Wallet', 'Connect a wallet to remove liquidity on Creditcoin Testnet.', 'error');
      return;
    }

    const lp = parseFloat(withdrawAmt) || 0;
    if (lp <= 0) {
      showToast('Invalid Amount', 'Enter LP tokens to withdraw.', 'error');
      return;
    }

    setPoolBusy('withdraw');
    playSound('click');

    try {
      const hash = await removeAMMLiquidity(lp);
      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        type: 'Remove Liquidity',
        details: `${lp.toLocaleString()} LP from ${ammState.token0.symbol}/${ammState.token1.symbol}`,
        txHash: txHashShort(hash),
        status: 'Confirmed',
        time: 'Just now'
      };
      setTransactions((prev) => [newTx, ...prev.slice(0, 4)]);
      setWithdrawAmt('');
      playSound('fanfare');
      void refreshPoolState();
      showToast(
        'Liquidity Removed',
        `Withdrawn ${lp.toLocaleString()} LP — tx ${txHashShort(hash)}.`,
        'success',
        4500
      );
    } catch (err: any) {
      showToast(
        'Remove Liquidity Failed',
        err?.shortMessage || err?.message || 'Transaction rejected.',
        'error',
        5000
      );
    } finally {
      setPoolBusy(null);
    }
  };

  // ─── Dual-Line Price Chart Canvas ──────────────────────────────────────────
  const chartPoints = useMemo(() => {
    const count = timeframe === '1D' ? 32 : timeframe === '1W' ? 40 : timeframe === '1M' ? 50 : 64;
    const basePrice = activeToken.priceUSD;
    const pointsA: number[] = [];
    const pointsB: number[] = [];

    let currentA = basePrice * 0.94;
    let currentB = basePrice * 0.90;

    for (let i = 0; i < count; i++) {
      const noiseA = (Math.sin(i * 0.35 + liveTick * 0.1) + (Math.random() - 0.48)) * (basePrice * 0.015); // NOSONAR
      const noiseB = (Math.cos(i * 0.28 + liveTick * 0.08) + (Math.random() - 0.5)) * (basePrice * 0.012); // NOSONAR

      currentA += noiseA;
      currentB += noiseB;

      currentA = Math.max(currentA, basePrice * 0.7);
      currentB = Math.max(currentB, basePrice * 0.65);

      pointsA.push(currentA);
      pointsB.push(currentB);
    }

    pointsA[pointsA.length - 1] = basePrice;
    pointsB[pointsB.length - 1] = basePrice * 0.96;

    return { pointsA, pointsB, count };
  }, [timeframe, activeToken.priceUSD, liveTick]);

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

    const { pointsA, pointsB, count } = chartPoints;
    const minVal = Math.min(...pointsA, ...pointsB) * 0.98;
    const maxVal = Math.max(...pointsA, ...pointsB) * 1.02;
    const range = maxVal - minVal || 1;

    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Subtle Horizontal Grid
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
      ctx.fillText(`$${val < 10 ? val.toFixed(2) : val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, padLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    // Curve B (Secondary Purple Benchmark)
    ctx.beginPath();
    pointsB.forEach((val, idx) => {
      const x = padLeft + (idx / (count - 1)) * chartW;
      const y = padTop + chartH - ((val - minVal) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else {
        const prevX = padLeft + ((idx - 1) / (count - 1)) * chartW;
        const prevY = padTop + chartH - ((pointsB[idx - 1] - minVal) / range) * chartH;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Curve A (Primary Cyan Token Price) with Glow Area
    ctx.beginPath();
    pointsA.forEach((val, idx) => {
      const x = padLeft + (idx / (count - 1)) * chartW;
      const y = padTop + chartH - ((val - minVal) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else {
        const prevX = padLeft + ((idx - 1) / (count - 1)) * chartW;
        const prevY = padTop + chartH - ((pointsA[idx - 1] - minVal) / range) * chartH;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });

    // Area Fill
    ctx.save();
    const lastX = padLeft + chartW;
    const lastY = padTop + chartH;
    ctx.lineTo(lastX, lastY);
    ctx.lineTo(padLeft, lastY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, lastY);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.22)');
    grad.addColorStop(0.7, 'rgba(0, 242, 254, 0.03)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Primary Stroke with Glow
    ctx.beginPath();
    pointsA.forEach((val, idx) => {
      const x = padLeft + (idx / (count - 1)) * chartW;
      const y = padTop + chartH - ((val - minVal) / range) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else {
        const prevX = padLeft + ((idx - 1) / (count - 1)) * chartW;
        const prevY = padTop + chartH - ((pointsA[idx - 1] - minVal) / range) * chartH;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Latest Live Pulsing Dot
    const currentX = padLeft + chartW;
    const currentY = padTop + chartH - ((pointsA[pointsA.length - 1] - minVal) / range) * chartH;

    ctx.beginPath();
    ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Timeframe X-axis Labels
    const timeLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'];
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    timeLabels.forEach((lbl, i) => {
      const x = padLeft + (i / (timeLabels.length - 1)) * chartW;
      ctx.fillText(lbl, x, height - 8);
    });
  }, [chartPoints]);

  // ─── Social Sentiment Donut Gauge Canvas ──────────────────────────────────
  useEffect(() => {
    const canvas = sentimentCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 130;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 48;
    const lineWidth = 12;

    ctx.clearRect(0, 0, size, size);

    // Segments: Positive 36%, Neutral 56%, Negative 8%
    const segments = [
      { pct: 0.36, color: '#00f2fe' },
      { pct: 0.56, color: '#fb923c' },
      { pct: 0.08, color: '#f43f5e' }
    ];

    let startAngle = -Math.PI / 2;
    const gap = 0.04;

    segments.forEach((seg) => {
      const arcLen = seg.pct * (Math.PI * 2) - gap;
      const endAngle = startAngle + arcLen;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      startAngle = endAngle + gap;
    });

    // Center Text "Total 100%"
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Total', cx, cy - 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('100%', cx, cy + 8);
  }, []);

  return (
    <div className="space-y-6 text-slate-200">
      {/* ═══════════════════════════════════════════════════════════════
          1. Header & Active Token Selector (Bitflow Reference Top)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-[#020d12] border border-cyan-500/20 shadow-xl">
        <div className="flex items-center gap-3.5">
          {/* Token Avatar Badge */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-lg border border-cyan-400/40"
            style={{ backgroundColor: activeToken.iconBg, color: activeToken.color }}
          >
            {activeToken.iconText}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                {activeToken.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-bold">
                {activeToken.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>Token ID: <strong className="text-white">#{selectedTokenKey}-L1</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Precompile 0x0FD2 AMM
              </span>
            </p>
          </div>
        </div>

        {/* Quick Token Switch Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400">Inspect Asset:</label>
          <select
            value={selectedTokenKey}
            onChange={(e) => {
              setSelectedTokenKey(e.target.value);
              setFromToken((prev) => (ammState ? prev : e.target.value));
            }}
            className="px-3.5 py-2 rounded-xl bg-[#031720] border border-cyan-500/40 text-cyan-300 font-bold font-mono text-xs outline-none cursor-pointer hover:border-cyan-400 transition shadow-inner"
          >
            {Object.keys(AVAILABLE_TOKENS).map((k) => (
              <option key={k} value={k} className="bg-[#020e14] text-white">
                {AVAILABLE_TOKENS[k].symbol} - {AVAILABLE_TOKENS[k].name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. Primary DEX Terminal Grid (Bitflow Reference Layout)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─────────────────────────────────────────────────────────────
            LEFT COLUMN (7 cols): Token Stats, Dual-Line Chart, Mentions & Sentiment
           ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card A: Token Stats Bar */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" /> Token Stats
              </span>
              <SimulationBadge label="DEMO MARKET DATA" note="Illustrative token market metadata — no price oracle contract is read for these stats." />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Stat 1: Price */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Price</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  ${activeToken.priceUSD.toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span>{activeToken.satsRate.toLocaleString()} sats</span>
                  <span>↗ +{activeToken.change24h}%</span>
                </div>
              </div>

              {/* Stat 2: Volume 24h */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Volume (24h)</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {activeToken.volume24h}
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  ↗ +11.75%
                </div>
              </div>

              {/* Stat 3: Market Cap */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Market Cap</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {activeToken.marketCap}
                </div>
                <div className="text-[10px] font-mono text-cyan-300">
                  +$108.22M
                </div>
              </div>

              {/* Stat 4: Supply */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Supply</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {activeToken.supply}
                </div>
                <div className="text-[10px] font-mono text-teal-400">
                  100% Minted
                </div>
              </div>

              {/* Stat 5: Holders */}
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 font-mono">Holders</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {activeToken.holders}
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  ↗ +5.75%
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Interactive Token Price Dual-Line Chart */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-1.5">
                  Token Price
                  <SimulationBadge label="ILLUSTRATIVE CHART" note="Price candles are drawn from mocked data. Live pool stats and swap quotes come from the ReputationAMM contract." />
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black font-mono text-white">
                    ${activeToken.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{activeToken.change24h}%
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({activeToken.satsRate.toLocaleString()} sats)
                  </span>
                </div>
              </div>

              {/* Timeframe Pills */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px]">
                {(['1D', '1W', '1M', '1Y', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      timeframe === tf
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Dual-Line Chart Canvas */}
            <div className="relative w-full h-[240px] bg-[#01080b] rounded-2xl border border-white/5 overflow-hidden">
              <canvas ref={chartCanvasRef} className="w-full h-full block" />

              {/* Legend Badges */}
              <div className="absolute top-3 left-4 flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2fe]" />
                  {activeToken.symbol} Spot Price (USD)
                </span>
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                  Ecosystem Benchmark Index
                </span>
              </div>
            </div>
          </div>

          {/* Card C & D: Mentions Stream & Social Sentiment Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Mentions & Signal Matrix (5 cols) */}
            <div className="md:col-span-5 p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Mentions & Velocity
                <SimulationBadge label="SIMULATED" />
              </span>

              <div className="space-y-2.5 pt-1">
                {Object.keys(mentionFilters).map((itemKey, idx) => {
                  const isChecked = mentionFilters[itemKey];
                  return (
                    <div
                      key={itemKey}
                      onClick={() =>
                        setMentionFilters((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
                      }
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isChecked
                          ? 'bg-cyan-500/10 border-cyan-400/40 text-white'
                          : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition ${
                            isChecked
                              ? 'bg-cyan-400 border-cyan-400 text-slate-950 font-black'
                              : 'border-white/30 bg-transparent'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-medium">{itemKey}</span>
                      </div>

                      {/* Mini Sparkline + Count */}
                      <div className="flex items-center gap-2">
                        <svg width="34" height="14" className="stroke-cyan-400 fill-none stroke-[1.5]">
                          <path
                            d={
                              idx % 2 === 0
                                ? 'M1 10 Q 8 2, 16 9 T 32 4'
                                : 'M1 4 Q 10 12, 18 3 T 32 8'
                            }
                          />
                        </svg>
                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {994 - idx * 120}K
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Social Sentiment & Top Creators/Validators (7 cols) */}
            <div className="md:col-span-7 p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-xl space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Social Sentiment & Nodes
                <SimulationBadge label="SIMULATED" />
              </span>

              <div className="flex items-center justify-between gap-4">
                {/* Progress Indicators */}
                <div className="space-y-2.5 flex-1 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#00f2fe]" /> Positive
                      </span>
                      <strong className="text-cyan-300">36%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#00f2fe] rounded-full" style={{ width: '36%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#fb923c]" /> Neutral
                      </span>
                      <strong className="text-amber-300">56%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#fb923c] rounded-full" style={{ width: '56%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#f43f5e]" /> Negative
                      </span>
                      <strong className="text-rose-400">8%</strong>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#f43f5e] rounded-full" style={{ width: '8%' }} />
                    </div>
                  </div>
                </div>

                {/* Donut Canvas */}
                <div className="w-[110px] h-[110px] flex-shrink-0 flex items-center justify-center">
                  <canvas ref={sentimentCanvasRef} className="w-[110px] h-[110px]" />
                </div>
              </div>

              {/* Top Creators / Validators Avatar Grid */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Top Consensus Nodes & Creators
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { name: 'Node #1', bg: '#042f2e', border: '#10b981', txt: 'N1' },
                    { name: 'Guild A', bg: '#1e1b4b', border: '#818cf8', txt: 'GA' },
                    { name: 'Validator B', bg: '#451a03', border: '#f59e0b', txt: 'VB' },
                    { name: 'SBT Hub', bg: '#1e1e38', border: '#a78bfa', txt: 'SH' },
                    { name: 'Alpha #5', bg: '#064e3b', border: '#34d399', txt: 'A5' },
                    { name: 'DePIN #7', bg: '#14532d', border: '#4ade80', txt: 'D7' },
                    { name: 'Credit X', bg: '#083344', border: '#38bdf8', txt: 'CX' },
                    { name: 'Oracle 9', bg: '#2e1065', border: '#c084fc', txt: 'O9' },
                    { name: 'Precompile', bg: '#3b0764', border: '#e879f9', txt: 'PC' },
                    { name: 'Runes #2', bg: '#701a75', border: '#f472b6', txt: 'R2' },
                    { name: 'L1 Relay', bg: '#0f172a', border: '#64748b', txt: 'LR' },
                    { name: 'Substrate', bg: '#022c22', border: '#10b981', txt: 'SS' }
                  ].map((node, i) => (
                    <div
                      key={i}
                      title={node.name}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-mono font-black text-white shadow-md cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: node.bg, border: `1.5px solid ${node.border}` }}
                    >
                      {node.txt}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT COLUMN (5 cols): Swap Ticket, Recent Transactions, Pool Stats
           ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Swap Ticket */}
          <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#031822] via-[#021016] to-[#010a0e] border border-cyan-500/30 shadow-2xl space-y-4">
            {/* Header with Slippage Settings Gear */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                Swap
                {poolLive ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
                  </span>
                ) : (
                  <SimulationBadge label={isConnected ? 'POOL UNREADABLE' : 'NOT CONNECTED'} note="Swap quotes are shown for illustration only until the ReputationAMM pool can be read with a connected wallet." />
                )}
              </h3>

              <div className="relative">
                <button
                  onClick={() => setIsSlippageOpen(!isSlippageOpen)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer border border-white/5"
                  title="Slippage Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Slippage Dropdown Popover */}
                {isSlippageOpen && (
                  <div className="absolute right-0 top-9 w-60 p-3 rounded-2xl bg-[#02141c] border border-cyan-500/40 shadow-2xl z-30 space-y-2">
                    <span className="text-[11px] font-mono text-slate-300 block font-bold">
                      Max Slippage Tolerance
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[0.1, 0.5, 1.0].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setSlippageTolerance(val);
                            setIsSlippageOpen(false);
                          }}
                          className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                            slippageTolerance === val
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-black/50 text-slate-400 hover:text-white'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* "You Pay" Input Box */}
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value)}
                    className="bg-[#031a24] text-white font-black font-mono text-xs px-2.5 py-1.5 rounded-xl border border-cyan-500/30 outline-none cursor-pointer"
                  >
                    {swapTokenKeys.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span>Balance: {fromBalance.toLocaleString()}</span>
                  <button
                    onClick={handleMaxPay}
                    className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent text-2xl font-mono font-black text-white outline-none"
                />
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                  &asymp; ${(fromAmtNum * fromTokenObj.priceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Flip Button */}
            <div className="flex justify-center -my-2">
              <button
                onClick={handleFlipDirection}
                className="w-9 h-9 rounded-full bg-[#03202c] hover:bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 flex items-center justify-center transition-all hover:rotate-180 cursor-pointer shadow-lg z-10"
                title="Invert Direction"
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>

            {/* "You Receive" Box */}
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <select
                    value={toToken}
                    onChange={(e) => setToToken(e.target.value)}
                    className="bg-[#031a24] text-white font-black font-mono text-xs px-2.5 py-1.5 rounded-xl border border-cyan-500/30 outline-none cursor-pointer"
                  >
                    {swapTokenKeys.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <span className="text-xs font-mono text-cyan-300">
                  1 {fromToken} &asymp; {swapRate < 1 ? swapRate.toFixed(6) : swapRate.toFixed(4)} {toToken}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <input
                  type="text"
                  readOnly
                  value={estimatedReceive}
                  className="w-full bg-transparent text-2xl font-mono font-black text-cyan-300 outline-none"
                />
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                  &asymp; ${(parseFloat(estimatedReceive || '0') * toTokenObj.priceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Swap Action Button */}
            <button
              disabled={isSwapping}
              onClick={handleExecuteSwap}
              className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:to-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-wide uppercase"
            >
              {isSwapping ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing on Creditcoin L1...</span>
                </>
              ) : (
                <span>Swap</span>
              )}
            </button>

            {/* Collapsible Route & Fees Accordion (Bitflow Style) */}
            <div className="rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
              <button
                onClick={() => setIsRouteExpanded(!isRouteExpanded)}
                className="w-full p-3 flex items-center justify-between text-xs font-mono text-slate-300 hover:bg-white/5 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <Info className="w-3.5 h-3.5 text-cyan-400" /> Route & Network Fees
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-cyan-300 font-bold">
                    {fromToken} &rarr; {toToken}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isRouteExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {isRouteExpanded && (
                <div className="p-3 pt-1 space-y-2 text-[11px] font-mono border-t border-white/5 text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Route:</span>
                    <span className="text-white font-bold flex items-center gap-1">
                      {fromToken} &rarr; {fromToken === 'CTC' ? 'AMM 0x0FD2' : 'CTC'} &rarr; {toToken}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>1 {fromToken} Rate:</span>
                    <span className="text-slate-200">
                      (&asymp; {swapRate < 1 ? swapRate.toFixed(6) : swapRate.toFixed(4)} {toToken})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Liquidity Provider Fee:</span>
                    <span className="text-emerald-400 font-bold">0.05% (Super-Prime Discount)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Slippage Tolerance:</span>
                    <span className="text-amber-300">{slippageTolerance}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Network Fee (Standard):</span>
                    <span className="text-slate-300">0.000003 CTC (~$0.01)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Recent Transactions Table (Bitflow Reference) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Transactions
              </span>
              <span className="text-[10px] font-mono text-slate-400">This Session</span>
            </div>

            <div className="space-y-2 overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="text-slate-400 border-b border-white/5 pb-1">
                    <th className="py-1 font-semibold">Type</th>
                    <th className="py-1 font-semibold">Details</th>
                    <th className="py-1 font-semibold">Tx ID</th>
                    <th className="py-1 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-500">
                        No transactions this session — swap or adjust pool liquidity to record one.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition">
                        <td className="py-2 text-slate-300 font-bold">{tx.type}</td>
                        <td className="py-2 text-slate-400 max-w-[140px] truncate" title={tx.details}>
                          {tx.details}
                        </td>
                        <td className="py-2">
                          <span className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-0.5">
                            {tx.txHash}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              tx.status === 'Confirmed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : tx.status === 'Pending'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Pool Stats & Pool Composition Bar (live ReputationAMM) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Pool Stats & Composition
              </span>
              {poolLive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
                </span>
              ) : poolLoading ? (
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 whitespace-nowrap">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                </span>
              ) : (
                <SimulationBadge label="POOL OFFLINE" note="ReputationAMM could not be read — connect a wallet on Creditcoin testnet to load live reserves." className="whitespace-nowrap" />
              )}
            </div>

            {/* Price Triad */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{fromToken} Price</span>
                <div className="text-xs font-black font-mono text-white">
                  {poolLive && fromTokenObj.priceUSD > 0 ? `$${fromTokenObj.priceUSD.toFixed(2)}` : '—'}
                </div>
                <div className="text-[9px] font-mono text-emerald-400">{poolLive ? 'from AMM quote' : 'catalog price'}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{toToken} Price</span>
                <div className="text-xs font-black font-mono text-white">
                  {poolLive && toTokenObj.priceUSD > 0 ? `$${toTokenObj.priceUSD.toFixed(2)}` : '—'}
                </div>
                <div className="text-[9px] font-mono text-emerald-400">{poolLive ? 'from AMM quote' : 'catalog price'}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">Pool TVL</span>
                <div className="text-xs font-black font-mono text-teal-300">
                  {poolTvl != null ? `$${poolTvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                </div>
                <div className="text-[9px] font-mono text-slate-400">{poolLive ? 'reserve0 + reserve1' : 'reserves unread'}</div>
              </div>
            </div>

            {/* Pool Composition Split Bar (real reserves) */}
            {poolLive && ammState ? (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    {ammState.token0.symbol}: <strong>{ammState.reserve0.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
                  </span>
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    {ammState.token1.symbol}: <strong>{ammState.reserve1.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-black/60 overflow-hidden flex border border-white/5">
                  {reserve0Pct != null && (
                    <>
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all" style={{ width: `${(reserve0Pct * 100).toFixed(1)}%` }} />
                      <div className="h-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all" style={{ width: `${((1 - reserve0Pct) * 100).toFixed(1)}%` }} />
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-500">
                  <span>Reserves</span>
                  <span>{isConnected ? 'pool read failed' : 'connect a wallet'}</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-black/60 border border-white/5" />
              </div>
            )}

            {/* Your LP & Wallet Balances */}
            {poolLive && ammState ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">Your LP Tokens</span>
                  <div className="text-xs font-black font-mono text-cyan-300">{ammState.lpBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} LP</div>
                  <div className="text-[9px] font-mono text-emerald-400">{lpSharePct != null ? `${lpSharePct.toFixed(2)}% of pool` : 'LP share unread'}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">cUSD Balance</span>
                  <div className="text-xs font-black font-mono text-white">{cusdBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} cUSD</div>
                  <div className="text-[9px] font-mono text-emerald-400">Wallet token balance</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">Your LP Tokens</span>
                  <div className="text-xs font-black font-mono text-slate-500">—</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">cUSD Balance</span>
                  <div className="text-xs font-black font-mono text-slate-500">—</div>
                </div>
              </div>
            )}

            {/* Add / Remove Liquidity controls (real writes) */}
            <div className="space-y-2 border-t border-white/5 pt-3">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownUp className="w-3 h-3 text-cyan-400" /> Add / Remove Liquidity
              </span>
              {poolLive && ammState ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={depositAmt0}
                      onChange={(e) => setDepositAmt0(e.target.value)}
                      placeholder={`${ammState.token0.symbol} amount`}
                      className="px-3 py-2.5 rounded-xl bg-black/40 border border-cyan-500/20 text-white font-mono text-xs outline-none placeholder:text-slate-600 min-w-0"
                    />
                    <input
                      type="number"
                      value={depositAmt1}
                      onChange={(e) => setDepositAmt1(e.target.value)}
                      placeholder={`${ammState.token1.symbol} amount`}
                      className="px-3 py-2.5 rounded-xl bg-black/40 border border-cyan-500/20 text-white font-mono text-xs outline-none placeholder:text-slate-600 min-w-0"
                    />
                  </div>
                  <button
                    disabled={poolBusy === 'deposit'}
                    onClick={handleAddLiquidity}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-400/20 to-cyan-400/20 border border-cyan-400/40 text-cyan-300 hover:border-cyan-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-bold text-xs"
                  >
                    {poolBusy === 'deposit' ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Adding Liquidity...</>
                    ) : (
                      `Add ${ammState.token0.symbol} + ${ammState.token1.symbol}`
                    )}
                  </button>
                  <input
                    type="number"
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(e.target.value)}
                    placeholder="LP tokens to withdraw"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-cyan-500/20 text-white font-mono text-xs outline-none placeholder:text-slate-600"
                  />
                  <button
                    disabled={poolBusy === 'withdraw'}
                    onClick={handleRemoveLiquidity}
                    className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-400/40 text-rose-300 hover:border-rose-300 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-bold text-xs"
                  >
                    {poolBusy === 'withdraw' ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Removing Liquidity...</>
                    ) : (
                      'Remove Liquidity'
                    )}
                  </button>
                </>
              ) : (
                <p className="text-[11px] font-mono text-slate-500">
                  Connect a wallet to read the deployed ReputationAMM pool and add or remove liquidity on Creditcoin testnet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DexAmmView;
