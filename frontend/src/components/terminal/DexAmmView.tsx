import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  fetchAMMState,
  addAMMLiquidity,
  removeAMMLiquidity,
  swapViaAMM,
  fetchCUSDBalance,
  fetchTokenBalance,
  fetchAMMEvents,
  txHashShort,
} from '../../services/credXService';
import { CREDITCOIN_BLOCKSCOUT, CONTRACTS } from '../../config/contracts';
import {
  ArrowLeftRight,
  Settings,
  ChevronDown,
  ArrowDownUp,
  ExternalLink,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  Info,
  BarChart2,
  Activity,
  Database,
  TrendingUp,
} from 'lucide-react';

interface PoolToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

interface ChartSample {
  t: number;
  p: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TransactionItem {
  id: string;
  type: 'Swap' | 'Add Liquidity' | 'Remove Liquidity';
  details: string;
  hash: string;
  status: 'Confirmed' | 'Pending' | 'Failed';
  time: string;
}

type AMMState = NonNullable<Awaited<ReturnType<typeof fetchAMMState>>>;

const TOKEN_STYLE: Record<string, { iconBg: string; iconText: string; color: string }> = {
  cUSD: { iconBg: '#083344', iconText: 'cUSD', color: '#38bdf8' },
  DEPIN: { iconBg: '#14532d', iconText: 'DPN', color: '#4ade80' },
  CTC: { iconBg: '#042f2e', iconText: 'CTC', color: '#00f2fe' },
  BTC: { iconBg: '#451a03', iconText: 'BTC', color: '#f59e0b' },
  ETH: { iconBg: '#1e1e38', iconText: 'ETH', color: '#a78bfa' },
  SOL: { iconBg: '#2e1065', iconText: 'SOL', color: '#c084fc' },
};

const FEED_ASSETS: { key: string; name: string; binance: string }[] = [
  { key: 'CTC', name: 'Creditcoin L1 Native', binance: 'CTCUSDT' },
  { key: 'BTC', name: 'Bitcoin (Wrapped CredX)', binance: 'BTCUSDT' },
  { key: 'ETH', name: 'Ethereum (CredX Bridge)', binance: 'ETHUSDT' },
  { key: 'SOL', name: 'Solana (Wormhole)', binance: 'SOLUSDT' },
];

const KLINE_INTERVAL: Record<string, string> = { '1H': '1h', '1D': '1d', '1W': '1w', '1M': '1M' };
const WINDOW_MS: Record<string, number> = {
  '1H': 3600e3,
  '1D': 86400e3,
  '1W': 7 * 86400e3,
  '1M': 30 * 86400e3,
};

// ─── Real technical-indicator math (computed on real price series) ──────────
function emaArray(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    out.push(i === 0 ? values[i] : values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function rsiValue(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return avgG === 0 ? null : 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function macdPoint(values: number[]): { macd: number; signal: number; hist: number } | null {
  if (values.length < 26 || values.length < 1) return null;
  const fast = emaArray(values, 12);
  const slow = emaArray(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  const signal = emaArray(line, 9);
  const last = values.length - 1;
  return { macd: line[last], signal: signal[last], hist: line[last] - signal[last] };
}

const fmtPrice = (v: number | null | undefined, maxDig = 4): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

export const DexAmmView: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { boostScore } = useProtocol();
  const { showToast, playSound } = useToast();

  // Selected asset for header / chart ("Inspect Asset")
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('cUSD');
  const [timeframe, setTimeframe] = useState<'1H' | '1D' | '1W' | '1M'>('1D');

  // Swap form
  const [fromToken, setFromToken] = useState<string>('cUSD');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState<string>('100');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.1);
  const [isSlippageOpen, setIsSlippageOpen] = useState<boolean>(false);
  const [isRouteExpanded, setIsRouteExpanded] = useState<boolean>(true);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Canvas refs
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real on-chain pool state
  const [ammState, setAmmState] = useState<AMMState | null>(null);
  const [poolLoading, setPoolLoading] = useState<boolean>(false);
  const [cusdBalance, setCusdBalance] = useState<number>(0);
  const [token1Balance, setToken1Balance] = useState<number>(0);
  const [depositAmt0, setDepositAmt0] = useState<string>('');
  const [depositAmt1, setDepositAmt1] = useState<string>('');
  const [withdrawAmt, setWithdrawAmt] = useState<string>('');
  const [poolBusy, setPoolBusy] = useState<'deposit' | 'withdraw' | null>(null);

  // Real-time session spot samples + real market candles
  const [samples, setSamples] = useState<ChartSample[]>([]);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketChange, setMarketChange] = useState<number | null>(null);

  // Real on-chain activity feed + this-session user transactions
  const [activity, setActivity] = useState<Array<Awaited<ReturnType<typeof fetchAMMEvents>>[number]>>([]);
  const [sessionTxs, setSessionTxs] = useState<TransactionItem[]>([]);

  const poolLive = ammState !== null;

  // ─── Live pool polling (reserves, LP supply, real quotes) ────────────────
  const refreshPoolState = useCallback(async () => {
    setPoolLoading(true);
    try {
      const s = await fetchAMMState(address || '');
      setAmmState(s);
      if (s) {
        setFromToken((prev) => (prev === s.token0.symbol || prev === s.token1.symbol ? prev : s.token0.symbol));
        setToToken((prev) => (prev === s.token1.symbol || prev === s.token0.symbol ? prev : s.token1.symbol));
        setSelectedTokenKey((prev) =>
          prev === s.token0.symbol || prev === s.token1.symbol || FEED_ASSETS.some((f) => f.key === prev)
            ? prev
            : 'cUSD'
        );
        // Append a real spot sample whenever the pool carries liquidity.
        if (s.reserve0 > 0 && s.reserve1 > 0) {
          const p = s.token1.symbol === 'cUSD' ? s.reserve1 / s.reserve0 : s.reserve0 / s.reserve1;
          if (isFinite(p) && p > 0) {
            setSamples((prev) => {
              const last = prev[prev.length - 1];
              if (last && (Math.abs(last.p - p) / last.p < 0.0002 || Date.now() - last.t < 1500)) return prev;
              return [...prev, { t: Date.now(), p }].slice(-240);
            });
          }
        }
      }
    } catch {
      setAmmState(null);
    } finally {
      setPoolLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshPoolState();
    const id = setInterval(() => void refreshPoolState(), 12000);
    return () => clearInterval(id);
  }, [refreshPoolState]);

  // ─── Real wallet token balances (cUSD + the pool's other token) ───────────
  useEffect(() => {
    if (!isConnected || !address) {
      setCusdBalance(0);
      setToken1Balance(0);
      return;
    }
    let dead = false;
    fetchCUSDBalance(address)
      .then((b) => { if (!dead) setCusdBalance(b); })
      .catch(() => {});
    if (ammState) {
      fetchTokenBalance(address, ammState.token1.address)
        .then((b) => { if (!dead) setToken1Balance(b); })
        .catch(() => {});
    }
    return () => { dead = true; };
  }, [isConnected, address, ammState?.token1.address]);

  // ─── Real on-chain activity feed polling ─────────────────────────────────
  useEffect(() => {
    let dead = false;
    const load = () =>
      fetchAMMEvents(30)
        .then((a) => { if (!dead) setActivity(a); })
        .catch(() => {});
    load();
    const id = setInterval(load, 25000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const poolTokens = useMemo<PoolToken[]>(() => {
    if (!ammState) return [];
    return [
      { symbol: ammState.token0.symbol, name: ammState.token0.name || ammState.token0.symbol, decimals: ammState.token0.decimals, address: ammState.token0.address },
      { symbol: ammState.token1.symbol, name: ammState.token1.name || ammState.token1.symbol, decimals: ammState.token1.decimals, address: ammState.token1.address },
    ];
  }, [ammState]);

  const selectedFeed = FEED_ASSETS.find((f) => f.key === selectedTokenKey) || null;
  const selectedPool = poolTokens.find((t) => t.symbol === selectedTokenKey) || null;

  const availKeys = useMemo(
    () => [...poolTokens.map((t) => t.symbol), ...FEED_ASSETS.map((f) => f.key)],
    [poolTokens]
  );

  const activeAsset = useMemo(() => {
    const style = TOKEN_STYLE[selectedTokenKey] || TOKEN_STYLE.cUSD;
    if (selectedFeed) return { ...style, symbol: selectedFeed.key, name: selectedFeed.name };
    if (selectedPool) return { ...style, symbol: selectedPool.symbol, name: selectedPool.name };
    return { ...style, symbol: 'cUSD', name: 'Creditcoin Stable USD' };
  }, [selectedFeed, selectedPool, selectedTokenKey]);

  // token1 priced in token0 units (cUSD): real reserves ratio
  const depinPriceUSD = useMemo(() => {
    if (!ammState || ammState.reserve0 <= 0 || ammState.reserve1 <= 0) return null;
    return ammState.reserve0 / ammState.reserve1;
  }, [ammState]);

  const poolTvl = useMemo(() => {
    if (!ammState || ammState.reserve0 <= 0 || ammState.reserve1 <= 0) return null;
    return 2 * ammState.reserve0;
  }, [ammState]);

  const lpSharePct = useMemo(() => {
    if (!ammState || ammState.lpTotalSupply <= 0) return null;
    return (ammState.lpBalance / ammState.lpTotalSupply) * 100;
  }, [ammState]);

  const activityCounts = useMemo(
    () => ({
      swaps: activity.filter((a) => a.type === 'Swap').length,
      adds: activity.filter((a) => a.type === 'Add').length,
      removes: activity.filter((a) => a.type === 'Remove').length,
    }),
    [activity]
  );

  // ─── Swap rate from a REAL on-chain getAmountOut quote ───────────────────
  const poolQuote = useMemo(() => {
    if (!ammState) return null;
    if (fromToken === ammState.token0.symbol && ammState.quote0To1 != null) return { rate: ammState.quote0To1 };
    if (fromToken === ammState.token1.symbol && ammState.quote1To0 != null) return { rate: ammState.quote1To0 };
    return null;
  }, [ammState, fromToken]);

  const canSwap = poolLive && !!ammState && ammState.reserve0 > 0 && ammState.reserve1 > 0;

  const fromAmtNum = parseFloat(fromAmount) || 0;
  const estimatedReceiveNum = useMemo(() => (poolQuote ? fromAmtNum * poolQuote.rate : NaN), [poolQuote, fromAmtNum]);
  const estimatedReceive = isFinite(estimatedReceiveNum)
    ? estimatedReceiveNum.toLocaleString('en-US', { maximumFractionDigits: estimatedReceiveNum < 1 ? 6 : 4 })
    : '—';

  const fromBalance = useMemo(() => {
    if (fromToken === 'cUSD') return cusdBalance;
    if (fromToken === ammState?.token1.symbol) return token1Balance;
    if (fromToken === 'CTC') return balanceCTC > 0 ? balanceCTC : 0;
    return 0;
  }, [fromToken, cusdBalance, token1Balance, balanceCTC, ammState]);

  // ─── Real chart price series ──────────────────────────────────────────────
  const chartCloses = useMemo(() => {
    if (selectedFeed) return candles ? candles.map((c) => c.close) : [];
    if (selectedPool) {
      if (selectedPool.symbol === ammState?.token1.symbol) {
        const win = WINDOW_MS[timeframe];
        const lastT = samples[samples.length - 1]?.t ?? Date.now();
        return samples.filter((s) => lastT - s.t <= win).map((s) => s.p);
      }
      // token0 = cUSD: suite stablecoin pegged at 1.00, flat by definition.
      return samples.length ? samples.map(() => 1) : [];
    }
    return [];
  }, [selectedFeed, selectedPool, candles, samples, timeframe, ammState]);

  const indicators = useMemo(() => {
    const closes = chartCloses;
    if (!closes.length) return null;
    return {
      ema9: emaArray(closes, 9).pop() as number,
      ema21: emaArray(closes, 21).pop() as number,
      rsi: rsiValue(closes),
      macd: macdPoint(closes),
      last: closes[closes.length - 1],
      count: closes.length,
    };
  }, [chartCloses]);

  const session24hChange = useMemo(() => {
    if (!samples.length || !samples[samples.length - 1]) return null;
    const last = samples[samples.length - 1].p;
    const win = Date.now() - WINDOW_MS['1D'];
    const older = samples.find((s) => s.t >= win);
    if (!older || older.p === 0) return null;
    return ((last - older.p) / older.p) * 100;
  }, [samples]);

  const handleMaxPay = () => setFromAmount(fromBalance.toString());
  const handleFlipDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  // ─── Execute real swap via ReputationAMM ─────────────────────────────────
  const handleExecuteSwap = async () => {
    if (!isConnected && openConnectModal) {
      openConnectModal();
      return;
    }
    if (!isConnected || !address) {
      showToast('Connect a Wallet', 'Connect a wallet to execute swaps on Creditcoin Testnet.', 'error');
      return;
    }
    if (!poolLive || !ammState || !canSwap) {
      showToast('No Liquidity', 'The ReputationAMM pool is empty — add liquidity first to enable swaps.', 'error');
      return;
    }
    const tokenIn = poolTokens.find((t) => t.symbol === fromToken);
    if (!tokenIn?.address) {
      showToast('Unsupported Pair', `${fromToken} is not a token in the live ReputationAMM pool.`, 'error');
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

    setIsSwapping(true);
    playSound('click');
    try {
      const hash = await swapViaAMM(fromAmtNum, tokenIn.address, address);
      const newTx: TransactionItem = {
        id: `tx-${Date.now()}`,
        type: 'Swap',
        details: `${fromAmtNum.toLocaleString()} ${fromToken} → ${estimatedReceive} ${toToken}`,
        hash,
        status: 'Confirmed',
        time: 'Just now',
      };
      setSessionTxs((prev) => [newTx, ...prev.slice(0, 24)]);
      boostScore(25, 'DEX Liquidity Swap');
      playSound('fanfare');

      if (isPostHogEnabled) {
        posthog.capture('swap_executed', {
          from_token: fromToken,
          to_token: toToken,
          amount: fromAmtNum,
          estimated_receive: isFinite(estimatedReceiveNum) ? estimatedReceiveNum : 0,
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
        hash,
        status: 'Confirmed',
        time: 'Just now',
      };
      setSessionTxs((prev) => [newTx, ...prev.slice(0, 24)]);
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
        hash,
        status: 'Confirmed',
        time: 'Just now',
      };
      setSessionTxs((prev) => [newTx, ...prev.slice(0, 24)]);
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

  // ─── Real market candles (Binance public feed) for feed assets ──────────
  useEffect(() => {
    if (!selectedFeed) {
      setCandles(null);
      setMarketPrice(null);
      setMarketChange(null);
      return;
    }
    let dead = false;
    fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedFeed.binance}&interval=${KLINE_INTERVAL[timeframe]}&limit=200`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (dead || !Array.isArray(raw) || raw.length === 0) return;
        const parsed: Candle[] = raw.map((k: any) => ({
          time: Number(k[0]),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        setCandles(parsed);
        if (parsed.length > 0) {
          const last = parsed[parsed.length - 1].close;
          const first = parsed[0].open;
          setMarketPrice(last);
          setMarketChange(first > 0 ? ((last - first) / first) * 100 : null);
        }
      })
      .catch(() => {
        if (!dead) {
          setCandles(null);
          setMarketPrice(null);
          setMarketChange(null);
        }
      });
    return () => { dead = true; };
  }, [selectedFeed, timeframe]);

  // ─── Real price chart canvas (price line + EMA9/EMA21 overlays) ─────────
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

    const closes = chartCloses;
    const hasData = closes.length >= 2;
    const padLeft = 46;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (!hasData) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        selectedFeed
          ? 'Fetching real Binance candles…'
          : selectedPool?.symbol === ammState?.token0.symbol
            ? 'cUSD is the suite stablecoin — pegged at $1.00.'
            : 'No on-chain price history yet — the pool has no liquidity.',
        width / 2,
        height / 2
      );
      return;
    }

    const minVal = Math.min(...closes) * 0.998;
    const maxVal = Math.max(...closes) * 1.002;
    const range = maxVal - minVal || 1;

    // Grid + y labels
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
      ctx.fillText(val < 10 ? val.toFixed(4) : val.toLocaleString('en-US', { maximumFractionDigits: 2 }), padLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    const N = closes.length;
    const xOf = (i: number) => padLeft + (i / (N - 1)) * chartW;
    const yOf = (v: number) => padTop + chartH - ((v - minVal) / range) * chartH;

    const drawSeries = (arr: number[], color: string, lineWidth: number) => {
      ctx.beginPath();
      arr.forEach((v, idx) => {
        const x = xOf(idx);
        const y = yOf(v);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    // EMA overlays (real)
    drawSeries(emaArray(closes, 9), '#22d3ee', 1.4);
    drawSeries(emaArray(closes, 21), '#c084fc', 1.4);

    // Area fill + main price line
    ctx.beginPath();
    closes.forEach((v, idx) => {
      const x = xOf(idx);
      const y = yOf(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.save();
    ctx.lineTo(xOf(N - 1), padTop + chartH);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    closes.forEach((v, idx) => {
      const x = xOf(idx);
      const y = yOf(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Latest pulsing dot
    const lastY = yOf(closes[N - 1]);
    ctx.beginPath();
    ctx.arc(xOf(N - 1), lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // X-axis labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ['← oldest', '', '', '', 'Now'].forEach((lbl, i) => {
      const x = padLeft + (i / 4) * chartW;
      ctx.fillText(lbl, x, height - 8);
    });
  }, [chartCloses, selectedFeed, selectedPool, ammState]);

  // ─── Pool composition donut (real reserve-value share) ──────────────────
  useEffect(() => {
    const canvas = compositionCanvasRef.current;
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

    const hasLiquidity = !!ammState && ammState.reserve0 > 0 && ammState.reserve1 > 0;
    const segments = hasLiquidity
      ? [
          { pct: 0.5, color: '#00f2fe' },
          { pct: 0.5, color: '#4ade80' },
        ]
      : [{ pct: 1, color: '#1e293b' }];

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

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hasLiquidity ? 'Reserve mix' : 'Liquidity', cx, cy - 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(hasLiquidity ? 'LIVE' : 'EMPTY', cx, cy + 8);
  }, [ammState]);

  // ─── Merged transaction stream (real on-chain events + session) ─────────
  const mergedTxs = useMemo<TransactionItem[]>(() => {
    const pair = ammState ? `${ammState.token0.symbol}/${ammState.token1.symbol}` : 'ReputationAMM';
    const ev = activity.map((a) => ({
      id: `ev-${a.txHash}`,
      type: (a.type === 'Add' ? 'Add Liquidity' : a.type === 'Remove' ? 'Remove Liquidity' : 'Swap') as TransactionItem['type'],
      details: `${a.type} · ${pair}`,
      hash: a.txHash,
      status: 'Confirmed' as const,
      time: `#${a.block.toLocaleString()}`,
    }));
    return [...ev, ...sessionTxs].slice(0, 14);
  }, [activity, sessionTxs, ammState]);

  const pairLabel = ammState ? `${ammState.token0.symbol} / ${ammState.token1.symbol}` : 'cUSD / DEPIN';

  return (
    <div className="space-y-6 text-slate-200">
      {/* ══════════ 1. Header & Asset Selector ══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-[#020d12] border border-cyan-500/20 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-lg border border-cyan-400/40"
            style={{ backgroundColor: activeAsset.iconBg, color: activeAsset.color }}
          >
            {activeAsset.iconText}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                {activeAsset.name}
              </h2>
              {poolLive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
                </span>
              ) : poolLoading ? (
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                  POOL READ FAILED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
              <span>
                Pair: <strong className="text-white">{pairLabel}</strong>
              </span>
              <span>•</span>
              <span className="text-cyan-300 font-bold flex items-center gap-1 hover:underline cursor-pointer">
                <a
                  href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.reputationAMM}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1"
                >
                  ReputationAMM <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-400">Inspect Asset:</label>
          <select
            value={selectedTokenKey}
            onChange={(e) => setSelectedTokenKey(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#031720] border border-cyan-500/40 text-cyan-300 font-bold font-mono text-xs outline-none cursor-pointer hover:border-cyan-400 transition shadow-inner"
          >
            {poolTokens.map((t) => (
              <option key={t.symbol} value={t.symbol} className="bg-[#020e14] text-white">
                {t.symbol} — pool asset (on-chain)
              </option>
            ))}
            {FEED_ASSETS.map((f) => (
              <option key={f.key} value={f.key} className="bg-[#020e14] text-white">
                {f.key} — {f.name} (Binance feed)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─────────── LEFT COLUMN (7 cols) ─────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card A: Real Pool / Market Stats */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-cyan-400" /> Live Stats
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {selectedFeed ? 'REAL MARKET FEED' : 'ON-CHAIN'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Price (USD)</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {selectedFeed
                    ? `$${fmtPrice(marketPrice)}`
                    : activeAsset.symbol === 'cUSD'
                      ? '$1.00'
                      : `$${fmtPrice(depinPriceUSD)}`}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {selectedFeed ? 'Binance close' : activeAsset.symbol === 'cUSD' ? 'suite stable peg' : 'reserves ratio'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">24h Change</span>
                <div
                  className={`text-sm sm:text-base font-black font-mono ${
                    selectedFeed || session24hChange != null
                      ? (selectedFeed ? marketChange ?? 0 : session24hChange ?? 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  {selectedFeed
                    ? marketChange != null
                      ? `${marketChange >= 0 ? '+' : ''}${marketChange.toFixed(2)}%`
                      : '—'
                    : activeAsset.symbol === 'cUSD'
                      ? '— (peg)'
                      : session24hChange != null
                        ? `${session24hChange >= 0 ? '+' : ''}${session24hChange.toFixed(2)}%`
                        : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{selectedFeed ? 'feed window' : 'session window'}</div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Pool TVL</span>
                <div className="text-sm sm:text-base font-black font-mono text-teal-300">
                  {poolTvl != null ? `$${poolTvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">reserves × cUSD peg</div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Pool Reserves</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {ammState
                    ? `${ammState.reserve0.toLocaleString('en-US', { maximumFractionDigits: 2 })} / ${ammState.reserve1.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{pairLabel}</div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 font-mono">LP Supply</span>
                <div className="text-sm sm:text-base font-black font-mono text-white">
                  {ammState ? ammState.lpTotalSupply.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{lpSharePct != null ? `${lpSharePct.toFixed(2)}% yours` : '0% yours'}</div>
              </div>
            </div>
          </div>

          {/* Card B: Real-Time Price Chart + Technical Indicators */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-1.5">
                  Real-time Pool / Market Price
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono ${
                      selectedFeed
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold'
                    }`}
                  >
                    {selectedFeed ? 'BINANCE FEED' : 'ON-CHAIN SESSION'}
                  </span>
                </span>
                <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                  <span className="text-2xl font-black font-mono text-white">
                    {selectedFeed
                      ? `$${fmtPrice(marketPrice)}`
                      : activeAsset.symbol === 'cUSD'
                        ? '$1.00'
                        : `$${fmtPrice(depinPriceUSD)}`}
                  </span>
                  {(selectedFeed || session24hChange != null) &&
                    (selectedFeed ? marketChange != null : activeAsset.symbol !== 'cUSD' && session24hChange != null) && (
                      <span
                        className={`text-xs font-mono font-bold flex items-center gap-0.5 ${
                          (selectedFeed ? marketChange ?? 0 : session24hChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />{' '}
                        {(selectedFeed ? marketChange ?? 0 : session24hChange ?? 0).toFixed(2)}%
                      </span>
                    )}
                </div>
              </div>

              {/* Timeframe pills */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px]">
                {(['1H', '1D', '1W', '1M'] as const).map((tf) => (
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

            {/* Real technical indicator chips (computed on the real series) */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-300 flex items-center gap-1">
                EMA9 <strong className="text-cyan-300">{indicators ? fmtPrice(indicators.ema9) : '—'}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-300 flex items-center gap-1">
                EMA21 <strong className="text-purple-300">{indicators ? fmtPrice(indicators.ema21) : '—'}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-300 flex items-center gap-1">
                RSI14{' '}
                <strong className={indicators?.rsi == null ? 'text-slate-300' : indicators.rsi >= 70 ? 'text-rose-400' : indicators.rsi <= 30 ? 'text-emerald-400' : 'text-cyan-300'}>
                  {indicators && indicators.rsi != null ? indicators.rsi.toFixed(1) : '—'}
                </strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-300 flex items-center gap-1">
                MACD <strong className="text-cyan-300">{indicators?.macd ? fmtPrice(indicators.macd.macd, 6) : '—'}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-300 flex items-center gap-1">
                SIGNAL <strong className="text-purple-300">{indicators?.macd ? fmtPrice(indicators.macd.signal, 6) : '—'}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-slate-400 flex items-center gap-1">
                {indicators ? `${indicators.count} samples` : 'no data'}
              </span>
            </div>

            {/* Chart canvas */}
            <div className="relative w-full h-[240px] bg-[#01080b] rounded-2xl border border-white/5 overflow-hidden">
              <canvas ref={chartCanvasRef} className="w-full h-full block" />
              <div className="absolute top-3 left-4 flex items-center gap-4 text-[10px] font-mono">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2fe]" /> Live Price
                </span>
                <span className="flex items-center gap-1.5 text-cyan-200/70">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-300" /> EMA 9
                </span>
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> EMA 21
                </span>
              </div>
            </div>
          </div>

          {/* Card C: Real On-Chain Activity (replaces simulated mentions) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> On-Chain Activity
              </span>
              <span className="text-[10px] font-mono text-slate-400">{poolLive ? 'live log — ReputationAMM' : 'pool unreadable'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold">
                Swaps: {activityCounts.swaps}
              </span>
              <span className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-bold">
                LP Adds: {activityCounts.adds}
              </span>
              <span className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold">
                LP Removes: {activityCounts.removes}
              </span>
              <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400">total events: {activity.length}</span>
            </div>

            {mergedTxs.length === 0 ? (
              <p className="text-[11px] font-mono text-slate-500 leading-relaxed pt-1">
                The ReputationAMM pool has zero on-chain events so far. Be the first to add liquidity — after that, every
                swap and LP action lands here with its real transaction link.
              </p>
            ) : (
              <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-1">
                {mergedTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between gap-2 text-[11px] font-mono"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${
                        tx.type === 'Swap'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : tx.type === 'Add Liquidity'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {tx.type}
                    </span>
                    <span className="text-slate-300 truncate flex-1 text-right" title={tx.details}>
                      {tx.details}
                    </span>
                    <span className="text-slate-500 whitespace-nowrap">{tx.time}</span>
                    <a
                      href={`${CREDITCOIN_BLOCKSCOUT}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5 whitespace-nowrap"
                      title={tx.hash}
                    >
                      {txHashShort(tx.hash)} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card D: Pool Health & Parameters (real deployment facts) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" /> Pool Health &amp; Parameters
            </span>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2.5 flex-1 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00f2fe]" /> {ammState?.token0.symbol ?? 'cUSD'}
                    </span>
                    <strong className="text-cyan-300">
                      {ammState && ammState.reserve0 > 0 ? '50%' : '—'}
                    </strong>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#00f2fe] rounded-full transition-all"
                      style={{ width: ammState && ammState.reserve0 > 0 ? '50%' : '0%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#4ade80]" /> {ammState?.token1.symbol ?? 'DEPIN'}
                    </span>
                    <strong className="text-emerald-300">
                      {ammState && ammState.reserve1 > 0 ? '50%' : '—'}
                    </strong>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#4ade80] rounded-full transition-all"
                      style={{ width: ammState && ammState.reserve1 > 0 ? '50%' : '0%' }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  Reserve-value share by USD peg. With zero reserves the pool is empty until the first liquidity add.
                </p>
              </div>

              <div className="w-[110px] h-[110px] flex-shrink-0 flex items-center justify-center">
                <canvas ref={compositionCanvasRef} className="w-[110px] h-[110px]" />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                <span className="text-slate-400">Pool</span>
                <a
                  href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.reputationAMM}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  {txHashShort(CONTRACTS.reputationAMM)} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                <span className="text-slate-400">Governance hook</span>
                <a
                  href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.credXHub}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-300 hover:underline flex items-center gap-1"
                >
                  {txHashShort(CONTRACTS.credXHub)} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                <span className="text-slate-400">Pair</span>
                <span className="text-white font-bold">
                  {ammState ? `${ammState.token0.symbol} (${ammState.token0.decimals}${ammState.token0.symbol === 'cUSD' ? ' · pegged' : ''}) + ${ammState.token1.symbol} (${ammState.token1.decimals})` : 'cUSD (18) + DEPIN (18)'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                <span className="text-slate-400">Quotes</span>
                <span className={canSwap ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {canSwap ? 'live (getAmountOut)' : 'unavailable — no reserves'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────── RIGHT COLUMN (5 cols) ─────────── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Swap Ticket */}
          <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#031822] via-[#021016] to-[#010a0e] border border-cyan-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                Swap
                {poolLive ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE ON-CHAIN
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                    {isConnected ? 'POOL EMPTY / UNREADABLE' : 'NOT CONNECTED'}
                  </span>
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
                {isSlippageOpen && (
                  <div className="absolute right-0 top-9 w-60 p-3 rounded-2xl bg-[#02141c] border border-cyan-500/40 shadow-2xl z-30 space-y-2">
                    <span className="text-[11px] font-mono text-slate-300 block font-bold">Max Slippage Tolerance</span>
                    <div className="flex items-center gap-1.5">
                      {[0.1, 0.5, 1.0].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setSlippageTolerance(val);
                            setIsSlippageOpen(false);
                          }}
                          className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                            slippageTolerance === val ? 'bg-cyan-400 text-slate-950' : 'bg-black/50 text-slate-400 hover:text-white'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                      Slippage is a local safety check; final output and pricing are decided on-chain by the AMM.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* You Pay */}
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <select
                    value={fromToken}
                    onChange={(e) => setFromToken(e.target.value)}
                    className="bg-[#031a24] text-white font-black font-mono text-xs px-2.5 py-1.5 rounded-xl border border-cyan-500/30 outline-none cursor-pointer"
                  >
                    {poolTokens.map((t) => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span>Balance: {fromBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
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
                  {fromToken === 'cUSD' ? '≈ $' + fmtPrice(fromAmtNum || null, 2) : 'amount'}
                </span>
              </div>
            </div>

            {/* Flip */}
            <div className="flex justify-center -my-2">
              <button
                onClick={handleFlipDirection}
                className="w-9 h-9 rounded-full bg-[#03202c] hover:bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 flex items-center justify-center transition-all hover:rotate-180 cursor-pointer shadow-lg z-10"
                title="Invert Direction"
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>

            {/* You Receive */}
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <select
                    value={toToken}
                    onChange={(e) => setToToken(e.target.value)}
                    className="bg-[#031a24] text-white font-black font-mono text-xs px-2.5 py-1.5 rounded-xl border border-cyan-500/30 outline-none cursor-pointer"
                  >
                    {poolTokens.map((t) => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
                <span className="text-xs font-mono text-cyan-300">
                  1 {fromToken} ≈ {poolQuote ? (poolQuote.rate < 1 ? poolQuote.rate.toFixed(6) : poolQuote.rate.toFixed(4)) : '—'} {toToken}
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
                  {poolQuote ? 'on-chain quote' : 'awaiting liquidity'}
                </span>
              </div>
            </div>

            {/* Swap Action */}
            <button
              disabled={isSwapping}
              onClick={handleExecuteSwap}
              className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-wide uppercase ${
                isConnected && !canSwap
                  ? 'bg-white/5 border border-dashed border-emerald-400/40 text-emerald-300'
                  : 'bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 hover:from-teal-300 hover:to-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/25'
              }`}
            >
              {isSwapping ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing on Creditcoin L1...</span>
                </>
              ) : !isConnected ? (
                <span>Connect Wallet</span>
              ) : canSwap ? (
                <span>Swap</span>
              ) : (
                <span>Pool Empty — Add Liquidity</span>
              )}
            </button>

            {/* Route & fees (real) */}
            <div className="rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
              <button
                onClick={() => setIsRouteExpanded(!isRouteExpanded)}
                className="w-full p-3 flex items-center justify-between text-xs font-mono text-slate-300 hover:bg-white/5 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <Info className="w-3.5 h-3.5 text-cyan-400" /> Route &amp; Network Fees
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-cyan-300 font-bold">
                    {fromToken} &rarr; {toToken}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isRouteExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isRouteExpanded && (
                <div className="p-3 pt-1 space-y-2 text-[11px] font-mono border-t border-white/5 text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Route:</span>
                    <span className="text-white font-bold flex items-center gap-1">
                      {fromToken} &rarr; ReputationAMM &rarr; {toToken}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>1 {fromToken} Rate:</span>
                    <span className="text-slate-200">{poolQuote ? (poolQuote.rate < 1 ? poolQuote.rate.toFixed(6) : poolQuote.rate.toFixed(4)) : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Execution:</span>
                    <span className="text-emerald-400 font-bold">on-chain getAmountOut (reputation-weighted)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Slippage Tolerance:</span>
                    <span className="text-amber-300">{slippageTolerance}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Network Fee:</span>
                    <span className="text-slate-300">CC3 testnet gas (wallet-determined)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Transactions (real on-chain + this session) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Transactions
              </span>
              <span className="text-[10px] font-mono text-slate-400">pool events + this session</span>
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
                  {mergedTxs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-500">
                        No transactions yet — the pool is empty. Add liquidity or swap to record one.
                      </td>
                    </tr>
                  ) : (
                    mergedTxs.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition">
                        <td className="py-2 text-slate-300 font-bold">{tx.type}</td>
                        <td className="py-2 text-slate-400 max-w-[140px] truncate" title={tx.details}>
                          {tx.details}
                        </td>
                        <td className="py-2">
                          <a
                            href={`${CREDITCOIN_BLOCKSCOUT}/tx/${tx.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline cursor-pointer flex items-center gap-0.5"
                            title={tx.hash}
                          >
                            {txHashShort(tx.hash)}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
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

          {/* Card 3: Pool Stats & Liquidity Management (real) */}
          <div className="p-5 rounded-3xl bg-[#020b0e] border border-cyan-500/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Pool Stats &amp; Liquidity
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
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">pool read failed</span>
              )}
            </div>

            {/* Price triad (real) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{ammState?.token0.symbol ?? 'token0'}</span>
                <div className="text-xs font-black font-mono text-white">
                  {ammState ? (ammState.token0.symbol === 'cUSD' ? '$1.00' : fmtPrice(depinPriceUSD)) : '—'}
                </div>
                <div className="text-[9px] font-mono text-slate-500">{ammState ? 'reserve / peg' : 'unread'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{ammState?.token1.symbol ?? 'token1'}</span>
                <div className="text-xs font-black font-mono text-teal-300">
                  {ammState && ammState.token1.symbol === 'cUSD' ? '$1.00' : fmtPrice(depinPriceUSD)}
                </div>
                <div className="text-[9px] font-mono text-slate-500">{ammState ? 'reserve ratio' : 'unread'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-mono">Pool TVL</span>
                <div className="text-xs font-black font-mono text-teal-300">
                  {poolTvl != null ? `$${poolTvl.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                </div>
                <div className="text-[9px] font-mono text-slate-500">{poolLive ? 'reserve0 + reserve1' : 'reserves unread'}</div>
              </div>
            </div>

            {/* Real reserves */}
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
                  {ammState.reserve0 > 0 && ammState.reserve1 > 0 && (
                    <>
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 transition-all" style={{ width: '50%' }} />
                      <div className="h-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all" style={{ width: '50%' }} />
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

            {/* Your LP & wallet balances */}
            {poolLive && ammState ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">Your LP</span>
                  <div className="text-xs font-black font-mono text-cyan-300">
                    {ammState.lpBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} LP
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400">
                    {lpSharePct != null ? `${lpSharePct.toFixed(2)}% of pool` : 'no LP held'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">cUSD Balance</span>
                  <div className="text-xs font-black font-mono text-white">
                    {cusdBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400">wallet token balance</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono">{ammState.token1.symbol} Balance</span>
                  <div className="text-xs font-black font-mono text-white">
                    {token1Balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400">wallet token balance</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {['Your LP', 'cUSD Balance', 'Token1 Balance'].map((lbl) => (
                  <div key={lbl} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-mono">{lbl}</span>
                    <div className="text-xs font-black font-mono text-slate-500">—</div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Remove Liquidity (real writes) */}
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
                  {!canSwap && (
                    <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                      The pool currently has zero reserves. Your first deposit sets the initial ratio and enables live
                      swaps + quotes for everyone.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] font-mono text-slate-500">
                  Pool unreadable — check the Creditcoin testnet RPC and try again.
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