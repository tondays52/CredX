import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Gamepad2,
  Gift,
  Users,
  Trophy,
  Sparkles,
  Sword,
  Shield,
  Flame,
  Coins,
  DollarSign,
  Crown,
  Play,
  RotateCw,
  Compass,
  Swords,
  Lock
} from 'lucide-react';
import { CyberRealmHarvester } from './gaming/CyberRealmHarvester';
import { GachaLootboxChamber } from './gaming/GachaLootboxChamber';
import { GuildScholarshipStage } from './gaming/GuildScholarshipStage';
import LootboxModal from '../modals/LootboxModal';
import ScholarshipModal from '../modals/ScholarshipModal';

export const GamingTab: React.FC = () => {
  const { isConnected, address, balanceCTC } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'harvester' | 'lootbox' | 'scholarships' | 'tournaments'>('harvester');
  const [lootboxOpen, setLootboxOpen] = useState(false);
  const [scholarshipOpen, setScholarshipOpen] = useState(false);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  return (
    <div className="space-y-6">
      {/* Connected Wallet & Gaming Guild Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-indigo-950/40 border border-purple-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-purple-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Gaming Guild Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-purple-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">
                (${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">Creditcoin Trust Score</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{score} / 850 (Super-Prime Tier)</span>
          </div>
          <button
            onClick={() => setActiveSubTab('lootbox')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-500/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Open VRF Lootbox
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
              <Crown className="w-3.5 h-3.5 text-amber-400" /> Web3 Guild Capital & Esports Reputation Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Play-to-Earn, Zero-Collateral Scholarships & On-Chain Lootboxes
            </h2>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed max-w-xl">
              Turn your Web3 gaming weapons, armor, and land into uncollateralized yield engines. Play daily resource harvesting with 3X Creditcoin reputation multipliers, open VRF dynamic-odds gacha, and borrow elite NFTs with zero collateral.
            </p>

            <div className="flex flex-wrap gap-3 pt-2 font-mono text-xs">
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Daily Multiplier</span>
                <span className="text-emerald-400 font-bold">3X Super-Prime</span>
              </div>
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Scholar Split</span>
                <span className="text-cyan-300 font-bold">70% Scholar / 30% Guild</span>
              </div>
              <div className="p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Legendary Odds</span>
                <span className="text-amber-400 font-bold">15.0% Boosted</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20 group">
              <img
                src="/images/gaming-guild.jpg"
                alt="3D Gaming Guild Cyber Controller and Energy Katana"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-purple-500/30 text-purple-300">
                  ⚔️ Guild Win Rate: 78.4%
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400 font-bold">
                  VRF Certified (0x0FD2)
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Sub-Sector Navigation Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-black/40 border border-white/[0.08] rounded-2xl">
        <button
          onClick={() => setActiveSubTab('harvester')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'harvester'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Compass className="w-4 h-4" /> Daily Harvester (Pixels)
        </button>

        <button
          onClick={() => setActiveSubTab('lootbox')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'lootbox'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Gift className="w-4 h-4" /> VRF Gacha Chamber
        </button>

        <button
          onClick={() => setActiveSubTab('scholarships')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'scholarships'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Users className="w-4 h-4" /> 0-Collateral Scholarships
        </button>

        <button
          onClick={() => setActiveSubTab('tournaments')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'tournaments'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Swords className="w-4 h-4" /> 1v1 Wagering Arena (Season 2)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: PLAYABLE DAILY HARVESTER (PIXELS STYLE)                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'harvester' && (
        <CyberRealmHarvester />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: DYNAMIC-ODDS VRF GACHA CHAMBER                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'lootbox' && (
        <GachaLootboxChamber />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: ZERO-COLLATERAL GUILD SCHOLARSHIP STAGE                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'scholarships' && (
        <GuildScholarshipStage />
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: 1v1 WAGERING DUEL ARENA (STANDBY / SEASON 2 PREVIEW)           */}
      {/* ========================================================================= */}
      {activeSubTab === 'tournaments' && (
        <GlassCard className="p-8 border-amber-500/30 space-y-6 text-center">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
              <Lock className="w-3.5 h-3.5" /> Season 2 Gladiator Championship &bull; On Standby
            </div>
            <h3 className="text-2xl font-black text-white">1v1 Wagering Duel Arena</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Randomly matches two combatants into head-to-head arena combat. Both players stake equal entry fees into the smart contract escrow.
            </p>
          </div>

          {/* Arena Combat Mechanics Specification Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-left font-mono text-xs">
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
              <span className="text-[10px] text-amber-400 font-bold uppercase block">1. Matchmaking</span>
              <span className="text-white font-bold block">Random Player Pairing</span>
              <p className="text-[11px] text-white/50">Pair two gladiators with symmetrical CTS reputation brackets.</p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
              <span className="text-[10px] text-amber-400 font-bold uppercase block">2. 2-Round Combat</span>
              <span className="text-white font-bold block">Equipped Armor & Gears</span>
              <p className="text-[11px] text-white/50">Your borrowed or unboxed weapons determine attack rolls and critical strikes.</p>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
              <span className="text-[10px] text-amber-400 font-bold uppercase block">3. Profit Return</span>
              <span className="text-emerald-400 font-bold block">+30% Net Profit</span>
              <p className="text-[11px] text-white/50">Winner takes 130% of their stake back directly on Creditcoin L1.</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => addToast('info', 'Season 2 Arena', '1v1 Wagering Arena is on standby for Season 2 rollout.')}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition cursor-pointer"
            >
              Notify Me When Season 2 Arena Launches
            </button>
          </div>
        </GlassCard>
      )}

      {/* Modals */}
      <LootboxModal isOpen={lootboxOpen} onClose={() => setLootboxOpen(false)} />
      <ScholarshipModal isOpen={scholarshipOpen} onClose={() => setScholarshipOpen(false)} />
    </div>
  );
};

export default GamingTab;
