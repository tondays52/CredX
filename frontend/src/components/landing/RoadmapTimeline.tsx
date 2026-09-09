import React from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';

export const RoadmapTimeline: React.FC = () => {
  const steps = [
    {
      quarter: 'Q1',
      year: '2025',
      title: 'OCCR Foundation & Precompile',
      active: true,
      items: [
        'EVM precompile 0x0FD2 deployment on Creditcoin Testnet',
        'State-proof cryptographic repayment verification',
        'Initial uncollateralized lending pool architecture'
      ]
    },
    {
      quarter: 'Q2',
      year: '2025',
      title: 'Dynamic CTS & DePIN Integration',
      active: true,
      items: [
        'Credit Score Engine (300 to 850 score calculation)',
        'Virtual Node bandwidth telemetry & reward distribution',
        'Multi-oracle consensus and circuit breaker validation'
      ]
    },
    {
      quarter: 'Q3',
      year: '2025',
      title: 'Gaming & RWA Expansion',
      active: true,
      items: [
        'CyberRealm Harvester & provably-fair VRF lootboxes',
        'Zero-collateral NFT guild scholarship vaults',
        'Tokenized US Treasury yield funds & invoice factoring'
      ]
    },
    {
      quarter: 'Q4',
      year: '2026',
      title: 'Autonomous AI & Mainnet Genesis',
      active: false,
      items: [
        'Decentralized AI compute cluster leasing on Creditcoin L1',
        'PredictBay prediction arena gamified liquidity staking',
        'Institutional credit lines with zero custodial bridge risk'
      ]
    }
  ];

  return (
    <section id="roadmap" className="py-16 space-y-12 select-none">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-6xl mx-auto">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>EXECUTION ROADMAP</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Driven by vision, powered by transparency
          </h2>
        </div>
        <div className="text-xs font-mono text-gray-400">
          <span>Execution Horizon: </span>
          <strong className="text-[#00FF66] font-bold">2025 &bull; 2026</strong>
        </div>
      </div>

      {/* 4-Step Horizon Grid */}
      <div className="relative max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {steps.map((step, idx) => (
            <div
              key={step.quarter}
              className={`p-6 rounded-3xl bg-[#090b0e] border transition-all duration-300 space-y-4 flex flex-col justify-between hover:translate-y-[-4px] ${
                step.active
                  ? 'border-[#00FF66]/40 shadow-[0_0_25px_rgba(0,255,102,0.1)]'
                  : 'border-white/[0.08] opacity-75'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center font-mono font-black text-[#00FF66] text-sm">
                    {step.quarter}
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 font-bold">{step.year}</span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">{step.title}</h3>
                  <div className="w-8 h-0.5 bg-[#00FF66] rounded-full mt-1.5" />
                </div>

                <ul className="space-y-2 pt-2 text-xs text-gray-300">
                  {step.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF66] shrink-0 mt-0.5" />
                      <span className="leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-white/[0.06] text-[10px] font-mono text-[#00FF66] font-semibold flex items-center justify-between">
                <span>{step.active ? 'PHASE ACTIVE' : 'UPCOMING'}</span>
                <span>0{idx + 1} / 04</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RoadmapTimeline;
