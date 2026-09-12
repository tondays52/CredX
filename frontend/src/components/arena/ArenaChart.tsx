import React, { useEffect, useRef, useState } from 'react';
import { AssetSymbol, Timeframe, PredictionRound, TechnicalSignals, UserBet } from '../../types/arena';
import { calculateTechnicalSignals } from '../../utils/technicalSignals';
import {
  CandleBar,
  generateTimeframeCandles,
  calculateMACDSeries,
  MACDPoint,
  ACCURATE_BASE_PRICES,
} from '../../utils/cryptoPriceService';
import {
  TrendingUp,
  Clock,
  Target,
  Flame,
  Activity,
  Zap,
  BarChart2,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CandlestickChart,
  LineChart
} from 'lucide-react';

interface ArenaChartProps {
  asset: AssetSymbol;
  assetPair: string;
  binanceSymbol: string;
  currentPrice: number;
  strikePrice: number;
  timeRemaining: number;
  round: PredictionRound;
  timeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  priceDelta24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: string;
  isLiveFeed?: boolean;
  userBet?: UserBet | null;
  onForceSettle?: () => void;
  isFastTestMode?: boolean;
  onToggleFastTestMode?: () => void;
}

export const ArenaChart: React.FC<ArenaChartProps> = ({
  asset,
  assetPair,
  binanceSymbol,
  currentPrice,
  strikePrice,
  timeRemaining,
  round,
  timeframe,
  onSelectTimeframe,
  priceDelta24h = +2.48,
  high24h,
  low24h,
  volume24h = '$1.84B',
  isLiveFeed = true,
  userBet,
  onForceSettle,
  isFastTestMode = false,
  onToggleFastTestMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const candlesRef = useRef<CandleBar[]>([]);
  const macdRef = useRef<MACDPoint[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastAssetRef = useRef<string>(asset);

  const [chartMode, setChartMode] = useState<'CANDLE' | 'LINE'>('CANDLE');
  const [axisPosition, setAxisPosition] = useState<'LEFT' | 'RIGHT'>('LEFT');

  const [technicalSignals, setTechnicalSignals] = useState<TechnicalSignals>({
    rsi: 54.2,
    rsiLabel: 'BULLISH',
    emaFast: currentPrice,
    emaSlow: currentPrice,
    trend: 'BULLISH',
    macd: 12.45,
    macdSignal: 8.20,
    signalHeadline: 'BULLISH MOMENTUM • ACCUMULATION ZONE',
    buyVolumeRatio: 56,
  });

  const timeframes: { id: Timeframe; label: string; desc: string }[] = [
    { id: '5m', label: '5 Mins', desc: 'Fast' },
    { id: '15m', label: '15 Mins', desc: 'Standard' },
    { id: '30m', label: '30 Mins', desc: 'Swing' },
    { id: '1h', label: '1 Hour', desc: 'Hourly' },
    { id: '1d', label: '1 Day', desc: 'Macro' },
  ];

  const formatPriceValue = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '--';
    if (val < 0.0001) return val.toFixed(8);
    if (val < 0.01) return val.toFixed(6);
    if (val < 1) return val.toFixed(4);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 1. Re-seed clean candles whenever asset or timeframe changes (Prevents cross-asset cliff bug!)
  useEffect(() => {
    lastAssetRef.current = asset;

    // Use currentPrice if valid for current asset, else accurate base price
    let base = currentPrice > 0 ? currentPrice : (ACCURATE_BASE_PRICES[asset] || 100);
    const expectedBase = ACCURATE_BASE_PRICES[asset] || 100;
    // Guard against stale cross-asset price
    if (Math.abs(base - expectedBase) / expectedBase > 0.5) {
      base = expectedBase;
    }

    const initialCandles = generateTimeframeCandles(base, timeframe, 42);
    candlesRef.current = initialCandles;
    macdRef.current = calculateMACDSeries(initialCandles);

    const closes = initialCandles.map((c) => c.close);
    const sigs = calculateTechnicalSignals(closes);
    setTechnicalSignals(sigs);
  }, [asset, timeframe]);

  // 2. Smoothly update forming candle with live real-time price ticks
  useEffect(() => {
    if (currentPrice <= 0) return;

    const candles = candlesRef.current;
    if (candles.length === 0) return;

    const lastCandle = candles[candles.length - 1];

    // Check if price belongs to current asset scale
    const pctDiff = Math.abs(currentPrice - lastCandle.close) / (lastCandle.close || 1);
    if (pctDiff > 0.35) {
      // In-flight asset switch, ignore rogue tick
      return;
    }

    const now = Date.now();
    let candleIntervalMs = 10 * 1000;
    if (timeframe === '15m') candleIntervalMs = 30 * 1000;
    if (timeframe === '30m') candleIntervalMs = 60 * 1000;
    if (timeframe === '1h') candleIntervalMs = 120 * 1000;
    if (timeframe === '1d') candleIntervalMs = 3600 * 1000;

    if (now - lastCandle.time >= candleIntervalMs) {
      // Push new forming candle
      const newCandle: CandleBar = {
        time: now,
        open: lastCandle.close,
        high: Math.max(lastCandle.close, currentPrice),
        low: Math.min(lastCandle.close, currentPrice),
        close: currentPrice,
        volume: Math.floor(Math.random() * 50 + 20), // NOSONAR
        isUp: currentPrice >= lastCandle.close,
      };
      candles.push(newCandle);
      if (candles.length > 50) {
        candles.shift();
      }
    } else {
      // Update forming candle
      lastCandle.close = currentPrice;
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
      lastCandle.isUp = lastCandle.close >= lastCandle.open;
    }

    // Recalculate MACD & signals
    macdRef.current = calculateMACDSeries(candles);
    const closes = candles.map((c) => c.close);
    const sigs = calculateTechnicalSignals(closes);
    setTechnicalSignals(sigs);
  }, [currentPrice, timeframe]);

  // 3. TradingView-Grade 60FPS Canvas Render Loop (Candlesticks + MACD Sub-Chart + Scales)
  useEffect(() => {
    let phase = 0;

    const render = () => {
      phase += 0.04;
      const canvas = canvasRef.current;
      if (!canvas) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.parentElement) {
        const parentW = canvas.parentElement.clientWidth;
        const parentH = canvas.parentElement.clientHeight || 480;
        if (canvas.width !== parentW || canvas.height !== parentH) {
          canvas.width = parentW;
          canvas.height = parentH;
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const candles = candlesRef.current;
      if (candles.length < 2) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Layout Dimensions:
      // When axisPosition === 'LEFT':
      // - Left Price Scale: 0 to scaleWidth (94px)
      // - Chart Area: scaleWidth to width
      // When axisPosition === 'RIGHT':
      // - Chart Area: 0 to width - scaleWidth
      // - Right Price Scale: width - scaleWidth to width
      const scaleWidth = 94;
      const chartStartX = axisPosition === 'LEFT' ? scaleWidth : 0;
      const chartEndX = axisPosition === 'LEFT' ? width : width - scaleWidth;
      const chartWidth = chartEndX - chartStartX;
      const scaleStartX = axisPosition === 'LEFT' ? 0 : chartEndX;

      const mainHeight = height - 145;
      const macdTop = mainHeight + 18;
      const macdHeight = 88;
      const timeAxisTop = height - 26;

      // ─── A. PRICE RANGE & PROJECTIONS ───
      const allHighs = candles.map((c) => c.high);
      const allLows = candles.map((c) => c.low);
      if (strikePrice > 0) {
        allHighs.push(strikePrice);
        allLows.push(strikePrice);
      }
      if (currentPrice > 0) {
        allHighs.push(currentPrice);
        allLows.push(currentPrice);
      }

      const minPrice = Math.min(...allLows) * 0.9992;
      const maxPrice = Math.max(...allHighs) * 1.0008;
      const priceRange = maxPrice - minPrice || 1;

      const getPriceY = (price: number) =>
        mainHeight - 15 - ((price - minPrice) / priceRange) * (mainHeight - 55);

      // ─── B. BACKGROUND & GRID ───
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, width, height);

      // Scale background subtle distinction
      ctx.fillStyle = '#090e15';
      ctx.fillRect(scaleStartX, 0, scaleWidth, height);

      // Scale Separator Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sepX = axisPosition === 'LEFT' ? scaleWidth : chartEndX;
      ctx.moveTo(sepX, 0);
      ctx.lineTo(sepX, height);
      ctx.stroke();

      // Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;

      // Vertical Grid Lines
      const candleSlotWidth = chartWidth / candles.length;
      candles.forEach((c, i) => {
        if (i % 6 === 0) {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, timeAxisTop);
          ctx.stroke();
        }
      });

      // Horizontal Grid Lines & Y-Axis Labels
      const gridSteps = 6;
      for (let i = 0; i <= gridSteps; i++) {
        const gridPrice = minPrice + (i / gridSteps) * priceRange;
        const y = getPriceY(gridPrice);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.beginPath();
        ctx.moveTo(chartStartX, y);
        ctx.lineTo(chartEndX, y);
        ctx.stroke();

        // Y-axis label in Price Scale Margin (Matches user reference image 2)
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        if (axisPosition === 'LEFT') {
          ctx.textAlign = 'right';
          ctx.fillText(formatPriceValue(gridPrice), scaleWidth - 10, y + 3.5);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(formatPriceValue(gridPrice), chartEndX + 8, y + 3.5);
        }
      }

      // Price Scale Top Header ("USD" as shown in user's image)
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px monospace';
      if (axisPosition === 'LEFT') {
        ctx.textAlign = 'right';
        ctx.fillText('USD', scaleWidth - 10, 18);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText('USD', chartEndX + 8, 18);
      }

      // ─── C. TOP-LEFT OVERLAY (TradingView Style Token & Coin Name) ───
      const last = candles[candles.length - 1];
      const overlayLeft = chartStartX + 14;

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${assetPair} • ${timeframe.toUpperCase()} • BINANCE / CREDIX ORACLE`,
        overlayLeft,
        18
      );

      // Real-Time OHLC Bar
      const chgColor = last.isUp ? '#10b981' : '#f43f5e';
      ctx.font = '10px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('O: ', overlayLeft, 34);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formatPriceValue(last.open), overlayLeft + 16, 34);

      ctx.fillStyle = '#64748b';
      ctx.fillText('H: ', overlayLeft + 92, 34);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formatPriceValue(last.high), overlayLeft + 108, 34);

      ctx.fillStyle = '#64748b';
      ctx.fillText('L: ', overlayLeft + 184, 34);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formatPriceValue(last.low), overlayLeft + 198, 34);

      ctx.fillStyle = '#64748b';
      ctx.fillText('C: ', overlayLeft + 274, 34);
      ctx.fillStyle = chgColor;
      ctx.fillText(formatPriceValue(last.close), overlayLeft + 290, 34);

      // ─── D. STRIKE PRICE REFERENCE LINE & SCALE PILL ───
      if (strikePrice > 0) {
        const strikeY = getPriceY(strikePrice);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(chartStartX, strikeY);
        ctx.lineTo(chartEndX, strikeY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Strike Target Pill in Price Scale
        const pillX = axisPosition === 'LEFT' ? 4 : chartEndX + 4;
        const pillW = scaleWidth - 8;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(pillX, strikeY - 9, pillW, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#070b0e';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatPriceValue(strikePrice), pillX + pillW / 2, strikeY + 3.5);
      }

      // ─── E. JAPANESE CANDLESTICKS OR PRO LINE ───
      const candleBodyWidth = Math.max(3, candleSlotWidth * 0.68);

      if (chartMode === 'CANDLE') {
        candles.forEach((c, i) => {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const openY = getPriceY(c.open);
          const closeY = getPriceY(c.close);
          const highY = getPriceY(c.high);
          const lowY = getPriceY(c.low);

          const isBull = c.close >= c.open;
          const barColor = isBull ? '#10b981' : '#f43f5e';

          // Wick
          ctx.strokeStyle = barColor;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, highY);
          ctx.lineTo(x, lowY);
          ctx.stroke();

          // Body
          const bodyY = Math.min(openY, closeY);
          const bodyH = Math.max(2, Math.abs(closeY - openY));

          ctx.fillStyle = barColor;
          ctx.fillRect(x - candleBodyWidth / 2, bodyY, candleBodyWidth, bodyH);
        });
      } else {
        // Mountain / Line mode
        const isAbove = currentPrice >= strikePrice;
        const themeColor = isAbove ? '#10b981' : '#f43f5e';
        const themeRGB = isAbove ? '16, 185, 129' : '244, 63, 94';

        ctx.beginPath();
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 2.5;
        candles.forEach((c, i) => {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const y = getPriceY(c.close);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Area fill
        const lastX = chartStartX + (candles.length - 1) * candleSlotWidth + candleSlotWidth / 2;
        ctx.lineTo(lastX, mainHeight);
        ctx.lineTo(chartStartX + candleSlotWidth / 2, mainHeight);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, mainHeight);
        grad.addColorStop(0, `rgba(${themeRGB}, 0.25)`);
        grad.addColorStop(1, `rgba(${themeRGB}, 0.0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // ─── F. CURRENT PRICE LINE & SCALE PILL ───
      const currentY = getPriceY(currentPrice);
      const isAboveStrike = currentPrice >= strikePrice;
      const liveColor = isAboveStrike ? '#10b981' : '#f43f5e';

      ctx.strokeStyle = liveColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(chartStartX, currentY);
      ctx.lineTo(chartEndX, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pulsing Beacon on Current Price
      const lastCandleX = chartStartX + (candles.length - 1) * candleSlotWidth + candleSlotWidth / 2;
      const pulseSize = 4 + Math.sin(phase * 3) * 2;
      ctx.beginPath();
      ctx.arc(lastCandleX, currentY, pulseSize + 3, 0, Math.PI * 2);
      ctx.fillStyle = isAboveStrike ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lastCandleX, currentY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = liveColor;
      ctx.fill();

      // Current Price Pill on Price Scale
      const currPillX = axisPosition === 'LEFT' ? 4 : chartEndX + 4;
      const currPillW = scaleWidth - 8;
      ctx.fillStyle = liveColor;
      ctx.beginPath();
      ctx.roundRect(currPillX, currentY - 9, currPillW, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatPriceValue(currentPrice), currPillX + currPillW / 2, currentY + 3.5);

      // ─── G. SUB-PANEL: MACD (12, 26, 9) (Matching TradingView Image 1) ───
      // Divider
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, mainHeight + 2, width, 1);

      // MACD Header Label & Values
      const macdPoints = macdRef.current;
      const lastMacd = macdPoints[macdPoints.length - 1] || { macd: 0, signal: 0, hist: 0 };

      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('MACD (12, 26, 9)', overlayLeft, macdTop - 4);

      ctx.font = '9.5px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`MACD: ${lastMacd.macd.toFixed(2)}`, overlayLeft + 105, macdTop - 4);

      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Signal: ${lastMacd.signal.toFixed(2)}`, overlayLeft + 200, macdTop - 4);

      ctx.fillStyle = lastMacd.hist >= 0 ? '#10b981' : '#f43f5e';
      ctx.fillText(`Hist: ${lastMacd.hist >= 0 ? '+' : ''}${lastMacd.hist.toFixed(2)}`, overlayLeft + 300, macdTop - 4);

      // Compute MACD Y-bounds
      if (macdPoints.length > 0) {
        const allM = macdPoints.flatMap((m) => [m.macd, m.signal, m.hist]);
        const maxM = Math.max(1, Math.max(...allM.map(Math.abs)));
        const macdCenterY = macdTop + macdHeight / 2;

        const getMacdY = (v: number) => macdCenterY - (v / maxM) * (macdHeight / 2 - 4);

        // Zero line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartStartX, macdCenterY);
        ctx.lineTo(chartEndX, macdCenterY);
        ctx.stroke();

        // MACD Histogram Bars
        macdPoints.forEach((m, i) => {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const barY = getMacdY(m.hist);
          const barH = macdCenterY - barY;

          ctx.fillStyle = m.hist >= 0 ? 'rgba(0, 229, 255, 0.75)' : 'rgba(244, 63, 94, 0.75)';
          const bW = Math.max(2, candleSlotWidth * 0.55);
          ctx.fillRect(x - bW / 2, barH >= 0 ? barY : macdCenterY, bW, Math.abs(barH));
        });

        // MACD Line (Blue)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        macdPoints.forEach((m, i) => {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const y = getMacdY(m.macd);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Signal Line (Orange)
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        macdPoints.forEach((m, i) => {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const y = getMacdY(m.signal);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // MACD Axis Ticks
        ctx.fillStyle = '#64748b';
        ctx.font = '9px monospace';
        if (axisPosition === 'LEFT') {
          ctx.textAlign = 'right';
          ctx.fillText(`+${maxM.toFixed(1)}`, scaleWidth - 10, macdTop + 10);
          ctx.fillText('0.0', scaleWidth - 10, macdCenterY + 3);
          ctx.fillText(`-${maxM.toFixed(1)}`, scaleWidth - 10, macdTop + macdHeight - 2);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(`+${maxM.toFixed(1)}`, chartEndX + 8, macdTop + 10);
          ctx.fillText('0.0', chartEndX + 8, macdCenterY + 3);
          ctx.fillText(`-${maxM.toFixed(1)}`, chartEndX + 8, macdTop + macdHeight - 2);
        }
      }

      // ─── H. BOTTOM TIME AXIS (Matching TradingView Image 1) ───
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, timeAxisTop, width, 1);

      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px monospace';
      ctx.textAlign = 'center';

      candles.forEach((c, i) => {
        if (i % 7 === 0 || i === candles.length - 1) {
          const x = chartStartX + i * candleSlotWidth + candleSlotWidth / 2;
          const d = new Date(c.time);
          let label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          if (timeframe === '1d') {
            label = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
          }
          ctx.fillText(label, x, height - 8);
        }
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentPrice, strikePrice, chartMode, timeframe, assetPair]);

  // Format countdown string mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deltaFromStrike = currentPrice - strikePrice;
  const isPositiveDelta = deltaFromStrike >= 0;

  return (
    <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/20 p-6 relative overflow-hidden shadow-2xl space-y-5">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Active Position Banner */}
      {userBet && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/15 to-emerald-500/20 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-white uppercase">Your Position:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                userBet.direction === 'UP'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              PREDICT {userBet.direction}
            </span>
            <span className="text-white/70">
              Stake: <strong className="text-white">${userBet.amount} USDC</strong>
            </span>
            <span className="text-white/70">
              Strike: <strong className="text-amber-400">${formatPriceValue(userBet.strikePrice)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {((userBet.direction === 'UP' && currentPrice >= userBet.strikePrice) ||
              (userBet.direction === 'DOWN' && currentPrice <= userBet.strikePrice)) ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> In The Money (+$
                {(userBet.amount * 0.92).toFixed(2)} Est. Profit)
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Out Of The Money
              </span>
            )}

            {onForceSettle && (
              <button
                onClick={onForceSettle}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] border border-amber-500/40 transition cursor-pointer"
              >
                ⚡ Settle Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative z-10 border-b border-white/[0.06] pb-4">
        {/* Asset Pair, Current Price & Mode Switcher */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                {assetPair}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                FREECRYPTO + BINANCE WS
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                ${formatPriceValue(currentPrice)}
              </span>
              <span
                className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                  priceDelta24h >= 0 ? 'text-[#10b981]' : 'text-rose-400'
                }`}
              >
                {priceDelta24h >= 0 ? '↑' : '↘'} {Math.abs(priceDelta24h).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Strike Target, Delta & Working Countdown Timer */}
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-right">
            <span className="text-[9px] text-gray-400 block uppercase tracking-wider">STRIKE TARGET</span>
            <span className="text-sm font-bold text-amber-400">
              ${formatPriceValue(strikePrice)}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-right">
            <span className="text-[9px] text-gray-400 block uppercase tracking-wider">TARGET DELTA</span>
            <span
              className={`text-sm font-bold ${
                isPositiveDelta ? 'text-[#10b981]' : 'text-rose-400'
              }`}
            >
              {isPositiveDelta ? '+' : '-'}${formatPriceValue(Math.abs(deltaFromStrike))}
            </span>
          </div>

          {/* Working Live Countdown Timer with Settle Action */}
          <div className="px-4 py-2 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/40 text-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <div className="flex items-center justify-center gap-1 text-[9px] text-cyan-300 uppercase tracking-wider">
              <Clock className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>ROUND TIMER</span>
            </div>
            <span className="text-lg font-black text-cyan-200 font-mono tracking-wider">
              {formatTimer(timeRemaining)}
            </span>
          </div>

          {/* Manual Settle Button for Testing & Verification */}
          {onForceSettle && (
            <button
              onClick={onForceSettle}
              title="Force epoch settlement immediately for testing"
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span>Settle Round</span>
            </button>
          )}

          {/* Fast 15s Test Mode Toggle */}
          {onToggleFastTestMode && (
            <button
              onClick={onToggleFastTestMode}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                isFastTestMode
                  ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-sm'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white'
              }`}
            >
              {isFastTestMode ? '⚡ 15s Rapid' : 'Standard'}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: Timeframe Selector + Candlestick/Line Toggle + Buy/Sell Volume */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08]">
            <span className="text-[10px] font-mono text-gray-500 uppercase px-2">TIMEFRAME:</span>
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => onSelectTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  timeframe === tf.id
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher (Candles vs Line) */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setChartMode('CANDLE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartMode === 'CANDLE'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Japanese Candlestick Chart"
            >
              <CandlestickChart className="w-3.5 h-3.5" />
              <span>Candles</span>
            </button>
            <button
              onClick={() => setChartMode('LINE')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartMode === 'LINE'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Smooth Line Chart"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
          </div>

          {/* Axis Position Toggle (Left vs Right Price Scale) */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08]">
            <span className="text-[10px] font-mono text-gray-500 uppercase px-1.5">AXIS:</span>
            <button
              onClick={() => setAxisPosition('LEFT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                axisPosition === 'LEFT'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Price scale on left side (matching standard indicator layout)"
            >
              Left
            </button>
            <button
              onClick={() => setAxisPosition('RIGHT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                axisPosition === 'RIGHT'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Price scale on right side"
            >
              Right
            </button>
          </div>
        </div>

        {/* Real Dynamic Buy/Sell Order Pressure Indicator */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-[#10b981] font-bold">BUY {technicalSignals.buyVolumeRatio}%</span>
          <div className="w-32 sm:w-44 h-2 rounded-full bg-rose-500/30 overflow-hidden flex">
            <div
              style={{ width: `${technicalSignals.buyVolumeRatio}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-[#10b981] transition-all duration-300 shadow-[0_0_10px_#10b981]"
            />
          </div>
          <span className="text-rose-400 font-bold">{100 - technicalSignals.buyVolumeRatio}% SELL</span>
        </div>
      </div>

      {/* Main 60FPS TradingView-Grade Canvas (Candlesticks + MACD Sub-Panel + Scales) */}
      <div className="relative w-full h-[480px] rounded-2xl overflow-hidden bg-[#03070a] border border-white/[0.06]">
        <canvas
          ref={canvasRef}
          width={880}
          height={480}
          className="w-full h-full block select-none"
        />
      </div>
    </div>
  );
};

export default ArenaChart;
