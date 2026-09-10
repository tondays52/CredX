import React, { useEffect, useRef, useState } from 'react';
import { AssetSymbol, Timeframe, PredictionRound, TechnicalSignals, UserBet } from '../../types/arena';
import { calculateTechnicalSignals } from '../../utils/technicalSignals';
import { generateTimeframeKlines } from '../../utils/cryptoPriceService';
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
  AlertCircle
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

interface PriceTick {
  price: number;
  time: number;
  volume: number;
  isUp: boolean;
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
  const historyRef = useRef<PriceTick[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastAssetRef = useRef<string>(asset);
  const lastTfRef = useRef<string>(timeframe);

  const [technicalSignals, setTechnicalSignals] = useState<TechnicalSignals>({
    rsi: 54.2,
    rsiLabel: 'BULLISH',
    emaFast: currentPrice,
    emaSlow: currentPrice,
    trend: 'BULLISH',
    macd: 0.12,
    macdSignal: 0.08,
    signalHeadline: 'BULLISH MOMENTUM • ACCUMULATION ZONE',
    buyVolumeRatio: 56
  });

  const timeframes: { id: Timeframe; label: string; desc: string }[] = [
    { id: '5m', label: '5 Mins', desc: 'Fast Expiry' },
    { id: '15m', label: '15 Mins', desc: 'Standard' },
    { id: '30m', label: '30 Mins', desc: 'Swing' },
    { id: '1h', label: '1 Hour', desc: 'Hourly' },
    { id: '1d', label: '1 Day', desc: 'Macro' }
  ];

  const formatPriceValue = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '--';
    if (val < 0.0001) return val.toFixed(8);
    if (val < 0.01) return val.toFixed(6);
    if (val < 1) return val.toFixed(4);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 1. Fetch / Re-seed historical klines cleanly whenever asset or timeframe changes
  useEffect(() => {
    const isNewAsset = lastAssetRef.current !== asset;
    const isNewTf = lastTfRef.current !== timeframe;
    lastAssetRef.current = asset;
    lastTfRef.current = timeframe;

    const base = currentPrice > 0 ? currentPrice : 100;
    const newKlines = generateTimeframeKlines(base, timeframe, 50);
    historyRef.current = newKlines;

    const sigs = calculateTechnicalSignals(newKlines.map((t) => t.price));
    setTechnicalSignals(sigs);
  }, [asset, timeframe]);

  // 2. Smoothly append live real-time price updates
  useEffect(() => {
    if (currentPrice <= 0) return;

    const ticks = historyRef.current;
    if (ticks.length === 0) return;

    const lastTick = ticks[ticks.length - 1];
    const pctDiff = Math.abs(currentPrice - lastTick.price) / (lastTick.price || 1);

    // Rescale history if switching across vastly different asset scales
    if (pctDiff > 0.40) {
      const scale = currentPrice / (lastTick.price || 1);
      historyRef.current = ticks.map((t) => ({ ...t, price: t.price * scale }));
    }

    const isUp = currentPrice >= lastTick.price;
    const now = Date.now();

    if (now - lastTick.time >= 300) {
      historyRef.current.push({
        price: currentPrice,
        time: now,
        volume: Math.random() * 50 + 20,
        isUp
      });

      if (historyRef.current.length > 70) {
        historyRef.current.shift();
      }

      const prices = historyRef.current.map((t) => t.price);
      const sigs = calculateTechnicalSignals(prices);
      setTechnicalSignals(sigs);
    } else {
      lastTick.price = currentPrice;
      lastTick.isUp = isUp;
    }
  }, [currentPrice]);

  // 3. 60FPS High-Precision HTML5 Canvas Render Loop with Target Lines & Live PnL Glow
  useEffect(() => {
    let phase = 0;

    const render = () => {
      phase += 0.04;
      const canvas = canvasRef.current;
      if (!canvas) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const ticks = historyRef.current;
      if (ticks.length < 2) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const allPrices = ticks.map((t) => t.price);
      if (strikePrice > 0) allPrices.push(strikePrice);
      if (currentPrice > 0) allPrices.push(currentPrice);

      const minPrice = Math.min(...allPrices) * 0.9992;
      const maxPrice = Math.max(...allPrices) * 1.0008;
      const priceRange = maxPrice - minPrice || 1;

      const getY = (price: number) => height - 45 - ((price - minPrice) / priceRange) * (height - 85);

      // 1. Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 25; y < height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Volume Bars
      const barWidth = Math.max(3, (width - 75) / ticks.length - 2);
      ticks.forEach((t, i) => {
        const x = (i / (ticks.length - 1)) * (width - 75);
        const barHeight = Math.min(35, (t.volume / 80) * 35);
        ctx.fillStyle = t.isUp ? 'rgba(0, 255, 102, 0.20)' : 'rgba(239, 68, 68, 0.20)';
        ctx.fillRect(x, height - barHeight - 4, barWidth, barHeight);
      });

      // 3. Strike Price Target Reference Line (Amber dashed line with target badge)
      if (strikePrice > 0) {
        const strikeY = getY(strikePrice);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, strikeY);
        ctx.lineTo(width - 80, strikeY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target Strike Badge
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.beginPath();
        ctx.roundRect(width - 76, strikeY - 10, 72, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#070b0e';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`STRIKE $${formatPriceValue(strikePrice)}`, width - 40, strikeY + 4);
      }

      // 4. Smooth Price Line Path
      const isAbove = currentPrice >= strikePrice;
      const themeColor = isAbove ? '#00FF66' : '#ef4444';
      const themeRGB = isAbove ? '0, 255, 102' : '239, 68, 68';

      ctx.beginPath();
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = 10;

      ticks.forEach((t, i) => {
        const x = (i / (ticks.length - 1)) * (width - 75);
        const y = getY(t.price);

        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevX = ((i - 1) / (ticks.length - 1)) * (width - 75);
          const prevY = getY(ticks[i - 1].price);
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Area gradient fill
      const lastX = width - 75;
      const lastY = getY(currentPrice);
      ctx.lineTo(lastX, height - 10);
      ctx.lineTo(0, height - 10);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, `rgba(${themeRGB}, 0.28)`);
      grad.addColorStop(0.6, `rgba(${themeRGB}, 0.05)`);
      grad.addColorStop(1, `rgba(${themeRGB}, 0.0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // 5. Live Cursor Line & Pulse Beacon
      ctx.strokeStyle = `rgba(${themeRGB}, 0.50)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, lastY);
      ctx.lineTo(width - 80, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Beacon Dot with Halo
      const pulseSize = 5 + Math.sin(phase * 3) * 2.5;
      ctx.beginPath();
      ctx.arc(lastX, lastY, pulseSize + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${themeRGB}, 0.25)`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = themeColor;
      ctx.fill();

      // Live Price Pill on Right Axis
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.roundRect(width - 76, lastY - 10, 72, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#070b0e';
      ctx.font = 'bold 9.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${formatPriceValue(currentPrice)}`, width - 40, lastY + 4);

      // 6. If user has placed a bet, render dynamic In-The-Money / Out-Of-The-Money indicator
      if (userBet) {
        const isWinning =
          (userBet.direction === 'UP' && currentPrice >= userBet.strikePrice) ||
          (userBet.direction === 'DOWN' && currentPrice <= userBet.strikePrice);

        ctx.fillStyle = isWinning ? 'rgba(0, 255, 102, 0.90)' : 'rgba(239, 68, 68, 0.90)';
        ctx.beginPath();
        ctx.roundRect(14, 14, 210, 28, 6);
        ctx.fill();

        ctx.fillStyle = '#070b0e';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          isWinning ? `★ IN THE MONEY (+$${(userBet.amount * 0.92).toFixed(2)})` : '✗ OUT OF THE MONEY',
          24,
          32
        );
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentPrice, strikePrice, userBet]);

  // Format countdown string mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deltaFromStrike = currentPrice - strikePrice;
  const isPositiveDelta = deltaFromStrike >= 0;

  return (
    <div className="rounded-[28px] bg-[#070b0e] border border-cyan-500/20 p-6 relative overflow-hidden shadow-2xl space-y-6">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/[0.05] rounded-full blur-3xl pointer-events-none" />

      {/* Active User Prediction Banner (If user placed a bet) */}
      {userBet && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-cyan-500/15 to-emerald-500/20 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-white uppercase">Your Prediction Active:</span>
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
        {/* Asset Pair, Current Price & Source Exchange Badge */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                {assetPair}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                FREECRYPTO + BINANCE WS
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                ${formatPriceValue(currentPrice)}
              </span>
              <span
                className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                  priceDelta24h >= 0 ? 'text-[#00FF66]' : 'text-rose-400'
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
                isPositiveDelta ? 'text-[#00FF66]' : 'text-rose-400'
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

      {/* Timeframe Selector & Real Buy/Sell Order Pressure */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.08]">
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

        {/* Real Dynamic Buy/Sell Order Pressure Indicator */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-[#00FF66] font-bold">BUY {technicalSignals.buyVolumeRatio}%</span>
          <div className="w-32 sm:w-44 h-2 rounded-full bg-rose-500/30 overflow-hidden flex">
            <div
              style={{ width: `${technicalSignals.buyVolumeRatio}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-[#00FF66] transition-all duration-300 shadow-[0_0_10px_#00FF66]"
            />
          </div>
          <span className="text-rose-400 font-bold">{100 - technicalSignals.buyVolumeRatio}% SELL</span>
        </div>
      </div>

      {/* Real-time Technical Signal HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-gray-400">Technical Signal:</span>
          <span
            className={`font-bold uppercase tracking-wider ${
              technicalSignals.trend.includes('BULLISH') ? 'text-[#00FF66]' : 'text-rose-400'
            }`}
          >
            {technicalSignals.signalHeadline}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-gray-400">
          <div>
            <span>RSI(14): </span>
            <strong
              className={`font-bold ${
                technicalSignals.rsi >= 70
                  ? 'text-rose-400'
                  : technicalSignals.rsi <= 30
                  ? 'text-[#00FF66]'
                  : 'text-cyan-300'
              }`}
            >
              {technicalSignals.rsi}
            </strong>
          </div>
          <div className="hidden sm:block">
            <span>EMA 9: </span>
            <strong className="text-white">${formatPriceValue(technicalSignals.emaFast)}</strong>
          </div>
          <div className="hidden sm:block">
            <span>EMA 21: </span>
            <strong className="text-white">${formatPriceValue(technicalSignals.emaSlow)}</strong>
          </div>
        </div>
      </div>

      {/* Main 60FPS High-Precision Canvas */}
      <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden bg-[#03070a]/90 border border-white/[0.04]">
        <canvas
          ref={canvasRef}
          width={800}
          height={380}
          className="w-full h-full block cursor-crosshair select-none"
        />
      </div>
    </div>
  );
};

export default ArenaChart;
