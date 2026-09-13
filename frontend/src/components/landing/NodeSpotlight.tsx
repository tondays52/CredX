import React, { useState } from 'react';
import { CheckCircle, Zap, Chrome, Download, Play, Cpu, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useProtocol } from '../../context/ProtocolContext';
import { ExtensionModal } from '../modals/ExtensionModal';

interface NodeSpotlightProps {
  onLaunchNode?: () => void;
  onSimulateNode?: () => void;
}

export const NodeSpotlight: React.FC<NodeSpotlightProps> = ({ onLaunchNode, onSimulateNode }) => {
  const { hardware, virtualNodePoints, virtualNodeActive } = useProtocol();
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);

  const handleTerminalAction = () => {
    if (onLaunchNode) onLaunchNode();
    else if (onSimulateNode) onSimulateNode();
  };

  return (
    <section id="extension" className="py-20 border-b border-white/5 bg-slate-950/60 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/30">
              <Chrome className="w-3.5 h-3.5" />
              <span>Manifest V3 Chrome Extension &amp; Web Node</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Earn Credit Points with Real Hardware.
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Install the CredX Virtual Node extension or launch in-browser to inspect your PC's CPU cores, RAM capacity, GPU hardware accelerator, and live edge ping to share compute &amp; bandwidth and continuously accumulate on-chain credit score points.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Real PC Hardware Inspection (`navigator.hardwareConcurrency`, WebGL GPU)</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Live Edge Ping latency measurement &amp; bandwidth point accumulator</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>1-Click cryptographic proof synchronization to Creditcoin EVM (AiComputeRegistry)</span>
              </div>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setExtensionModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Get Chrome Extension (ZIP)</span>
              </button>
              <button
                onClick={handleTerminalAction}
                className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Launch Web Node Terminal</span>
              </button>
            </div>
          </div>

          {/* Live Mockup Card */}
          <GlassCard className="max-w-md mx-auto w-full p-6 border-cyan-500/30 space-y-4 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="font-extrabold text-sm text-white">CredX Virtual Node</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                virtualNodeActive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              }`}>
                {virtualNodeActive ? 'Mining Live' : 'Ready'}
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
                onClick={handleTerminalAction}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Launch Node
              </button>
            </div>
          </GlassCard>

        </div>

      </div>

      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />
    </section>
  );
};

export default NodeSpotlight;
