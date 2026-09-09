import React from 'react';
import { GlassCard } from '../common/GlassCard';

export const TimelineOCCR: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 border-b border-white/5 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <span className="px-3.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/30">
            Deterministic Verification
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            How OCCR Protocol Works
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Oracle-less Cross-Chain Reputation on Creditcoin executes deterministically in 3 cryptographic steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <GlassCard className="p-7 space-y-3">
            <span className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-base border border-cyan-500/30">
              01
            </span>
            <h3 className="text-lg font-bold text-white">Multi-Chain Proof Aggregation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              User submits cryptographic Merkle inclusion proofs of historical loan repayments and trade receipts across Ethereum, Base, and Arbitrum.
            </p>
          </GlassCard>

          <GlassCard className="p-7 space-y-3">
            <span className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-base border border-purple-500/30">
              02
            </span>
            <h3 className="text-lg font-bold text-white">Attestcoin Precompile 0x0FD2</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creditcoin native precompile verifies source block hashes and receipts at consensus level, eliminating reliance on third-party bridge oracles.
            </p>
          </GlassCard>

          <GlassCard className="p-7 space-y-3">
            <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-base border border-emerald-500/30">
              03
            </span>
            <h3 className="text-lg font-bold text-white">Soulbound Credit Tier Mint</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Borrower is issued an on-chain CX-SBT granting access to 70% under-collateralized loans, 0.01% flash loans, and DePIN hardware lines.
            </p>
          </GlassCard>

        </div>

      </div>
    </section>
  );
};

export default TimelineOCCR;
