import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface AMMSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AMMSwapModal: React.FC<AMMSwapModalProps> = ({ isOpen, onClose }) => {
  const [payAmount, setPayAmount] = useState(1000);
  const { showToast, playSound } = useToast();

  const receiveAmount = (payAmount / 2.0 - payAmount * 0.0005).toFixed(2);
  const fee = (payAmount * 0.0005).toFixed(2);

  const handleSwap = () => {
    playSound('success');
    showToast(
      'AMM Swap Confirmed!',
      `Swapped ${payAmount} cUSD for ${receiveAmount} CTC via ReputationAMM (0.05% fee tier applied: $${fee})`,
      'success'
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reputation AMM Liquidity DEX"
      subtitle="Tier-weighted liquidity pool with 0.05% fee for Super-Prime"
      icon={<RefreshCw className="w-5 h-5 text-emerald-400" />}
    >
      <div className="space-y-5">
        <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300">Swap Fee Tier:</span>
          <span className="text-emerald-400 font-extrabold">0.05% (vs 0.30% standard)</span>
        </div>

        {/* Swap Input Box */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>You Pay:</span>
              <span>Balance: 14,250 cUSD</span>
            </div>
            <div className="flex justify-between items-center">
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(+e.target.value)}
                className="bg-transparent text-white font-mono text-lg font-bold outline-none w-2/3"
              />
              <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold font-mono text-cyan-300">cUSD</span>
            </div>
          </div>

          <div className="flex justify-center -my-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs text-slate-400">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>You Receive (Est.):</span>
              <span>Rate: 1 CTC = 2.00 cUSD</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-white font-mono text-lg font-bold">{receiveAmount}</div>
              <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold font-mono text-emerald-300">CTC</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">DEX Fee (0.05%):</span>
            <span className="text-emerald-400 font-bold">
              ${fee} cUSD <span className="text-slate-500 line-through ml-1">${(payAmount * 0.003).toFixed(2)}</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Price Impact:</span>
            <span className="text-emerald-400">&lt; 0.01%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Routing:</span>
            <span className="text-cyan-400">CredX ReputationAMM (Direct)</span>
          </div>
        </div>

        <button
          onClick={handleSwap}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20"
        >
          🔄 Swap {payAmount} cUSD ➔ CTC (0.05% Fee)
        </button>
      </div>
    </Modal>
  );
};

export default AMMSwapModal;
