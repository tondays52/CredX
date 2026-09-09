import React from 'react';
import { ShieldCheck, Zap, Lock, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

interface RyzenEcosystemProps {
  onLaunchApp: () => void;
}

export const RyzenEcosystem: React.FC<RyzenEcosystemProps> = ({ onLaunchApp }) => {
  return (
    <section id="ecosystem" className="py-12 relative overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Futuristic Green Energy Cylinder / Core */}
        <div className="lg:col-span-6 relative flex items-center justify-center">
          <div className="relative w-full max-w-[440px] aspect-square flex items-center justify-center">
            {/* Ambient Green Glow */}
            <div className="absolute inset-0 bg-[#00FF66]/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Glowing 3D Concentric Ring Hologram matching Dribbble image */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Outer Orbit Ring */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00FF66]/30 animate-[spin_30s_linear_infinite]" />

              {/* Mid Ring */}
              <div className="absolute w-48 h-48 rounded-full border border-[#00FF66]/50 shadow-[0_0_30px_rgba(0,255,102,0.2)] animate-[spin_20s_linear_infinite_reverse]" />

              {/* Green Glowing Cylinder Core */}
              <div className="relative w-36 h-44 rounded-3xl bg-gradient-to-b from-[#00FF66]/40 via-[#064e3b] to-[#022c22] border-2 border-[#00FF66] shadow-[0_0_50px_rgba(0,255,102,0.4)] flex flex-col items-center justify-between p-4 backdrop-blur-md">
                <div className="w-8 h-1.5 rounded-full bg-[#00FF66] shadow-[0_0_10px_#00FF66] animate-pulse" />
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#00FF66] uppercase tracking-widest block">
                    L1 CORE
                  </span>
                  <span className="text-white font-mono font-black text-xs">
                    0x0FD2
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full bg-black/60 border border-[#00FF66]/40 flex items-center justify-center text-[#00FF66]">
                  <Cpu className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Floating Orbit Nodes */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-[#00FF66]/50 text-[10px] font-mono text-[#00FF66] shadow-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-ping" />
                <span>EVM Precompile Verified</span>
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 border border-white/20 text-[10px] font-mono text-white/80 shadow-lg">
                Sub-Second Cross-Chain Proofs
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Narrative & Key Features */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block font-bold">
              THE FOUNDATION OF TRUST AND <span className="text-[#00FF66]">SECURITY</span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
              ECOSYSTEM ARCHITECTURE
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
            In the CredX ecosystem, decentralized credit underwriting and verifiable off-chain transaction attestations provide the security bedrock for multi-chain liquidity. Powered by Creditcoin L1, we eliminate the need for over-collateralization and predatory liquidation cascades.
          </p>

          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00FF66]/40 transition space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Zap className="w-4 h-4 text-[#00FF66]" />
                <span>Accelerated Proof Verification</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed pl-6">
                Native EVM precompile executes cryptographic validation of external blockchain repayment receipts directly at the consensus layer, achieving 10x faster verification with zero bridge vulnerability.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00FF66]/40 transition space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-[#00FF66]" />
                <span>Decentralized KYC & Sybil-Proof Reputation</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed pl-6">
                Zero-knowledge reputation passports verify institutional compliance (CTS &ge; 600) for US T-Bills and corporate factoring without storing vulnerable PII data on centralized servers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-[#00FF66]/40 transition space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Lock className="w-4 h-4 text-[#00FF66]" />
                <span>Multi-Chain Default Freezing Safeguards</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed pl-6">
                If a borrower defaults on corporate trade credit, their universal cross-chain credit score crashes across all connected networks, freezing global Web3 credit lines and protecting depositors.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onLaunchApp}
              className="px-6 py-3 rounded-xl bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/40 text-[#00FF66] font-mono font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-[#00FF66]/10"
            >
              <span>Explore Protocol Hubs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RyzenEcosystem;
