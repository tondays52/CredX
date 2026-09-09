import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Server } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { GPUCluster } from '../../types/tracks';

interface GPULeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  cluster?: GPUCluster | null;
}

export const GPULeaseModal: React.FC<GPULeaseModalProps> = ({ isOpen, onClose, cluster }) => {
  const [selectedCluster, setSelectedCluster] = useState({
    name: cluster?.model || '8x NVIDIA H100 (80GB)',
    cost: cluster?.pricePerHour ? cluster.pricePerHour * 720 : 50000,
    benchmark: cluster ? `${cluster.tflops} TFLOPS` : '32 PFLOPS FP8'
  });
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { showToast, playSound } = useToast();

  const handleOriginate = () => {
    setExecuting(true);
    setProgress(20);
    playSound('ping');

    setTimeout(() => setProgress(60), 400);
    setTimeout(() => setProgress(90), 800);
    setTimeout(() => {
      setProgress(100);
      setExecuting(false);
      playSound('success');
      showToast(
        'Compute Lease Originated!',
        `Originated $${selectedCluster.cost.toLocaleString()} facility for ${selectedCluster.name}. Escrow released to GPU supplier.`,
        'success'
      );
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DePIN Hardware Lease Line"
      subtitle="Zero-collateral compute financing on Creditcoin"
      icon={<Server className="w-5 h-5 text-indigo-400" />}
    >
      <div className="space-y-5">
        <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300">Reputation Verification:</span>
          <span className="text-indigo-300 font-extrabold">CTS 794 ≥ 750 (APPROVED ✅)</span>
        </div>

        {/* Cluster Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">Select Compute Cluster:</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: '4x NVIDIA A100 (80GB)', cost: 25000, benchmark: '16 PFLOPS FP16', label: '4x A100' },
              { name: '8x NVIDIA H100 (80GB)', cost: 50000, benchmark: '32 PFLOPS FP8', label: '8x H100 🔥' },
              { name: '16x Blackwell B200', cost: 100000, benchmark: '72 PFLOPS FP4', label: '16x B200' }
            ].map(c => (
              <button
                key={c.cost}
                onClick={() => setSelectedCluster(c)}
                className={`p-3 rounded-2xl border text-left space-y-1 transition-all ${
                  selectedCluster.cost === c.cost
                    ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-md'
                    : 'bg-white/5 hover:bg-indigo-500/10 border-white/10 text-slate-300'
                }`}
              >
                <div className="text-[11px] font-bold">{c.label}</div>
                <div className="text-[10px] text-indigo-400 font-mono">${c.cost.toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Spec details */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Target Cluster:</span>
            <span className="text-white font-bold">{selectedCluster.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Compute Benchmark:</span>
            <span className="text-indigo-400 font-bold">{selectedCluster.benchmark}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Credit Facility:</span>
            <span className="text-white font-bold">${selectedCluster.cost.toLocaleString()} USD Lease</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-white/10">
            <span className="text-slate-300 font-bold">Required Collateral:</span>
            <span className="text-emerald-400 font-bold">$0.00 (100% Reputation Backed)</span>
          </div>
        </div>

        {executing && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-indigo-400">
              <span>Disbursing escrow to verified hardware vendor...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleOriginate}
          disabled={executing}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-extrabold text-xs transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
        >
          🚀 Originate Zero-Collateral Compute Lease
        </button>
      </div>
    </Modal>
  );
};

export default GPULeaseModal;
