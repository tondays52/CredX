import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Vault, Sparkles } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface YieldVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const YieldVaultModal: React.FC<YieldVaultModalProps> = ({ isOpen, onClose }) => {
  const [stakeAmount, setStakeAmount] = useState(5000);
  const { showToast, playSound } = useToast();

  const handleStake = () => {
    playSound('success');
    showToast(
      'Boosted Staking Confirmed!',
      `Staked ${stakeAmount.toLocaleString()} cUSD into 17.0% Boosted Governance Vault (2.0x Multiplier active)`,
      'success'
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reputation Staking Yield Vault"
      subtitle="Lock cUSD to earn boosted 2.0x protocol governance rewards"
      icon={<Vault className="w-5 h-5 text-purple-400" />}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400">Standard APY</span>
            <div className="text-base font-extrabold text-slate-300 font-mono">8.50%</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-1">
            <span className="text-[11px] text-purple-300 font-bold">Super-Prime APY (2.0x)</span>
            <div className="text-base font-extrabold text-purple-400 font-mono">17.00% APY 🔥</div>
          </div>
        </div>

        {/* Staking Input */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-bold">Deposit Amount:</span>
            <span className="text-slate-400">Available: 50,000 cUSD</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={stakeAmount}
              onChange={e => setStakeAmount(+e.target.value)}
              className="w-full py-3 px-4 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-purple-400 outline-none"
            />
            <span className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-slate-300">
              cUSD
            </span>
          </div>
        </div>

        {/* Live Yield Counter */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Unclaimed Real-time Yield:</span>
            <div className="text-lg font-extrabold text-emerald-400 font-mono">+12.4500 cUSD</div>
          </div>
          <button
            onClick={() => {
              playSound('ping');
              showToast('Yield Harvested', 'Claimed +12.45 cUSD to your wallet', 'success');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all"
          >
            Harvest
          </button>
        </div>

        <button
          onClick={handleStake}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-extrabold text-xs transition-all shadow-lg shadow-purple-500/20"
        >
          ✨ Stake into 17.0% Boosted Vault
        </button>
      </div>
    </Modal>
  );
};

export default YieldVaultModal;
