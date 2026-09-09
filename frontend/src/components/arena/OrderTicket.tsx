import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import { ArrowUp, ArrowDown, Zap, DollarSign, Award, Flame, Coins } from 'lucide-react';
import { AssetSymbol, Timeframe, PredictionRound } from '../../types/arena';

interface OrderTicketProps {
  asset: AssetSymbol;
  round: PredictionRound;
  onPlaceBet: (direction: 'UP' | 'DOWN', amount: number) => void;
  streak: number;
}

const timeframeMultipliers: Record<Timeframe, number> = {
  '5m': 1.92,
  '15m': 2.15,
  '30m': 2.45,
  '1h': 2.80,
  '1d': 3.50,
};

const OrderTicket: React.FC<OrderTicketProps> = ({
  asset,
  round,
  onPlaceBet,
  streak,
}) => {
  const { balanceCTC } = useWeb3();
  const { addToast } = useToast();
  const [amount, setAmount] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const quickChips = [10, 25, 50, 100, 250];
  const currentTf: Timeframe = round.timeframe || '5m';
  const multiplier = timeframeMultipliers[currentTf] || 1.92;
  const potentialPayout = (amount * multiplier).toFixed(2);

  const handleBet = (direction: 'UP' | 'DOWN') => {
    if (!amount || amount <= 0) {
      addToast('error', 'Invalid Stake', 'Please select or enter a valid stake amount.');
      return;
    }
    setSubmitting(true);
    addToast('info', 'Submitting Binary Order', `Placing $${amount} on ${direction} for ${asset} (${currentTf.toUpperCase()}) round #${round.id}...`);

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
      addToast('success', 'Order Filled', `Successfully committed $${amount} to ${direction} pool on ${currentTf.toUpperCase()} window.`);
    }, 800);
  };

  return (
    <GlassCard className="p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Place Prediction Stake</h3>
          <span className="text-xs text-white/40">Round #{round.id} &bull; {currentTf.toUpperCase()} Binary Expiry</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold animate-pulse">
            <Flame className="w-4 h-4 text-amber-400" />
            {streak} Win Streak
          </div>
        )}
      </div>

      {/* Stake Input */}
      <div>
        <div className="flex justify-between text-xs font-medium mb-1.5">
          <span className="text-white/70">Stake Amount (USDC)</span>
          <span className="text-cyan-400 font-mono">Available: ${userWalletUSD.toLocaleString()} USD</span>
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
              className={`flex-1 py-1 rounded-lg text-xs font-mono font-medium transition border ${
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

      {/* Payout Summary */}
      <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-white/60">
          <span>{currentTf.toUpperCase()} Multiplier</span>
          <span className="text-cyan-400 font-bold">{multiplier}x Parimutuel</span>
        </div>
        <div className="flex justify-between text-white/60">
          <span>Estimated Win Payout</span>
          <span className="text-emerald-400 font-bold text-sm">${potentialPayout} USDC</span>
        </div>
      </div>

      {/* Binary Choice Action Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={() => handleBet('UP')}
          disabled={submitting}
          className="py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          PREDICT UP
        </button>

        <button
          onClick={() => handleBet('DOWN')}
          disabled={submitting}
          className="py-3.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowDown className="w-5 h-5 stroke-[2.5]" />
          PREDICT DOWN
        </button>
      </div>

      <div className="text-[11px] text-white/40 text-center font-mono">
        Consecutive correct predictions triggers automatic CTS Credit Score bonus on Creditcoin.
      </div>
    </GlassCard>
  );
};

export default OrderTicket;
