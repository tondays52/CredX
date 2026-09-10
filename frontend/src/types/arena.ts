export type AssetSymbol =
  | 'BTC'
  | 'ETH'
  | 'SOL'
  | 'CTC'
  | 'CTC_USDT'
  | 'CTC_ETH'
  | 'CTC_BTC'
  | 'BNB'
  | 'XRP'
  | 'DOGE'
  | 'AVAX'
  | 'LINK'
  | 'GOLD';

export type Timeframe = '5m' | '15m' | '30m' | '1h' | '1d';

export interface TimeframeConfig {
  id: Timeframe;
  label: string;
  durationSec: number;
  multiplier: number;
  volatilityScale: number;
}

export interface AssetConfig {
  symbol: AssetSymbol;
  name: string;
  pair: string;
  category: 'CTC' | 'Major' | 'DePIN' | 'RWA';
  basePrice: number;
  binanceSymbol: string;
  quoteSymbol: string;
  decimals: number;
}

export interface TechnicalSignals {
  rsi: number;
  rsiLabel: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  emaFast: number;
  emaSlow: number;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH';
  macd: number;
  macdSignal: number;
  signalHeadline: string;
  buyVolumeRatio: number;
}

export interface PredictionRound {
  id: number;
  asset: AssetSymbol;
  timeframe: Timeframe;
  strikePrice: number;
  closePrice?: number | null;
  currentPrice?: number;
  upPool: number;
  downPool: number;
  status?: 'ACTIVE' | 'RESOLVED' | 'CANCELLED' | string;
  startTime: number;
  endTime: number;
}

export interface UserBet {
  roundId: number;
  direction: 'UP' | 'DOWN';
  amount: number;
  strikePrice: number;
  timestamp: number;
}
