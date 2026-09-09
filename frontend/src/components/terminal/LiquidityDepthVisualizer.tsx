import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Layers,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Filter,
  Sliders
} from 'lucide-react';

interface LiquidityDepthVisualizerProps {
  fromToken: string;
  toToken: string;
}

interface DepthBin {
  price: number;
  bidDepthUSD: number;
  askDepthUSD: number;
  cumBidUSD: number;
  cumAskUSD: number;
}

export const LiquidityDepthVisualizer: React.FC<LiquidityDepthVisualizerProps> = ({ fromToken, toToken }) => {
  const [zoomLevel, setZoomLevel] = useState<'2%' | '5%' | '10%'>('5%');
  const [hoverData, setHoverData] = useState<{
    price: number;
    depthUSD: number;
    cumDepthUSD: number;
    slippagePct: number;
    type: 'BID' | 'ASK';
    x: number;
    y: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const depthBins = useRef<DepthBin[]>([]);

  // Token price mapping
  const getTokenPrice = (token: string): number => {
    switch (token.toUpperCase()) {
      case 'BTC': return 78950.00;
      case 'ETH': return 3485.40;
      case 'SOL': return 152.40;
      case 'CTC': return 2.00;
      case 'BNB': return 592.10;
      case 'AVAX': return 28.50;
      case 'NEAR': return 4.85;
      case 'DOGE': return 0.1142;
      case 'PEPE': return 0.0000085;
      default: return 1.00;
    }
  };

  const basePrice = getTokenPrice(fromToken);

  // Generate realistic Uniswap v3 concentrated liquidity depth bins
  useEffect(() => {
    const bins: DepthBin[] = [];
    const count = 48;
    const spreadPct = zoomLevel === '2%' ? 0.02 : zoomLevel === '5%' ? 0.05 : 0.10;

    let runningBid = 0;
    let runningAsk = 0;

    // Generate Bid side (left of mid price)
    for (let i = count; i >= 1; i--) {
      const p = basePrice * (1 - (i / count) * spreadPct);
      // Concentrated liquidity density profile with Gaussian peak around mid-market
      const normDist = (count - i) / (count * 0.4);
      const density = Math.exp(-Math.pow(normDist, 1.8)) * 480000 + Math.random() * 45000;
      runningBid += density;
      bins.push({
        price: p,
        bidDepthUSD: density,
        askDepthUSD: 0,
        cumBidUSD: runningBid,
        cumAskUSD: 0,
      });
    }

    // Mid point
    bins.push({
      price: basePrice,
      bidDepthUSD: 0,
      askDepthUSD: 0,
      cumBidUSD: runningBid,
      cumAskUSD: 0,
    });

    // Generate Ask side (right of mid price)
    for (let i = 1; i <= count; i++) {
      const p = basePrice * (1 + (i / count) * spreadPct);
      const normDist = i / (count * 0.4);
      const density = Math.exp(-Math.pow(normDist, 1.8)) * 450000 + Math.random() * 42000;
      runningAsk += density;
      bins.push({
        price: p,
        bidDepthUSD: 0,
        askDepthUSD: density,
        cumBidUSD: 0,
        cumAskUSD: runningAsk,
      });
    }

    depthBins.current = bins;
  }, [fromToken, toToken, zoomLevel, basePrice]);

  // High-performance canvas chart: Stepped cumulative depth & concentrated liquidity bins
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 560;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 260;

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

      const paddingLeft = 16;
      const paddingRight = 64;
      const paddingTop = 32;
      const paddingBottom = 28;
      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;
      const midX = paddingLeft + plotWidth / 2;

      // Gridlines & Scale
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = paddingTop + (i / 4) * plotHeight;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        // Right Axis Depth Labels ($M)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '9px monospace';
        const depthVal = ((4 - i) * 2.5).toFixed(1);
        ctx.fillText(`$${depthVal}M`, width - paddingRight + 6, y + 3);
      }

      const bins = depthBins.current;
      if (bins.length === 0) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      const tNow = Date.now() / 1000;
      const maxDepth = 10000000; // $10M max scale
      const midIdx = Math.floor(bins.length / 2);

      // 1. Concentrated Liquidity Histogram Bins (Uniswap v3 Style Range Bins)
      const binWidth = plotWidth / bins.length;
      for (let i = 0; i < bins.length; i++) {
        const x = paddingLeft + i * binWidth;
        const b = bins[i];
        if (i < midIdx && b.bidDepthUSD > 0) {
          const liveWobble = 1 + Math.sin(tNow * 3 + i * 0.4) * 0.04;
          const barH = ((b.bidDepthUSD * liveWobble) / 1200000) * (plotHeight * 0.45);
          ctx.fillStyle = 'rgba(14, 203, 129, 0.12)';
          ctx.fillRect(x, paddingTop + plotHeight - barH, Math.max(1, binWidth - 1), barH);
        } else if (i > midIdx && b.askDepthUSD > 0) {
          const liveWobble = 1 + Math.cos(tNow * 3 + i * 0.4) * 0.04;
          const barH = ((b.askDepthUSD * liveWobble) / 1200000) * (plotHeight * 0.45);
          ctx.fillStyle = 'rgba(246, 70, 93, 0.12)';
          ctx.fillRect(x, paddingTop + plotHeight - barH, Math.max(1, binWidth - 1), barH);
        }
      }

      // 2. Stepped Cumulative Bids Curve (Left Side - Green) with subtle live micro-pulse
      const getBidY = (i: number) => {
        const wobble = 1 + Math.sin(tNow * 2.2 + i * 0.15) * 0.012;
        return paddingTop + plotHeight - ((bins[i].cumBidUSD * wobble) / maxDepth) * plotHeight;
      };

      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop + plotHeight);

      for (let i = 0; i <= midIdx; i++) {
        const x = paddingLeft + i * binWidth;
        const y = getBidY(i);
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevY = getBidY(i - 1);
          ctx.lineTo(x, prevY); // Step
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(midX, paddingTop + plotHeight);
      ctx.closePath();

      const bidGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotHeight);
      bidGrad.addColorStop(0, 'rgba(14, 203, 129, 0.45)');
      bidGrad.addColorStop(1, 'rgba(14, 203, 129, 0.04)');
      ctx.fillStyle = bidGrad;
      ctx.fill();

      // Stroke Bids Line
      ctx.beginPath();
      for (let i = 0; i <= midIdx; i++) {
        const x = paddingLeft + i * binWidth;
        const y = getBidY(i);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prevY = getBidY(i - 1);
          ctx.lineTo(x, prevY);
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = '#0ecb81';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#0ecb81';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Stepped Cumulative Asks Curve (Right Side - Red) with subtle live micro-pulse
      const getAskY = (i: number) => {
        const wobble = 1 + Math.cos(tNow * 2.2 + i * 0.15) * 0.012;
        return paddingTop + plotHeight - ((bins[i].cumAskUSD * wobble) / maxDepth) * plotHeight;
      };

      ctx.beginPath();
      ctx.moveTo(midX, paddingTop + plotHeight);

      for (let i = midIdx; i < bins.length; i++) {
        const x = paddingLeft + i * binWidth;
        const y = getAskY(i);
        if (i === midIdx) {
          ctx.lineTo(x, y);
        } else {
          const prevY = getAskY(i - 1);
          ctx.lineTo(x, prevY); // Step
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(paddingLeft + plotWidth, paddingTop + plotHeight);
      ctx.closePath();

      const askGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotHeight);
      askGrad.addColorStop(0, 'rgba(246, 70, 93, 0.45)');
      askGrad.addColorStop(1, 'rgba(246, 70, 93, 0.04)');
      ctx.fillStyle = askGrad;
      ctx.fill();

      // Stroke Asks Line
      ctx.beginPath();
      for (let i = midIdx; i < bins.length; i++) {
        const x = paddingLeft + i * binWidth;
        const y = getAskY(i);
        if (i === midIdx) ctx.moveTo(x, y);
        else {
          const prevY = getAskY(i - 1);
          ctx.lineTo(x, prevY);
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = '#f6465d';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#f6465d';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center Mid-Market Line (Dashed Cyan)
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.beginPath();
      ctx.moveTo(midX, paddingTop);
      ctx.lineTo(midX, paddingTop + plotHeight);
      ctx.stroke();
      ctx.restore();

      // Mid-Market Price Tag
      const midPrice = bins[midIdx].price;
      const formatP = (p: number) => p < 1 ? p.toFixed(6) : p.toFixed(2);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(midX - 38, paddingTop - 22, 76, 18);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(formatP(midPrice), midX - 30, paddingTop - 10);

      // Bottom X-Axis Price Labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '9px monospace';
      const pLeft = bins[0].price;
      const pRight = bins[bins.length - 1].price;
      ctx.fillText(formatP(pLeft), paddingLeft, height - 8);
      ctx.fillText(`Mid: ${formatP(midPrice)}`, midX - 25, height - 8);
      ctx.fillText(formatP(pRight), width - paddingRight - 40, height - 8);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [fromToken, toToken, zoomLevel, basePrice]);

  return (
    <div className="space-y-4 font-sans select-none text-slate-200">
      {/* Top Header with Metrics & Zoom Controls */}
      <div className="p-3.5 rounded-2xl bg-[#0b0e14] border border-[#1e2329] flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-white">
                {fromToken}/{toToken} Concentrated Liquidity Depth
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                0.05% Pool
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Creditcoin 0x0FD2 Sovereign Router &bull; Constant Product Invariant
            </div>
          </div>
        </div>

        {/* Zoom Level Pills */}
        <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/10 font-mono text-[10px]">
          {(['2%', '5%', '10%'] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoomLevel(z)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                zoomLevel === z
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              &plusmn;{z}
            </button>
          ))}
        </div>
      </div>

      {/* Bids vs Asks Ratio Bar */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-[#0ecb81] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81]" /> Bids: $8.45M (53.4%)
          </span>
          <span className="text-[#f6465d] font-bold flex items-center gap-1">
            Asks: $7.38M (46.6%) <span className="w-1.5 h-1.5 rounded-full bg-[#f6465d]" />
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-black/50 border border-white/5">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: '53.4%' }} />
          <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: '46.6%' }} />
        </div>
      </div>

      {/* Main Enterprise Canvas Depth Chart with Interactive Crosshair */}
      <div
        className="relative w-full h-[280px] rounded-2xl overflow-hidden bg-[#05070a] border border-[#1e2329] shadow-2xl"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const width = rect.width;
          const paddingLeft = 16;
          const paddingRight = 64;
          const plotWidth = width - paddingLeft - paddingRight;

          const bins = depthBins.current;
          if (!bins || bins.length === 0) return;

          const ratio = Math.max(0, Math.min(1, (x - paddingLeft) / plotWidth));
          const binIdx = Math.min(bins.length - 1, Math.floor(ratio * bins.length));
          const bin = bins[binIdx];
          const midIdx = Math.floor(bins.length / 2);
          const isBid = binIdx <= midIdx;

          const priceDiff = Math.abs(bin.price - basePrice);
          const slip = (priceDiff / basePrice) * 100;

          setHoverData({
            price: bin.price,
            depthUSD: isBid ? bin.bidDepthUSD : bin.askDepthUSD,
            cumDepthUSD: isBid ? bin.cumBidUSD : bin.cumAskUSD,
            slippagePct: slip,
            type: isBid ? 'BID' : 'ASK',
            x,
            y,
          });
        }}
        onMouseLeave={() => setHoverData(null)}
      >
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Top Floating Telemetry Badges */}
        <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none font-mono text-[10px]">
          <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-[#0ecb81]/40 text-[#0ecb81] font-bold backdrop-blur-md">
            +Bids: $8.45M
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-[#f6465d]/40 text-[#f6465d] font-bold backdrop-blur-md">
            -Asks: $7.38M
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-cyan-500/40 text-cyan-300 font-bold backdrop-blur-md">
            Spread: 0.01% (Super-Prime)
          </span>
        </div>

        {/* Interactive Floating Tooltip */}
        {hoverData && (
          <div
            className="absolute z-20 pointer-events-none p-2.5 rounded-xl bg-black/90 border border-cyan-500/50 shadow-2xl backdrop-blur-md font-mono text-[10px] space-y-1"
            style={{
              left: Math.min(hoverData.x + 12, 280),
              top: Math.max(12, Math.min(hoverData.y - 40, 190)),
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Orderbook Side:</span>
              <span className={`font-bold ${hoverData.type === 'BID' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {hoverData.type === 'BID' ? 'BID / BUY' : 'ASK / SELL'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Price Level:</span>
              <span className="text-white font-bold">
                ${hoverData.price < 1 ? hoverData.price.toFixed(6) : hoverData.price.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Cumulative Depth:</span>
              <span className="text-cyan-300 font-bold">
                ${(hoverData.cumDepthUSD / 1000000).toFixed(2)}M
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Est. Price Impact:</span>
              <span className="text-emerald-400 font-bold">
                {hoverData.slippagePct.toFixed(3)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Enterprise Metrics Bar */}
      <div className="grid grid-cols-3 gap-3 font-mono text-center">
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#1e2329]">
          <span className="text-[10px] text-slate-400 uppercase block">Total Pool Liquidity</span>
          <span className="text-xs font-bold text-white">$48,920,000 USD</span>
        </div>
        <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
          <span className="text-[10px] text-cyan-300 uppercase block">Simulated Slippage ($50k)</span>
          <span className="text-xs font-extrabold text-emerald-400">&lt; 0.03%</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#0b0e14] border border-[#1e2329]">
          <span className="text-[10px] text-slate-400 uppercase block">Your CTS Fee</span>
          <span className="text-xs font-bold text-cyan-300">0.05% (-83.3% Discount)</span>
        </div>
      </div>
    </div>
  );
};

export default LiquidityDepthVisualizer;
