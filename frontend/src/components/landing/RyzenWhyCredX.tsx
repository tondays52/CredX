import React from 'react';
import {
  Cpu,
  Bot,
  Zap,
  ShieldCheck,
  Coins,
  Layers,
  ArrowUpRight,
  Lock,
  Sparkles
} from 'lucide-react';

interface RyzenWhyCredXProps {
  onLaunchApp: () => void;
}

export const RyzenWhyCredX: React.FC<RyzenWhyCredXProps> = ({ onLaunchApp }) => {
  const features = [
    {
      icon: Cpu,
      title: 'Cutting Edge Tech',
      primaryPoint: 'Creditcoin L1 Precompile 0x0FD2:',
      description:
        'Native EVM precompile executes cryptographic validation of cross-chain repayment events without centralized bridges or custodial middle-men.',
      tag: 'OCCR v2.0'
    },
    {
      icon: Bot,
      title: 'AI-Driven Underwriting',
      primaryPoint: 'Dynamic Credit Score Engine (CTS):',
      description:
        'Machine learning algorithms evaluate on-chain wallet telemetry to assign trust scores (300–850), unlocking uncollateralized lending and factoring rates.',
      tag: 'Autonomous AI'
    },
    {
      icon: Zap,
      title: 'Scalability & Efficiency',
      primaryPoint: 'High-Throughput State Proofs:',
      description:
        'Sub-second finality powers real-time DePIN bandwidth hashing, RTK GNSS satellite corrections, and millisecond on-chain CredXsor AI compute settlements.',
      tag: 'Sub-Second'
    },
    {
      icon: ShieldCheck,
      title: 'Security & Reliability',
      primaryPoint: '102.4% Proof-of-Reserve (PoR):',
      description:
        'Institutional US Treasury yield funds custodied at BNY Mellon (CUSIP 912797HY7) with on-chain cryptographic audit and $1.25M safety reserves.',
      tag: 'SEC SPV'
    },
    {
      icon: Coins,
      title: 'Incentivized Ecosystem',
      primaryPoint: 'Super-Prime Reputation Multipliers:',
      description:
        'Earn 3X daily resource yields in CyberRealm Harvester, 15% Legendary VRF lootbox drop rates, and +2.00% loyalty bonuses on US T-Bill redemptions.',
      tag: '3X Yield'
    },
    {
      icon: Layers,
      title: 'Future-Ready Versatility',
      primaryPoint: '5 Live Production Sectors:',
      description:
        'A single unified wallet passport spans DeFi, DePIN, Gaming, Real-World Assets (RWA), and Autonomous AI compute clusters.',
      tag: 'Multi-Track'
    }
  ];

  return (
    <section id="why-credx" className="space-y-10 text-center py-10">
      {/* Section Header */}
      <div className="space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-xs font-mono font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />
          <span>Next-Gen Multi-Chain Infrastructure</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-3">
          <span>WHY USE</span>
          <div className="w-10 h-10 rounded-full bg-black border-2 border-[#00FF66] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.4)]">
            <span className="text-[#00FF66] font-black text-lg font-sans">C</span>
          </div>
          <span>CREDX?</span>
        </h2>

        <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed font-normal">
          CredX is not just another project on Creditcoin; it&apos;s a game-changing platform that combines the power of native precompile 0x0FD2 with decentralized reputation scoring to create a versatile and scalable infrastructure. Here&apos;s why developers, investors, and users choose CredX:
        </p>
      </div>

      {/* 6-Card Bento Grid matching Ryzen AI Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              onClick={onLaunchApp}
              className="p-6 rounded-3xl bg-[#090b0e] border border-white/[0.08] hover:border-[#00FF66]/50 transition-all duration-300 space-y-4 hover:shadow-[0_0_30px_rgba(0,255,102,0.1)] group cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/20 flex items-center justify-center text-[#00FF66] group-hover:scale-110 group-hover:bg-[#00FF66]/20 transition-all duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-white/[0.03] text-white/40 border border-white/[0.08]">
                    {feat.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-[#00FF66] transition-colors">
                  {feat.title}
                </h3>

                <p className="text-xs text-white/70 leading-relaxed">
                  <strong className="text-white block mb-1 font-semibold">{feat.primaryPoint}</strong>
                  {feat.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono text-white/40 group-hover:text-[#00FF66] transition-colors">
                <span>Explore in Terminal</span>
                <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RyzenWhyCredX;
