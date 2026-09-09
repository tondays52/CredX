import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Sparkles, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface LootboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LootboxModal: React.FC<LootboxModalProps> = ({ isOpen, onClose }) => {
  const [opened, setOpened] = useState(false);
  const [shaking, setShaking] = useState(false);
  const { showToast, playSound } = useToast();

  const handleOpenChest = () => {
    setShaking(true);
    playSound('ping');
    setTimeout(() => {
      setShaking(false);
      setOpened(true);
      playSound('fanfare');
      showToast('Mythic Chest Unlocked!', 'Received Creditcoin Broadsword #07 (Soulbound NFT item drop)', 'success');
    }, 800);
  };

  const handleReset = () => {
    setOpened(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title="Anti-Sybil Fair Mythic Chest"
      subtitle="Gated by Creditcoin reputation (CTS ≥ 500)"
      icon="🎁"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-5 text-center">
        <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-xs font-mono flex items-center justify-center space-x-2 text-amber-300">
          <span>🛡️ Sybil Verification: CTS 794 ≥ 500 (PASSED)</span>
        </div>

        {!opened ? (
          <div className="space-y-4 py-3">
            <div
              onClick={handleOpenChest}
              className={`w-28 h-28 mx-auto rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-6xl cursor-pointer hover:scale-105 transition-transform ${
                shaking ? 'animate-bounce' : ''
              }`}
            >
              📦
            </div>
            <p className="text-xs text-slate-300 font-medium">Tap the chest to break seal and reveal item drop!</p>
            <button
              onClick={handleOpenChest}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/20"
            >
              ✨ UNLOCK MYTHIC CHEST
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-500/20 via-slate-950 to-slate-950 border border-amber-400/50 shadow-2xl space-y-3">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-5xl">
                🗡️
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider mb-1">
                  Legendary Drop
                </div>
                <h4 className="text-base font-extrabold text-white">Creditcoin Broadsword #07</h4>
                <p className="text-xs text-slate-400">+65 Atk · +25% Critical · Soul-Bound</p>
              </div>
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] font-mono text-left">
                <div className="text-slate-400">Rarity: <span className="text-amber-400 font-bold">0.05% Mythic</span></div>
                <div className="text-slate-400">Owner: <span className="text-cyan-400 font-bold">0x742d...f44e</span></div>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all"
            >
              ✅ Equip to Hero Inventory
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LootboxModal;
