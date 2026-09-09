import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { ArrowDownLeft, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BorrowModal: React.FC<BorrowModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const { score, maxBorrowLimit, borrow } = useProtocol();
  const [amount, setAmount] = useState('1500');
  const [collateralAsset, setCollateralAsset] = useState('ETH');
  const [loading, setLoading] = useState(false);

  // Interest rate discount calculated from CTS score
  const interestRate = Math.max(3.2, 12.5 - (score / 1000) * 8.5).toFixed(2);
  const collateralRatio = score > 750 ? '110%' : score > 600 ? '125%' : '140%';

  const handleBorrow = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      addToast('error', 'Invalid Sum', 'Please enter a valid loan request amount.');
      return;
    }
    if (val > maxBorrowLimit) {
      addToast('error', 'Limit Exceeded', `Your tier allows borrowing up to $${maxBorrowLimit.toLocaleString()}.`);
      return;
    }

    setLoading(true);
    addToast('info', 'Underwriting Loan', `Evaluating CTS score (${score}) with OCCR algorithmic parameters...`);

    setTimeout(() => {
      borrow(val, `${val * 1.15} ${collateralAsset}`);
      setLoading(false);
      addToast('success', 'Credit Disbursed', `Loan position for $${val.toLocaleString()} USDC activated at ${interestRate}% APR.`);
      onClose();
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open Reputation-Backed Credit Line" maxWidth="max-w-md">
      <div className="space-y-4 text-xs text-white/80">
        <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono">
              {score}
            </div>
            <div>
              <div className="font-semibold text-white">Prime Credit Rating</div>
              <div className="text-[10px] text-white/50">Reputation LTV: {collateralRatio}</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-white/40 block">Max Limit</span>
            <span className="text-emerald-400 font-bold font-mono">${maxBorrowLimit.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-white/70 block mb-1.5">Borrow Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm outline-none transition"
              placeholder="e.g. 1500"
            />
            <span className="absolute right-3 top-2.5 text-xs text-white/40 font-mono">USDC</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-white/70 block mb-1.5">Collateral Asset</label>
          <div className="grid grid-cols-3 gap-2">
            {['ETH', 'WBTC', 'CTC'].map((token) => (
              <button
                key={token}
                onClick={() => setCollateralAsset(token)}
                className={`py-2 rounded-xl text-xs font-mono font-medium transition border ${
                  collateralAsset === token
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
                }`}
              >
                {token}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5">
          <div className="flex justify-between text-white/60">
            <span>Interest Rate (APR)</span>
            <span className="text-emerald-400 font-mono font-semibold">{interestRate}% (Score Discounted)</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Origination Fee</span>
            <span className="text-white font-mono">0.00% (Free for Sovereign Tier)</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Liquidation Threshold</span>
            <span className="text-amber-400 font-mono">105%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleBorrow}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            {loading ? 'Disbursing...' : 'Confirm Borrow'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BorrowModal;
