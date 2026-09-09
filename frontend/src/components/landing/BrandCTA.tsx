import React from 'react';
import { ArrowRight, Sparkles, Shield, Cpu, Flame } from 'lucide-react';

interface BrandCTAProps {
  onLaunchApp: () => void;
  onExploreArena: () => void;
}

export const BrandCTA: React.FC<BrandCTAProps> = ({ onLaunchApp, onExploreArena }) => {
  return (
    <section className="relative w-full overflow-hidden rounded-3xl py-24 px-6 md:px-12 bg-gradient-to-b from-[#041a22]/80 via-[#020b0e] to-[#010608] border border-cyan-500/20 shadow-2xl text-center">
      {/* Background Glows and Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-teal-950/20 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-400/10 blur-[130px] rounded-full pointer-events-none" />
      
      {/* Giant Outline Watermark Text "CREDX" */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none z-0 w-full">
        <span className="text-[90px] sm:text-[140px] md:text-[200px] lg:text-[260px] font-black tracking-widest text-outline-watermark block text-center leading-none opacity-40">
          CREDX
        </span>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto space-y-8">
        {/* Floating Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono tracking-wider backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
          <span>DECENTRALIZED CREDIT INFRASTRUCTURE</span>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            CredX is evolving. <br />
            <span className="bg-gradient-to-r from-cyan-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
              Be part of the future.
            </span>
          </h2>
          <p className="text-sm md:text-base text-cyan-100/70 max-w-xl mx-auto leading-relaxed">
            Experience uncollateralized lending verified by edge nodes, institutional zk-attestations, and gamified credit market predictions.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={onLaunchApp}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-[#020b0e] font-bold text-sm shadow-xl shadow-cyan-400/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group cursor-pointer"
          >
            Launch Protocol Terminal
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onExploreArena}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#041a22]/80 hover:bg-[#062c3a] border border-cyan-500/40 text-cyan-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
          >
            <Flame className="w-4 h-4 text-amber-400" />
            PredictBay Arena ⚔️
          </button>
        </div>

        {/* Micro highlights */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-cyan-500/15 max-w-lg mx-auto text-center font-mono">
          <div>
            <div className="text-lg md:text-xl font-bold text-white">0x0FD2</div>
            <div className="text-[11px] text-cyan-300/60 uppercase">Precompile</div>
          </div>
          <div>
            <div className="text-lg md:text-xl font-bold text-cyan-300">100%</div>
            <div className="text-[11px] text-cyan-300/60 uppercase">Self-Sovereign</div>
          </div>
          <div>
            <div className="text-lg md:text-xl font-bold text-teal-300">5 Tracks</div>
            <div className="text-[11px] text-cyan-300/60 uppercase">Synergy</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrandCTA;
