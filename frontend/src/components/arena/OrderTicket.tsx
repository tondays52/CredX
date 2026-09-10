import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import { ArrowUp, ArrowDown, Zap, DollarSign, Award, Flame, Coins, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { AssetSymbol, Timeframe, PredictionRound, UserBet } from '../../types/arena';

interface OrderTicketProps {
  asset: AssetSymbol;
  round: PredictionRound;
  onPlaceBet: (direction: 'UP' | 'DOWN', amount: number) => void;
  streak: number;
  userBet?: UserBet | null;
  currentPrice: number;
  strikePrice: number;
  paperBalanceUSD: number;
  onForceSettle?: () => void;
}

const timeframeMultipliers: Record<Timeframe, number> = {
  '5m': 1.92,
  '15m': 2.15,
  '30m': 2.45,
  '1h': 2.80,
  '1d': 3.50,
};

export const OrderTicket: React.FC<OrderTicketProps> = ({
  asset,
  round,
  onPlaceBet,
  streak,
  userBet,
  currentPrice,
  strikePrice,
  paperBalanceUSD,
  onForceSettle,
}) => {
  const { addToast } = useToast();
  const [amount, setAmount] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);

  const quickChips = [10, 25, 50, 100, 250];
  const currentTf: Timeframe = round.timeframe || '5m';
  const multiplier = timeframeMultipliers[currentTf] || 1.92;
  const potentialPayout = (amount * multiplier).toFixed(2);

  const formatPriceValue = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '--';
    if (val < 0.0001) return val.toFixed(8);
    if (val < 0.01) return val.toFixed(6);
    if (val < 1) return val.toFixed(4);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleBet = (direction: 'UP' | 'DOWN') => {
    if (!amount || amount <= 0) {
      addToast('error', 'Invalid Stake', 'Please select or enter a valid stake amount.');
      return;
    }

    if (amount > paperBalanceUSD) {
      addToast('error', 'Insufficient Balance', `Your available balance is $${paperBalanceUSD.toFixed(2)} USDC.`);
      return;
    }

    setSubmitting(true);
    addToast(
      'info',
      'Placing Binary Prediction',
      `Staking $${amount} on ${direction} for ${asset} @ strike $${formatPriceValue(strikePrice)}...`
    );

    setTimeout(() => {
      onPlaceBet(direction, amount);
      if (isPostHogEnabled) {
        posthog.capture('prediction_placed', {
          asset,
          direction,
          amount,
          timeframe: currentTf,
        });
      }
      setSubmitting(false);
      addToast(
        'success',
        'Prediction Position Opened',
        `Successfully staked $${amount} on ${direction}. Target strike locked at $${formatPriceValue(strikePrice)}.`
      );
    }, 400);
  };

  const isWinning =
    userBet &&
    ((userBet.direction === 'UP' && currentPrice >= userBet.strikePrice) ||
      (userBet.direction === 'DOWN' && currentPrice <= userBet.strikePrice));

  return (
    <GlassCard className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Prediction Order Ticket</h3>
          <span className="text-xs text-white/40">Round #{round.id} &bull; {currentTf.toUpperCase()} Expiry</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold animate-pulse">
            <Flame className="w-4 h-4 text-amber-400" />
            {streak} Streak (+{streak * 5} CTS)
          </div>
        )}
      </div>

      {/* Active Bet Position Display */}
      {userBet ? (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/30 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ACTIVE POSITION OPEN
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                userBet.direction === 'UP'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              PREDICT {userBet.direction}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-white/70">
            <div className="flex justify-between">
              <span>Stake Amount:</span>
              <strong className="text-white">${userBet.amount.toFixed(2)} USDC</strong>
            </div>
            <div className="flex justify-between">
              <span>Locked Strike:</span>
              <strong className="text-amber-400">${formatPriceValue(userBet.strikePrice)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Live Market Price:</span>
              <strong className={currentPrice >= userBet.strikePrice ? 'text-emerald-400' : 'text-rose-400'}>
                ${formatPriceValue(currentPrice)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Est. Win Payout:</span>
              <strong className="text-emerald-400">${(userBet.amount * multiplier).toFixed(2)} USDC</strong>
            </div>
          </div>

          <div
            className={`p-2.5 rounded-lg text-xs font-bold flex items-center justify-between border ${
              isWinning
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <span className="flex items-center gap-1">
              {isWinning ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isWinning ? 'IN THE MONEY' : 'OUT OF THE MONEY'}
            </span>
            <span>{isWinning ? `+$${(userBet.amount * (multiplier - 1)).toFixed(2)} PnL` : '-$0.00'}</span>
          </div>

          {onForceSettle && (
            <button
              onClick={onForceSettle}
              className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Settle This Round Now
            </button>
          )}
        </div>
      ) : (
        /* Stake Input & Chips when no active bet */
        <div>
          <div className="flex justify-between text-xs font-medium mb-1.5">
            <span className="text-white/70">Stake Amount (USDC)</span>
            <span className="text-cyan-400 font-mono">Available: ${paperBalanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-4 py-2.5 text-white font-mono text-base font-semibold outline-none transition"
              placeholder="50"
            />
            <span className="absolute right-3 top-2.5 text-xs text-white/40 font-mono">USDC</span>
          </div>

          {/* Quick Chips */}
          <div className="flex gap-2 mt-2">
            {quickChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setAmount(chip)}
                className={`flex-1 py-1 rounded-lg text-xs font-mono font-medium transition border cursor-pointer ${
                  amount === chip
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
                }`}
              >
                ${chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payout Summary */}
      <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-white/60">
          <span>{currentTf.toUpperCase()} Parimutuel Odds</span>
          <span className="text-cyan-400 font-bold">{multiplier}x Multiplier</span>
        </div>
        <div className="flex justify-between text-white/60">
          <span>Projected Win Payout</span>
          <span className="text-emerald-400 font-bold text-sm">${potentialPayout} USDC</span>
        </div>
      </div>

      {/* Binary Choice Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={() => handleBet('UP')}
          disabled={submitting || !!userBet}
          className="py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          PREDICT UP
        </button>

        <button
          onClick={() => handleBet('DOWN')}
          disabled={submitting || !!userBet}
          className="py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-500/25 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ArrowDown className="w-5 h-5 stroke-[2.5]" />
          PREDICT DOWN
        </button>
      </div>

      <div className="text-[11px] text-white/40 text-center font-mono">
        Consecutive correct predictions triggers automatic CTS Credit Score bonus on Creditcoin L1.
      </div>
    </GlassCard>
  );
};

export default OrderTicket;
