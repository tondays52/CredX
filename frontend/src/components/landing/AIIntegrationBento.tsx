import React from 'react';

interface AIIntegrationBentoProps {
  onSelectTrack?: (track: string) => void;
}

export const AIIntegrationBento: React.FC<AIIntegrationBentoProps> = ({ onSelectTrack }) => {
  const cards = [
    {
      id: 'smartchain',
      title: 'SmartChain Layer',
      description: 'Optimized Creditcoin L1 infrastructure supporting fast smart contracts with integrated AI-driven OCCR credit score risk enhancements.',
      image: '/images/smartchain-cube.jpg',
      tag: 'OCCR 7-FACTOR'
    },
    {
      id: 'quantum',
      title: 'Quantum-Resistant Encryption',
      description: 'Next generation security ensuring zero-knowledge blockchain Merkle proofs remain safe against powerful quantum computers and bridge exploits.',
      image: '/images/quantum-shield.jpg',
      tag: '0x0FD2 PROOF'
    },
    {
      id: 'validators',
      title: 'AI Validator Nodes',
      description: 'Intelligent decentralized neural nodes that learn, validate off-chain reputational proofs, and secure the network autonomously and efficiently.',
      image: '/images/ai-validators.jpg',
      tag: 'AUTONOMOUS ORACLE'
    },
    {
      id: 'green',
      title: 'Green Protocol & DePIN',
      description: 'A low-carbon blockchain framework reducing power consumption through edge node hardware telemetry and distributed bandwidth sharing.',
      image: '/images/green-protocol.jpg',
      tag: 'VIRTUAL NODE'
    }
  ];

  return (
    <section id="ai-integration" className="py-16 space-y-12">
      {/* Section Header matching Sentra layout */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-[10px] uppercase font-bold font-mono tracking-widest text-cyan-400">
          NEXT-GEN ARCHITECTURE
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          AI & Multi-Track Integration
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
          CredX merges blockchain transparency with AI intelligence, enabling autonomous risk oracles, predictive scoring, uncollateralized lending, and adaptive governance.
        </p>
      </div>

      {/* 4 Cards Bento Grid matching Dribbble Sentra layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {cards.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelectTrack?.(c.id)}
            className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#041a22] to-[#020b0e] border border-cyan-500/25 shadow-xl space-y-4 flex flex-col justify-between hover:border-cyan-400/50 hover:translate-y-[-4px] transition-all duration-300 group cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-cyan-500/25 relative bg-[#020c10]">
                <img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020b0e]/60 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 text-[9px] font-mono font-bold px-2.5 py-1 rounded-full bg-[#020b0e]/80 border border-cyan-500/30 text-cyan-300">
                  {c.tag}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-white">{c.title}</h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {c.description}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-cyan-500/15 flex items-center justify-between text-xs font-mono text-cyan-400">
              <span>Verified On-Chain</span>
              <span className="text-teal-300">Active &bull; L1 Core</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default AIIntegrationBento;
