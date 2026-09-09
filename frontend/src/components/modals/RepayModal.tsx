import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { ArrowUpRight, CheckCircle2, Award, Sparkles } from 'lucide-react';
import { LoanPosition } from '../../types/protocol';

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan?: LoanPosition | null;
}

const RepayModal: React.FC<RepayModalProps> = ({ isOpen, onClose, loan }) => {
  const { addToast } = useToast();
  const { repay } = useProtocol();
  const [loading, setLoading] = useState(false);

  const handleRepay = () => {
    if (!loan) return;
    setLoading(true);
    addToast('info', 'Submitting Repayment', `Settling $${loan.amount.toLocaleString()} USDC position on Creditcoin...`);

    setTimeout(() => {
      repay(loan.id);
      setLoading(false);
      addToast('fanfare', 'Debt Retired & CTS Boosted!', `Repayment finalized. CTS Score increased +12 pts for on-time settlement.`);
      onClose();
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settle Active Debt Position" maxWidth="max-w-md">
      <div className="space-y-4 text-xs text-white/80">
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Position ID</span>
            <div className="text-white font-mono font-semibold text-sm">{loan?.id || 'LN-001'}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Outstanding Total</span>
            <div className="text-lg font-bold text-white font-mono">${(loan?.amount || 2500).toLocaleString()} USDC</div>
          </div>
        </div>

        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Sparkles className="w-4 h-4" /> Reputation Reward Incentive
          </div>
          <p className="text-[11px] text-white/70">
            Repaying this loan settles your on-chain debt obligation and submits an audited credit receipt (0x0FD2) to Creditcoin, granting <strong className="text-emerald-400">+12 CTS points</strong>.
          </p>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5">
          <div className="flex justify-between text-white/60">
            <span>Interest Accrued</span>
            <span className="text-white font-mono">$14.20 USDC</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Collateral Unlocked</span>
            <span className="text-cyan-400 font-mono">{loan?.collateral || '1.25 ETH'}</span>
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
            onClick={handleRepay}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {loading ? 'Settling Debt...' : 'Confirm Repayment'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default RepayModal;
