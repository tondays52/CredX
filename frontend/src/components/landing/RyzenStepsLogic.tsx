import React from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

interface RyzenStepsLogicProps {
  onLaunchApp: () => void;
}

export const RyzenStepsLogic: React.FC<RyzenStepsLogicProps> = ({ onLaunchApp }) => {
  const steps = [
    {
      num: 1,
      title: 'Proof Ingestion',
      subtitle: 'OCCR Cross-Chain Engine',
      description:
        'User submits off-chain repayment proof or external EVM transaction receipt. Creditcoin L1 native precompile 0x0FD2 verifies it at consensus.'
    },
    {
      num: 2,
      title: 'CTS Reputation Scoring',
      subtitle: 'Dynamic Trust Engine',
      description:
        'The Credit Score Engine recalculates the borrower profile (300 to 850), dynamically updating borrow power and risk classification.'
    },
    {
      num: 3,
      title: 'Zero-Collateral Borrow',
      subtitle: 'Instant Capital Disbursement',
      description:
        'Borrowers with Prime CTS (≥ 700) unlock 100% uncollateralized lending caps, while enterprises get 95% cash advance on accounts receivable.'
    },
    {
      num: 4,
      title: 'Multi-Chain Lien Enforcement',
      subtitle: 'Cross-Network Risk Shield',
      description:
        'If a default occurs, Creditcoin cross-chain state proofs trigger collateral freezes across Ethereum, Arbitrum, and connected EVM chains.'
    },
    {
      num: 5,
      title: 'Yield Streaming & Bonus',
      subtitle: 'Automated Rebasing',
      description:
        'US T-Bills and corporate factoring interest stream continuously into depositor wallets, with Super-Prime users receiving a +2.00% loyalty bonus.'
    }
  ];

  return (
    <section className="space-y-10 py-12 text-center">
      <div className="space-y-3 max-w-2xl mx-auto">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#00FF66] font-bold block">
          ALL IN ONE CREDIT LIFECYCLE
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
          CREDIT LOGIC ON CREDX CHAIN
        </h2>
        <p className="text-xs sm:text-sm text-white/60 leading-relaxed font-sans">
          A seamless 5-step automated lifecycle transforming cross-chain reputation into zero-collateral liquidity and institutional yield.
        </p>
      </div>

      {/* Numbered Stepped Process Cards matching Ryzen AI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
        {steps.map((step) => (
          <div
            key={step.num}
            onClick={onLaunchApp}
            className="p-5 rounded-3xl bg-[#090b0e] border border-white/[0.08] hover:border-[#00FF66]/50 transition-all duration-300 space-y-4 hover:shadow-[0_0_20px_rgba(0,255,102,0.1)] group cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Circular Number Badge matching Ali Hyder's design */}
              <div className="w-11 h-11 rounded-full bg-[#00FF66]/10 border-2 border-[#00FF66]/40 flex items-center justify-center font-black font-mono text-base text-[#00FF66] group-hover:scale-110 group-hover:bg-[#00FF66] group-hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(0,255,102,0.2)]">
                {step.num}
              </div>

              <div>
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                  {step.subtitle}
                </span>
                <h3 className="text-sm font-bold text-white group-hover:text-[#00FF66] transition-colors mt-0.5">
                  {step.title}
                </h3>
              </div>

              <p className="text-xs text-white/60 leading-relaxed font-sans">
                {step.description}
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.04] text-[10px] font-mono text-white/30 group-hover:text-[#00FF66] transition-colors flex items-center gap-1">
              <span>Step {step.num} of 5</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RyzenStepsLogic;
