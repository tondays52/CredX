import React from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { Award, Flame, Zap, ArrowRight, Sparkles } from 'lucide-react';

interface StreakCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: number;
}

const StreakCelebrationModal: React.FC<StreakCelebrationModalProps> = ({
  isOpen,
  onClose,
  streak,
}) => {
  const { addToast } = useToast();

  const handleSyncToChain = () => {
    addToast('fanfare', 'Creditcoin L1 Synchronized', 'Reputation boost (+15 CTS points) anchored to your on-chain Soulbound Passport.');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="PredictBay Hot Streak Reached!" maxWidth="max-w-md">
      <div className="space-y-4 text-center text-xs text-white/80">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20 animate-bounce">
          <Flame className="w-9 h-9" />
        </div>

        <div>
          <h3 className="text-xl font-extrabold text-white">{streak}-Win Streak Unlocked!</h3>
          <p className="text-xs text-amber-300/90 font-mono mt-1">
            PredictBay Binary Trading Arena Milestone
          </p>
        </div>

        <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2 text-left">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Sparkles className="w-4 h-4" /> Creditcoin Reputation Rewards
          </div>
          <div className="text-[11px] text-white/70 space-y-1">
            <div className="flex justify-between">
              <span>CTS Point Bonus:</span>
              <strong className="text-emerald-400 font-mono">+15 CTS Points</strong>
            </div>
            <div className="flex justify-between">
              <span>Uncollateralized Credit Buffer:</span>
              <strong className="text-cyan-400 font-mono">+$2,500 USDC</strong>
            </div>
            <div className="flex justify-between">
              <span>Reputation Tier:</span>
              <strong className="text-white font-mono">Sovereign Prime</strong>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSyncToChain}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold text-xs shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-current" />
            Synchronize Reputation to Creditcoin L1
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default StreakCelebrationModal;
