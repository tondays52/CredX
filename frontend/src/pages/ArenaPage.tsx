import React, { useState, useEffect, useRef, useCallback } from 'react';
import GlassCard from '../components/common/GlassCard';
import ArenaChart from '../components/arena/ArenaChart';
import OrderTicket from '../components/arena/OrderTicket';
import SimulationBadge from '../components/common/SimulationBadge';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { AssetSymbol, Timeframe, PredictionRound, AssetConfig, UserBet } from '../types/arena';
import {
  fetchLiveMarketPrices,
  ACCURATE_BASE_PRICES,
} from '../utils/cryptoPriceService';
import {
  fetchArenaView,
  arenaPlacePrediction,
  arenaClaimPayout,
  registerArenaUser,
  syncArenaStreak,
  txHashShort,
  ArenaView,
} from '../services/credXService';
import {
  Flame,
  Trophy,
  History,
  Shield,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const timeframeDurations: Record<Timeframe, number> = {
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '1d': 86400,
};

export const ASSETS_REGISTRY: Record<AssetSymbol, AssetConfig> = {
  CTC: {
    symbol: 'CTC',
    name: 'Creditcoin L1 Native',
    pair: 'CTC/USDC',
    category: 'CTC',
    basePrice: ACCURATE_BASE_PRICES.CTC,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  CTC_USDT: {
    symbol: 'CTC_USDT',
    name: 'Creditcoin Tether',
    pair: 'CTC/USDT',
    category: 'CTC',
    basePrice: ACCURATE_BASE_PRICES.CTC_USDT,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'USDT',
    decimals: 4,
  },
  CTC_ETH: {
    symbol: 'CTC_ETH',
    name: 'Creditcoin / Ethereum',
    pair: 'CTC/ETH',
    category: 'CTC',
    basePrice: ACCURATE_BASE_PRICES.CTC_ETH,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'ETH',
    decimals: 7,
  },
  CTC_BTC: {
    symbol: 'CTC_BTC',
    name: 'Creditcoin / Bitcoin',
    pair: 'CTC/BTC',
    category: 'CTC',
    basePrice: ACCURATE_BASE_PRICES.CTC_BTC,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'BTC',
    decimals: 8,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    pair: 'BTC/USDC',
    category: 'Major',
    basePrice: ACCURATE_BASE_PRICES.BTC,
    binanceSymbol: 'btcusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    pair: 'ETH/USDC',
    category: 'Major',
    basePrice: ACCURATE_BASE_PRICES.ETH,
    binanceSymbol: 'ethusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    pair: 'SOL/USDC',
    category: 'Major',
    basePrice: ACCURATE_BASE_PRICES.SOL,
    binanceSymbol: 'solusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB Chain',
    pair: 'BNB/USDC',
    category: 'Major',
    basePrice: ACCURATE_BASE_PRICES.BNB,
    binanceSymbol: 'bnbusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  XRP: {
    symbol: 'XRP',
    name: 'Ripple XRP',
    pair: 'XRP/USDC',
    category: 'Major',
    basePrice: ACCURATE_BASE_PRICES.XRP,
    binanceSymbol: 'xrpusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  AVAX: {
    symbol: 'AVAX',
    name: 'Avalanche',
    pair: 'AVAX/USDC',
    category: 'DePIN',
    basePrice: ACCURATE_BASE_PRICES.AVAX,
    binanceSymbol: 'avaxusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink Oracle',
    pair: 'LINK/USDC',
    category: 'DePIN',
    basePrice: ACCURATE_BASE_PRICES.LINK,
    binanceSymbol: 'linkusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  DOGE: {
    symbol: 'DOGE',
    name: 'Dogecoin',
    pair: 'DOGE/USDC',
    category: 'DePIN',
    basePrice: ACCURATE_BASE_PRICES.DOGE,
    binanceSymbol: 'dogeusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  GOLD: {
    symbol: 'GOLD',
    name: 'PAX Gold RWA',
    pair: 'PAXG/USDC',
    category: 'RWA',
    basePrice: ACCURATE_BASE_PRICES.GOLD,
    binanceSymbol: 'paxgusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
};

type CategoryFilter = 'ALL' | 'CTC' | 'Major' | 'DePIN_RWA';

const DEMO_SETTLED_ROUNDS: PredictionRound[] = [
  { id: 1041, asset: 'BTC', timeframe: '5m', strikePrice: 77920.0, closePrice: 78050.0, upPool: 18200, downPool: 14400, status: 'RESOLVED', startTime: Date.now() - 360000, endTime: Date.now() - 60000 },
  { id: 1040, asset: 'BTC', timeframe: '5m', strikePrice: 78100.0, closePrice: 77940.0, upPool: 12900, downPool: 15800, status: 'RESOLVED', startTime: Date.now() - 660000, endTime: Date.now() - 360000 },
  { id: 1039, asset: 'ETH', timeframe: '5m', strikePrice: 2465.0, closePrice: 2472.5, upPool: 15400, downPool: 11800, status: 'RESOLVED', startTime: Date.now() - 960000, endTime: Date.now() - 660000 },
];

const roundStatusLabel = (status: number): string => {
  switch (status) {
    case 0: return 'OPEN';
    case 1: return 'CLOSED';
    case 2: return 'SETTLED';
    case 3: return 'CANCELLED';
    default: return 'UNKNOWN';
  }
};

const normalizeStrike = (raw: number): number => raw / 1e8;

const toHumanUnits = (raw: number): number => raw / 1e18;

export const ArenaPage: React.FC = () => {
  const { isConnected, address, openConnectModal } = useWeb3();
  const { addToast } = useToast();

  const account = isConnected && address ? address : null;

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('CTC');
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('BTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5m');

  const currentAssetConfig = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.BTC;
  const [currentPrice, setCurrentPrice] = useState<number>(currentAssetConfig.basePrice);
  const [strikePrice, setStrikePrice] = useState<number>(0);
  const [priceDelta24h, setPriceDelta24h] = useState<number>(0);
  const [high24h, setHigh24h] = useState<number>(currentAssetConfig.basePrice * 1.015);
  const [low24h, setLow24h] = useState<number>(currentAssetConfig.basePrice * 0.985);
  const [volume24h, setVolume24h] = useState<string>('—');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  const wsRef = useRef<WebSocket | null>(null);
  const currentPriceRef = useRef<number>(currentAssetConfig.basePrice);
  currentPriceRef.current = currentPrice;

  const [view, setView] = useState<ArenaView | null>(null);
  const [viewState, setViewState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [registerPending, setRegisterPending] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  const round = view?.round ?? null;
  const stats = view?.stats ?? null;
  const prediction = view?.prediction ?? null;

  const isRegistered = !!(
    stats &&
    (stats.paperBalance > 0 || stats.totalRounds > 0 || stats.currentWinStreak > 0 || stats.longestWinStreak > 0 || stats.totalWins > 0)
  );

  const getLaneEpoch = useCallback((tf: Timeframe) => {
    const durationSec = timeframeDurations[tf] || 300;
    const durationMs = durationSec * 1000;
    const now = Date.now();
    const epochIndex = Math.floor(now / durationMs);
    const startTime = epochIndex * durationMs;
    const endTime = (epochIndex + 1) * durationMs;
    const remainingSec = Math.max(0, Math.ceil((endTime - now) / 1000));
    return { durationSec, durationMs, epochIndex, startTime, endTime, remainingSec };
  }, []);

  const [timeRemaining, setTimeRemaining] = useState<number>(() => getLaneEpoch('5m').remainingSec);

  useEffect(() => {
    setTimeRemaining(getLaneEpoch(selectedTimeframe).remainingSec);
  }, [selectedTimeframe, getLaneEpoch]);

  const refreshArenaView = useCallback(async () => {
    if (!account) {
      setView(null);
      setViewState('idle');
      return;
    }
    setViewState('loading');
    try {
      const v = await fetchArenaView(account);
      if (!v) {
        setView(null);
        setViewState('error');
        return;
      }
      setView(v);
      setViewState('ok');
    } catch {
      setView(null);
      setViewState('error');
    }
  }, [account]);

  useEffect(() => {
    if (account) {
      void refreshArenaView();
    } else {
      setView(null);
      setViewState('idle');
    }
    const poll = setInterval(() => {
      if (account) void refreshArenaView();
    }, 10000);
    return () => clearInterval(poll);
  }, [account, refreshArenaView]);

  useEffect(() => {
    if (round && round.assetSymbol) {
      const sym = round.assetSymbol as AssetSymbol;
      if (ASSETS_REGISTRY[sym] && sym !== selectedAsset) {
        setSelectedAsset(sym);
      }
    }
  }, [round]);

  useEffect(() => {
    if (round) {
      setStrikePrice(normalizeStrike(round.strikePrice));
    }
  }, [round]);

  useEffect(() => {
    let isMounted = true;

    const syncMarketPrices = async () => {
      try {
        const tickers = await fetchLiveMarketPrices();
        if (!isMounted) return;

        const assetTicker = tickers[selectedAsset];
        if (assetTicker && assetTicker.price > 0) {
          setCurrentPrice(assetTicker.price);
          setPriceDelta24h(assetTicker.change24h);
          setHigh24h(assetTicker.high24h);
          setLow24h(assetTicker.low24h);
          setVolume24h(assetTicker.volume24h);
        }
      } catch (e) {
        console.warn('[ArenaPage] Price sync error', e);
      }
    };

    syncMarketPrices();
    const interval = setInterval(syncMarketPrices, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedAsset]);

  useEffect(() => {
    const cfg = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.BTC;
    const symbol = cfg.binanceSymbol.toLowerCase();
    const streamUrl = `wss://stream.binance.com:9443/ws/${symbol}@trade/${symbol}@ticker`;

    try {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLiveConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e === 'trade' && data.p) {
            let p = parseFloat(data.p);
            if (!isNaN(p) && p > 0) {
              setCurrentPrice(p);
            }
          }
          if (data.e === '24hrTicker') {
            if (data.P) setPriceDelta24h(parseFloat(data.P));
            if (data.h) setHigh24h(parseFloat(data.h));
            if (data.l) setLow24h(parseFloat(data.l));
          }
        } catch {
          // ignore stream parse errors
        }
      };

      ws.onerror = () => setIsLiveConnected(false);
      ws.onclose = () => setIsLiveConnected(false);
    } catch {
      setIsLiveConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedAsset]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getLaneEpoch(selectedTimeframe).remainingSec);
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedTimeframe, getLaneEpoch]);

  const arenaRound: PredictionRound = round
    ? {
        id: round.roundId,
        asset: (round.assetSymbol as AssetSymbol) || 'BTC',
        timeframe: '5m',
        strikePrice: normalizeStrike(round.strikePrice),
        closePrice: null,
        upPool: toHumanUnits(round.totalAboveStake),
        downPool: toHumanUnits(round.totalBelowStake),
        status: roundStatusLabel(round.status),
        startTime: Date.now() - 60000,
        endTime: Date.now(),
      }
    : {
        id: 0,
        asset: selectedAsset,
        timeframe: '5m',
        strikePrice: strikePrice,
        closePrice: null,
        upPool: 0,
        downPool: 0,
        status: viewState === 'error' ? 'UNAVAILABLE' : 'IDLE',
        startTime: Date.now() - 60000,
        endTime: Date.now(),
      };

  const userBet: UserBet | null =
    round && prediction && prediction.stakeAmount > 0
      ? {
          id: `arena-${round.roundId}`,
          roundId: round.roundId,
          asset: (round.assetSymbol as AssetSymbol) || 'BTC',
          timeframe: '5m',
          laneKey: `${(round.assetSymbol as AssetSymbol) || 'BTC'}_5m`,
          direction: prediction.choice === 0 ? 'UP' : 'DOWN',
          amount: toHumanUnits(prediction.stakeAmount),
          strikePrice: normalizeStrike(round.strikePrice),
          timestamp: Date.now(),
        }
      : null;

  const formatDisplayPrice = (p: number | null | undefined, dec?: number) => {
    if (p === null || p === undefined || (!p && p !== 0)) return '--';
    if (p < 0.0001) return p.toFixed(8);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toLocaleString(undefined, {
      minimumFractionDigits: dec !== undefined ? dec : 2,
      maximumFractionDigits: dec !== undefined ? dec : 2,
    });
  };

  const revertReason = (err: unknown): string => {
    const e = err as { shortMessage?: string; reason?: string; message?: string };
    const msg = e?.shortMessage || e?.reason || e?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    return 'Transaction reverted on-chain (see console for details).';
  };

  const handleSelectAsset = (sym: AssetSymbol) => {
    setSelectedAsset(sym);
    const initialPrice = ACCURATE_BASE_PRICES[sym] || currentAssetConfig.basePrice;
    setCurrentPrice(initialPrice);
    currentPriceRef.current = initialPrice;
  };

  const handleSelectTimeframe = (tf: Timeframe) => {
    setSelectedTimeframe(tf);
    setTimeRemaining(getLaneEpoch(tf).remainingSec);
  };

  const handlePlacePrediction = async (direction: 'UP' | 'DOWN', amount: number) => {
    if (!account) {
      addToast('error', 'Connect A Wallet', 'Place predictions against the deployed ReputationArena on Creditcoin testnet.');
      return;
    }
    if (!round) {
      addToast('error', 'Round Not Found', 'The contract returned no current arena round. Try again on the next refresh.');
      return;
    }
    if (prediction && prediction.stakeAmount > 0) {
      addToast('error', 'Prediction Already Placed', `Round #${round.roundId} already has a live on-chain stake of $${toHumanUnits(prediction.stakeAmount).toFixed(2)} USDC.`);
      return;
    }
    if (stats && amount > stats.paperBalance) {
      addToast('error', 'InsufficientPaperBalance', `Available paper balance is $${stats.paperBalance.toFixed(2)} USDC.`);
      return;
    }
    try {
      const hash = await arenaPlacePrediction(round.roundId, direction === 'UP' ? 0 : 1, amount);
      addToast('success', 'Prediction Placed On-Chain', `Round #${round.roundId}: ${direction} $${amount.toFixed(2)} USDC locked. tx ${txHashShort(hash)}`);
      await refreshArenaView();
    } catch (err) {
      addToast('error', 'Place-Prediction Reverted', revertReason(err));
    }
  };

  const handleClaimPayout = async () => {
    if (!account) {
      addToast('error', 'Connect A Wallet', 'Claiming payouts requires a connected wallet on Creditcoin testnet.');
      return;
    }
    if (!round) {
      addToast('error', 'Round Not Found', 'No current arena round to claim for.');
      return;
    }
    try {
      const hash = await arenaClaimPayout(round.roundId);
      addToast('success', 'Payout Claimed On-Chain', `Round #${round.roundId} payout claimed. tx ${txHashShort(hash)}`);
      await refreshArenaView();
    } catch (err) {
      addToast('error', 'Claim-Payout Reverted', revertReason(err));
    }
  };

  const handleRegister = async () => {
    if (!account) {
      addToast('error', 'Connect A Wallet', 'Registering requires a connected wallet on Creditcoin testnet.');
      return;
    }
    setRegisterPending(true);
    try {
      const hash = await registerArenaUser();
      addToast('success', 'Arena Account Registered', `Paper-trading arena account created on-chain. tx ${txHashShort(hash)}`);
      await refreshArenaView();
    } catch (err) {
      addToast('error', 'Register Reverted', revertReason(err));
    } finally {
      setRegisterPending(false);
    }
  };

  const handleSyncStreak = async () => {
    if (!account) {
      addToast('error', 'Connect A Wallet', 'Streak sync requires a connected wallet on Creditcoin testnet.');
      return;
    }
    setSyncPending(true);
    try {
      const hash = await syncArenaStreak();
      addToast('success', 'Streak Synced To Reputation', `Reputation boost anchored to Creditcoin L1. tx ${txHashShort(hash)}`);
      await refreshArenaView();
    } catch (err) {
      addToast('error', 'Streak Sync Reverted', revertReason(err));
    } finally {
      setSyncPending(false);
    }
  };

  const filteredAssets = Object.values(ASSETS_REGISTRY).filter((assetCfg) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'CTC') return assetCfg.category === 'CTC';
    if (selectedCategory === 'Major') return assetCfg.category === 'Major';
    if (selectedCategory === 'DePIN_RWA') return assetCfg.category === 'DePIN' || assetCfg.category === 'RWA';
    return true;
  });

  return (
    <div className="space-y-6 py-4">
      {/* Live Wallet & Available Paper Trading Capital Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-cyan-950/40 border border-amber-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-amber-400 tracking-wider flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${view?.stats ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {view?.stats
                ? 'ReputationArena Live Paper Balance'
                : account
                ? viewState === 'error'
                  ? 'Arena Read Unavailable'
                  : 'Loading Arena State...'
                : 'FreeCrypto API + Binance WS Connected'}
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              ${stats !== null && stats !== undefined ? formatDisplayPrice(stats.paperBalance, 2) : '--'} <span className="text-xs text-cyan-300 font-normal">USDC</span>
              <span className="text-xs text-white/40 font-mono font-normal">
                (Paper Trading Capital)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">
              Round #{round ? round.roundId : '--'} · {round ? roundStatusLabel(round.status) : account ? 'OFFLINE' : 'IDLE'}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              +{(stats ? stats.currentWinStreak : 0) * 5} Rep Multiplier
            </span>
          </div>

          {!account && (
            <button
              onClick={openConnectModal}
              className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              Connect For Live Arena
            </button>
          )}

          {account && (
            <>
              <button
                onClick={handleRegister}
                disabled={registerPending || isRegistered}
                className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white/70 hover:text-white text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Register a paper-trading account on the deployed ReputationArena"
              >
                {registerPending ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                ) : isRegistered ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                )}
                {registerPending ? 'Registering...' : isRegistered ? 'Registered' : 'Register Arena User'}
              </button>

              <button
                onClick={handleSyncStreak}
                disabled={syncPending || !stats}
                className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync current win streak into CredX reputation via syncStreakToReputation()"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncPending ? 'animate-spin' : ''}`} />
                {syncPending ? 'Syncing...' : 'Sync Streak To Rep'}
              </button>
            </>
          )}

          <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Streak: {stats ? stats.currentWinStreak : '--'} Wins
          </div>
        </div>
      </div>

      {/* Live Arena Reputation Stats Strip */}
      {account && view && (
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono flex flex-wrap items-center gap-x-6 gap-y-2">
          {stats ? (
            <>
              <span className="text-white/40">Total Wins <strong className="text-emerald-400 ml-1">{stats.totalWins}</strong></span>
              <span className="text-white/40">Total Rounds <strong className="text-cyan-300 ml-1">{stats.totalRounds}</strong></span>
              <span className="text-white/40">Longest Streak <strong className="text-amber-300 ml-1">{stats.longestWinStreak}</strong></span>
              <span className="text-white/40">Rep Boosts Claimed <strong className="text-purple-300 ml-1">{stats.totalReputationBoostsClaimed}</strong></span>
            </>
          ) : (
            <span className="text-white/50 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              No arena stats returned from the contract — register an arena account to start paper-trading.
            </span>
          )}
        </div>
      )}

      {/* Top Arena Header with Token Categorization */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border border-amber-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" /> PredictBay High-Frequency Binary Arena
            </h1>
            <p className="text-xs text-white/50 mt-1">
              Live FreeCrypto API &bull; Sub-second ticks &bull; Creditcoin L1 verifiable epoch settlement.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setSelectedCategory('CTC')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === 'CTC'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              ⭐ CTC Pairs
            </button>
            <button
              onClick={() => setSelectedCategory('Major')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                selectedCategory === 'Major'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Majors
            </button>
            <button
              onClick={() => setSelectedCategory('DePIN_RWA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                selectedCategory === 'DePIN_RWA'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              DePIN & RWA
            </button>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-white/15 text-white border border-white/30 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              All (13)
            </button>
          </div>
        </div>

        {/* Token Selector Badges Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {filteredAssets.map((cfg) => {
            const isSelected = selectedAsset === cfg.symbol;
            const isCTC = cfg.category === 'CTC';
            return (
              <button
                key={cfg.symbol}
                onClick={() => handleSelectAsset(cfg.symbol)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap border cursor-pointer ${
                  isSelected
                    ? isCTC
                      ? 'bg-amber-500/20 border-amber-500/70 text-amber-300 shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/40'
                      : 'bg-cyan-500/20 border-cyan-500/70 text-cyan-300 shadow-lg shadow-cyan-500/20'
                    : isCTC
                    ? 'bg-amber-950/20 border-amber-500/20 text-amber-300/70 hover:border-amber-500/40 hover:text-amber-200'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-white/20'
                }`}
              >
                {isCTC && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                <span>{cfg.pair}</span>
                {isCTC && (
                  <span className="text-[9px] font-sans px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    L1
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Trading Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart & Odds */}
        <div className="lg:col-span-8 space-y-4">
          <ArenaChart
            asset={selectedAsset}
            assetPair={currentAssetConfig.pair}
            binanceSymbol={currentAssetConfig.binanceSymbol}
            currentPrice={currentPrice}
            strikePrice={strikePrice}
            timeRemaining={timeRemaining}
            round={arenaRound}
            timeframe={selectedTimeframe}
            onSelectTimeframe={handleSelectTimeframe}
            priceDelta24h={priceDelta24h}
            high24h={high24h}
            low24h={low24h}
            volume24h={volume24h}
            isLiveFeed={isLiveConnected}
            userBet={userBet}
            onForceSettle={handleClaimPayout}
          />
        </div>

        {/* Right Order Ticket */}
        <div className="lg:col-span-4">
          <OrderTicket
            asset={selectedAsset}
            round={arenaRound}
            onPlaceBet={handlePlacePrediction}
            streak={stats ? stats.currentWinStreak : 0}
            userBet={userBet}
            currentPrice={currentPrice}
            strikePrice={strikePrice}
            paperBalanceUSD={stats ? stats.paperBalance : 0}
            onForceSettle={handleClaimPayout}
          />
        </div>
      </div>

      {/* Past Resolved Rounds Table */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Settled Arena Epochs</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/40 hidden sm:inline">
              No on-chain archive reader — local demo only
            </span>
            <SimulationBadge label="SIMULATED HISTORY" note="Illustrative settled-epochs list. fetchArenaView() only exposes the current arena round, so past rounds are not read on-chain." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEMO_SETTLED_ROUNDS.map((r) => {
            const isUpWon = (r.closePrice || 0) >= r.strikePrice;
            const cfg = ASSETS_REGISTRY[r.asset] || ASSETS_REGISTRY.BTC;
            return (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/30 transition space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-white/50 font-bold">
                    {cfg.pair} #{r.id} ({r.timeframe || '5m'})
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      isUpWon
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {isUpWon ? 'UP WON ↗' : 'DOWN WON ↘'}
                  </span>
                </div>

                <div className="space-y-1 font-mono text-white/70">
                  <div className="flex justify-between">
                    <span>Strike:</span>
                    <span className="text-white">${formatDisplayPrice(r.strikePrice, cfg.decimals)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Closed:</span>
                    <span className={isUpWon ? 'text-emerald-400' : 'text-red-400'}>
                      ${formatDisplayPrice(r.closePrice, cfg.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/40 text-[10px] pt-1 border-t border-white/[0.04]">
                    <span>Total Epoch Pool:</span>
                    <span>${((r.upPool + r.downPool) / 1000).toFixed(1)}k USDC</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};

export default ArenaPage;
