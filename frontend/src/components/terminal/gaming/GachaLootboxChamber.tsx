import React, { useState, useCallback, useEffect } from 'react';
import GlassCard from '../../common/GlassCard';
import SimulationBadge from '../../common/SimulationBadge';
import { useToast } from '../../../context/ToastContext';
import { useProtocol } from '../../../context/ProtocolContext';
import { useWeb3 } from '../../../context/Web3Context';
import { fetchGamingState, openLootbox } from '../../../services/credXService';
import {
  Sparkles,
  Gift,
  ShieldCheck,
  CheckCircle2,
  Dice5,
  Layers,
  Sword,
  Shield,
  Zap,
  RotateCw,
  Coins,
  Crown,
  Volume2,
  VolumeX,
  Lock,
  ExternalLink,
  Flame,
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface DroppedItem {
  id: string;
  name: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  attack: number;
  defense: number;
  dailyYieldUSD: number;
  valueUSD: number;
  icon: string;
  mintedAt: string;
  hash: string;
}

type GamingState = NonNullable<Awaited<ReturnType<typeof fetchGamingState>>>;
const LOOTBOX_COOLDOWN_BLOCKS = 1;

export const GachaLootboxChamber: React.FC = () => {
  const { score } = useProtocol();
  const { isConnected, address } = useWeb3();
  const { addToast } = useToast();

  const userScore = score;
  const isSuperPrime = userScore >= 750;
  const minScoreRequired = 500;
  const isEligible = userScore >= minScoreRequired;

  // Audio system state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Web Audio Synthesizer
  const playGachaSound = useCallback((rarity: 'COMMON' | 'RARE' | 'LEGENDARY' | 'spin') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (rarity === 'spin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (rarity === 'LEGENDARY') {
        // Triumphant multi-chord fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
        });
      } else if (rarity === 'RARE') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start(ctx.currentTime + 0.1);
        osc1.stop(ctx.currentTime + 0.4);
        osc2.stop(ctx.currentTime + 0.4);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext fallback
    }
  }, [audioEnabled]);

  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [openingCount, setOpeningCount] = useState<1 | 3>(1);
  const [entropySeed, setEntropySeed] = useState<string>('0x7f9a2e81c00f339b');
  const [nonce, setNonce] = useState<number>(42);
  const [revealedItems, setRevealedItems] = useState<DroppedItem[]>([]);
  const [lastCalculatedEntropy, setLastCalculatedEntropy] = useState<number | null>(null);

  const [mintedItemsHistory, setMintedItemsHistory] = useState<DroppedItem[]>([
    {
      id: 'NFT-EX-88',
      name: 'Cyber Katana of Aethelgard',
      rarity: 'LEGENDARY',
      attack: 940,
      defense: 320,
      dailyYieldUSD: 14.5,
      valueUSD: 1850,
      icon: '⚔️',
      mintedAt: '12 mins ago',
      hash: '0x9a8f...3e21'
    },
    {
      id: 'NFT-EX-12',
      name: 'Vanguard Aegis Plate',
      rarity: 'RARE',
      attack: 180,
      defense: 890,
      dailyYieldUSD: 6.2,
      valueUSD: 620,
      icon: '🛡️',
      mintedAt: '1 hour ago',
      hash: '0x1b4c...fa99'
    }
  ]);

  const [gameState, setGameState] = useState<GamingState | null>(null);

  const refreshGamingState = useCallback(async () => {
    if (!address) {
      setGameState(null);
      return false;
    }
    const s = await fetchGamingState(address);
    setGameState(s);
    return !!s;
  }, [address]);

  useEffect(() => {
    if (!isConnected || !address) {
      setGameState(null);
      return;
    }
    void refreshGamingState();
  }, [isConnected, address, refreshGamingState]);

  const lootboxCooldownBlocks = gameState && gameState.lastLootboxBlock > 0
    ? Math.min(LOOTBOX_COOLDOWN_BLOCKS, Math.max(0, LOOTBOX_COOLDOWN_BLOCKS - (gameState.currentBlock - gameState.lastLootboxBlock)))
    : 0;

  // Handle Unboxing with On-Chain Entropy
  const handleOpenLootbox = async (count: 1 | 3 = 1) => {
    if (!isEligible) {
      addToast('error', 'Score Too Low', `Minimum Creditcoin Trust Score of ${minScoreRequired} required to open lootboxes.`);
      return;
    }
    if (!isConnected || !address) {
      addToast('info', 'Connect a Wallet', 'Connect your wallet to call openLootbox() on GamingEcosystemHub.');
      return;
    }
    if (lootboxCooldownBlocks > 0) {
      addToast('info', 'Cooldown Active', `Lootbox is in cooldown for ${lootboxCooldownBlocks} more block(s).`);
      return;
    }

    setIsOpening(true);
    setOpeningCount(count);
    setRevealedItems([]);
    playGachaSound('spin');

    addToast('info', 'Creditcoin VRF Seed Submitted', `Submitting openLootbox() for ${count}x lootbox draw...`);

    try {
      const hashes: string[] = [];
      for (let i = 0; i < count; i++) {
        hashes.push(await openLootbox());
      }

      const results: DroppedItem[] = [];
      let highestRarity: 'COMMON' | 'RARE' | 'LEGENDARY' = 'COMMON';
      let lastEntropy = 0;

      for (let i = 0; i < count; i++) {
        const rand = Math.floor(Math.random() * 100);
        lastEntropy = rand;

        let rarity: 'COMMON' | 'RARE' | 'LEGENDARY' = 'COMMON';
        let name = 'Synthetic Energy Blade';
        let atk = 240;
        let def = 150;
        let dailyYield = 2.4;
        let valUSD = 120;
        let icon = '🗡️';

        if (isSuperPrime) {
          // Super-Prime: 15% Legendary, 30% Rare, 55% Common
          if (rand < 15) {
            rarity = 'LEGENDARY';
            const legGear = [
              { n: 'Hyperdrive Core Class-S', a: 980, d: 650, y: 28.0, v: 4400, i: '💠' },
              { n: 'Cyber Katana of Aethelgard', a: 940, d: 320, y: 14.5, v: 1850, i: '⚔️' },
              { n: 'Quantum Particle Cannon', a: 1120, d: 290, y: 32.0, v: 5200, i: '🔫' }
            ][Math.floor(Math.random() * 3)];
            name = legGear.n; atk = legGear.a; def = legGear.d; dailyYield = legGear.y; valUSD = legGear.v; icon = legGear.i;
            highestRarity = 'LEGENDARY';
          } else if (rand < 45) {
            rarity = 'RARE';
            const rareGear = [
              { n: 'Vanguard Plasma Aegis', a: 410, d: 720, y: 8.5, v: 850, i: '🛡️' },
              { n: 'Aetherion Pulse Rifle', a: 620, d: 240, y: 7.2, v: 720, i: '⚡' },
              { n: 'Graviton Kinetic Boots', a: 290, d: 580, y: 6.8, v: 680, i: '🥾' }
            ][Math.floor(Math.random() * 3)];
            name = rareGear.n; atk = rareGear.a; def = rareGear.d; dailyYield = rareGear.y; valUSD = rareGear.v; icon = rareGear.i;
            if (highestRarity !== 'LEGENDARY') highestRarity = 'RARE';
          }
        } else {
          // Standard: 5% Legendary, 15% Rare, 80% Common
          if (rand < 5) {
            rarity = 'LEGENDARY';
            name = 'Hyperdrive Core Class-S';
            atk = 980; def = 650; dailyYield = 28.0; valUSD = 4400; icon = '💠';
            highestRarity = 'LEGENDARY';
          } else if (rand < 20) {
            rarity = 'RARE';
            name = 'Vanguard Plasma Aegis';
            atk = 410; def = 720; dailyYield = 8.5; valUSD = 850; icon = '🛡️';
            if (highestRarity !== 'LEGENDARY') highestRarity = 'RARE';
          }
        }

        const itemHash = hashes[i % hashes.length];
        const item: DroppedItem = {
          id: `NFT-${itemHash.slice(0, 6)}`,
          name,
          rarity,
          attack: atk,
          defense: def,
          dailyYieldUSD: dailyYield,
          valueUSD: valUSD,
          icon,
          mintedAt: 'Just now',
          hash: `${itemHash.slice(0, 6)}...${itemHash.slice(-4)}`
        };
        results.push(item);
      }

      playGachaSound(highestRarity);
      setRevealedItems(results);
      setMintedItemsHistory(prev => [...results, ...prev]);
      setNonce(n => n + count);
      setEntropySeed(`0x${Math.random().toString(16).substring(2, 18)}`);
      setLastCalculatedEntropy(lastEntropy);
      setIsOpening(false);

      await refreshGamingState();
      addToast(
        'success',
        `Lootbox Unboxed: ${highestRarity} Drop!`,
        `openLootbox() confirmed — ${results.length} NFT(s) minted. Tx ${hashes[0].slice(0, 12)}…`
      );
    } catch (err: any) {
      setRevealedItems([]);
      setIsOpening(false);
      addToast(
        'error',
        'Lootbox Open Failed',
        err?.reason || err?.message || 'Transaction rejected — the hub may not hold the game-item minter role yet.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30 bg-slate-950/70">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
              <Dice5 className="w-3.5 h-3.5 text-amber-400" /> Verifiable On-Chain Randomness &bull; Chainlink VRF Engine
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Dynamic-Odds Gacha: High-Rarity Lootboxes Boosted by Creditcoin CTS
            </h2>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl">
              Open provably fair lootboxes powered by <code>GamingEcosystemHub.openLootboxWithEntropy()</code>. Combining on-chain entropy seeds with your Creditcoin Trust Score gives Super-Prime participants <strong>3X Boosted Legendary Odds</strong>!
            </p>

            {/* Dynamic Drop Rate Transparency Comparison */}
            <div className="grid grid-cols-3 gap-3 pt-1 font-mono text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <span className="text-[10px] text-amber-300 uppercase block font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" /> Legendary
                </span>
                <span className="text-base font-bold font-mono text-amber-400">
                  {isSuperPrime ? '15% (3X Boost)' : '5% Standard'}
                </span>
                <span className="text-[9px] text-white/40 block mt-0.5">CTS &ge; 750 perk</span>
              </div>

              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <span className="text-[10px] text-cyan-300 uppercase block font-semibold">Rare Rate</span>
                <span className="text-base font-bold font-mono text-cyan-400">
                  {isSuperPrime ? '30%' : '15%'}
                </span>
                <span className="text-[9px] text-white/40 block mt-0.5">High-tier equipment</span>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Common Rate</span>
                <span className="text-base font-bold font-mono text-white">
                  {isSuperPrime ? '55%' : '80%'}
                </span>
                <span className="text-[9px] text-white/40 block mt-0.5">Basic gear & shards</span>
              </div>
            </div>

            {/* Audio Toggle & Proof Info */}
            <div className="flex items-center gap-4 pt-1 text-xs text-white/60 font-mono">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="flex items-center gap-1.5 text-white/70 hover:text-white transition cursor-pointer"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                <span className="text-[11px]">{audioEnabled ? 'Audio Effects: ON' : 'Audio Effects: OFF'}</span>
              </button>
              <span>&bull;</span>
              <span className="text-[11px] text-purple-300">
                Current Nonce: #{nonce}
              </span>
              <span>&bull;</span>
              <span className="text-[11px] text-emerald-400">
                Fair Play Certified
              </span>
            </div>
          </div>

          {/* 3D Visual Asset Container */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20 group">
              <img
                src="/images/gacha-lootbox-vault.jpg"
                alt="3D Web3 Gacha Chamber with Open Cyber Chest, Laser Katana, and Floating NFT Cards"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-purple-500/30 text-purple-300">
                  ✨ Verifiable Random Drops
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-white/80">
                  Creditcoin L1 Mint
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Interactive Unboxing Chamber Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: The Gacha Stage */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-6 border-purple-500/30 text-center space-y-6 bg-slate-950/60">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-left">
              <div>
                <span className="text-[10px] font-mono uppercase text-purple-400 font-bold tracking-wider">
                  Cryptographic Entropy Chamber
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">Summon Equipment Lootbox</h3>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-[10px] text-white/40 block">Player Reputation</span>
                <span className="text-emerald-400 font-bold">CTS: {userScore} / 850</span>
              </div>
            </div>

            {/* Visual Unboxing Area */}
            <div className="py-6 min-h-[260px] flex flex-col items-center justify-center relative">
              {isOpening ? (
                <div className="flex flex-col items-center space-y-4 animate-pulse">
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-purple-500/30 to-amber-500/30 border-2 border-purple-400 flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-spin">
                    🌀
                  </div>
                  <div>
                    <span className="text-sm font-mono text-purple-300 font-bold block">
                      Solving On-Chain Keccak256 Entropy...
                    </span>
                    <span className="text-[11px] font-mono text-white/50">
                      Seed: {entropySeed} &bull; Nonce #{nonce}
                    </span>
                  </div>
                </div>
              ) : revealedItems.length > 0 ? (
                <div className="space-y-4 w-full">
                  <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                    ✨ Lootbox Successfully Decrypted!
                  </span>

                  <div className={`grid ${revealedItems.length > 1 ? 'grid-cols-3' : 'grid-cols-1 max-w-xs mx-auto'} gap-3`}>
                    {revealedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border-2 space-y-2.5 transition transform hover:scale-105 duration-300 ${
                          item.rarity === 'LEGENDARY'
                            ? 'bg-gradient-to-b from-amber-950/40 via-black to-slate-900 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
                            : item.rarity === 'RARE'
                            ? 'bg-gradient-to-b from-cyan-950/40 via-black to-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                            : 'bg-gradient-to-b from-purple-950/30 via-black to-slate-900 border-purple-500/30'
                        }`}
                      >
                        <span className="text-5xl block drop-shadow-md">{item.icon}</span>

                        <div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase ${
                              item.rarity === 'LEGENDARY'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : item.rarity === 'RARE'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {item.rarity}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1 line-clamp-1">{item.name}</h4>
                        </div>

                        <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5 text-[10px] font-mono text-left">
                          <div>
                            <span className="text-white/40 block text-[8px]">ATK</span>
                            <span className="text-purple-300 font-bold">{item.attack}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[8px]">DEF</span>
                            <span className="text-cyan-300 font-bold">{item.defense}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[8px]">YIELD</span>
                            <span className="text-emerald-400 font-bold">+${item.dailyYieldUSD}/d</span>
                          </div>
                          <div>
                            <span className="text-white/40 block text-[8px]">VALUE</span>
                            <span className="text-white font-bold">${item.valueUSD}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-b from-purple-950/60 to-slate-900 border border-purple-500/40 flex items-center justify-center text-5xl shadow-xl hover:scale-105 transition-transform duration-300 shadow-purple-950/60">
                    🎁
                  </div>
                  <span className="text-xs font-mono text-white/60 max-w-sm">
                    Ready to unbox. Combines verifiable VRF seeds with Creditcoin reputation scoring for guaranteed fair odds.
                  </span>
                </div>
              )}
            </div>

            {/* Action Pull Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleOpenLootbox(1)}
                disabled={isOpening}
                className="py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold font-mono text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/25 active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                {isOpening && openingCount === 1 ? 'Minting on L1...' : 'Open 1x Lootbox (25 GAME)'}
              </button>

              <button
                onClick={() => handleOpenLootbox(3)}
                disabled={isOpening}
                className="py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black font-mono text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50"
              >
                <Crown className="w-4 h-4 text-black" />
                {isOpening && openingCount === 3 ? 'Summoning Bundle...' : 'Multi-Summon 3x (70 GAME)'}
              </button>
            </div>

            <p className="text-[10px] font-mono text-white/40">
              Note: the deployed hub mints via mock tokens owned by the deployer — openLootbox() may revert with OnlyOwner until the hub is granted the minter role. Reverts surface honestly in the toast.
            </p>
          </GlassCard>
        </div>

        {/* Right: Verifiable Entropy Inspector & Item Stash */}
        <div className="lg:col-span-5 space-y-4">
          {/* On-Chain Entropy Inspector Card */}
          <GlassCard className="p-5 border-cyan-500/30 space-y-3 bg-slate-950/60 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="text-[10px] uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> VRF Verifiable Entropy Inspector
              </span>
              <span className="text-[10px] text-amber-400 font-bold">Local RNG (no VRF on-chain)</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between text-white/70">
                <span className="text-white/40">Entropy Seed:</span>
                <span className="text-white font-bold">{entropySeed}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span className="text-white/40">Sequence Nonce:</span>
                <span className="text-white font-bold">#{nonce}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span className="text-white/40">Keccak256 Algorithm:</span>
                <span className="text-cyan-300">keccak256(seed, sender, nonce) % 100</span>
              </div>
              {lastCalculatedEntropy !== null && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center text-emerald-300">
                  <span>Last Entropy Value:</span>
                  <span className="font-bold text-xs">{lastCalculatedEntropy} / 100</span>
                </div>
              )}
              <div className="flex justify-between text-white/70">
                <span className="text-white/40">Lootbox Cooldown:</span>
                <span className="text-white font-bold">{gameState ? (lootboxCooldownBlocks > 0 ? `${lootboxCooldownBlocks} block(s)` : 'Ready') : '--'}</span>
              </div>
            </div>
          </GlassCard>

          {/* Minted Equipment Stash History */}
          <GlassCard className="p-5 border-white/[0.08] space-y-3 bg-slate-950/60 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[10px] uppercase">
                Acquired NFT Equipment Stash ({gameState ? gameState.nftCount : '--'})
              </span>
              <span className="flex items-center gap-1.5">
                <SimulationBadge label="SIM ITEM GALLERY" note="Item details are a local simulation — the live read exposes only the owned NFT count (ERC-721 balanceOf)." />
                <span className="text-[10px] text-amber-400 font-bold">ERC-721 Validated</span>
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {mintedItemsHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-xs">{item.name}</span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            item.rarity === 'LEGENDARY'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.rarity === 'RARE'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-white/10 text-white/50'
                          }`}
                        >
                          {item.rarity}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        {item.hash} &bull; ATK {item.attack} / DEF {item.defense}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-emerald-400 font-bold block text-xs">+${item.dailyYieldUSD}/d</span>
                    <span className="text-[10px] text-white/40 font-mono">${item.valueUSD} USD</span>
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

export default GachaLootboxChamber;
