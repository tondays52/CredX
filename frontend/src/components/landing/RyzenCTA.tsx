import React from 'react';
import { ArrowRight, Flame, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface RyzenCTAProps {
  onLaunchApp: () => void;
  onExploreArena: () => void;
}

export const RyzenCTA: React.FC<RyzenCTAProps> = ({ onLaunchApp, onExploreArena }) => {
  return (
    <section className="relative w-full overflow-hidden rounded-[32px] py-24 px-6 md:px-16 bg-[#090b0e] border border-white/[0.08] text-center shadow-2xl my-12">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#00FF66]/[0.08] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Giant Faded Outlined Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none z-0 w-full">
        <span className="text-[80px] sm:text-[130px] md:text-[190px] lg:text-[240px] font-black tracking-widest block text-center leading-none text-transparent stroke-text opacity-15">
          CREDX
        </span>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-xs font-mono uppercase tracking-widest backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>DECENTRALIZED CREDIT & COMPUTATIONAL POWERHOUSE</span>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight uppercase leading-[1.1]">
            CREDX IS EVOLVING. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-[#66ff99] to-[#00cc52]">
              BE PART OF THE FUTURE.
            </span>
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
            Deploy uncollateralized loans, operate AI compute clusters, stake real-world trade finance notes, and harvest daily gaming yields verified directly through the 0x0FD2 L1 consensus precompile.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onLaunchApp}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#00FF66] hover:bg-[#00e65c] text-black font-extrabold text-sm tracking-wide uppercase transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-[0_0_35px_rgba(0,255,102,0.4)] cursor-pointer"
          >
            Launch Protocol Terminal
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onExploreArena}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.15] text-white font-bold text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer hover:border-[#00FF66]/40"
          >
            <Flame className="w-4 h-4 text-[#00FF66]" />
            PredictBay Arena
          </button>
        </div>

        {/* Metrics Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 border-t border-white/[0.08] max-w-3xl mx-auto text-center font-mono">
          <div>
            <div className="text-xl md:text-2xl font-bold text-white">0x0FD2</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">L1 Precompile</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-bold text-[#00FF66]">5 Tracks</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">Unified Synergy</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-bold text-white">100%</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">Self-Sovereign</div>
          </div>
          <div>
            <div className="text-xl md:text-2xl font-bold text-[#00FF66]">Zero-Collateral</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">Reputation Engine</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RyzenCTA;
