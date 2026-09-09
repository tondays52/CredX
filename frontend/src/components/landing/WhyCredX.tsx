import React from 'react';
import { Zap, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

interface WhyCredXProps {
  onLaunchApp?: () => void;
}

export const WhyCredX: React.FC<WhyCredXProps> = ({ onLaunchApp }) => {
  return (
    <section id="why-credx" className="py-16 space-y-12">
      {/* Section Header matching Sentra layout */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Why CredX Exists
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
          CredX was created to bridge the gap between AI systems, multi-chain activity, and trustless on-chain credit, where every transaction learns, validates, and evolves.
        </p>
      </div>

      {/* Main Grid: 1 Large Top Card with 3D Arrow + 2 Bottom Grid Cards */}
      <div className="space-y-6">
        
        {/* Top Feature Card with 3D Chevron Arrow */}
        <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-[#041a22] to-[#020b0e] border border-cyan-500/25 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 group">
          <div className="space-y-4 max-w-xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>High-Frequency OCCR Disbursals</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Ultra-fast transactions & instant credit
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Optimized Creditcoin architecture enabling secure, real-time uncollateralized lending and uncollateralized flash loans at unprecedented blockchain speeds with sub-second finality.
            </p>
            <div className="pt-2">
              <button
                onClick={onLaunchApp}
                className="px-5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition-all flex items-center gap-2"
              >
                <span>Explore Fast Liquidity</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex justify-center relative z-10">
            <div className="relative w-full max-w-md aspect-[16/9] rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl group-hover:scale-105 transition-transform duration-500">
              <img
                src="/images/fast-transactions.jpg"
                alt="3D Fast Transactions Cyber Arrow"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#020b0e]/80 via-transparent to-transparent" />
            </div>
          </div>
        </div>

        {/* Bottom 2 Grid Cards matching Dribbble Sentra layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Decentralized Sybil Defense */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#041a22] to-[#020b0e] border border-cyan-500/20 shadow-xl space-y-5 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-cyan-500/25 relative">
                <img
                  src="/images/sybil-mesh.jpg"
                  alt="3D Decentralized Sybil Network"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020b0e]/70 via-transparent to-transparent" />
              </div>
              <h4 className="text-lg font-extrabold text-white">Decentralized Sybil Defense & ID</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Zero-knowledge biometric and multi-chain cryptographic signatures prevent bot farming, wash trading, and Sybil manipulation across all credit tracks.
              </p>
            </div>
            <div className="pt-3 border-t border-cyan-500/15 flex items-center justify-between text-xs font-mono text-cyan-300">
              <span>Status: ZK-SnarkJS Active</span>
              <span className="text-teal-400">0 Gas Overhead</span>
            </div>
          </div>

          {/* Card 2: 0x0FD2 Sovereign Proof Vault */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#041a22] to-[#020b0e] border border-cyan-500/20 shadow-xl space-y-5 flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-cyan-500/25 relative">
                <img
                  src="/images/vault-shield.jpg"
                  alt="3D Sovereign Vault Shield"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020b0e]/70 via-transparent to-transparent" />
              </div>
              <h4 className="text-lg font-extrabold text-white">0x0FD2 Attestation Vault</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Native Creditcoin L1 precompile validating cross-chain source Merkle proofs at EVM consensus level, establishing deterministic trust.
              </p>
            </div>
            <div className="pt-3 border-t border-cyan-500/15 flex items-center justify-between text-xs font-mono text-teal-300">
              <span>Precompile: 0x0FD2</span>
              <span className="text-emerald-400">EVM Native</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default WhyCredX;
