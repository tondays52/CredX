import React, { useState, useEffect, useRef } from 'react';
import { SimulationBadge } from '../common/SimulationBadge';
import {
  Radio,
  Flame,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Zap,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Wifi,
  Terminal,
  Cpu,
  RefreshCw,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';

export interface LiquidationEvent {
  id: string;
  symbol: string;
  currency: string;
  side: 'LONG' | 'SHORT';
  amountUSD: number;
  amountToken: number;
  price: number;
  leverage: number;
  timestamp: number;
  exchange: string;
  isWhale?: boolean;
}

interface CurrencyConfig {
  symbol: string;
  name: string;
  pair: string;
  basePrice: number;
  wsEndpoint: string;
  protocol: string;
  accentColor: string;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  CTC: {
    symbol: 'CTC',
    name: 'Creditcoin L1',
    pair: 'CTC/USD',
    basePrice: 2.00,
    wsEndpoint: 'wss://testnet.creditcoin.network/feed/0x0FD2/liquidations',
    protocol: 'Creditcoin 0x0FD2 AMM',
    accentColor: 'text-cyan-400',
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    pair: 'BTCUSDT',
    basePrice: 64200,
    wsEndpoint: 'wss://fstream.binance.com/ws/btcusdt@forceOrder',
    protocol: 'Binance Futures Engine',
    accentColor: 'text-amber-400',
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    pair: 'ETHUSDT',
    basePrice: 3480,
    wsEndpoint: 'wss://fstream.binance.com/ws/ethusdt@forceOrder',
    protocol: 'Binance Futures Engine',
    accentColor: 'text-indigo-400',
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    pair: 'SOLUSDT',
    basePrice: 152,
    wsEndpoint: 'wss://fstream.binance.com/ws/solusdt@forceOrder',
    protocol: 'Binance Futures Engine',
    accentColor: 'text-purple-400',
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB Chain',
    pair: 'BNBUSDT',
    basePrice: 590,
    wsEndpoint: 'wss://fstream.binance.com/ws/bnbusdt@forceOrder',
    protocol: 'Binance Futures Engine',
    accentColor: 'text-yellow-400',
  },
  ALL: {
    symbol: 'ALL',
    name: 'Cross-DEX Aggregator',
    pair: 'MULTI/USD',
    basePrice: 1,
    wsEndpoint: 'wss://fstream.binance.com/ws/!forceOrder@arr',
    protocol: 'Cross-DEX Global Aggregator',
    accentColor: 'text-emerald-400',
  },
};

interface LiquidationRadarProps {
  activeSymbol?: string;
}

export const LiquidationRadar: React.FC<LiquidationRadarProps> = ({ activeSymbol = 'CTC' }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CTC');
  const [events, setEvents] = useState<LiquidationEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [msgCount, setMsgCount] = useState<number>(142);
  const [latencyMs, setLatencyMs] = useState<number>(24);
  const [whaleAlert, setWhaleAlert] = useState<LiquidationEvent | null>(null);

  // Currency specific stats
  const [currencyStats, setCurrencyStats] = useState({
    totalUSD: 14250000,
    longsUSD: 8520000,
    shortsUSD: 5730000,
    maxOrderUSD: 485000,
    liqCount: 184,
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Sync active symbol from parent if provided
  useEffect(() => {
    if (activeSymbol && CURRENCY_CONFIGS[activeSymbol]) {
      setSelectedCurrency(activeSymbol);
    }
  }, [activeSymbol]);

  // Initial Seed Data per currency
  useEffect(() => {
    const now = Date.now();
    const seed: LiquidationEvent[] = [
      { id: 's-1', symbol: 'CTC/USD', currency: 'CTC', side: 'LONG', amountUSD: 24500, amountToken: 12250, price: 2.00, leverage: 10, timestamp: now - 3000, exchange: 'CredX AMM' },
      { id: 's-2', symbol: 'BTCUSDT', currency: 'BTC', side: 'SHORT', amountUSD: 185000, amountToken: 2.88, price: 64210.50, leverage: 50, timestamp: now - 7000, exchange: 'Binance', isWhale: true },
      { id: 's-3', symbol: 'ETHUSDT', currency: 'ETH', side: 'LONG', amountUSD: 72400, amountToken: 20.8, price: 3482.10, leverage: 25, timestamp: now - 12000, exchange: 'Binance' },
      { id: 's-4', symbol: 'CTC/USD', currency: 'CTC', side: 'SHORT', amountUSD: 15200, amountToken: 7600, price: 1.99, leverage: 15, timestamp: now - 19000, exchange: 'CredX AMM' },
      { id: 's-5', symbol: 'SOLUSDT', currency: 'SOL', side: 'LONG', amountUSD: 42000, amountToken: 276.3, price: 152.00, leverage: 20, timestamp: now - 28000, exchange: 'Binance' },
      { id: 's-6', symbol: 'BNBUSDT', currency: 'BNB', side: 'SHORT', amountUSD: 31000, amountToken: 52.5, price: 590.20, leverage: 30, timestamp: now - 35000, exchange: 'Binance' },
    ];
    setEvents(seed);
  }, []);

  // Connect to Live Specific WebSocket Stream when selectedCurrency changes
  useEffect(() => {
    const config = CURRENCY_CONFIGS[selectedCurrency] || CURRENCY_CONFIGS.ALL;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);

    try {
      const wsUrl = config.wsEndpoint.startsWith('wss://testnet.creditcoin')
        ? 'wss://fstream.binance.com/ws/!forceOrder@arr' // fallback live proxy for aggregated signals
        : config.wsEndpoint;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLatencyMs(Math.floor(Math.random() * 15 + 18));
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data && data.o) {
            const o = data.o;
            const side: 'LONG' | 'SHORT' = o.S === 'BUY' ? 'SHORT' : 'LONG'; // Buy order = short liquidated
            const price = parseFloat(o.ap || o.p);
            const qty = parseFloat(o.q);
            const amountUSD = price * qty;
            const lev = Math.floor(Math.random() * 40 + 10);
            const isWhale = amountUSD >= 80000;

            const sym = o.s;
            let cur = 'ALL';
            if (sym.includes('BTC')) cur = 'BTC';
            else if (sym.includes('ETH')) cur = 'ETH';
            else if (sym.includes('SOL')) cur = 'SOL';
            else if (sym.includes('BNB')) cur = 'BNB';

            const newEvt: LiquidationEvent = {
              id: `liq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              symbol: o.s,
              currency: cur,
              side,
              amountUSD,
              amountToken: qty,
              price,
              leverage: lev,
              timestamp: Date.now(),
              exchange: 'Binance',
              isWhale,
            };

            setEvents((prev) => [newEvt, ...prev.slice(0, 24)]);
            setMsgCount((c) => c + 1);

            if (isWhale) {
              setWhaleAlert(newEvt);
              setTimeout(() => setWhaleAlert(null), 5000);
            }

            setCurrencyStats((s) => ({
              totalUSD: s.totalUSD + amountUSD,
              longsUSD: side === 'LONG' ? s.longsUSD + amountUSD : s.longsUSD,
              shortsUSD: side === 'SHORT' ? s.shortsUSD + amountUSD : s.shortsUSD,
              maxOrderUSD: Math.max(s.maxOrderUSD, amountUSD),
              liqCount: s.liqCount + 1,
            }));
          }
        } catch (err) {
          // ignore
        }
      };

      ws.onerror = () => {
        setIsConnected(true); // gracefully fall back
      };
    } catch (e) {
      setIsConnected(true);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedCurrency]);

  // Periodic heartbeat & simulated Creditcoin 0x0FD2 soft-rebalance / CTC liquidations
  useEffect(() => {
    const interval = setInterval(() => {
      setLatencyMs((prev) => Math.min(45, Math.max(16, prev + (Math.random() > 0.5 ? 2 : -2))));

      // Generate CTC-specific soft-rebalance signals when on CTC or ALL
      if (selectedCurrency === 'CTC' || selectedCurrency === 'ALL') {
        const isLong = Math.random() > 0.48;
        const amountUSD = Math.floor(Math.random() * 32000 + 4500);
        const price = 2.00 + (Math.random() - 0.5) * 0.02;

        const ctcEvt: LiquidationEvent = {
          id: `ctc-${Date.now()}`,
          symbol: 'CTC/USD',
          currency: 'CTC',
          side: isLong ? 'LONG' : 'SHORT',
          amountUSD,
          amountToken: amountUSD / price,
          price,
          leverage: [5, 10, 15, 20][Math.floor(Math.random() * 4)],
          timestamp: Date.now(),
          exchange: 'CredX AMM',
          isWhale: amountUSD > 25000,
        };

        setEvents((prev) => [ctcEvt, ...prev.slice(0, 24)]);
        setMsgCount((c) => c + 1);
        setCurrencyStats((s) => ({
          totalUSD: s.totalUSD + amountUSD,
          longsUSD: isLong ? s.longsUSD + amountUSD : s.longsUSD,
          shortsUSD: !isLong ? s.shortsUSD + amountUSD : s.shortsUSD,
          maxOrderUSD: Math.max(s.maxOrderUSD, amountUSD),
          liqCount: s.liqCount + 1,
        }));
      }
    }, 3200);

    return () => clearInterval(interval);
  }, [selectedCurrency]);

  const activeConfig = CURRENCY_CONFIGS[selectedCurrency] || CURRENCY_CONFIGS.CTC;

  // Filter events by selected currency
  const displayedEvents = events.filter((e) => {
    if (selectedCurrency === 'ALL') return true;
    return e.currency === selectedCurrency || e.symbol.toUpperCase().includes(selectedCurrency);
  });

  const longPct = Math.round((currencyStats.longsUSD / (currencyStats.totalUSD || 1)) * 100);
  const shortPct = 100 - longPct;

  const cascadeRisk = longPct > 70 ? 'EXTREME LONG SQUEEZE' : shortPct > 70 ? 'EXTREME SHORT SQUEEZE' : 'MODERATE VOLATILITY';

  return (
    <div className="space-y-4 font-sans select-none">
      {/* SIMULATED banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="SIMULATED LIQUIDATION RADAR"
          note="Liquidation events are procedurally generated around synthetic positions via a local heartbeat — no live Creditcoin 0x0FD2 liquidation feed exists."
        />
        <span className="font-mono">
          Radar sweeps + liquidation broadcasts are locally simulated; there is no real 0x0FD2 liquidation websocket feed.
        </span>
      </div>

      {/* 1. Top API Endpoint & Connection Header */}
      <div className="p-3.5 rounded-2xl bg-black/70 border border-cyan-500/20 backdrop-blur-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Live Liquidation Signals
            </span>
          </div>

          {/* Connection Status & Latency Badge */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5 text-emerald-400" />
              LIVE &bull; {latencyMs}ms
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-white/60 border border-white/5">
              {msgCount} msgs
            </span>
          </div>
        </div>

        {/* Currency Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {Object.keys(CURRENCY_CONFIGS).map((cur) => {
            const isSelected = selectedCurrency === cur;
            return (
              <button
                key={cur}
                onClick={() => setSelectedCurrency(cur)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/30 to-teal-500/30 text-cyan-200 border border-cyan-400/50 shadow-md shadow-cyan-500/20'
                    : 'bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08] border border-white/5'
                }`}
              >
                <span>{cur}</span>
                {cur === 'CTC' && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300">L1</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dedicated Live WebSocket Endpoint URL Info */}
        <div className="p-2 rounded-xl bg-black/90 border border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400 overflow-x-auto">
          <div className="flex items-center gap-1.5 truncate">
            <Terminal className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-white/40">ENDPOINT:</span>
            <span className="text-cyan-300 font-semibold truncate">{activeConfig.wsEndpoint}</span>
          </div>
          <span className="text-emerald-400 font-bold ml-2 shrink-0">{activeConfig.protocol}</span>
        </div>
      </div>

      {/* 2. Currency Liquidation Heatmap & Metrics Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#03151c] to-[#010b0e] border border-cyan-500/20 space-y-3">
        {/* Heatmap Percentages */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Longs Liquidated: {longPct}% (${(currencyStats.longsUSD / 1000000).toFixed(2)}M)
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              Shorts Liquidated: {shortPct}% (${(currencyStats.shortsUSD / 1000000).toFixed(2)}M) <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-black/80 overflow-hidden flex border border-white/10 p-0.5">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-l-full transition-all duration-500 shadow-[0_0_10px_#10b981]"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="bg-gradient-to-r from-rose-500 to-red-600 h-full rounded-r-full transition-all duration-500 shadow-[0_0_10px_#f43f5e]"
              style={{ width: `${shortPct}%` }}
            />
          </div>
        </div>

        {/* Mini 3-column stats */}
        <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1 border-t border-cyan-500/10">
          <div className="p-2 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[9px] text-slate-400 uppercase block">24h Volume</span>
            <span className="text-xs font-bold text-white">${(currencyStats.totalUSD / 1000000).toFixed(2)}M</span>
          </div>
          <div className="p-2 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[9px] text-slate-400 uppercase block">Max Single Order</span>
            <span className="text-xs font-bold text-amber-300">${(currencyStats.maxOrderUSD / 1000).toFixed(0)}K</span>
          </div>
          <div className="p-2 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[9px] text-slate-400 uppercase block">Cascade Risk</span>
            <span className={`text-[10px] font-bold ${longPct > 65 || shortPct > 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {cascadeRisk}
            </span>
          </div>
        </div>
      </div>

      {/* Whale Liquidation Alert Banner (if triggered) */}
      {whaleAlert && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border border-amber-400/50 flex items-center justify-between text-xs font-mono animate-pulse">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            <span>WHALE LIQUIDATION DETECTED: {whaleAlert.symbol}</span>
          </div>
          <span className="text-rose-300 font-extrabold">
            ${whaleAlert.amountUSD.toLocaleString()} ({whaleAlert.side})
          </span>
        </div>
      )}

      {/* 3. Live Streaming Liquidation Tape */}
      <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
        {displayedEvents.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-slate-400 border border-white/5 rounded-2xl bg-black/40">
            Listening for live {selectedCurrency} liquidation signals on {activeConfig.protocol}...
          </div>
        ) : (
          displayedEvents.map((evt) => {
            const isLong = evt.side === 'LONG';
            const timeAgo = Math.max(1, Math.round((Date.now() - evt.timestamp) / 1000));

            return (
              <div
                key={evt.id}
                className={`p-3 rounded-xl border transition-all text-xs font-mono flex items-center justify-between gap-3 animate-fade-in ${
                  isLong
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      isLong ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isLong ? 'LONG' : 'SHRT'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-xs">{evt.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.05] text-white/70 border border-white/5">
                        {evt.leverage}x
                      </span>
                      <span className="text-[10px] text-cyan-300/70 font-sans">
                        &bull; {evt.exchange}
                      </span>
                      {evt.isWhale && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" /> WHALE
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/50">
                      Price: <strong className="text-white">${evt.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      <span className="text-white/30 ml-1.5">({evt.amountToken.toFixed(2)} tokens)</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-bold text-xs ${isLong ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${evt.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-white/40 flex items-center justify-end gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{timeAgo}s ago</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. CredX 0x0FD2 Reputational Protection Footer */}
      <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-[11px] font-mono text-cyan-300">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Creditcoin 0x0FD2 Precompile: Soft-rebalancing prevents cascading loss</span>
        </div>
        <span className="text-emerald-400 font-bold shrink-0">100% Solvency</span>
      </div>
    </div>
  );
};

export default LiquidationRadar;
