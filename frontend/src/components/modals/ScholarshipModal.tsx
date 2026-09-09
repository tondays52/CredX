import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface ScholarshipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScholarshipModal: React.FC<ScholarshipModalProps> = ({ isOpen, onClose }) => {
  const { showToast, playSound } = useToast();

  const handleRent = () => {
    playSound('success');
    showToast(
      'NFT Character Rented ($0 Deposit)!',
      'Dragon Slayer NFT #42 assigned to your guild squad with 0 capital collateral (reputation backed)',
      'success'
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guild Scholarship Character Vault"
      subtitle="Borrow high-tier gaming NFT characters with $0 deposit"
      icon="🛡️"
    >
      <div className="space-y-5">
        <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-xs flex justify-between items-center">
          <span className="text-slate-300">Creditcoin Reputation Gate:</span>
          <span className="text-cyan-400 font-extrabold font-mono">CTS 794 ≥ 700 (APPROVED)</span>
        </div>

        {/* Character Card Selection */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white/5 border border-cyan-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-3xl">
                🐉
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">Dragon Slayer NFT #42</h4>
                <p className="text-xs text-slate-400">Level 85 Arch-Paladin · Guild Yield: 70/30 split</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    $0 Deposit Required
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRent}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs transition-all"
            >
              Rent $0
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-400 font-mono space-y-1">
          <div>• Smart Contract: <span className="text-white">GamingScholarshipVault.sol</span></div>
          <div>• Collateral Staked: <span className="text-emerald-400 font-bold">$0.00 (100% Reputation Backed)</span></div>
        </div>
      </div>
    </Modal>
  );
};

export default ScholarshipModal;
