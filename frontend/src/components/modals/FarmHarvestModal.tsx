import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';

interface FarmHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FarmHarvestModal: React.FC<FarmHarvestModalProps> = ({ isOpen, onClose }) => {
  const [harvestedTiles, setHarvestedTiles] = useState<number[]>([]);
  const [totalYield, setTotalYield] = useState<number>(0);
  const { showToast, playSound } = useToast();

  const tiles = [
    { id: 1, icon: '🌻', name: 'Sunberry', reward: 105 },
    { id: 2, icon: '🍓', name: 'Popberry', reward: 90 },
    { id: 3, icon: '💎', name: 'Mana Gem', reward: 120 },
    { id: 4, icon: '🌽', name: 'Graincorn', reward: 75 },
    { id: 5, icon: '🌟', name: 'Star Fruit', reward: 150 },
    { id: 6, icon: '🍇', name: 'Void Grape', reward: 90 }
  ];

  const handleTileClick = (id: number, reward: number) => {
    if (harvestedTiles.includes(id)) return;
    setHarvestedTiles(prev => [...prev, id]);
    setTotalYield(prev => prev + reward);
    playSound('ping');
  };

  const handleClaim = () => {
    playSound('success');
    showToast('Daily Harvest Claimed!', `Received +${totalYield} GAME Tokens into your hero inventory (3.0x Super-Prime multiplier applied)`, 'success');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pixels Metaverse Harvest Field"
      subtitle="Click ripe crop tiles to harvest daily resources"
      icon="🌾"
    >
      <div className="space-y-5">
        <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Your CredX Tier:</span>
            <span className="text-emerald-400 font-extrabold font-mono ml-1">Super-Prime (794 CTS)</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
            ✨ 3.0x Multiplier Active
          </div>
        </div>

        {/* 3x2 Farm Grid */}
        <div className="grid grid-cols-3 gap-3">
          {tiles.map(tile => {
            const isHarvested = harvestedTiles.includes(tile.id);
            return (
              <div
                key={tile.id}
                onClick={() => handleTileClick(tile.id, tile.reward)}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-1 text-center transition-all duration-200 select-none ${
                  isHarvested
                    ? 'bg-emerald-950/20 border-emerald-500/20 opacity-40 grayscale cursor-default scale-95'
                    : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:scale-105 cursor-pointer shadow-sm'
                }`}
              >
                <span className="text-3xl">{tile.icon}</span>
                <span className="text-xs font-bold text-slate-200">{tile.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono">+{tile.reward} GAME</span>
              </div>
            );
          })}
        </div>

        {/* Harvest Summary */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Harvested Today:</span>
            <span className="text-emerald-400 font-extrabold text-base font-mono">{totalYield} GAME</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(harvestedTiles.length / tiles.length) * 100}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={harvestedTiles.length === 0}
          className={`w-full py-3.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 ${
            harvestedTiles.length > 0
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20 hover:scale-[1.01]'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>{harvestedTiles.length > 0 ? `Claim Harvest (+${totalYield} GAME)` : 'Click tiles above to harvest!'}</span>
        </button>
      </div>
    </Modal>
  );
};

export default FarmHarvestModal;
