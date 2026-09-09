import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface FlashLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlashLoanModal: React.FC<FlashLoanModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState(100000);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { showToast, playSound } = useToast();

  const handleExecute = () => {
    setExecuting(true);
    setProgress(15);
    playSound('ping');

    setTimeout(() => setProgress(45), 400);
    setTimeout(() => setProgress(80), 800);
    setTimeout(() => {
      setProgress(100);
      setExecuting(false);
      playSound('success');
      showToast(
        'Flash Loan Executed!',
        `Borrowed $${amount.toLocaleString()} cUSD with 0.01% fee tier ($${(amount * 0.0001).toFixed(2)}). Arbitraged +$1,420.00 profit.`,
        'success'
      );
      onClose();
    }, 1200);
  };

  const fee = (amount * 0.0001).toFixed(2);
  const standardFee = (amount * 0.0009).toFixed(2);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reputation Flash Loan Arbitrage"
      subtitle="Zero-collateral atomic borrowing powered by Creditcoin"
      icon={<Zap className="w-5 h-5 text-cyan-400" />}
    >
      <div className="space-y-5">
        {/* Tier Badge */}
        <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-slate-400">Your Fee Tier:</span>
            <span className="text-emerald-400 font-bold ml-1">0.01% (9x Discount)</span>
          </div>
          <span className="text-slate-500 line-through">Standard: 0.09%</span>
        </div>

        {/* Loan Amount Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">Select Flash Loan Principal (cUSD):</label>
          <div className="grid grid-cols-4 gap-2">
            {[25000, 50000, 100000, 500000].map(val => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                  amount === val
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-white/5 hover:bg-cyan-500/20 border-white/10 text-white'
                }`}
              >
                ${val / 1000}k
              </button>
            ))}
          </div>
        </div>

        {/* Live Arbitrage Breakdown */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Principal Borrowed:</span>
            <span className="text-white font-bold">${amount.toLocaleString()} cUSD</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reputation Fee (0.01%):</span>
            <span className="text-emerald-400 font-bold">
              ${fee} cUSD <span className="text-[10px] text-slate-500">(Saved ${(amount * 0.0008).toFixed(2)})</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Target Arbitrage Route:</span>
            <span className="text-cyan-400">Uniswap v3 ➔ Curve Pool</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-white/10">
            <span className="text-slate-300 font-bold">Estimated Net Profit:</span>
            <span className="text-emerald-400 font-bold text-sm">+$1,420.00 cUSD</span>
          </div>
        </div>

        {/* Progress bar */}
        {executing && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-cyan-400">
              <span>Executing atomic multi-hop arbitrage...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleExecute}
          disabled={executing}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          <span>{executing ? 'Executing Flash Arbitrage...' : `Execute Atomic Flash Loan ($${amount.toLocaleString()})`}</span>
        </button>
      </div>
    </Modal>
  );
};

export default FlashLoanModal;
