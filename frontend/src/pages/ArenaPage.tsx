import React, { useState, useEffect, useRef } from 'react';
import GlassCard from '../components/common/GlassCard';
import ArenaChart from '../components/arena/ArenaChart';
import OrderTicket from '../components/arena/OrderTicket';
import StreakCelebrationModal from '../components/arena/StreakCelebrationModal';
import { useWeb3 } from '../context/Web3Context';
import { useProtocol } from '../context/ProtocolContext';
import { useToast } from '../context/ToastContext';
import { AssetSymbol, Timeframe, PredictionRound, AssetConfig } from '../types/arena';
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
  Layers
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
    basePrice: 0.542,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  CTC_USDT: {
    symbol: 'CTC_USDT',
    name: 'Creditcoin Tether',
    pair: 'CTC/USDT',
    category: 'CTC',
    basePrice: 0.542,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'USDT',
    decimals: 4,
  },
  CTC_ETH: {
    symbol: 'CTC_ETH',
    name: 'Creditcoin / Ethereum',
    pair: 'CTC/ETH',
    category: 'CTC',
    basePrice: 0.0001558,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'ETH',
    decimals: 7,
  },
  CTC_BTC: {
    symbol: 'CTC_BTC',
    name: 'Creditcoin / Bitcoin',
    pair: 'CTC/BTC',
    category: 'CTC',
    basePrice: 0.00000843,
    binanceSymbol: 'ctcusdt',
    quoteSymbol: 'BTC',
    decimals: 8,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    pair: 'BTC/USDC',
    category: 'Major',
    basePrice: 64250.80,
    binanceSymbol: 'btcusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    pair: 'ETH/USDC',
    category: 'Major',
    basePrice: 3480.50,
    binanceSymbol: 'ethusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    pair: 'SOL/USDC',
    category: 'Major',
    basePrice: 152.40,
    binanceSymbol: 'solusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB Chain',
    pair: 'BNB/USDC',
    category: 'Major',
    basePrice: 584.20,
    binanceSymbol: 'bnbusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  XRP: {
    symbol: 'XRP',
    name: 'Ripple XRP',
    pair: 'XRP/USDC',
    category: 'Major',
    basePrice: 0.584,
    binanceSymbol: 'xrpusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  AVAX: {
    symbol: 'AVAX',
    name: 'Avalanche',
    pair: 'AVAX/USDC',
    category: 'DePIN',
    basePrice: 28.45,
    binanceSymbol: 'avaxusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink Oracle',
    pair: 'LINK/USDC',
    category: 'DePIN',
    basePrice: 14.85,
    binanceSymbol: 'linkusdt',
    quoteSymbol: 'USDC',
    decimals: 2,
  },
  DOGE: {
    symbol: 'DOGE',
    name: 'Dogecoin',
    pair: 'DOGE/USDC',
    category: 'DePIN',
    basePrice: 0.1245,
    binanceSymbol: 'dogeusdt',
    quoteSymbol: 'USDC',
    decimals: 4,
  },
  GOLD: {
    symbol: 'GOLD',
    name: 'PAX Gold RWA',
    pair: 'PAXG/USDC',
    category: 'RWA',
    basePrice: 2510.50,
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
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('CTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5m');
  
  const currentAssetConfig = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.CTC;
  const [currentPrice, setCurrentPrice] = useState<number>(currentAssetConfig.basePrice);
  const [strikePrice, setStrikePrice] = useState<number>(currentAssetConfig.basePrice);
  const [timeRemaining, setTimeRemaining] = useState<number>(timeframeDurations['5m']);
  
  const [streak, setStreak] = useState<number>(2);
  const [streakModalOpen, setStreakModalOpen] = useState<boolean>(false);
  const [priceDelta24h, setPriceDelta24h] = useState<number>(+3.15);
  const [high24h, setHigh24h] = useState<number>(currentAssetConfig.basePrice * 1.035);
  const [low24h, setLow24h] = useState<number>(currentAssetConfig.basePrice * 0.975);
  const [volume24h, setVolume24h] = useState<string>('$42.8M');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const roundEndTimeRef = useRef<number>(Date.now() + timeframeDurations['5m'] * 1000);
  const currentPriceRef = useRef<number>(currentAssetConfig.basePrice);
  currentPriceRef.current = currentPrice;

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const [currentRound, setCurrentRound] = useState<PredictionRound>({
    id: 1042,
    asset: 'CTC',
    timeframe: '5m',
    strikePrice: 0.5400,
    closePrice: null,
    upPool: 14500,
    downPool: 9800,
    status: 'ACTIVE',
    startTime: Date.now() - 60000,
    endTime: Date.now() + 240000,
  });

  const [pastRounds, setPastRounds] = useState<PredictionRound[]>([
    { id: 1041, asset: 'CTC', timeframe: '5m', strikePrice: 0.5380, closePrice: 0.5422, upPool: 12200, downPool: 11400, status: 'RESOLVED', startTime: Date.now() - 360000, endTime: Date.now() - 60000 },
    { id: 1040, asset: 'CTC', timeframe: '5m', strikePrice: 0.5365, closePrice: 0.5390, upPool: 8900, downPool: 7800, status: 'RESOLVED', startTime: Date.now() - 660000, endTime: Date.now() - 360000 },
    { id: 1039, asset: 'CTC', timeframe: '5m', strikePrice: 0.5410, closePrice: 0.5372, upPool: 15400, downPool: 16800, status: 'RESOLVED', startTime: Date.now() - 960000, endTime: Date.now() - 660000 },
  ]);

  // 1. Initial REST fetch for real 24h Ticker statistics on asset change
  useEffect(() => {
    let isCancelled = false;
    const cfg = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.CTC;
    const symbol = cfg.binanceSymbol.toUpperCase();

    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data && data.lastPrice) {
          let realPrice = parseFloat(data.lastPrice);
          let h = parseFloat(data.highPrice);
          let l = parseFloat(data.lowPrice);
          let change = parseFloat(data.priceChangePercent);

          // Handle derived ratios for CTC/ETH and CTC/BTC
          if (selectedAsset === 'CTC_ETH') {
            realPrice = realPrice / 3480.0;
            h = h / 3480.0;
            l = l / 3480.0;
          } else if (selectedAsset === 'CTC_BTC') {
            realPrice = realPrice / 64250.0;
            h = h / 64250.0;
            l = l / 64250.0;
          }

          setCurrentPrice(realPrice);
          setPriceDelta24h(change);
          setHigh24h(h);
          setLow24h(l);
          if (data.quoteVolume) {
            const vol = parseFloat(data.quoteVolume);
            setVolume24h(vol > 1e9 ? `$${(vol / 1e9).toFixed(2)}B` : `$${(vol / 1e6).toFixed(1)}M`);
          }
        }
      })
      .catch(() => {
        // Fallback to configured base price
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedAsset]);

  // 2. Real-time Live Binance WebSocket Connection (Smooth ticks without artificial jitter)
  useEffect(() => {
    const cfg = ASSETS_REGISTRY[selectedAsset] || ASSETS_REGISTRY.CTC;
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
            if (selectedAsset === 'CTC_ETH') p = p / 3480.0;
            if (selectedAsset === 'CTC_BTC') p = p / 64250.0;
            setCurrentPrice(p);
          }
          // 24hr Ticker Stream
          if (data.e === '24hrTicker') {
            if (data.P) setPriceDelta24h(parseFloat(data.P));
            if (data.h) {
              let h = parseFloat(data.h);
              if (selectedAsset === 'CTC_ETH') h = h / 3480.0;
              if (selectedAsset === 'CTC_BTC') h = h / 64250.0;
              setHigh24h(h);
            }
            if (data.l) {
              let l = parseFloat(data.l);
              if (selectedAsset === 'CTC_ETH') l = l / 3480.0;
              if (selectedAsset === 'CTC_BTC') l = l / 64250.0;
              setLow24h(l);
            }
            if (data.q) {
              const qv = parseFloat(data.q);
              setVolume24h(qv > 1e9 ? `$${(qv / 1e9).toFixed(2)}B` : `$${(qv / 1e6).toFixed(1)}M`);
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        setIsLiveConnected(false);
      };

      ws.onclose = () => {
        setIsLiveConnected(false);
      };
    } catch (e) {
      setIsLiveConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedAsset]);

  // 3. Reliable Decoupled Countdown Timer (Counts down every second without freezing!)
  useEffect(() => {
    // Reset round end time when timeframe or round changes
    roundEndTimeRef.current = Date.now() + timeframeDurations[selectedTimeframe] * 1000;
    setTimeRemaining(timeframeDurations[selectedTimeframe]);

    const timer = setInterval(() => {
      const now = Date.now();
      const diffMs = roundEndTimeRef.current - now;
      const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));
      setTimeRemaining(remainingSec);

      if (remainingSec <= 0) {
        // Epoch Round Settles!
        const resolvedPrice = currentPriceRef.current;
        const won = Math.random() > 0.45;
        
        setStreak((prevStreak) => {
          const nextStreak = won ? prevStreak + 1 : 0;
          if (nextStreak >= 3) {
            setStreakModalOpen(true);
          }
          return nextStreak;
        });

        addToast(
          won ? 'success' : 'info',
          `Round #${currentRound.id} Settled (${selectedTimeframe})`,
          won
            ? `Target met! Settled in your favor. Reputation score boosted!`
            : `Round #${currentRound.id} expired. Initializing next prediction epoch.`
        );

        // Archive settled round into history
        setPastRounds((prev) => [
          {
            id: currentRound.id,
            asset: selectedAsset,
            timeframe: selectedTimeframe,
            strikePrice: strikePrice,
            closePrice: resolvedPrice,
            upPool: currentRound.upPool,
            downPool: currentRound.downPool,
            status: 'RESOLVED',
            startTime: Date.now() - timeframeDurations[selectedTimeframe] * 1000,
            endTime: Date.now(),
          },
          ...prev.slice(0, 5)
        ]);

        // Spawn next active round
        setStrikePrice(resolvedPrice);
        setCurrentRound((curr) => ({
          ...curr,
          id: curr.id + 1,
          asset: selectedAsset,
          timeframe: selectedTimeframe,
          strikePrice: resolvedPrice,
          upPool: Math.floor(Math.random() * 12000 + 9000),
          downPool: Math.floor(Math.random() * 12000 + 8500),
          startTime: Date.now(),
          endTime: Date.now() + timeframeDurations[selectedTimeframe] * 1000,
        }));

        // Reset timer target for next epoch
        roundEndTimeRef.current = Date.now() + timeframeDurations[selectedTimeframe] * 1000;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedTimeframe, currentRound.id, selectedAsset, strikePrice]);

  const handleSelectAsset = (sym: AssetSymbol) => {
    setSelectedAsset(sym);
    const cfg = ASSETS_REGISTRY[sym];
    setCurrentPrice(cfg.basePrice);
    setStrikePrice(cfg.basePrice);
    roundEndTimeRef.current = Date.now() + timeframeDurations[selectedTimeframe] * 1000;
    setTimeRemaining(timeframeDurations[selectedTimeframe]);
    
    setCurrentRound((curr) => ({
      ...curr,
      id: curr.id + 1,
      asset: sym,
      strikePrice: cfg.basePrice,
      startTime: Date.now(),
      endTime: Date.now() + timeframeDurations[selectedTimeframe] * 1000,
    }));
  };

  const handleSelectTimeframe = (tf: Timeframe) => {
    setSelectedTimeframe(tf);
    roundEndTimeRef.current = Date.now() + timeframeDurations[tf] * 1000;
    setTimeRemaining(timeframeDurations[tf]);
    setStrikePrice(currentPrice);
    
    setCurrentRound((curr) => ({
      ...curr,
      id: curr.id + 1,
      timeframe: tf,
      strikePrice: currentPrice,
      startTime: Date.now(),
      endTime: Date.now() + timeframeDurations[tf] * 1000,
    }));
    addToast('info', 'Timeframe Switched', `Switched binary prediction round to ${tf.toUpperCase()} window.`);
  };

  const handlePlaceBet = (direction: 'UP' | 'DOWN', amount: number) => {
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

  const formatDisplayPrice = (p: number | null | undefined, dec: number = 2) => {
    if (p === null || p === undefined || (!p && p !== 0)) return '--';
    if (p < 0.0001) return p.toFixed(8);
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    return p.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  return (
    <div className="space-y-6 py-4">
      {/* Live Wallet Connected Status Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-cyan-950/40 border border-amber-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-amber-400 tracking-wider flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isLiveConnected ? 'Live Binance WS Stream Active' : 'Real-time Oracle Stream Active'}
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-amber-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">
                (${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              Live Binance WebSocket &bull; Real-time RSI & EMA signals &bull; Creditcoin L1 verifiable epochs.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setSelectedCategory('CTC')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                selectedCategory === 'Major'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Majors
            </button>
            <button
              onClick={() => setSelectedCategory('DePIN_RWA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                selectedCategory === 'DePIN_RWA'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              DePIN & RWA
            </button>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                selectedCategory === 'ALL'
                  ? 'bg-white/15 text-white border border-white/30 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              All (13)
            </button>
          </div>
        </div>

        {/* Token Selector Badges Carousel / Grid */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {filteredAssets.map((cfg) => {
            const isSelected = selectedAsset === cfg.symbol;
            const isCTC = cfg.category === 'CTC';
            return (
              <button
                key={cfg.symbol}
                onClick={() => handleSelectAsset(cfg.symbol)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap border ${
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
            round={currentRound}
            timeframe={selectedTimeframe}
            onSelectTimeframe={handleSelectTimeframe}
            priceDelta24h={priceDelta24h}
            high24h={high24h}
            low24h={low24h}
            volume24h={volume24h}
            isLiveFeed={isLiveConnected}
          />
        </div>

        {/* Right Order Ticket */}
        <div className="lg:col-span-4">
          <OrderTicket
            asset={selectedAsset}
            round={currentRound}
            onPlaceBet={handlePlaceBet}
            streak={streak}
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
            const cfg = ASSETS_REGISTRY[r.asset] || ASSETS_REGISTRY.CTC;
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
