import React from 'react';
import { ShieldCheck, Repeat, Server, TrendingUp, Check, ArrowRight } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

interface BentoGridProps {
  onSelectTrack?: (track: string) => void;
  onLaunchTerminal?: () => void;
  onLaunchArena?: () => void;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ onSelectTrack, onLaunchTerminal, onLaunchArena }) => {
  const handleTerminal = () => {
    if (onSelectTrack) onSelectTrack('overview');
    else if (onLaunchTerminal) onLaunchTerminal();
  };

  const handleArena = () => {
    if (onSelectTrack) onSelectTrack('arena');
    else if (onLaunchArena) onLaunchArena();
  };

  return (
    <section id="bento" className="py-20 border-b border-white/5 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <span className="px-3.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold border border-cyan-500/30">
            Multi-Track Ecosystem
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            One Portable Score. 5 Ecosystem Hubs.
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            CredX reputation natively unlocks liquidity, computational leases, gaming character vaults, and tokenized trade debt.
          </p>
        </div>

        {/* 6 Bento Cards Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Bento 1: Large OCCR 7-Factor Model (2 Cols) */}
          <GlassCard className="md:col-span-2 p-6 sm:p-8 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Multi-Factor Risk Assessment</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono">7 Dimensions</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">OCCR Credit Risk Scoring Engine</h3>
              <p className="text-xs text-slate-400 mt-1">Multi-dimensional weighting replacing primitive single-metric TVL checks.</p>
            </div>

            {/* Factor Bars */}
            <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/10 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>1. Historical Loan Repayment Proofs (Aave / Compound)</span>
                  <span className="text-cyan-400 font-mono font-bold">+200 / 200 pts (35%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5"><div className="bg-cyan-400 h-1.5 rounded-full w-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>2. Verified Cross-Chain Volume ($150,000 USD)</span>
                  <span className="text-purple-400 font-mono font-bold">+150 / 150 pts (25%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5"><div className="bg-purple-400 h-1.5 rounded-full w-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>3. Multi-Protocol & Chain Diversity (3 DeFi &middot; 2 Chains)</span>
                  <span className="text-emerald-400 font-mono font-bold">+120 / 120 pts (20%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5"><div className="bg-emerald-400 h-1.5 rounded-full w-full"></div></div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-slate-400">Total Verified Volume: <strong className="text-white font-mono">$150,000,000</strong></span>
              <button onClick={handleTerminal} className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1">
                <span>View Full Scoring Breakdown</span> →
              </button>
            </div>
          </GlassCard>

          {/* Bento 2: Holographic Soulbound Attestation Token (1 Col) */}
          <div className="sbt-badge p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Soulbound Token</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 font-mono">ERC-5192</span>
            </div>
            
            <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-3 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-lg border border-purple-500/30">
                🛡️
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">CX-SBT Passport</h4>
                <p className="text-[10px] text-slate-400 font-mono">Token ID: #1 &middot; Non-Transferable</p>
              </div>
              <div className="text-[10px] font-mono text-cyan-300 bg-white/5 py-1 px-2.5 rounded-lg border border-white/10 truncate">
                0x73549c...84f
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Zero-Knowledge Tier Proofs</p>
              <p className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Selective Identity Disclosure</p>
            </div>
          </div>

          {/* Bento 3: Advanced DeFi Hub */}
          <GlassCard className="p-6 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">0.01% Flash Loans</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Super-Prime borrowers access zero-collateral arbitrage liquidity with fees slashed from 0.09% to 0.01%.
              </p>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-slate-400">Yield Boost:</span>
              <span className="text-cyan-400 font-mono font-bold">2.0x Multiplier</span>
            </div>
          </GlassCard>

          {/* Bento 4: DePIN GPU Leases */}
          <GlassCard className="p-6 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">DePIN GPU Clusters</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                $25,000 to $100,000 hardware financing lines for verified operators running H100 and B200 AI compute clusters.
              </p>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-slate-400">Hardware APY:</span>
              <span className="text-indigo-400 font-mono font-bold">14.5% Yield</span>
            </div>
          </GlassCard>

          {/* Bento 5: PredictBay Arena */}
          <GlassCard className="p-6 border-amber-500/30 bg-amber-950/10 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">PredictBay Arena</h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">LIVE</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-frequency binary trading terminal with Pyth feeds. 3-win streaks sync directly to on-chain Creditcoin CTS (+25 CTS).
            </p>
            <button onClick={handleArena} className="pt-2 border-t border-white/5 w-full flex justify-between items-center text-xs text-amber-300 font-bold hover:text-white transition-colors">
              <span>Enter Trading Arena</span> →
            </button>
          </GlassCard>

        </div>

      </div>
    </section>
  );
};

export default BentoGrid;
