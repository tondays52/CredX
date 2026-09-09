import { TechnicalSignals } from '../types/arena';

/**
 * Calculates real-time Technical Indicators (RSI, EMA-9, EMA-21, MACD)
 * from an array of price values.
 */
export function calculateTechnicalSignals(prices: number[]): TechnicalSignals {
  if (prices.length < 5) {
    return {
      rsi: 50.0,
      rsiLabel: 'NEUTRAL',
      emaFast: prices[prices.length - 1] || 100,
      emaSlow: prices[prices.length - 1] || 100,
      trend: 'BULLISH',
      macd: 0.15,
      macdSignal: 0.10,
      signalHeadline: 'CONSOLIDATION • BALANCED ORDER FLOW',
      buyVolumeRatio: 52
    };
  }

  const currentPrice = prices[prices.length - 1];

  // 1. Calculate RSI (14 period or scaled to available data)
  const period = Math.min(14, prices.length - 1);
  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  let rsi = 50;

  if (avgLoss === 0) {
    rsi = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi = parseFloat((100 - (100 / (1 + rs))).toFixed(1));
  }

  // 2. Calculate EMA 9 & EMA 21
  const calcEMA = (data: number[], span: number): number => {
    const k = 2 / (span + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const emaFast = calcEMA(prices, Math.min(9, prices.length));
  const emaSlow = calcEMA(prices, Math.min(21, prices.length));

  // 3. MACD Approximation
  const macd = parseFloat((emaFast - emaSlow).toFixed(4));
  const macdSignal = parseFloat((macd * 0.85).toFixed(4));

  // 4. Trend & Headline Signal Logic
  let rsiLabel: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let trend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' = 'BULLISH';
  let signalHeadline = 'BALANCED ACCUMULATION';
  let buyVolumeRatio = 50;

  if (rsi >= 70) {
    rsiLabel = 'OVERBOUGHT';
    signalHeadline = 'OVERBOUGHT SQUEEZE • BEARISH RESISTANCE NEAR STRIKE';
    buyVolumeRatio = 38;
  } else if (rsi <= 30) {
    rsiLabel = 'OVERSOLD';
    signalHeadline = 'OVERSOLD DIP • STRONG BUY ACCUMULATION ZONE';
    buyVolumeRatio = 68;
  } else if (rsi > 52) {
    rsiLabel = 'BULLISH';
    signalHeadline = emaFast > emaSlow ? 'STRONG BULLISH MOMENTUM (EMA 9 > EMA 21)' : 'BULLISH RECOVERY';
    buyVolumeRatio = 58;
  } else {
    rsiLabel = 'BEARISH';
    signalHeadline = emaFast < emaSlow ? 'BEARISH DOWNTREND (EMA 9 < EMA 21)' : 'MILD SELLING PRESSURE';
    buyVolumeRatio = 44;
  }

  if (emaFast > emaSlow && rsi > 55) trend = 'STRONG_BULLISH';
  else if (emaFast > emaSlow) trend = 'BULLISH';
  else if (emaFast < emaSlow && rsi < 45) trend = 'STRONG_BEARISH';
  else trend = 'BEARISH';

  return {
    rsi,
    rsiLabel,
    emaFast: parseFloat(emaFast.toFixed(2)),
    emaSlow: parseFloat(emaSlow.toFixed(2)),
    trend,
    macd,
    macdSignal,
    signalHeadline,
    buyVolumeRatio
  };
}
