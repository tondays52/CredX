import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../../common/GlassCard';
import { useToast } from '../../../context/ToastContext';
import { useProtocol } from '../../../context/ProtocolContext';
import {
  Users,
  ShieldCheck,
  Sword,
  Shield,
  Zap,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Sparkles,
  Lock,
  Unlock,
  RotateCw,
  Coins,
  Crown,
  Volume2,
  VolumeX,
  Swords,
  PlusCircle,
  Clock,
  Layers,
  Activity
} from 'lucide-react';

interface ScholarshipNFT {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'core';
  rarity: 'EPIC' | 'LEGENDARY' | 'MYTHIC';
  powerBonus: number;
  defenseBonus: number;
  dailyYieldUSD: number;
  originalOwner: string;
  isBorrowed: boolean;
  borrower?: string;
  icon: string;
  description: string;
}

export const GuildScholarshipStage: React.FC = () => {
  const { score } = useProtocol();
  const { addToast } = useToast();

  const userScore = score || 785;
  const isEligibleForScholarship = userScore >= 700;

  // Audio system state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Web Audio synthesizer for equip/unequip
  const playEquipSound = useCallback((action: 'equip' | 'unequip' | 'claim') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (action === 'equip') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (action === 'claim') {
        const notes = [587.33, 739.99, 880.00]; // D5, F#5, A5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
          gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.06);
          osc.stop(ctx.currentTime + idx * 0.06 + 0.3);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(270, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // AudioContext fallback
    }
  }, [audioEnabled]);

  // Character Loadout Slots
  const [equippedWeapon, setEquippedWeapon] = useState<ScholarshipNFT | null>(null);
  const [equippedArmor, setEquippedArmor] = useState<ScholarshipNFT | null>(null);
  const [equippedCore, setEquippedCore] = useState<ScholarshipNFT | null>(null);

  // Category Filter
  const [filterCategory, setFilterCategory] = useState<'all' | 'weapon' | 'armor' | 'core'>('all');

  // Available Vault NFTs
  const [vaultNFTs, setVaultNFTs] = useState<ScholarshipNFT[]>([
    {
      id: 'NFT-EX-88',
      name: 'Aethel Blade Cyber Katana',
      category: 'weapon',
      rarity: 'LEGENDARY',
      powerBonus: 950,
      defenseBonus: 140,
      dailyYieldUSD: 14.5,
      originalOwner: '0x892a...GuildWhale',
      isBorrowed: false,
      icon: '⚔️',
      description: 'Forged from dark cyber-steel with plasma edge. +950 ATK.'
    },
    {
      id: 'NFT-EX-12',
      name: 'Nova Shield Aegis Plate',
      category: 'armor',
      rarity: 'EPIC',
      powerBonus: 120,
      defenseBonus: 880,
      dailyYieldUSD: 6.2,
      originalOwner: '0x14f2...ApexDao',
      isBorrowed: false,
      icon: '🛡️',
      description: 'Deflector shield generator and heavy titanium plating. +880 DEF.'
    },
    {
      id: 'NFT-EX-99',
      name: 'Ion Core Hyperdrive Class-S',
      category: 'core',
      rarity: 'MYTHIC',
      powerBonus: 1200,
      defenseBonus: 640,
      dailyYieldUSD: 28.0,
      originalOwner: '0x33b1...CyberSyndicate',
      isBorrowed: false,
      icon: '💠',
      description: 'Antimatter reaction core that supercharges all combat abilities.'
    },
    {
      id: 'NFT-EX-45',
      name: 'Quantum Particle Carbine',
      category: 'weapon',
      rarity: 'EPIC',
      powerBonus: 680,
      defenseBonus: 90,
      dailyYieldUSD: 8.0,
      originalOwner: '0x71e3...NeonRaider',
      isBorrowed: false,
      icon: '🔫',
      description: 'High-fire-rate particle weapon suited for mid-range skirmishes.'
    }
  ]);

  // Live Claimable Yield Ticker
  const [claimableYieldUSD, setClaimableYieldUSD] = useState<number>(34.85);

  // Auto-tick earnings
  useEffect(() => {
    const timer = setInterval(() => {
      if (equippedWeapon || equippedArmor || equippedCore) {
        const totalDay =
          (equippedWeapon?.dailyYieldUSD || 0) +
          (equippedArmor?.dailyYieldUSD || 0) +
          (equippedCore?.dailyYieldUSD || 0);
        const perSec = (totalDay * 0.7) / 86400;
        setClaimableYieldUSD((prev) => prev + perSec);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [equippedWeapon, equippedArmor, equippedCore]);

  // Compute Active Stats & Yield
  const totalPower =
    500 +
    (equippedWeapon?.powerBonus || 0) +
    (equippedArmor?.powerBonus || 0) +
    (equippedCore?.powerBonus || 0);
  const totalDefense =
    300 +
    (equippedWeapon?.defenseBonus || 0) +
    (equippedArmor?.defenseBonus || 0) +
    (equippedCore?.defenseBonus || 0);
  const totalDailyYield =
    (equippedWeapon?.dailyYieldUSD || 0) +
    (equippedArmor?.dailyYieldUSD || 0) +
    (equippedCore?.dailyYieldUSD || 0);
  const scholarCut = totalDailyYield * 0.7;
  const guildCut = totalDailyYield * 0.3;
  const combatRating = totalPower + totalDefense;

  // Borrow NFT with Zero Collateral
  const handleBorrow = (nft: ScholarshipNFT) => {
    if (!isEligibleForScholarship) {
      addToast(
        'error',
        'Reputation Gated (GamingScholarshipVault.sol)',
        `Zero-collateral borrowing requires at least 700 CTS score. Your current score is ${userScore}.`
      );
      return;
    }

    playEquipSound('equip');

    // Mark as borrowed
    setVaultNFTs((prev) =>
      prev.map((item) =>
        item.id === nft.id ? { ...item, isBorrowed: true, borrower: 'You' } : item
      )
    );

    // Auto equip to respective slot
    if (nft.category === 'weapon') setEquippedWeapon(nft);
    if (nft.category === 'armor') setEquippedArmor(nft);
    if (nft.category === 'core') setEquippedCore(nft);

    addToast(
      'success',
      'Zero-Collateral Scholarship Granted!',
      `Borrowed ${nft.name} with 0 collateral! Equipped to loadout. 70/30 split active.`
    );
  };

  // Return NFT to Vault
  const handleReturn = (nft: ScholarshipNFT) => {
    playEquipSound('unequip');

    setVaultNFTs((prev) =>
      prev.map((item) =>
        item.id === nft.id ? { ...item, isBorrowed: false, borrower: undefined } : item
      )
    );

    if (equippedWeapon?.id === nft.id) setEquippedWeapon(null);
    if (equippedArmor?.id === nft.id) setEquippedArmor(null);
    if (equippedCore?.id === nft.id) setEquippedCore(null);

    addToast(
      'info',
      'NFT Returned to Guild Vault',
      `Returned ${nft.name} safely to pool. Accrued yield saved in session balance.`
    );
  };

  // Claim Yield
  const handleClaimYield = () => {
    if (claimableYieldUSD <= 0) {
      addToast('info', 'No Yield to Claim', 'Accrue earnings by keeping guild equipment active.');
      return;
    }
    playEquipSound('claim');
    const claimed = claimableYieldUSD;
    setClaimableYieldUSD(0);
    addToast(
      'success',
      'Scholarship Earnings Disbursed',
      `Transferred +$${claimed.toFixed(2)} USD to your Creditcoin L1 wallet!`
    );
  };

  // Filtered Vault NFTs
  const filteredNFTs = vaultNFTs.filter((nft) => {
    if (filterCategory === 'all') return true;
    return nft.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30 bg-slate-950/70">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Nexus Guild Armory &bull; GamingScholarshipVault.sol
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Zero-Collateral NFT Guild Scholarships & Esports Loadouts
            </h2>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl">
              Borrow elite game-winning weapons, shields, and power cores with <strong>Zero Upfront Collateral</strong>. Your verified Creditcoin Trust Score ($\ge 700$ CTS) guarantees fair play. Daily quest yields are automatically settled via an automated <strong>70% Scholar / 30% Guild Owner</strong> split.
            </p>

            {/* Reputation & Yield Badges */}
            <div className="grid grid-cols-3 gap-3 pt-1 font-mono text-xs">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <span className="text-[10px] text-emerald-300 uppercase block font-semibold flex items-center gap-1">
                  <Unlock className="w-3 h-3 text-emerald-400" /> Collateral Free
                </span>
                <span className="text-base font-bold text-white">$0 Upfront</span>
                <span className="text-[9px] text-emerald-400 block mt-0.5">CTS &ge; 700 qualified</span>
              </div>

              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <span className="text-[10px] text-cyan-300 uppercase block font-semibold">Scholar Cut</span>
                <span className="text-base font-bold text-cyan-400">70% Net Yield</span>
                <span className="text-[9px] text-white/40 block mt-0.5">Disbursed directly</span>
              </div>

              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <span className="text-[10px] text-purple-300 uppercase block font-semibold">Guild Vault Cut</span>
                <span className="text-base font-bold text-purple-300">30% Passive</span>
                <span className="text-[9px] text-white/40 block mt-0.5">Owner sponsorship</span>
              </div>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center gap-4 pt-1 text-xs text-white/60 font-mono">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="flex items-center gap-1.5 text-white/70 hover:text-white transition cursor-pointer"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                <span className="text-[11px]">{audioEnabled ? 'Equip Sounds: ON' : 'Equip Sounds: OFF'}</span>
              </button>
              <span>&bull;</span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> CTS {userScore} (Scholar Approved)
              </span>
            </div>
          </div>

          {/* 3D Visual Asset Container */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20 group">
              <img
                src="/images/guild-armory-vault.jpg"
                alt="3D Nexus Guild Armory with Holographic Display Pedestals for Cyber Blade, Nova Shield, and Ion Core"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-purple-500/30 text-purple-300">
                  🛡️ Nexus Armory Stash
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-white/80">
                  3 Staged Pedestals
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Loadout & Rental Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3-Slot Interactive Character Loadout */}
        <div className="lg:col-span-6 space-y-4">
          <GlassCard className="p-6 border-purple-500/30 space-y-5 bg-slate-950/60">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-purple-400 font-bold tracking-wider">
                  Active Scholar Loadout
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">Equipped Gear & Stats</h3>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-white/40 text-[10px] block uppercase">Total Combat Power</span>
                <span className="text-cyan-300 font-extrabold text-base">{combatRating} CP</span>
              </div>
            </div>

            {/* 3 Holographic Equipment Slots */}
            <div className="grid grid-cols-3 gap-3">
              {/* Slot 1: Weapon */}
              <div className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col items-center justify-between min-h-[170px] transition duration-300 ${
                equippedWeapon
                  ? 'bg-gradient-to-b from-purple-950/40 via-black to-slate-900 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'bg-black/60 border-white/10'
              }`}>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Slot 1: Weapon</span>
                {equippedWeapon ? (
                  <>
                    <span className="text-4xl animate-pulse">{equippedWeapon.icon}</span>
                    <div className="w-full">
                      <span className="text-xs font-bold text-white block truncate">{equippedWeapon.name}</span>
                      <span className="text-[10px] font-mono text-purple-300 font-bold">+{equippedWeapon.powerBonus} ATK</span>
                    </div>
                    <button
                      onClick={() => handleReturn(equippedWeapon)}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Unequip
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto text-white/20">
                    <Sword className="w-7 h-7" />
                    <span className="text-[9px] font-mono mt-1 text-white/40">Empty Weapon</span>
                  </div>
                )}
              </div>

              {/* Slot 2: Armor */}
              <div className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col items-center justify-between min-h-[170px] transition duration-300 ${
                equippedArmor
                  ? 'bg-gradient-to-b from-cyan-950/40 via-black to-slate-900 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-black/60 border-white/10'
              }`}>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Slot 2: Armor</span>
                {equippedArmor ? (
                  <>
                    <span className="text-4xl animate-pulse">{equippedArmor.icon}</span>
                    <div className="w-full">
                      <span className="text-xs font-bold text-white block truncate">{equippedArmor.name}</span>
                      <span className="text-[10px] font-mono text-cyan-300 font-bold">+{equippedArmor.defenseBonus} DEF</span>
                    </div>
                    <button
                      onClick={() => handleReturn(equippedArmor)}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Unequip
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto text-white/20">
                    <Shield className="w-7 h-7" />
                    <span className="text-[9px] font-mono mt-1 text-white/40">Empty Armor</span>
                  </div>
                )}
              </div>

              {/* Slot 3: Core */}
              <div className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col items-center justify-between min-h-[170px] transition duration-300 ${
                equippedCore
                  ? 'bg-gradient-to-b from-amber-950/40 via-black to-slate-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-black/60 border-white/10'
              }`}>
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Slot 3: Core</span>
                {equippedCore ? (
                  <>
                    <span className="text-4xl animate-pulse">{equippedCore.icon}</span>
                    <div className="w-full">
                      <span className="text-xs font-bold text-white block truncate">{equippedCore.name}</span>
                      <span className="text-[10px] font-mono text-amber-300 font-bold">+{equippedCore.powerBonus} PWR</span>
                    </div>
                    <button
                      onClick={() => handleReturn(equippedCore)}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 underline cursor-pointer"
                    >
                      Unequip
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto text-white/20">
                    <Zap className="w-7 h-7" />
                    <span className="text-[9px] font-mono mt-1 text-white/40">Empty Core</span>
                  </div>
                )}
              </div>
            </div>

            {/* 70/30 Yield Ledger & Live Claimer */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] font-mono text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-white/50 font-bold">
                  Automated 70/30 Scholar Revenue Ledger
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" /> Yield Streaming
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
                  <span className="text-[9px] text-white/40 uppercase block">Daily Gross</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">${totalDailyYield.toFixed(2)}/d</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[9px] text-emerald-300 uppercase block font-semibold">Scholar Cut (70%)</span>
                  <span className="text-xs font-bold text-emerald-400 mt-0.5 block">+${scholarCut.toFixed(2)}/d</span>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <span className="text-[9px] text-purple-300 uppercase block font-semibold">Guild Cut (30%)</span>
                  <span className="text-xs font-bold text-purple-300 mt-0.5 block">+${guildCut.toFixed(2)}/d</span>
                </div>
              </div>

              {/* Claim Payout Button */}
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-white/40 block">Claimable Earnings:</span>
                  <span className="text-sm font-bold text-emerald-400">${claimableYieldUSD.toFixed(4)} USD</span>
                </div>
                <button
                  onClick={handleClaimYield}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs font-mono transition shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  Claim Scholar Earnings &rarr;
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right: Guild Staked Asset Vault */}
        <div className="lg:col-span-6 space-y-4">
          <GlassCard className="p-6 border-white/10 space-y-4 bg-slate-950/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-white/40 font-bold block">
                  Guild Staked Armory Vault
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">Zero-Collateral Equipment Pool</h3>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-black/60 border border-white/10 rounded-xl text-[10px] font-mono">
                {(['all', 'weapon', 'armor', 'core'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg uppercase font-bold transition ${
                      filterCategory === cat
                        ? 'bg-purple-600 text-white'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Vault NFT Cards */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredNFTs.map((nft) => (
                <div
                  key={nft.id}
                  className={`p-4 rounded-2xl border transition space-y-2.5 font-mono text-xs ${
                    nft.isBorrowed
                      ? 'bg-white/[0.01] border-white/[0.05] opacity-60'
                      : 'bg-white/[0.02] border-white/[0.08] hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-2 rounded-xl bg-black/60 border border-white/10">{nft.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{nft.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              nft.rarity === 'MYTHIC'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : nft.rarity === 'LEGENDARY'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {nft.rarity}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 font-normal mt-0.5 line-clamp-1">{nft.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {nft.isBorrowed ? (
                        <button
                          onClick={() => handleReturn(nft)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" /> Return
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBorrow(nft)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-900/40 active:scale-95"
                        >
                          <Unlock className="w-3.5 h-3.5 text-emerald-300" /> Borrow (0 Collateral)
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.04] text-white/50">
                    <div className="flex items-center gap-3">
                      <span>Owner: <strong className="text-white">{nft.originalOwner}</strong></span>
                      <span>&bull;</span>
                      <span>
                        Stats: <strong className="text-purple-300">+{nft.powerBonus} PWR</strong> / <strong className="text-cyan-300">+{nft.defenseBonus} DEF</strong>
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      +${(nft.dailyYieldUSD * 0.7).toFixed(2)}/day net
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default GuildScholarshipStage;
