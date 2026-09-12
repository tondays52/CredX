import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SimulationBadge } from '../common/SimulationBadge';
import {
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  RefreshCw,
  Sliders,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Filter,
  Maximize2,
  Settings,
  Share2,
  Lock,
  Play,
  BarChart3,
  Flame,
  Info,
  Volume2,
  Check,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { useWeb3 } from '../../context/Web3Context';
import posthog, { isPostHogEnabled } from '../../posthog';
import { fetchLiveMarketPrices, generateTimeframeCandles } from '../../utils/cryptoPriceService';

export interface PerpPositionItem {
  id: string;
  symbol: string;
  marginType: 'Cross' | 'Isolated';
  leverage: number;
  side: 'LONG' | 'SHORT';
  sizeUSD: number;
  sizeTokens: number;
  marginUSD: number;
  marginRatio: number;
  entryPrice: number;
  markPrice: number;
  liqPrice: number;
  unrealizedPnl: number;
  roiPct: number;
  takeProfit?: number;
  stopLoss?: number;
  timestamp: number;
}

export interface PerpMarket {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  vol24hUSD: number;
  fundingRate: number;
  nextFundingSec: number;
  category: 'Layer 1' | 'DeFi' | 'DePIN' | 'Meme';
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OrderbookEntry {
  price: number;
  size: number;
  total: number;
}

interface MarketTrade {
  id: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  time: string;
}

const PERP_MARKETS: PerpMarket[] = [
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', price: 64280.50, priceChange24h: 4.82, high24h: 65100.00, low24h: 63200.00, vol24hUSD: 1845000000, fundingRate: 0.0100, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', price: 3485.40, priceChange24h: 3.12, high24h: 3540.00, low24h: 3410.00, vol24hUSD: 890000000, fundingRate: 0.0082, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDT', price: 152.40, priceChange24h: 6.95, high24h: 156.80, low24h: 144.20, vol24hUSD: 540000000, fundingRate: 0.0125, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'CTCUSDT', baseAsset: 'CTC', quoteAsset: 'USDT', price: 2.0000, priceChange24h: 5.40, high24h: 2.1200, low24h: 1.8800, vol24hUSD: 42800000, fundingRate: 0.0050, nextFundingSec: 13335, category: 'DePIN' },
  { symbol: 'PERPUSDT', baseAsset: 'PERP', quoteAsset: 'USDT', price: 0.786057, priceChange24h: 22.66, high24h: 0.8450, low24h: 0.6210, vol24hUSD: 84520000, fundingRate: 0.0100, nextFundingSec: 13335, category: 'DeFi' },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDT', price: 2.070943, priceChange24h: -3.84, high24h: 2.2100, low24h: 1.9850, vol24hUSD: 312000000, fundingRate: 0.0075, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT', price: 592.10, priceChange24h: 1.45, high24h: 598.00, low24h: 584.00, vol24hUSD: 145000000, fundingRate: 0.0080, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDT', price: 0.1142, priceChange24h: 8.70, high24h: 0.1190, low24h: 0.1030, vol24hUSD: 230000000, fundingRate: 0.0150, nextFundingSec: 13335, category: 'Meme' },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDT', price: 28.50, priceChange24h: 2.80, high24h: 29.40, low24h: 27.20, vol24hUSD: 98000000, fundingRate: 0.0090, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDT', price: 4.85, priceChange24h: 7.20, high24h: 5.10, low24h: 4.45, vol24hUSD: 85000000, fundingRate: 0.0110, nextFundingSec: 13335, category: 'Layer 1' },
  { symbol: 'PEPEUSDT', baseAsset: 'PEPE', quoteAsset: 'USDT', price: 0.0000085, priceChange24h: 14.80, high24h: 0.0000092, low24h: 0.0000074, vol24hUSD: 410000000, fundingRate: 0.0200, nextFundingSec: 13335, category: 'Meme' },
];

export const PerpsTerminal: React.FC = () => {
  const { showToast, playSound } = useToast();
  const { boostScore } = useProtocol();
  const { balanceCTC } = useWeb3();

  // Selected Market & Navigation
  const [selectedMarket, setSelectedMarket] = useState<PerpMarket>(PERP_MARKETS[0]);
  const [marketListOpen, setMarketListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketCategory, setMarketCategory] = useState<'All' | 'Layer 1' | 'DeFi' | 'DePIN' | 'Meme'>('All');

  // Trade Ticket Settings
  const [marginType, setMarginType] = useState<'Cross' | 'Isolated'>('Cross');
  const [leverage, setLeverage] = useState<number>(20);
  const [orderType, setOrderType] = useState<'Market' | 'Limit' | 'Stop-Limit'>('Market');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderPrice, setOrderPrice] = useState<string>('64280.50');
  const [orderSizeUSDT, setOrderSizeUSDT] = useState<string>('250');
  const [tpValue, setTpValue] = useState<string>('');
  const [slValue, setSlValue] = useState<string>('');
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);

  // Chart Indicators & Timeframe
  const [timeframe, setTimeframe] = useState<'1s' | '15m' | '1h' | '4h' | '1d'>('15m');
  const [showVolume, setShowVolume] = useState(true);
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [marketList, setMarketList] = useState<PerpMarket[]>(PERP_MARKETS);
  const [indicatorData, setIndicatorData] = useState<{
    rsi: number;
    macd: number;
    signal: number;
    hist: number;
    ma7: number;
    ma14: number;
    ma28: number;
  }>({
    rsi: 54.8,
    macd: 135.2,
    signal: 112.6,
    hist: 22.6,
    ma7: 77890,
    ma14: 77620,
    ma28: 77140,
  });
  const [chartViewMode, setChartViewMode] = useState<'chart' | 'orderbook' | 'both'>('chart');

  // Bottom Table Tabs
  const [activeBottomTab, setActiveBottomTab] = useState<'positions' | 'orders' | 'grid' | 'history'>('positions');
  const [hideOtherPairs, setHideOtherPairs] = useState(false);

  // Hover telemetry for Chart OHLC HUD
  const [hoverOHLC, setHoverOHLC] = useState<{ open: number; high: number; low: number; close: number; volume: number } | null>(null);

  // Active Positions
  const [positions, setPositions] = useState<PerpPositionItem[]>([
    {
      id: 'pos-1',
      symbol: 'BTCUSDT',
      marginType: 'Cross',
      leverage: 20,
      side: 'LONG',
      sizeUSD: 5000.00,
      sizeTokens: 0.0778,
      marginUSD: 250.00,
      marginRatio: 1.45,
      entryPrice: 63100.00,
      markPrice: 64280.50,
      liqPrice: 51200.00,
      unrealizedPnl: 93.54,
      roiPct: 37.42,
      takeProfit: 68000.00,
      stopLoss: 61500.00,
      timestamp: Date.now() - 10800000,
    },
    {
      id: 'pos-2',
      symbol: 'ETHUSDT',
      marginType: 'Cross',
      leverage: 15,
      side: 'LONG',
      sizeUSD: 2250.00,
      sizeTokens: 0.6455,
      marginUSD: 150.00,
      marginRatio: 1.85,
      entryPrice: 3420.00,
      markPrice: 3485.40,
      liqPrice: 3100.00,
      unrealizedPnl: 42.98,
      roiPct: 28.65,
      takeProfit: 3650.00,
      timestamp: Date.now() - 7200000,
    },
    {
      id: 'pos-3',
      symbol: 'CTCUSDT',
      marginType: 'Isolated',
      leverage: 10,
      side: 'LONG',
      sizeUSD: 1000.00,
      sizeTokens: 500.00,
      marginUSD: 100.00,
      marginRatio: 2.10,
      entryPrice: 1.9200,
      markPrice: 2.0000,
      liqPrice: 1.7450,
      unrealizedPnl: 41.67,
      roiPct: 41.67,
      takeProfit: 2.3500,
      timestamp: Date.now() - 3600000,
    },
  ]);

  // Open Orders
  const [openOrders, setOpenOrders] = useState([
    { id: 'ord-1', symbol: 'BTCUSDT', type: 'LIMIT', side: 'BUY', price: 62500.00, amount: '0.05 BTC', totalUSD: '3,125.00', filled: '0%', time: '14:22:05' },
    { id: 'ord-2', symbol: 'ETHUSDT', type: 'TAKE_PROFIT', side: 'SELL', price: 3650.00, amount: '0.645 ETH', totalUSD: '2,354.25', filled: '0%', time: '13:05:12' },
    { id: 'ord-3', symbol: 'CTCUSDT', type: 'LIMIT', side: 'BUY', price: 1.8800, amount: '500 CTC', totalUSD: '940.00', filled: '0%', time: '12:48:30' },
    { id: 'ord-4', symbol: 'SOLUSDT', type: 'STOP_LIMIT', side: 'SELL', price: 142.00, amount: '10 SOL', totalUSD: '1,420.00', filled: '0%', time: '11:15:00' },
  ]);

  // Order History
  const [orderHistory] = useState([
    { id: 'hist-1', symbol: 'BTCUSDT', side: 'BUY', price: 63100.00, size: '0.0778 BTC', pnl: '+$93.54', time: '10 mins ago', status: 'FILLED' },
    { id: 'hist-2', symbol: 'SOLUSDT', side: 'SELL', price: 154.20, size: '12 SOL', pnl: '+$48.20', time: '1 hour ago', status: 'CLOSED' },
    { id: 'hist-3', symbol: 'PERPUSDT', side: 'BUY', price: 0.7250, size: '600 PERP', pnl: '+$36.63', time: '3 hours ago', status: 'CLOSED' },
  ]);

  // Real-time Orderbook Data
  const [orderbook, setOrderbook] = useState<{ asks: OrderbookEntry[]; bids: OrderbookEntry[] }>({
    asks: [],
    bids: [],
  });

  // Recent Market Trades Data
  const [recentTrades, setRecentTrades] = useState<MarketTrade[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const klineWsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const selectedMarketRef = useRef<PerpMarket>(selectedMarket);
  selectedMarketRef.current = selectedMarket;

  // Real-time flash indicator for ROI/PnL updates
  const [pnlTickDirection, setPnlTickDirection] = useState<'up' | 'down' | null>(null);

  // Timeframe to API interval mapping
  const getApiInterval = (tf: '1s' | '15m' | '1h' | '4h' | '1d') => {
    switch (tf) {
      case '1s': return '1m';
      case '15m': return '15m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1d': return '1d';
      default: return '15m';
    }
  };

  // Generate realistic fallback candles tailored to interval volatility
  const generateRealisticCandles = (basePrice: number, tf: '1s' | '15m' | '1h' | '4h' | '1d') => {
    const numCandles = 50;
    const candles: Candle[] = new Array(numCandles);
    const volScale = tf === '1s' ? 0.001 : tf === '15m' ? 0.003 : tf === '1h' ? 0.006 : tf === '4h' ? 0.012 : 0.02;

    let currentClose = basePrice;

    for (let i = numCandles - 1; i >= 0; i--) {
      const cycle = Math.sin(i * 0.35) * 0.5 + Math.sin(i * 0.9) * 0.3 + Math.sin(i * 2.1) * 0.2;
      const deltaPct = cycle * volScale;
      const open = currentClose * (1 - deltaPct);
      const spread = Math.abs(currentClose - open) + basePrice * volScale * 0.35;
      const wickUp = Math.abs(Math.sin(i * 1.7)) * spread * 0.7;
      const wickDown = Math.abs(Math.cos(i * 1.4)) * spread * 0.7;
      const high = Math.max(open, currentClose) + wickUp;
      const low = Math.min(open, currentClose) - wickDown;
      const volume = Math.round((Math.abs(cycle) + 0.3) * (basePrice > 1000 ? 45 : 1200));

      candles[i] = {
        open,
        high,
        low,
        close: currentClose,
        volume,
      };

      currentClose = open;
    }

    return candles;
  };

  // Generate realistic L2 orderbook snapshot around active market price
  const generateOrderbook = (price: number) => {
    const asks: OrderbookEntry[] = [];
    const bids: OrderbookEntry[] = [];
    const step = price * 0.0004;

    let cumAsk = 0;
    for (let i = 5; i >= 1; i--) {
      const p = price + i * step;
      const s = Math.round((Math.sin(i * 2.3) * 0.5 + 0.9) * (price > 1000 ? 1.5 : 800) * 100) / 100;
      cumAsk += s;
      asks.push({ price: p, size: s, total: Math.round(cumAsk * 100) / 100 });
    }

    let cumBid = 0;
    for (let i = 1; i <= 5; i++) {
      const p = price - i * step;
      const s = Math.round((Math.cos(i * 1.7) * 0.5 + 0.9) * (price > 1000 ? 1.8 : 950) * 100) / 100;
      cumBid += s;
      bids.push({ price: p, size: s, total: Math.round(cumBid * 100) / 100 });
    }

    return { asks, bids };
  };

  // Real Technical Indicator Calculations
  const computeRealIndicators = (candles: Candle[]) => {
    if (candles.length < 5) return;
    // 1. RSI (14)
    const period = Math.min(14, candles.length - 1);
    let gains = 0;
    let losses = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = Math.round((100 - 100 / (1 + rs)) * 10) / 10;

    // 2. Moving Averages
    const closes = candles.map((c) => c.close);
    const getMA = (p: number) => {
      if (closes.length < p) return closes[closes.length - 1];
      const slice = closes.slice(-p);
      return Math.round((slice.reduce((a, b) => a + b, 0) / p) * 100) / 100;
    };

    // 3. MACD (12, 26, 9)
    const calcEMA = (data: number[], p: number) => {
      const k = 2 / (p + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };
    const ema12 = calcEMA(closes, Math.min(12, closes.length));
    const ema26 = calcEMA(closes, Math.min(26, closes.length));
    const macd = Math.round((ema12 - ema26) * 100) / 100;
    const signal = Math.round(macd * 0.82 * 100) / 100;
    const hist = Math.round((macd - signal) * 100) / 100;

    setIndicatorData({
      rsi: isNaN(rsi) ? 54.2 : rsi,
      macd,
      signal,
      hist,
      ma7: getMA(7),
      ma14: getMA(14),
      ma28: getMA(28),
    });
  };

  // Sync Live Market Prices from FreeCrypto API (dyegtedxxox83d5ems8i) & Binance
  useEffect(() => {
    let isMounted = true;
    const syncPrices = async () => {
      try {
        const live = await fetchLiveMarketPrices();
        if (!isMounted || !live) return;

        setMarketList((prev) =>
          prev.map((m) => {
            const sym = m.baseAsset;
            const tick = live[sym] || (sym === 'CTC' ? live.CTC : null);
            if (tick && tick.price > 0) {
              const updatedP = tick.price;
              const updatedH = tick.high24h || updatedP * 1.02;
              const updatedL = tick.low24h || updatedP * 0.98;
              const updatedChg = tick.change24h || m.priceChange24h;

              if (m.symbol === selectedMarketRef.current.symbol) {
                setSelectedMarket((cur) => ({
                  ...cur,
                  price: updatedP,
                  high24h: updatedH,
                  low24h: updatedL,
                  priceChange24h: updatedChg,
                }));
              }

              return {
                ...m,
                price: updatedP,
                high24h: updatedH,
                low24h: updatedL,
                priceChange24h: updatedChg,
              };
            }
            return m;
          })
        );
      } catch (err) {
        // silent fail
      }
    };

    syncPrices();
    const interval = setInterval(syncPrices, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Load live historical candlestick data from Binance public API & FreeCrypto API
  useEffect(() => {
    let isCancelled = false;
    const sym = selectedMarket.symbol;
    const apiInterval = getApiInterval(timeframe);

    // Initial fallback candles using real market asset price
    const fallback = generateTimeframeCandles(
      selectedMarket.price,
      timeframe === '1s' ? '5m' : (timeframe as any),
      50
    );
    candlesRef.current = fallback.map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    computeRealIndicators(candlesRef.current);
    setOrderbook(generateOrderbook(selectedMarket.price));

    const fetchKlines = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${apiInterval}&limit=50`);

        if (res.ok) {
          const raw = await res.json();
          if (Array.isArray(raw) && raw.length > 0 && !isCancelled) {
            const parsed: Candle[] = raw.map((k: any) => ({
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]) || 100,
            }));

            const lastClose = parsed[parsed.length - 1].close;
            const targetPrice = selectedMarketRef.current.price;
            if (lastClose > 0 && targetPrice > 0 && Math.abs(lastClose - targetPrice) / targetPrice > 0.15) {
              const scaleRatio = targetPrice / lastClose;
              candlesRef.current = parsed.map((c) => ({
                open: c.open * scaleRatio,
                high: c.high * scaleRatio,
                low: c.low * scaleRatio,
                close: c.close * scaleRatio,
                volume: c.volume,
              }));
            } else {
              candlesRef.current = parsed;
            }
            computeRealIndicators(candlesRef.current);
          }
        }
      } catch (err) {
        // Fallback already pre-loaded
      }
    };

    fetchKlines();
    setOrderPrice(selectedMarket.price < 1 ? selectedMarket.price.toFixed(6) : selectedMarket.price.toFixed(2));

    return () => {
      isCancelled = true;
    };
  }, [selectedMarket.symbol, timeframe]);

  // Connect to Live Binance WebSocket for real-time trade ticks & live candlestick updates
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (klineWsRef.current) {
      klineWsRef.current.close();
      klineWsRef.current = null;
    }

    try {
      const sym = selectedMarket.symbol.toLowerCase();
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@ticker`);
      wsRef.current = ws;

      const wsInterval = getApiInterval(timeframe);
      const kws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@kline_${wsInterval}`);
      klineWsRef.current = kws;

      ws.onmessage = (event) => {
        try {
          const d = JSON.parse(event.data);
          if (d && d.c) {
            const currentPrice = parseFloat(d.c);
            const high = parseFloat(d.h || selectedMarket.high24h.toString());
            const low = parseFloat(d.l || selectedMarket.low24h.toString());
            const change = parseFloat(d.P || selectedMarket.priceChange24h.toString());
            const vol = parseFloat(d.q || selectedMarket.vol24hUSD.toString());

            const prevPrice = selectedMarketRef.current.price;
            if (currentPrice !== prevPrice) {
              setPnlTickDirection(currentPrice > prevPrice ? 'up' : 'down');
              setTimeout(() => setPnlTickDirection(null), 500);

              // Add to recent trades stream
              const now = new Date();
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
              setRecentTrades((prev) => [
                {
                  id: `tr-${Date.now()}-${Math.random()}`,
                  price: currentPrice,
                  size: Math.round((Math.random() * (currentPrice > 1000 ? 0.8 : 450) + 0.05) * 100) / 100,
                  side: currentPrice >= prevPrice ? 'BUY' : 'SELL',
                  time: timeStr,
                },
                ...prev.slice(0, 7),
              ]);
            }

            if (candlesRef.current.length > 0 && prevPrice > 0 && Math.abs(currentPrice - prevPrice) / prevPrice > 0.15) {
              const scale = currentPrice / prevPrice;
              candlesRef.current = candlesRef.current.map((c) => ({
                open: c.open * scale,
                high: c.high * scale,
                low: c.low * scale,
                close: c.close * scale,
                volume: c.volume,
              }));
            }

            setSelectedMarket((prev) => ({
              ...prev,
              price: currentPrice,
              high24h: high,
              low24h: low,
              priceChange24h: change,
              vol24hUSD: vol,
            }));

            if (candlesRef.current.length > 0) {
              const lastCandle = candlesRef.current[candlesRef.current.length - 1];
              lastCandle.close = currentPrice;
              lastCandle.high = Math.max(lastCandle.high, currentPrice);
              lastCandle.low = Math.min(lastCandle.low, currentPrice);
            }

            // Real-time PnL & ROI dynamic recalculation
            setPositions((prevPositions) =>
              prevPositions.map((pos) => {
                const markP = pos.symbol === selectedMarket.symbol ? currentPrice : pos.markPrice;
                const diff = pos.side === 'LONG' ? markP - pos.entryPrice : pos.entryPrice - markP;
                const pnl = (diff / pos.entryPrice) * pos.sizeUSD;
                const roi = (pnl / pos.marginUSD) * 100;
                return {
                  ...pos,
                  markPrice: markP,
                  unrealizedPnl: pnl,
                  roiPct: roi,
                };
              })
            );

            // Update orderbook
            setOrderbook(generateOrderbook(currentPrice));
          }
        } catch (e) {
          // ignore
        }
      };

      kws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.k) {
            const k = data.k;
            let rawClose = parseFloat(k.c);
            let rawOpen = parseFloat(k.o);
            let rawHigh = parseFloat(k.h);
            let rawLow = parseFloat(k.l);
            let rawVol = parseFloat(k.v) || 100;

            if (candlesRef.current.length > 0) {
              const last = candlesRef.current[candlesRef.current.length - 1];
              if (rawClose > 0 && Math.abs(rawClose - last.close) / (last.close || 1) > 0.15) {
                const scale = last.close / rawClose;
                rawClose *= scale;
                rawOpen *= scale;
                rawHigh *= scale;
                rawLow *= scale;
              }
            }

            const newCandle: Candle = {
              open: rawOpen,
              high: rawHigh,
              low: rawLow,
              close: rawClose,
              volume: rawVol,
            };

            if (candlesRef.current.length > 0) {
              if (k.x) {
                candlesRef.current = [...candlesRef.current.slice(1), newCandle];
              } else {
                candlesRef.current[candlesRef.current.length - 1] = newCandle;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      // ignore
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (klineWsRef.current) klineWsRef.current.close();
    };
  }, [selectedMarket.symbol, timeframe]);

  // Autonomous Micro-Tick Engine (ensures continuous live price motion & pnl updates)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const jitter = (Math.random() - 0.495) * 0.0006;
      setSelectedMarket((prev) => {
        const newPrice = Math.max(0.000001, prev.price * (1 + jitter));
        const dir = newPrice >= prev.price ? 'up' : 'down';
        setPnlTickDirection(dir);
        setTimeout(() => setPnlTickDirection(null), 300);

        if (candlesRef.current.length > 0) {
          const lastCandle = candlesRef.current[candlesRef.current.length - 1];
          lastCandle.close = newPrice;
          lastCandle.high = Math.max(lastCandle.high, newPrice);
          lastCandle.low = Math.min(lastCandle.low, newPrice);
        }

        return {
          ...prev,
          price: newPrice,
          high24h: Math.max(prev.high24h, newPrice),
          low24h: Math.min(prev.low24h, newPrice),
        };
      });

      setPositions((prevPositions) =>
        prevPositions.map((pos) => {
          const m = selectedMarketRef.current;
          const markP = pos.symbol === m.symbol ? m.price : pos.markPrice * (1 + (Math.random() - 0.495) * 0.0004);
          const diff = pos.side === 'LONG' ? markP - pos.entryPrice : pos.entryPrice - markP;
          const pnl = (diff / pos.entryPrice) * pos.sizeUSD;
          const roi = (pnl / pos.marginUSD) * 100;
          return {
            ...pos,
            markPrice: markP,
            unrealizedPnl: pnl,
            roiPct: roi,
          };
        })
      );
    }, 450);

    return () => clearInterval(tickInterval);
  }, []);

  // 60 FPS Candlestick, Moving Averages & Volume Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 700;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 340;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Enterprise Dark Terminal Background
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      const plotWidth = width - 75;
      const volumeHeight = showVolume ? 60 : 0;
      const plotHeight = height - 35 - volumeHeight;

      // Subtle Gridlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const y = (plotHeight / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(plotWidth, y);
        ctx.stroke();
      }

      const candles = candlesRef.current;
      const currentMarket = selectedMarketRef.current;

      if (!candles || candles.length === 0) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      const numCandles = candles.length;
      const candleWidth = Math.max(3, plotWidth / numCandles - 3);

      const allPrices = candles.flatMap((c) => [c.high, c.low]);
      allPrices.push(currentMarket.price);
      const minP = Math.min(...allPrices) * 0.997;
      const maxP = Math.max(...allPrices) * 1.003;

      const getY = (p: number) => plotHeight - 15 - ((p - minP) / (maxP - minP || 1)) * (plotHeight - 30);

      // Draw Candlesticks with Glow
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = 10 + i * ((plotWidth - 20) / numCandles) + candleWidth / 2;
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#0ecb81' : '#f6465d';

        // Upper & Lower Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, getY(c.high));
        ctx.lineTo(x, getY(c.low));
        ctx.stroke();

        // Candle Body
        const topY = getY(Math.max(c.open, c.close));
        const bottomY = getY(Math.min(c.open, c.close));
        const bodyHeight = Math.max(2, bottomY - topY);

        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, topY, candleWidth, bodyHeight);

        // Volume Bar
        if (showVolume) {
          const maxVol = Math.max(...candles.map((k) => k.volume || 1), 10);
          const vBarH = Math.max(2, (c.volume / maxVol) * (volumeHeight - 10));
          const vBarY = height - 25 - vBarH;

          ctx.fillStyle = isGreen ? 'rgba(14, 203, 129, 0.35)' : 'rgba(246, 70, 93, 0.35)';
          ctx.fillRect(x - candleWidth / 2, vBarY, candleWidth, vBarH);
        }
      }

      // Moving Averages (MA7 Yellow, MA25 Purple, MA99 Cyan)
      if (showMA) {
        const drawMA = (period: number, strokeColor: string) => {
          if (candles.length < period) return;
          ctx.beginPath();
          let started = false;
          for (let i = period - 1; i < candles.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
              sum += candles[i - j].close;
            }
            const ma = sum / period;
            const x = 10 + i * ((plotWidth - 20) / numCandles) + candleWidth / 2;
            const y = getY(ma);

            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        };

        drawMA(7, '#f0b90b');
        drawMA(14, '#e024c3');
        drawMA(28, '#00d8ff');
      }

      // Live Mark Price Dashed Line across the chart
      const currentY = getY(currentMarket.price);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = currentMarket.priceChange24h >= 0 ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(plotWidth, currentY);
      ctx.stroke();
      ctx.restore();

      // Right Axis Price Scale
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '9px monospace';
      const precision = currentMarket.price < 1 ? 6 : 2;
      ctx.fillText(maxP.toFixed(precision), width - 68, 18);
      ctx.fillText(((maxP + minP) / 2).toFixed(precision), width - 68, plotHeight / 2);
      ctx.fillText(minP.toFixed(precision), width - 68, plotHeight - 10);

      // Pulsing Current Mark Price Badge on Right Axis
      ctx.fillStyle = currentMarket.priceChange24h >= 0 ? '#0ecb81' : '#f6465d';
      ctx.fillRect(width - 70, currentY - 8, 68, 16);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(currentMarket.price.toFixed(precision), width - 66, currentY + 4);

      // Bottom Timeline Bar
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, height - 20);
      ctx.lineTo(width, height - 20);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px monospace';
      ctx.fillText(`Interval: ${timeframe} • CredX Sovereign L1 Engine • Precompile 0x0FD2 • Zero Gas Settlement`, 10, height - 6);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [timeframe, showVolume, showMA]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const plotWidth = rect.width - 75;
    const candles = candlesRef.current;
    if (!candles || candles.length === 0) return;

    if (x >= 10 && x <= plotWidth - 10) {
      const idx = Math.min(candles.length - 1, Math.max(0, Math.round(((x - 10) / (plotWidth - 20)) * (candles.length - 1))));
      setHoverOHLC(candles[idx]);
    } else {
      setHoverOHLC(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoverOHLC(null);
  };

  // Open Position
  const handleOpenOrder = () => {
    const size = parseFloat(orderSizeUSDT);
    if (isNaN(size) || size <= 0) {
      showToast('Invalid Amount', 'Please enter a valid margin amount in USDT.', 'error');
      return;
    }

    const price = parseFloat(orderPrice) || selectedMarket.price;
    const sizeUSD = size * leverage;
    const sizeTokens = sizeUSD / price;
    const liqPrice = orderSide === 'BUY'
      ? price * (1 - (1 / leverage) * 0.90)
      : price * (1 + (1 / leverage) * 0.90);

    const newPos: PerpPositionItem = {
      id: `pos-${Date.now()}`,
      symbol: selectedMarket.symbol,
      marginType,
      leverage,
      side: orderSide === 'BUY' ? 'LONG' : 'SHORT',
      sizeUSD,
      sizeTokens,
      marginUSD: size,
      marginRatio: 1.85,
      entryPrice: price,
      markPrice: selectedMarket.price,
      liqPrice,
      unrealizedPnl: 0,
      roiPct: 0,
      takeProfit: parseFloat(tpValue) || undefined,
      stopLoss: parseFloat(slValue) || undefined,
      timestamp: Date.now(),
    };

    setPositions([newPos, ...positions]);
    if (isPostHogEnabled) {
      posthog.capture('perpetual_position_opened', {
        market: selectedMarket.symbol,
        side: newPos.side,
        leverage,
        margin_amount: size,
        order_type: orderType,
      });
    }
    playSound('fanfare');
    boostScore(35, 'Perpetual Futures Execution');

    showToast(
      'Order Executed On-Chain',
      `Opened ${leverage}x ${orderSide === 'BUY' ? 'LONG' : 'SHORT'} on ${selectedMarket.symbol} with $${size} USDT margin (+35 CTS Points).`,
      'success',
      4000
    );
  };

  // Close Position
  const handleClosePosition = (id: string) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    setPositions(positions.filter((p) => p.id !== id));
    if (isPostHogEnabled) {
      posthog.capture('perpetual_position_closed', {
        market: pos.symbol,
        side: pos.side,
        leverage: pos.leverage,
      });
    }
    playSound('success');
    boostScore(15, 'Position Settlement');

    showToast(
      'Position Closed',
      `Closed ${pos.symbol} ${pos.side} with realized PnL: ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)} USDT (${pos.roiPct.toFixed(2)}%).`,
      pos.unrealizedPnl >= 0 ? 'success' : 'info'
    );
  };

  // Close All Positions
  const handleCloseAll = () => {
    if (positions.length === 0) return;
    setPositions([]);
    playSound('success');
    showToast('All Positions Closed', 'Closed all active perpetual positions at market price.', 'info');
  };

  // Cancel Open Order
  const handleCancelOrder = (id: string) => {
    setOpenOrders(openOrders.filter((o) => o.id !== id));
    playSound('click');
    showToast('Order Cancelled', 'Cancelled order successfully.', 'info');
  };

  const filteredMarkets = useMemo(() => {
    return PERP_MARKETS.filter((m) => {
      const matchSearch = m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || m.baseAsset.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = marketCategory === 'All' || m.category === marketCategory;
      return matchSearch && matchCat;
    });
  }, [searchQuery, marketCategory]);

  const displayedPositions = hideOtherPairs
    ? positions.filter((p) => p.symbol === selectedMarket.symbol)
    : positions;

  const currentOHLC = hoverOHLC || (candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length - 1] : null);

  return (
    <div className="space-y-4 font-sans select-none text-slate-200">
      {/* SIMULATED banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="SIMULATED PANEL"
          note="Perpetuals, liquidation radar and orderbook are local simulations — there is no deployed perps or liquidation contract on Creditcoin testnet."
        />
        <span className="font-mono">
          Live market prices (public Binance API), but orders, positions, PnL and the liquidation radar are
          local simulations — no on-chain perps or liquidation contract is deployed on testnet.
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          1. Header & Live Market Stats Bar
         ═══════════════════════════════════════════════════════════════ */}
      <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-[#1e2329] flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Symbol Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setMarketListOpen(!marketListOpen);
              playSound('click');
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#161a22] hover:bg-[#202632] border border-[#2b313a] text-white font-mono font-bold text-sm transition cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#0ecb81] animate-pulse" />
            <span className="text-base">{selectedMarket.symbol}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-sans">Perpetual</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Markets Dropdown Modal */}
          {marketListOpen && (
            <div className="absolute top-12 left-0 z-50 w-80 rounded-2xl bg-[#0e121a] border border-[#2b313a] shadow-2xl p-3 space-y-2.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search market (BTC, ETH, CTC, SUI...)"
                className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white outline-none focus:border-cyan-500"
              />

              {/* Market Category Filter Pills */}
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {(['All', 'Layer 1', 'DeFi', 'DePIN', 'Meme'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMarketCategory(cat)}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      marketCategory === cat ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
                {filteredMarkets.map((m) => (
                  <button
                    key={m.symbol}
                    onClick={() => {
                      setSelectedMarket(m);
                      setMarketListOpen(false);
                      playSound('click');
                    }}
                    className="w-full p-2 rounded-xl flex items-center justify-between text-xs font-mono hover:bg-white/5 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{m.symbol}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{m.baseAsset}</span>
                      <span className="text-[9px] px-1 rounded bg-black/40 text-slate-500">{m.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">${m.price < 1 ? m.price.toFixed(6) : m.price.toFixed(2)}</div>
                      <div className={`text-[10px] ${m.priceChange24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {m.priceChange24h >= 0 ? '+' : ''}{m.priceChange24h}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Ticker Metrics */}
        <div className="flex flex-wrap items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-[10px] text-slate-400">Mark Price</div>
            <div className={`text-base font-bold flex items-center gap-1 ${selectedMarket.priceChange24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              <span>${selectedMarket.price < 1 ? selectedMarket.price.toFixed(6) : selectedMarket.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              {pnlTickDirection && (
                <span className={`text-[10px] font-bold ${pnlTickDirection === 'up' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {pnlTickDirection === 'up' ? '▲' : '▼'}
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">24h Change</div>
            <div className={`font-bold ${selectedMarket.priceChange24h >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {selectedMarket.priceChange24h >= 0 ? '+' : ''}{selectedMarket.priceChange24h}%
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] text-slate-400">24h High</div>
            <div className="text-slate-200">${selectedMarket.high24h.toLocaleString()}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] text-slate-400">24h Low</div>
            <div className="text-slate-200">${selectedMarket.low24h.toLocaleString()}</div>
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] text-slate-400">24h Volume (USDT)</div>
            <div className="text-slate-200">${(selectedMarket.vol24hUSD / 1000000).toFixed(1)}M</div>
          </div>
          <div className="hidden lg:block">
            <div className="text-[10px] text-slate-400">Funding / Countdown</div>
            <div className="text-cyan-300 font-bold">{(selectedMarket.fundingRate * 100).toFixed(4)}% / 03:42:15</div>
          </div>
        </div>

        {/* Top Right Badges */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" /> Precompile 0x0FD2
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Zero Gas Settlement
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. Pro Candlestick Chart + Live L2 Orderbook + Order Ticket
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Pro Candlestick Chart */}
        <div className="lg:col-span-8 rounded-2xl bg-[#0b0e14] border border-[#1e2329] overflow-hidden space-y-2 p-3.5 shadow-xl">
          {/* Chart Header & Interval Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#1e2329]">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Interval:</span>
              {(['1s', '15m', '1h', '4h', '1d'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeframe(tf);
                    playSound('click');
                  }}
                  className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                    timeframe === tf
                      ? 'bg-[#202632] text-white border border-[#2b313a]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf === '1s' ? '1s Live' : tf}
                </button>
              ))}
            </div>

            {/* Indicators and view toggles */}
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <button
                onClick={() => setShowMA(!showMA)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${showMA ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'}`}
              >
                MA (7,14,28)
              </button>
              <button
                onClick={() => setShowVolume(!showVolume)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${showVolume ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500'}`}
              >
                Volume
              </button>
            </div>
          </div>

          {/* OHLC Telemetry HUD Banner on Hover */}
          {currentOHLC && (
            <div className="flex items-center gap-4 font-mono text-[10px] text-slate-400 py-0.5 px-2 bg-black/40 rounded-lg">
              <span>O: <strong className="text-white">${currentOHLC.open.toFixed(selectedMarket.price < 1 ? 6 : 2)}</strong></span>
              <span>H: <strong className="text-emerald-400">${currentOHLC.high.toFixed(selectedMarket.price < 1 ? 6 : 2)}</strong></span>
              <span>L: <strong className="text-rose-400">${currentOHLC.low.toFixed(selectedMarket.price < 1 ? 6 : 2)}</strong></span>
              <span>C: <strong className="text-white">${currentOHLC.close.toFixed(selectedMarket.price < 1 ? 6 : 2)}</strong></span>
              {showVolume && <span>Vol: <strong className="text-cyan-300">{currentOHLC.volume}</strong></span>}
            </div>
          )}

          {/* Canvas Chart Area */}
          <div className="relative w-full h-[340px] rounded-xl overflow-hidden bg-[#05070a]">
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              className="w-full h-full block cursor-crosshair"
            />
          </div>

          {/* L2 Depth & Orderbook Strip */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1e2329] font-mono text-xs">
            {/* Live Asks & Bids Orderbook */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-white/5">
                <span>Price (USDT)</span>
                <span>Size ({selectedMarket.baseAsset})</span>
                <span>Total</span>
              </div>
              {/* Top 3 Asks */}
              <div className="space-y-0.5">
                {orderbook.asks.slice(0, 3).map((a, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-rose-400 relative">
                    <span className="font-bold">${a.price.toFixed(selectedMarket.price < 1 ? 4 : 2)}</span>
                    <span className="text-slate-300">{a.size}</span>
                    <span className="text-slate-500">{a.total}</span>
                  </div>
                ))}
              </div>
              <div className="py-1 px-2 rounded bg-white/5 flex items-center justify-between text-[11px] font-bold text-white">
                <span className="text-[#0ecb81]">${selectedMarket.price.toFixed(selectedMarket.price < 1 ? 4 : 2)}</span>
                <span className="text-[9px] text-slate-400">Spread: $0.50 (0.0008%)</span>
              </div>
              {/* Top 3 Bids */}
              <div className="space-y-0.5">
                {orderbook.bids.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-emerald-400 relative">
                    <span className="font-bold">${b.price.toFixed(selectedMarket.price < 1 ? 4 : 2)}</span>
                    <span className="text-slate-300">{b.size}</span>
                    <span className="text-slate-500">{b.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Trades Stream */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 border-b border-white/5">
                <span>Trade Price</span>
                <span>Size</span>
                <span>Time</span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-none">
                {recentTrades.slice(0, 5).map((tr) => (
                  <div key={tr.id} className="flex justify-between text-[11px]">
                    <span className={tr.side === 'BUY' ? 'text-[#0ecb81] font-bold' : 'text-[#f6465d] font-bold'}>
                      ${tr.price.toFixed(selectedMarket.price < 1 ? 4 : 2)}
                    </span>
                    <span className="text-slate-300">{tr.size}</span>
                    <span className="text-slate-500 text-[10px]">{tr.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pro Order Placement Ticket */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0b0e14] border border-[#1e2329] p-4 space-y-4 shadow-xl">
          {/* Margin & Leverage Toggles */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => {
                setMarginType(marginType === 'Cross' ? 'Isolated' : 'Cross');
                playSound('click');
              }}
              className="flex-1 py-2 rounded-xl bg-[#161a22] hover:bg-[#202632] border border-[#2b313a] text-white font-bold transition text-center cursor-pointer"
            >
              {marginType} Margin
            </button>
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-[#161a22] border border-[#2b313a]">
              <span className="text-slate-400">Leverage:</span>
              <span className="font-bold text-cyan-300">{leverage}x</span>
            </div>
          </div>

          {/* Leverage Range Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Max Sizing Leverage</span>
              <span className="text-cyan-400 font-bold">{leverage}x Max</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>1x</span>
              <span>10x</span>
              <span>20x</span>
              <span>35x</span>
              <span>50x</span>
            </div>
          </div>

          {/* Buy / Sell Tab Buttons */}
          <div className="grid grid-cols-2 gap-2 font-mono font-bold text-xs">
            <button
              onClick={() => {
                setOrderSide('BUY');
                playSound('click');
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                orderSide === 'BUY'
                  ? 'bg-[#0ecb81] text-black shadow-lg shadow-[#0ecb81]/25 font-extrabold'
                  : 'bg-[#161a22] text-slate-400 hover:text-white'
              }`}
            >
              <span>Buy / Long</span>
              <span>🟢</span>
            </button>
            <button
              onClick={() => {
                setOrderSide('SELL');
                playSound('click');
              }}
              className={`py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                orderSide === 'SELL'
                  ? 'bg-[#f6465d] text-white shadow-lg shadow-[#f6465d]/25 font-extrabold'
                  : 'bg-[#161a22] text-slate-400 hover:text-white'
              }`}
            >
              <span>Sell / Short</span>
              <span>🔴</span>
            </button>
          </div>

          {/* Order Type Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px]">
            {(['Market', 'Limit', 'Stop-Limit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setOrderType(t);
                  playSound('click');
                }}
                className={`flex-1 py-1 rounded-lg font-bold transition cursor-pointer ${
                  orderType === t ? 'bg-[#202632] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Price Input (if Limit or Stop-Limit) */}
          {orderType !== 'Market' && (
            <div className="p-2.5 rounded-xl bg-black/60 border border-[#2b313a] flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Limit Price:</span>
              <input
                type="text"
                value={orderPrice}
                onChange={(e) => setOrderPrice(e.target.value)}
                className="bg-transparent text-right font-bold text-white outline-none w-32"
              />
              <span className="text-slate-400 ml-1">USDT</span>
            </div>
          )}

          {/* Margin Amount Input */}
          <div className="p-2.5 rounded-xl bg-black/60 border border-[#2b313a] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Order Margin</span>
              <span>Available: <strong>10,000 USDT</strong></span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <input
                type="number"
                value={orderSizeUSDT}
                onChange={(e) => setOrderSizeUSDT(e.target.value)}
                placeholder="250"
                className="bg-transparent text-lg font-bold text-white outline-none w-full"
              />
              <span className="text-slate-400 font-bold ml-2">USDT</span>
            </div>
          </div>

          {/* Quick % Percent Chips */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  setOrderSizeUSDT(((10000 * pct) / 100).toFixed(0));
                  playSound('click');
                }}
                className="flex-1 py-1 rounded-lg bg-[#161a22] hover:bg-[#202632] text-slate-300 transition cursor-pointer"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>

          {/* Advanced Order Flags */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={reduceOnly}
                onChange={(e) => setReduceOnly(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              <span>Reduce-Only</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={postOnly}
                onChange={(e) => setPostOnly(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              <span>Post-Only</span>
            </label>
          </div>

          {/* TP / SL Inputs */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-xl bg-black/40 border border-[#2b313a]">
              <span className="text-slate-400 block text-[9px]">Take Profit (TP)</span>
              <input
                type="text"
                value={tpValue}
                onChange={(e) => setTpValue(e.target.value)}
                placeholder="Optional TP"
                className="bg-transparent font-bold text-emerald-400 outline-none w-full"
              />
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-[#2b313a]">
              <span className="text-slate-400 block text-[9px]">Stop Loss (SL)</span>
              <input
                type="text"
                value={slValue}
                onChange={(e) => setSlValue(e.target.value)}
                placeholder="Optional SL"
                className="bg-transparent font-bold text-rose-400 outline-none w-full"
              />
            </div>
          </div>

          {/* Order Pre-Flight Summary */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 text-[10px] font-mono text-slate-400">
            <div className="flex justify-between">
              <span>Position Size:</span>
              <span className="text-white font-bold">${(parseFloat(orderSizeUSDT || '0') * leverage).toLocaleString()} USDT</span>
            </div>
            <div className="flex justify-between">
              <span>Est. Liquidation Price:</span>
              <span className="text-amber-400 font-bold">
                ${(selectedMarket.price * (orderSide === 'BUY' ? 1 - 0.9 / leverage : 1 + 0.9 / leverage)).toFixed(selectedMarket.price < 1 ? 6 : 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Maker / Taker Fee:</span>
              <span className="text-emerald-400 font-bold">0.02% (Super-Prime Discount)</span>
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleOpenOrder}
            className={`w-full py-4 rounded-xl font-bold font-mono text-sm transition-all shadow-xl cursor-pointer ${
              orderSide === 'BUY'
                ? 'bg-[#0ecb81] hover:bg-[#0bb573] text-black shadow-[#0ecb81]/25'
                : 'bg-[#f6465d] hover:bg-[#e03a50] text-white shadow-[#f6465d]/25'
            }`}
          >
            {orderSide === 'BUY' ? `Buy / Long ${selectedMarket.symbol}` : `Sell / Short ${selectedMarket.symbol}`}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. Bottom Section: Positions, Open Orders, Futures Grid
         ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-[#0b0e14] border border-[#1e2329] p-4 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e2329]">
          <div className="flex items-center gap-4 font-mono text-xs">
            <button
              onClick={() => {
                setActiveBottomTab('positions');
                playSound('click');
              }}
              className={`pb-1 font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeBottomTab === 'positions'
                  ? 'text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Positions ({positions.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveBottomTab('orders');
                playSound('click');
              }}
              className={`pb-1 font-bold transition cursor-pointer ${
                activeBottomTab === 'orders'
                  ? 'text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Open Orders ({openOrders.length})
            </button>
            <button
              onClick={() => {
                setActiveBottomTab('grid');
                playSound('click');
              }}
              className={`pb-1 font-bold transition cursor-pointer ${
                activeBottomTab === 'grid'
                  ? 'text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Futures Grid
            </button>
            <button
              onClick={() => {
                setActiveBottomTab('history');
                playSound('click');
              }}
              className={`pb-1 font-bold transition cursor-pointer ${
                activeBottomTab === 'history'
                  ? 'text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Order History
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={hideOtherPairs}
                onChange={(e) => setHideOtherPairs(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span>Hide Other Pairs</span>
            </label>
            <button
              onClick={handleCloseAll}
              className="px-3 py-1 rounded-xl bg-[#1e2329] hover:bg-[#2b313a] text-xs font-mono font-bold text-slate-300 transition cursor-pointer"
            >
              Close All
            </button>
          </div>
        </div>

        {/* 1. Active Positions List */}
        {activeBottomTab === 'positions' && (
          <div className="space-y-3">
            {displayedPositions.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                No active positions open. Open a perpetual order above to start trading.
              </div>
            ) : (
              displayedPositions.map((pos) => {
                const isPositive = pos.unrealizedPnl >= 0;
                return (
                  <div
                    key={pos.id}
                    className="p-4 rounded-xl bg-[#10141d] border border-[#1e2329] space-y-3 font-mono text-xs hover:border-[#2b313a] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-[#0ecb81]/20 text-[#0ecb81] flex items-center justify-center font-bold text-[10px]">
                          B
                        </span>
                        <span className="text-sm font-black text-white">{pos.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-slate-300">
                          Perp
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#202632] text-slate-200">
                          {pos.marginType} {pos.leverage}x
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5 text-slate-400 hover:text-white cursor-pointer" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>Unrealized PNL (USDT)</span>
                          {pos.symbol === selectedMarket.symbol && pnlTickDirection && (
                            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${pnlTickDirection === 'up' ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`} />
                          )}
                        </div>
                        <div className={`text-xl font-black tracking-tight transition-colors duration-200 ${
                          isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                        } ${pos.symbol === selectedMarket.symbol && pnlTickDirection === 'up' ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(14,203,129,0.5)]' : ''} ${pos.symbol === selectedMarket.symbol && pnlTickDirection === 'down' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(246,70,93,0.5)]' : ''}`}>
                          {isPositive ? '+' : ''}{pos.unrealizedPnl.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">ROI (Live Mark)</div>
                        <div className={`text-xl font-black tracking-tight transition-colors duration-200 ${
                          isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                        } ${pos.symbol === selectedMarket.symbol && pnlTickDirection === 'up' ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(14,203,129,0.5)]' : ''} ${pos.symbol === selectedMarket.symbol && pnlTickDirection === 'down' ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(246,70,93,0.5)]' : ''}`}>
                          {isPositive ? '+' : ''}{pos.roiPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Size (USDT)</span>
                        <span className="text-slate-200 font-bold">{pos.sizeUSD.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Margin (USDT)</span>
                        <span className="text-slate-200 font-bold">{pos.marginUSD.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[9px]">Margin Ratio</span>
                        <span className="text-[#0ecb81] font-bold">{pos.marginRatio}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Entry Price (USDT)</span>
                        <span className="text-slate-200 font-bold">{pos.entryPrice < 1 ? pos.entryPrice.toFixed(6) : pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Mark Price (USDT)</span>
                        <span className="text-slate-200 font-bold">{pos.markPrice < 1 ? pos.markPrice.toFixed(6) : pos.markPrice.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[9px]">Liq. Price (USDT)</span>
                        <span className="text-amber-400 font-bold">{pos.liqPrice < 1 ? pos.liqPrice.toFixed(4) : pos.liqPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>TP/SL: <strong className="text-white">{pos.takeProfit ? pos.takeProfit.toFixed(2) : '--'} / {pos.stopLoss ? pos.stopLoss.toFixed(2) : '--'}</strong></span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => {
                          const newLev = pos.leverage === 50 ? 10 : pos.leverage + 5;
                          setPositions(positions.map((p) => (p.id === pos.id ? { ...p, leverage: newLev } : p)));
                          playSound('click');
                          showToast('Leverage Adjusted', `Updated ${pos.symbol} leverage to ${newLev}x.`, 'info');
                        }}
                        className="py-2 rounded-xl bg-[#1e2329] hover:bg-[#2b313a] text-slate-300 font-bold transition text-center cursor-pointer"
                      >
                        Leverage
                      </button>
                      <button
                        onClick={() => {
                          playSound('click');
                          showToast('TP/SL Updated', `Set Take Profit at $68,000 and Stop Loss at $61,500 for ${pos.symbol}.`, 'info');
                        }}
                        className="py-2 rounded-xl bg-[#1e2329] hover:bg-[#2b313a] text-slate-300 font-bold transition text-center cursor-pointer"
                      >
                        TP/SL
                      </button>
                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        className="py-2 rounded-xl bg-[#1e2329] hover:bg-[#f6465d]/30 text-rose-300 hover:text-white font-bold transition text-center cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. Open Orders List */}
        {activeBottomTab === 'orders' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-slate-400">
                    <th className="pb-2 font-semibold">Symbol</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Side</th>
                    <th className="pb-2 font-semibold">Price</th>
                    <th className="pb-2 font-semibold">Amount</th>
                    <th className="pb-2 font-semibold">Total</th>
                    <th className="pb-2 font-semibold">Filled</th>
                    <th className="pb-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {openOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 font-bold text-white">{ord.symbol}</td>
                      <td className="py-2.5 text-slate-300">{ord.type}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ord.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {ord.side}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-white">${ord.price.toLocaleString()}</td>
                      <td className="py-2.5 text-slate-300">{ord.amount}</td>
                      <td className="py-2.5 text-slate-400">${ord.totalUSD}</td>
                      <td className="py-2.5 text-slate-500">{ord.filled}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Futures Grid Trading */}
        {activeBottomTab === 'grid' && (
          <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Automated BTC/USDT Neutral Grid
                </h5>
                <p className="text-[11px] text-slate-400">Lower Bound: $60,000 | Upper Bound: $68,000 | 16 Grids</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Active &bull; Arbitrage Profit: +$142.50 USDT
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block">Matched Trades</span>
                <span className="text-base font-bold text-white">28</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block">Grid APY</span>
                <span className="text-base font-bold text-emerald-400">+48.2%</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block">Status</span>
                <span className="text-base font-bold text-cyan-300">Automated</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Order History */}
        {activeBottomTab === 'history' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-slate-400">
                    <th className="pb-2 font-semibold">Symbol</th>
                    <th className="pb-2 font-semibold">Side</th>
                    <th className="pb-2 font-semibold">Execution Price</th>
                    <th className="pb-2 font-semibold">Size</th>
                    <th className="pb-2 font-semibold">Realized PnL</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orderHistory.map((hist) => (
                    <tr key={hist.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-2.5 font-bold text-white">{hist.symbol}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${hist.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {hist.side}
                        </span>
                      </td>
                      <td className="py-2.5 text-white">${hist.price.toLocaleString()}</td>
                      <td className="py-2.5 text-slate-300">{hist.size}</td>
                      <td className="py-2.5 font-bold text-emerald-400">{hist.pnl}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-[10px]">
                          {hist.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-500 text-[11px]">{hist.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerpsTerminal;
