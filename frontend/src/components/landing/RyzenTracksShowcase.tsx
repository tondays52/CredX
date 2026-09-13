import React, { useState } from 'react';
import {
  Coins,
  Radio,
  Gamepad2,
  Building2,
  Bot,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';

interface RyzenTracksShowcaseProps {
  onSelectTrack: (trackIndex?: number) => void;
}

export const RyzenTracksShowcase: React.FC<RyzenTracksShowcaseProps> = ({ onSelectTrack }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'defi' | 'depin' | 'gaming' | 'rwa' | 'ai'>('all');

  const tracks = [
    {
      id: 'defi',
      title: 'DeFi & Micro-Yield Vaults',
      badge: 'Track 1: Capital Efficiency',
      icon: Coins,
      color: '#00FF66',
      heroStat: '85% Advance',
      summary:
        'Zero-collateral borrowing powered by on-chain Creditcoin Trust Scores (CTS 300–850). Flash Repay mechanics, liquid staking, and automated yield compounding.',
      highlights: [
        'Zero-Collateral Borrowing for Prime Scores (CTS ≥ 700)',
        'Flash Repay Arbitrage with zero capital requirements',
        'Cross-Chain Collateral Freezing on default'
      ],
      linkHash: '#/defi'
    },
    {
      id: 'depin',
      title: 'DePIN Infrastructure Mesh',
      badge: 'Track 2: Physical Networks',
      icon: Radio,
      color: '#00E5FF',
      heroStat: '4 Live Sectors',
      summary:
        'Decentralized physical infrastructure spanning Pulse (bandwidth hashing), Nexus (IoT Bluetooth edge nodes), GeoOrbit (RTK GNSS space-time positioning), and an on-chain CredXsor AI compute market.',
      highlights: [
        'Real hardware probing (CPU, GPU, RAM, Live Ping)',
        'Centimeter-level RTK GNSS satellite positioning',
        'CredXsor Yuma Consensus mathematical engine'
      ],
      linkHash: '#/depin'
    },
    {
      id: 'gaming',
      title: 'Web3 Gaming & Guild Armory',
      badge: 'Track 3: Guild Capital',
      icon: Gamepad2,
      color: '#A855F7',
      heroStat: '3X Multiplier',
      summary:
        'Playable 5x5 CyberRealm Resource Harvester with autonomous drone navigation, Dynamic-Odds VRF Gacha lootboxes with 15% Legendary rates, and Zero-Collateral Guild Scholarships.',
      highlights: [
        '3X Daily Resource Yield Multiplier for Super-Prime participants',
        'Verifiable on-chain VRF entropy lootboxes with audio fanfare',
        '70% Scholar / 30% Guild Owner automated revenue ledger'
      ],
      linkHash: '#/gaming'
    },
    {
      id: 'rwa',
      title: 'Tokenized RWA & US Treasuries',
      badge: 'Track 4: Sovereign Debt',
      icon: Building2,
      color: '#F59E0B',
      heroStat: '5.24% - 7.24%',
      summary:
        'Franklin US Treasury Fund (tbUSD) earning risk-free sovereign yields with +2.00% Super-Prime loyalty bonuses, and Corporate Trade Factoring for Siemens, Maersk, and Samsung Heavy.',
      highlights: [
        '102.4% Over-Collateralized Proof of Reserve at BNY Mellon',
        'Instant T+0 stablecoin liquidity redemption',
        'Reputation-based 95% cash advance on enterprise invoices'
      ],
      linkHash: '#/rwa'
    },
    {
      id: 'ai',
      title: 'Autonomous AI Risk Oracles',
      badge: 'Track 5: Decentralized AI',
      icon: Bot,
      color: '#EC4899',
      heroStat: '10x Faster',
      summary:
        'Decentralized risk modeling and liquidation safeguards evaluating cross-chain borrow portfolios in real time, preventing bad debt while maintaining maximum capital velocity.',
      highlights: [
        'Creditcoin L1 Precompile 0x0FD2 cryptographic proof checking',
        'Continuous credit health reassessment every block',
        'Zero-Knowledge privacy-preserving credit identity'
      ],
      linkHash: '#/ai'
    }
  ];

  const filteredTracks = activeTab === 'all' ? tracks : tracks.filter((t) => t.id === activeTab);

  return (
    <section className="space-y-10 py-12">
      {/* Top Banner & Stats Card matching Ryzen Chain */}
      <div className="p-8 rounded-3xl bg-[#090b0e] border border-white/[0.08] relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3 text-left">
            <span className="text-[10px] font-mono uppercase text-[#00FF66] tracking-widest font-bold block">
              MULTI-TRACK ECOSYSTEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
              CREDX PROTOCOL HUBS
            </h2>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans max-w-xl">
              Creditcoin L1 native integration delivers specialized financial primitives across 5 core verticals, all unified under a single on-chain Creditcoin Trust Score (CTS).
            </p>
          </div>

          <div className="lg:col-span-5 grid grid-cols-3 gap-3 text-center font-mono">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] text-white/40 uppercase block">Originated AUM</span>
              <span className="text-lg font-black text-white mt-0.5 block">$42.6M+</span>
              <span className="text-[9px] text-[#00FF66]">Active Volume</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] text-white/40 uppercase block">DePIN Nodes</span>
              <span className="text-lg font-black text-[#00FF66] mt-0.5 block">10,480+</span>
              <span className="text-[9px] text-white/40">Global Hardware</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] text-white/40 uppercase block">Default Rate</span>
              <span className="text-lg font-black text-cyan-300 mt-0.5 block">0.00%</span>
              <span className="text-[9px] text-[#00FF66]">0x0FD2 Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Track Selection Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/20'
              : 'bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          All 5 Tracks
        </button>
        {tracks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/20'
                : 'bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <span>{t.title.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Grid of Track Showcase Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
        {filteredTracks.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.id}
              onClick={() => onSelectTrack()}
              className="p-6 rounded-3xl bg-[#090b0e] border border-white/[0.08] hover:border-[#00FF66]/50 transition-all duration-300 space-y-4 hover:shadow-[0_0_25px_rgba(0,255,102,0.12)] group cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-[#00FF66] group-hover:scale-105 group-hover:border-[#00FF66]/50 transition-all">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-black text-[#00FF66] px-2.5 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30">
                    {t.heroStat}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                    {t.badge}
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#00FF66] transition-colors mt-0.5">
                    {t.title}
                  </h3>
                </div>

                <p className="text-xs text-white/65 leading-relaxed">
                  {t.summary}
                </p>

                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.04] space-y-1.5 text-[11px] font-mono text-white/60">
                  {t.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF66] shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-white/40 group-hover:text-[#00FF66] transition-colors">
                <span>Launch Hub in Terminal</span>
                <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RyzenTracksShowcase;
