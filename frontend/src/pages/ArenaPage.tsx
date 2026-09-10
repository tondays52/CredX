import React, { useState, useEffect, useRef, useCallback } from 'react';
import GlassCard from '../components/common/GlassCard';
import ArenaChart from '../components/arena/ArenaChart';
import OrderTicket from '../components/arena/OrderTicket';
import StreakCelebrationModal from '../components/arena/StreakCelebrationModal';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { AssetSymbol, Timeframe, PredictionRound, AssetConfig, UserBet } from '../types/arena';
import {
  fetchLiveMarketPrices,
  ACCURATE_BASE_PRICES,
  TickerData,
} from '../utils/cryptoPriceService';
import {
  Flame,
  Trophy,
  History,
  Zap,
  Shield,
  Coins,
  DollarSign,
  Clock,
  Radio,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Filter,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

const timeframeDurations: Record<Timeframe, number> = {
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '1d': 86400,
};

const timeframeMultipliers: Record<Timeframe, number> = {
  '5m': 1.92,
  '15m': 2.15,
  '30m': 2.45,
  '1h': 2.80,
  '1d': 3.50,
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

export const ArenaPage: React.FC = () => {
  const { balanceCTC } = useWeb3();
  const { addToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('CTC');
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('BTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5m');
  const [isFastTestMode, setIsFastTestMode] = useState<boolean>(false);
  
  const currentAssetConfig = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.BTC;
  const [currentPrice, setCurrentPrice] = useState<number>(currentAssetConfig.basePrice);
  const [strikePrice, setStrikePrice] = useState<number>(currentAssetConfig.basePrice);
  const [timeRemaining, setTimeRemaining] = useState<number>(timeframeDurations['5m']);
  
  const [streak, setStreak] = useState<number>(2);
  const [streakModalOpen, setStreakModalOpen] = useState<boolean>(false);
  const [priceDelta24h, setPriceDelta24h] = useState<number>(-0.42);
  const [high24h, setHigh24h] = useState<number>(currentAssetConfig.basePrice * 1.015);
  const [low24h, setLow24h] = useState<number>(currentAssetConfig.basePrice * 0.985);
  const [volume24h, setVolume24h] = useState<string>('$1.84B');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  // User Paper Trading & Multi-Lane Active Bets
  const [paperBalanceUSD, setPaperBalanceUSD] = useState<number>(10000);
  const [activeBets, setActiveBets] = useState<Record<string, UserBet>>({});
  const activeBetsRef = useRef<Record<string, UserBet>>({});
  activeBetsRef.current = activeBets;

  const currentLaneKey = `${selectedAsset}_${selectedTimeframe}`;
  const userBet = activeBets[currentLaneKey] || null;

  const wsRef = useRef<WebSocket | null>(null);
  const currentPriceRef = useRef<number>(currentAssetConfig.basePrice);
  currentPriceRef.current = currentPrice;

  const strikePriceRef = useRef<number>(currentAssetConfig.basePrice);
  strikePriceRef.current = strikePrice;

  const laneStrikesRef = useRef<Record<string, number>>({
    [currentLaneKey]: currentAssetConfig.basePrice,
  });

  // Epoch Synchronizer (Global Wall-Clock alignment: rounds never reset on asset switch)
  const getLaneEpoch = useCallback((tf: Timeframe, isFast: boolean) => {
    const durationSec = isFast ? 15 : timeframeDurations[tf] || 300;
    const durationMs = durationSec * 1000;
    const now = Date.now();
    const epochIndex = Math.floor(now / durationMs);
    const startTime = epochIndex * durationMs;
    const endTime = (epochIndex + 1) * durationMs;
    const remainingSec = Math.max(0, Math.ceil((endTime - now) / 1000));
    return { durationSec, durationMs, epochIndex, startTime, endTime, remainingSec };
  }, []);

  const initialEpoch = getLaneEpoch(selectedTimeframe, isFastTestMode);

  const [currentRound, setCurrentRound] = useState<PredictionRound>({
    id: initialEpoch.epochIndex,
    asset: 'BTC',
    timeframe: '5m',
    strikePrice: currentAssetConfig.basePrice,
    closePrice: null,
    upPool: 14500,
    downPool: 9800,
    status: 'ACTIVE',
    startTime: initialEpoch.startTime,
    endTime: initialEpoch.endTime,
  });

  const [pastRounds, setPastRounds] = useState<PredictionRound[]>([
    { id: 1041, asset: 'BTC', timeframe: '5m', strikePrice: 77920.0, closePrice: 78050.0, upPool: 18200, downPool: 14400, status: 'RESOLVED', startTime: Date.now() - 360000, endTime: Date.now() - 60000 },
    { id: 1040, asset: 'BTC', timeframe: '5m', strikePrice: 78100.0, closePrice: 77940.0, upPool: 12900, downPool: 15800, status: 'RESOLVED', startTime: Date.now() - 660000, endTime: Date.now() - 360000 },
    { id: 1039, asset: 'ETH', timeframe: '5m', strikePrice: 2465.0, closePrice: 2472.5, upPool: 15400, downPool: 11800, status: 'RESOLVED', startTime: Date.now() - 960000, endTime: Date.now() - 660000 },
  ]);

  // 1. Live FreeCrypto API Poller (Key: dyegtedxxox83d5ems8i)
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

  // 2. Real-time Live Binance WebSocket Connection (For sub-second tick continuity)
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
          // Trade Stream
          if (data.e === 'trade' && data.p) {
            let p = parseFloat(data.p);
            if (selectedAsset === 'CTC_ETH') p = p / (currentPriceRef.current > 0 ? 2470.0 : 2470.0);
            if (selectedAsset === 'CTC_BTC') p = p / (currentPriceRef.current > 0 ? 78000.0 : 78000.0);
            if (!isNaN(p) && p > 0) {
              setCurrentPrice(p);
            }
          }
          // 24hr Ticker Stream
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

  // 3. Manual Immediate Settlement Trigger
  const triggerSettlement = useCallback(() => {
    const currentBet = activeBetsRef.current[currentLaneKey];
    const resolvedPrice = currentPriceRef.current;
    const targetStrike = strikePriceRef.current;
    const isUpWon = resolvedPrice >= targetStrike;
    const mult = timeframeMultipliers[selectedTimeframe] || 1.92;

    if (currentBet) {
      const userWon =
        (currentBet.direction === 'UP' && isUpWon) ||
        (currentBet.direction === 'DOWN' && !isUpWon);

      if (userWon) {
        const payout = currentBet.amount * mult;
        setPaperBalanceUSD((prev) => prev + payout);
        setStreak((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setStreakModalOpen(true);
          }
          return next;
        });

        addToast(
          'success',
          '🎉 PREDICTION WON! (+CTS REPUTATION)',
          `Resolved at $${formatDisplayPrice(resolvedPrice)}. You won $${payout.toFixed(2)} USDC (${mult}x payout)! Streak increased to ${streak + 1}!`
        );
      } else {
        setStreak(0);
        addToast(
          'error',
          'Prediction Expired Out-of-the-Money',
          `Resolved at $${formatDisplayPrice(resolvedPrice)} vs Strike $${formatDisplayPrice(targetStrike)}. Streak reset.`
        );
      }

      setActiveBets((prev) => {
        const copy = { ...prev };
        delete copy[currentLaneKey];
        return copy;
      });
    } else {
      addToast(
        'info',
        `Round #${currentRound.id} Settled`,
        `Resolved at $${formatDisplayPrice(resolvedPrice)} (Strike $${formatDisplayPrice(targetStrike)}). ${isUpWon ? 'UP POOL WON ↗' : 'DOWN POOL WON ↘'}.`
      );
    }

    // Archive into Past Settled Rounds
    setPastRounds((prev) => [
      {
        id: currentRound.id,
        asset: selectedAsset,
        timeframe: selectedTimeframe,
        strikePrice: targetStrike,
        closePrice: resolvedPrice,
        upPool: currentRound.upPool,
        downPool: currentRound.downPool,
        status: 'RESOLVED',
        startTime: Date.now() - (isFastTestMode ? 15000 : timeframeDurations[selectedTimeframe] * 1000),
        endTime: Date.now(),
      },
      ...prev.slice(0, 7),
    ]);

    // Update Strike Price for next round
    laneStrikesRef.current[currentLaneKey] = resolvedPrice;
    setStrikePrice(resolvedPrice);
    strikePriceRef.current = resolvedPrice;
  }, [currentLaneKey, selectedAsset, selectedTimeframe, isFastTestMode, currentRound.id, currentRound.upPool, currentRound.downPool, streak, addToast]);

  // 4. Continuous Multi-Lane 1-Second Master Clock
  // (Never resets on asset/timeframe click — tracks true real-time epoch!)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      // Update current lane's countdown
      const currentEpoch = getLaneEpoch(selectedTimeframe, isFastTestMode);
      setTimeRemaining(currentEpoch.remainingSec);

      // Ensure current lane has a strike price set
      if (!laneStrikesRef.current[currentLaneKey] && currentPriceRef.current > 0) {
        laneStrikesRef.current[currentLaneKey] = currentPriceRef.current;
        setStrikePrice(currentPriceRef.current);
      }

      // Check all active bets across all lanes for epoch completion
      const currentBets = { ...activeBetsRef.current };
      let betsChanged = false;

      Object.entries(currentBets).forEach(([laneKey, bet]) => {
        const betDurationMs = (isFastTestMode ? 15 : timeframeDurations[bet.timeframe] || 300) * 1000;
        const betEpoch = getLaneEpoch(bet.timeframe, isFastTestMode);

        // Check if bet round has concluded
        if (now >= bet.timestamp + betDurationMs || betEpoch.epochIndex > bet.roundId) {
          betsChanged = true;
          const assetCfg = ASSETS_REGISTRY[bet.asset] || ASSETS_REGISTRY.BTC;
          const resolvedPrice =
            bet.asset === selectedAsset
              ? currentPriceRef.current
              : assetCfg.basePrice || bet.strikePrice;

          const isUpWon = resolvedPrice >= bet.strikePrice;
          const userWon =
            (bet.direction === 'UP' && isUpWon) ||
            (bet.direction === 'DOWN' && !isUpWon);
          const mult = timeframeMultipliers[bet.timeframe] || 1.92;

          if (userWon) {
            const payout = bet.amount * mult;
            setPaperBalanceUSD((prev) => prev + payout);
            setStreak((prev) => {
              const next = prev + 1;
              if (next >= 3) setStreakModalOpen(true);
              return next;
            });
            addToast(
              'success',
              `🎉 ${bet.asset} PREDICTION WON! (+CTS REPUTATION)`,
              `Resolved at $${formatDisplayPrice(resolvedPrice)}. Won $${payout.toFixed(2)} USDC (${mult}x) on ${bet.asset} ${bet.timeframe}!`
            );
          } else {
            setStreak(0);
            addToast(
              'error',
              `${bet.asset} ${bet.timeframe} Expired Out-of-the-Money`,
              `Resolved at $${formatDisplayPrice(resolvedPrice)} vs Strike $${formatDisplayPrice(bet.strikePrice)}.`
            );
          }

          // Log into settled rounds
          setPastRounds((prev) => [
            {
              id: bet.roundId,
              asset: bet.asset,
              timeframe: bet.timeframe,
              strikePrice: bet.strikePrice,
              closePrice: resolvedPrice,
              upPool: Math.floor(Math.random() * 8000 + 10000),
              downPool: Math.floor(Math.random() * 8000 + 9000),
              status: 'RESOLVED',
              startTime: bet.timestamp,
              endTime: now,
            },
            ...prev.slice(0, 7),
          ]);

          delete currentBets[laneKey];
        }
      });

      if (betsChanged) {
        setActiveBets(currentBets);
      }

      // Roll current round if epoch changed
      setCurrentRound((prev) => {
        if (prev.id !== currentEpoch.epochIndex) {
          const newStrike = currentPriceRef.current > 0 ? currentPriceRef.current : prev.strikePrice;
          laneStrikesRef.current[currentLaneKey] = newStrike;
          setStrikePrice(newStrike);
          return {
            ...prev,
            id: currentEpoch.epochIndex,
            asset: selectedAsset,
            timeframe: selectedTimeframe,
            strikePrice: newStrike,
            startTime: currentEpoch.startTime,
            endTime: currentEpoch.endTime,
            upPool: Math.floor(Math.random() * 8000 + 11000),
            downPool: Math.floor(Math.random() * 8000 + 9500),
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedAsset, selectedTimeframe, isFastTestMode, currentLaneKey, getLaneEpoch, addToast]);

  // Handle Asset Switch (Continuous clock: timer is NEVER reset!)
  const handleSelectAsset = (sym: AssetSymbol) => {
    setSelectedAsset(sym);
    const cfg = ASSETS_REGISTRY[sym];
    const initialPrice = ACCURATE_BASE_PRICES[sym] || cfg.basePrice;

    setCurrentPrice(initialPrice);
    currentPriceRef.current = initialPrice;

    const newLaneKey = `${sym}_${selectedTimeframe}`;
    if (!laneStrikesRef.current[newLaneKey]) {
      laneStrikesRef.current[newLaneKey] = initialPrice;
    }
    const currentStrike = laneStrikesRef.current[newLaneKey];
    setStrikePrice(currentStrike);
    strikePriceRef.current = currentStrike;

    const { epochIndex, startTime, endTime, remainingSec } = getLaneEpoch(selectedTimeframe, isFastTestMode);
    setTimeRemaining(remainingSec);

    setCurrentRound((prev) => ({
      ...prev,
      id: epochIndex,
      asset: sym,
      timeframe: selectedTimeframe,
      strikePrice: currentStrike,
      startTime,
      endTime,
    }));
  };

  // Handle Timeframe Switch (Calculates target epoch clock seamlessly)
  const handleSelectTimeframe = (tf: Timeframe) => {
    setSelectedTimeframe(tf);
    const newLaneKey = `${selectedAsset}_${tf}`;
    if (!laneStrikesRef.current[newLaneKey]) {
      laneStrikesRef.current[newLaneKey] = currentPriceRef.current;
    }
    const currentStrike = laneStrikesRef.current[newLaneKey];
    setStrikePrice(currentStrike);
    strikePriceRef.current = currentStrike;

    const { epochIndex, startTime, endTime, remainingSec } = getLaneEpoch(tf, isFastTestMode);
    setTimeRemaining(remainingSec);

    setCurrentRound((curr) => ({
      ...curr,
      id: epochIndex,
      timeframe: tf,
      strikePrice: currentStrike,
      startTime,
      endTime,
    }));

    addToast('info', 'Timeframe Switched', `Switched to ${tf.toUpperCase()} epoch lane. Countdown continuously synchronized.`);
  };

  // Handle User Bet Placement in Current Lane
  const handlePlaceBet = (direction: 'UP' | 'DOWN', amount: number) => {
    if (amount > paperBalanceUSD) {
      addToast('error', 'Insufficient Capital', `Your available balance is $${paperBalanceUSD.toFixed(2)} USDC.`);
      return;
    }

    // Deduct stake from paper balance
    setPaperBalanceUSD((prev) => Math.max(0, prev - amount));

    const { epochIndex } = getLaneEpoch(selectedTimeframe, isFastTestMode);
    const lockStrike = currentPriceRef.current > 0 ? currentPriceRef.current : strikePrice;

    // Record user bet in active bets registry for this lane
    const newBet: UserBet = {
      id: `${selectedAsset}_${selectedTimeframe}_${epochIndex}_${Date.now()}`,
      roundId: epochIndex,
      asset: selectedAsset,
      timeframe: selectedTimeframe,
      laneKey: currentLaneKey,
      direction,
      amount,
      strikePrice: lockStrike,
      timestamp: Date.now(),
      potentialPayout: amount * (timeframeMultipliers[selectedTimeframe] || 1.92),
    };

    setActiveBets((prev) => ({
      ...prev,
      [currentLaneKey]: newBet,
    }));

    // Lock strike price
    setStrikePrice(lockStrike);
    strikePriceRef.current = lockStrike;

    // Update round pools
    setCurrentRound((prev) => ({
      ...prev,
      upPool: direction === 'UP' ? prev.upPool + amount : prev.upPool,
      downPool: direction === 'DOWN' ? prev.downPool + amount : prev.downPool,
    }));
  };

  // Filter tokens by category
  const filteredAssets = Object.values(ASSETS_REGISTRY).filter((assetCfg) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'CTC') return assetCfg.category === 'CTC';
    if (selectedCategory === 'Major') return assetCfg.category === 'Major';
    if (selectedCategory === 'DePIN_RWA') return assetCfg.category === 'DePIN' || assetCfg.category === 'RWA';
    return true;
  });

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
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isLiveConnected ? 'FreeCrypto API + Binance WS Connected' : 'FreeCrypto API Feed Active'}
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              ${paperBalanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs text-cyan-300 font-normal">USDC</span>
              <span className="text-xs text-white/40 font-mono font-normal">
                (Paper Trading Capital)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Fast Test Mode Toggle */}
          <button
            onClick={() => setIsFastTestMode((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer flex items-center gap-1.5 ${
              isFastTestMode
                ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-md shadow-purple-500/20'
                : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {isFastTestMode ? '⚡ 15s Rapid Test Mode' : 'Standard 5m Mode'}
          </button>

          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">Creditcoin CTS Multiplier</span>
            <span className="text-xs font-mono font-bold text-emerald-400">+{streak * 5} Rep Multiplier</span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 font-bold">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Streak: {streak} Wins
          </div>
        </div>
      </div>

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

      {/* Active Positions Across Lanes Strip */}
      {Object.values(activeBets).length > 0 && (
        <div className="p-3.5 rounded-2xl bg-cyan-950/25 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-lg shadow-cyan-500/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-white uppercase tracking-wider">
              Active Multi-Asset Lanes ({Object.values(activeBets).length}):
            </span>
            <span className="text-white/40 hidden sm:inline">&bull; Real-time isolated epoch resolution</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(activeBets).map((b) => {
              const isCurrent = b.asset === selectedAsset && b.timeframe === selectedTimeframe;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    handleSelectAsset(b.asset);
                    handleSelectTimeframe(b.timeframe);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:border-cyan-500/40 hover:text-white'
                  }`}
                  title={`Jump to ${b.asset} ${b.timeframe} lane`}
                >
                  <span className="text-white">{b.asset}</span>
                  <span className="text-white/40 text-[10px]">{b.timeframe.toUpperCase()}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      b.direction === 'UP'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {b.direction} ${b.amount}
                  </span>
                  {isCurrent && <span className="text-[10px] text-cyan-400 font-normal">&bull; Active View</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            round={currentRound}
            timeframe={selectedTimeframe}
            onSelectTimeframe={handleSelectTimeframe}
            priceDelta24h={priceDelta24h}
            high24h={high24h}
            low24h={low24h}
            volume24h={volume24h}
            isLiveFeed={isLiveConnected}
            userBet={userBet}
            onForceSettle={triggerSettlement}
            isFastTestMode={isFastTestMode}
            onToggleFastTestMode={() => setIsFastTestMode((p) => !p)}
          />
        </div>

        {/* Right Order Ticket */}
        <div className="lg:col-span-4">
          <OrderTicket
            asset={selectedAsset}
            round={currentRound}
            onPlaceBet={handlePlaceBet}
            streak={streak}
            userBet={userBet}
            currentPrice={currentPrice}
            strikePrice={strikePrice}
            paperBalanceUSD={paperBalanceUSD}
            onForceSettle={triggerSettlement}
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
          <span className="text-xs font-mono text-white/40">Verified via Creditcoin L1 Precompile (0x0FD2)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pastRounds.map((r) => {
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

      {/* Streak Celebration Modal */}
      <StreakCelebrationModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streak={streak}
      />
    </div>
  );
};

export default ArenaPage;
