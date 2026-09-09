import React, { useState } from 'react';
import { Gauge, Sparkles, Zap, ShieldCheck, ArrowRight, FileText, ChevronDown } from 'lucide-react';
import { useProtocol } from '../../context/ProtocolContext';

interface HeroHUDStageProps {
  onLaunchApp?: () => void;
  onExploreArena?: () => void;
}

export const HeroHUDStage: React.FC<HeroHUDStageProps> = ({ onLaunchApp, onExploreArena }) => {
  const { score, tier } = useProtocol();
  const [sliderScore, setSliderScore] = useState<number>(score);
  const [borrowAmount, setBorrowAmount] = useState<number>(10000);

  const getTierForScore = (s: number) => {
    if (s >= 780) return { name: 'Super-Prime', ratio: 70.0, apr: 2.50, flashFee: 0.01 };
    if (s >= 700) return { name: 'Prime', ratio: 85.0, apr: 5.00, flashFee: 0.03 };
    if (s >= 650) return { name: 'Near-Prime', ratio: 100.0, apr: 7.50, flashFee: 0.06 };
    return { name: 'Subprime', ratio: 120.0, apr: 12.00, flashFee: 0.09 };
  };

  const currentTier = getTierForScore(sliderScore);
  const capitalSaved = Math.round(borrowAmount * ((150 - currentTier.ratio) / 100));
  const dashOffset = Math.round(264 - (264 * (sliderScore - 300)) / 550);

  return (
    <div className="relative min-h-[640px] rounded-3xl overflow-hidden border border-cyan-500/20 shadow-2xl bg-[#020b0e] flex flex-col justify-between p-6 sm:p-10 lg:p-14">
      {/* 3D Photorealistic Backdrop Image */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src="/images/hero-pedestal.jpg"
          alt="3D Cyber Pedestal and Levitating Tokens"
          className="w-full h-full object-cover object-center opacity-85 scale-105 transition-transform duration-1000"
        />
        {/* Subtle radial dark overlay to maintain text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020b0e]/95 via-[#020b0e]/40 to-[#020b0e]/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020b0e] via-transparent to-transparent" />
      </div>

      {/* Floating 3D Cross Lasers Accent Keyframes */}
      <div className="absolute top-1/4 right-1/4 w-32 h-[1px] bg-cyan-400/60 shadow-[0_0_15px_#22d3ee] rotate-45 pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 left-1/4 w-40 h-[1px] bg-teal-400/50 shadow-[0_0_15px_#2dd4bf] -rotate-45 pointer-events-none" />

      {/* Top Left Floating Satellite Chip */}
      <div className="hidden sm:flex absolute top-6 left-8 hud-pill-badge float-chip-1 px-4 py-2 items-center space-x-2.5 z-20">
        <span className="text-lg">⚡</span>
        <div>
          <div className="text-[9px] uppercase font-bold text-cyan-300 tracking-wider">OCCR Flash Router</div>
          <p className="text-xs font-bold text-white font-mono">$500,000 &middot; 0.01% Fee</p>
        </div>
      </div>

      {/* Top Right Floating Satellite Chip */}
      <div className="hidden sm:flex absolute top-6 right-8 hud-pill-badge float-chip-2 px-4 py-2 items-center space-x-2.5 z-20">
        <span className="text-lg">🛡️</span>
        <div>
          <div className="text-[9px] uppercase font-bold text-teal-300 tracking-wider">Precompile 0x0FD2</div>
          <p className="text-xs font-bold text-white font-mono">Merkle Proof Verified</p>
        </div>
      </div>

      {/* Main Hero Header: Left Typography vs Right Callout */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mt-8">
        
        {/* Left Headline */}
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cross-Chain Credit Bureau on Creditcoin</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Powering the evolution of tomorrow's credit
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
            Convert multi-chain DeFi volume into portable on-chain credit scores. Enjoy 70% under-collateralized loans, zero-collateral DePIN hardware lines, and institutional RWA yield.
          </p>
        </div>

        {/* Center / Right: Dribbble Style Callout Glass Box */}
        <div className="lg:col-span-6 flex flex-col lg:items-end justify-center">
          <div className="w-full max-w-md p-6 sm:p-7 rounded-3xl bg-[#03151b]/85 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl space-y-5">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-cyan-400">
                CREDITCOIN L1 PROTOCOL
              </span>
              <h3 className="text-lg font-extrabold text-white leading-snug">
                Join the community revolution and unlock true blockchain freedom
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your Web3 wallet to verify off-chain identity and unlock instant reputation-backed liquidity.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={onLaunchApp}
                className="flex-1 py-3 px-5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('why-credx');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 py-3 px-5 rounded-xl font-semibold text-xs bg-white/5 hover:bg-white/10 text-white border border-white/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Read Whitepaper</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive 3D OCCR Live Simulator Bar */}
      <div className="relative z-10 mt-10 p-5 sm:p-6 rounded-3xl bg-[#021117]/80 backdrop-blur-2xl border border-cyan-500/25 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          
          {/* Speedometer Gauge Column */}
          <div className="md:col-span-3 flex flex-col items-center justify-center p-3 rounded-2xl bg-black/40 border border-cyan-500/20 text-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="url(#qclayHeroGrad2)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="264"
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="qclayHeroGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="60%" stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-mono text-white">{sliderScore}</span>
                <span className="text-[8px] text-cyan-400 uppercase tracking-widest">CTS SCORE</span>
              </div>
            </div>
            <span className="text-[10px] text-teal-300 font-mono font-bold mt-1">
              Tier: {currentTier.name}
            </span>
          </div>

          {/* Interactive Sliders */}
          <div className="md:col-span-6 space-y-3.5 p-3 rounded-2xl bg-black/40 border border-cyan-500/20">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-300">Creditcoin Trust Score (CTS):</span>
                <span className="text-cyan-400 font-mono font-bold">{sliderScore} CTS</span>
              </div>
              <input
                type="range"
                min="300"
                max="850"
                value={sliderScore}
                onChange={e => setSliderScore(+e.target.value)}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-300">Borrow Amount:</span>
                <span className="text-white font-mono font-bold">${borrowAmount.toLocaleString()} cUSD</span>
              </div>
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={borrowAmount}
                onChange={e => setBorrowAmount(+e.target.value)}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Unlocked Terms Column */}
          <div className="md:col-span-3 p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-teal-950/30 border border-cyan-500/30 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Collateral:</span>
              <span className="text-emerald-400 font-bold">{currentTier.ratio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Borrow APR:</span>
              <span className="text-cyan-400 font-bold">{currentTier.apr.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Capital Saved:</span>
              <span className="text-teal-300 font-bold">+${capitalSaved.toLocaleString()}</span>
            </div>
            <button
              onClick={onLaunchApp}
              className="w-full mt-2 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[11px] border border-cyan-500/40 transition-colors"
            >
              Originate Loan &rarr;
            </button>
          </div>

        </div>
      </div>

      {/* Bottom Center "Scroll to explore ↓" pill matching Dribbble Sentra layout */}
      <div className="relative z-10 flex justify-center mt-6">
        <a
          href="#why-credx"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#03151b]/90 border border-cyan-500/30 hover:border-cyan-400 text-xs text-slate-300 hover:text-white transition-all shadow-lg shadow-cyan-500/10 cursor-pointer"
        >
          <span>Scroll to explore</span>
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
        </a>
      </div>
    </div>
  );
};

export default HeroHUDStage;
