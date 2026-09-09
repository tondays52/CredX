import React from 'react';
import { CheckCircle, Zap } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useProtocol } from '../../context/ProtocolContext';

interface NodeSpotlightProps {
  onLaunchNode?: () => void;
  onSimulateNode?: () => void;
}

export const NodeSpotlight: React.FC<NodeSpotlightProps> = ({ onLaunchNode, onSimulateNode }) => {
  const { hardware, virtualNodePoints } = useProtocol();

  const handleAction = () => {
    if (onLaunchNode) onLaunchNode();
    else if (onSimulateNode) onSimulateNode();
  };

  return (
    <section id="extension" className="py-20 border-b border-white/5 bg-slate-950/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          
          <div className="space-y-5">
            <span className="px-3.5 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-bold border border-pink-500/30">
              Manifest V3 Chrome Extension
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Earn Credit Points with Idle Hardware.
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Install the CredX Virtual Node extension to inspect your PC's CPU cores, RAM capacity, GPU hardware accelerator, and live edge ping to share idle bandwidth and continuously accumulate on-chain credit score points.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Real PC Hardware Inspection (`navigator.hardwareConcurrency`, WebGL GPU)</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Live Edge Ping latency measurement & bandwidth point accumulator</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>1-Click cryptographic proof synchronization to Creditcoin EVM</span>
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={handleAction}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-pink-500/20"
              >
                Simulate Node Extension
              </button>
            </div>
          </div>

          {/* Live Mockup Card */}
          <GlassCard className="max-w-md mx-auto w-full p-6 border-pink-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-pink-400" />
                <span className="font-extrabold text-sm text-white">CredX Virtual Node</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Connected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center font-mono">
              <div>
                <span className="text-[9px] uppercase text-slate-400">CPU</span>
                <p className="text-xs font-bold text-white mt-0.5">{hardware.cpuCores} Cores</p>
              </div>
              <div className="border-x border-white/10">
                <span className="text-[9px] uppercase text-slate-400">RAM</span>
                <p className="text-xs font-bold text-white mt-0.5">{hardware.deviceMemoryGB} GB</p>
              </div>
              <div>
                <span className="text-[9px] uppercase text-slate-400">Ping</span>
                <p className="text-xs font-bold text-emerald-400 mt-0.5">{hardware.pingMs} ms</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/50 border border-white/10 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400">CredX Points</span>
                <p className="text-xl font-mono font-black text-cyan-400">{virtualNodePoints} PTS</p>
              </div>
              <button
                onClick={handleAction}
                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs shadow-md transition-all"
              >
                Sync Proof
              </button>
            </div>
          </GlassCard>

        </div>

      </div>
    </section>
  );
};

export default NodeSpotlight;
