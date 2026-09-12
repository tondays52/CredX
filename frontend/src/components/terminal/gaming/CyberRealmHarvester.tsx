import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../../common/GlassCard';
import { useToast } from '../../../context/ToastContext';
import { useProtocol } from '../../../context/ProtocolContext';
import { useWeb3 } from '../../../context/Web3Context';
import { fetchGamingState, gatherResources } from '../../../services/credXService';
import {
  Gamepad2,
  Zap,
  Sparkles,
  Flame,
  Award,
  Clock,
  Compass,
  CheckCircle2,
  ArrowRight,
  Radar,
  Volume2,
  VolumeX,
  BatteryCharging,
  Layers,
  Cpu,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface GridTile {
  id: number;
  x: number;
  y: number;
  type: 'empty' | 'crystal' | 'plasma' | 'ore';
  yieldAmount: number;
  name: string;
  isScanned?: boolean;
}

type GamingState = NonNullable<Awaited<ReturnType<typeof fetchGamingState>>>;
const GATHER_COOLDOWN_BLOCKS = 7200;

export const CyberRealmHarvester: React.FC = () => {
  const { score } = useProtocol();
  const { isConnected, address } = useWeb3();
  const { addToast } = useToast();

  // Audio effects state
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  // Sound generator using native Web Audio API (zero external deps)
  const playSound = useCallback((type: 'move' | 'harvest' | 'scan' | 'overdrive') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'move') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'harvest') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
        osc2.frequency.setValueAtTime(660, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.25);
        osc2.stop(ctx.currentTime + 0.25);
      } else if (type === 'scan') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // AudioContext auto-play restriction fallback
    }
  }, [audioEnabled]);

  // Player position on 5x5 grid (0 to 4)
  const [playerPos, setPlayerPos] = useState<{ x: number; y: number }>({ x: 2, y: 2 });
  const [gameState, setGameState] = useState<GamingState | null>(null);
  const [cyberCrystals, setCyberCrystals] = useState<number>(65);
  const [solarPlasma, setSolarPlasma] = useState<number>(24);
  const [darkOre, setDarkOre] = useState<number>(12);
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false);
  const [droneBattery, setDroneBattery] = useState<number>(100);
  const [radarScanning, setRadarScanning] = useState<boolean>(false);

  // Harvesting history log
  const [harvestLog, setHarvestLog] = useState<Array<{ id: string; name: string; amount: number; time: string; blockHash: string }>>([]);

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

  // Creditcoin Super-Prime Check (Score >= 750 grants 3X multiplier)
  const userScore = score;
  const isSuperPrime = userScore >= 750;
  const multiplier = isSuperPrime ? 3 : 1;
  const baseReward = 10;
  const totalReward = baseReward * multiplier;

  // 5x5 Grid Setup
  const [grid, setGrid] = useState<GridTile[]>(() => {
    const tiles: GridTile[] = [];
    let id = 0;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        let type: 'empty' | 'crystal' | 'plasma' | 'ore' = 'empty';
        let yieldAmount = 0;
        let name = 'Barren Cyber Grid';

        if ((x === 0 && y === 1) || (x === 4 && y === 3) || (x === 1 && y === 4)) {
          type = 'crystal';
          yieldAmount = 5;
          name = 'Quantum Crystal Vein';
        } else if ((x === 3 && y === 0) || (x === 1 && y === 2) || (x === 4 && y === 1)) {
          type = 'plasma';
          yieldAmount = 3;
          name = 'Solar Plasma Vent';
        } else if ((x === 0 && y === 4) || (x === 3 && y === 4) || (x === 2 && y === 0)) {
          type = 'ore';
          yieldAmount = 2;
          name = 'Dark Aether Ore';
        }

        tiles.push({ id: id++, x, y, type, yieldAmount, name, isScanned: false });
      }
    }
    return tiles;
  });

  // Battery recharge loop
  useEffect(() => {
    const batteryTimer = setInterval(() => {
      setDroneBattery(b => Math.min(100, b + 2));
    }, 2000);
    return () => clearInterval(batteryTimer);
  }, []);

  const gameTokenSymbol = gameState?.gameToken.symbol || 'GAME';
  const gameBalanceLabel = gameState ? gameState.gameBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--';
  const gatherCooldownBlocks = gameState && gameState.lastGatherBlock > 0
    ? Math.max(0, GATHER_COOLDOWN_BLOCKS - (gameState.currentBlock - gameState.lastGatherBlock))
    : 0;

  const currentTile = grid.find(t => t.x === playerPos.x && t.y === playerPos.y);

  // Move Player
  const handleMove = useCallback((dx: number, dy: number) => {
    const newX = Math.max(0, Math.min(4, playerPos.x + dx));
    const newY = Math.max(0, Math.min(4, playerPos.y + dy));
    if (newX !== playerPos.x || newY !== playerPos.y) {
      playSound('move');
      setPlayerPos({ x: newX, y: newY });
      setDroneBattery(b => Math.max(0, b - 2));
    }
  }, [playerPos, playSound]);

  // Scan Sector with Radar
  const handleScanRadar = () => {
    if (radarScanning) return;
    playSound('scan');
    setRadarScanning(true);
    addToast('info', 'Deep Sector Radar Scan', 'Probing sub-surface grid for rich energy monoliths...');

    setTimeout(() => {
      setGrid(prev => prev.map(t => ({ ...t, isScanned: true })));
      setRadarScanning(false);
      setDroneBattery(b => Math.max(0, b - 15));
      addToast('success', 'Sector Map Synchronized', 'All Quantum Crystal and Solar Plasma coordinates revealed.');
    }, 1200);
  };

  // Harvest Node
  const handleHarvest = useCallback(async () => {
    if (!isConnected || !address) {
      addToast('info', 'Connect a Wallet', 'Connect your wallet to call gatherResources() on GamingEcosystemHub.');
      return;
    }
    if (gatherCooldownBlocks > 0) {
      addToast('info', 'Cooldown Active', `On-chain gather is in cooldown for ${gatherCooldownBlocks} more block(s).`);
      return;
    }
    if (droneBattery < 10) {
      addToast('error', 'Battery Depleted', 'Allow drone battery to recharge to at least 10% before mining.');
      return;
    }

    setIsHarvesting(true);
    playSound('harvest');

    try {
      const hash = await gatherResources();
      setDroneBattery(b => Math.max(0, b - 20));

      let addedCrystals = 0;
      let addedPlasma = 0;
      let addedOre = 0;
      if (currentTile?.type === 'crystal') addedCrystals = currentTile.yieldAmount * multiplier;
      else if (currentTile?.type === 'plasma') addedPlasma = currentTile.yieldAmount * multiplier;
      else if (currentTile?.type === 'ore') addedOre = currentTile.yieldAmount * multiplier;
      if (addedCrystals) setCyberCrystals(c => c + addedCrystals);
      if (addedPlasma) setSolarPlasma(p => p + addedPlasma);
      if (addedOre) setDarkOre(o => o + addedOre);

      const newLog = {
        id: `TX-${hash.slice(0, 8)}`,
        name: currentTile?.name || 'Sector Grid Tile',
        amount: totalReward,
        time: 'Just now',
        blockHash: `${hash.slice(0, 10)}...${hash.slice(-4)}`
      };
      setHarvestLog(prev => [newLog, ...prev.slice(0, 9)]);

      await refreshGamingState();
      addToast(
        'success',
        'Daily Resources Gathered (GamingEcosystemHub.sol)',
        `gatherResources() confirmed — tx ${hash.slice(0, 12)}… ${isSuperPrime ? '(Super-Prime 3X CTS Multiplier Active!)' : ''}`
      );
    } catch (err: any) {
      addToast(
        'error',
        'Gather Failed',
        err?.reason || err?.message || 'Transaction rejected — the hub may not hold the game-token minter role yet.'
      );
    } finally {
      setIsHarvesting(false);
    }
  }, [address, isConnected, gatherCooldownBlocks, droneBattery, currentTile, multiplier, totalReward, isSuperPrime, playSound, refreshGamingState, addToast]);

  // Keyboard navigation listener (W, A, S, D and Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleMove(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleMove(0, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleMove(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleMove(1, 0);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleHarvest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, handleHarvest]);

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30 bg-slate-950/70">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Sector 07 Autonomous Resource Extraction
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              CyberRealm Daily Harvester: Autonomous Drone Mining Grid
            </h2>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl">
              Navigate your autonomous harvester drone across the 5x5 subterranean energy grid. Mine raw <strong>Quantum Crystals</strong>, <strong>Solar Plasma</strong>, and <strong>Dark Aether Ore</strong>. Settled directly into your wallet via Creditcoin L1 <code>GamingEcosystemHub.sol</code> with 24-hour block cooldowns.
            </p>

            {/* Smart Contract & CTS Multiplier Badges */}
            <div className="grid grid-cols-3 gap-3 pt-1 font-mono text-xs">
              <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Base Reward</span>
                <span className="text-base font-bold text-white">10 {gameTokenSymbol}</span>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <span className="text-[10px] text-amber-300 uppercase block font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> CTS Multiplier
                </span>
                <span className="text-base font-bold text-amber-400">
                  {isSuperPrime ? '3X Super-Prime' : '1X Standard'}
                </span>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Harvest Payout</span>
                <span className="text-base font-bold text-emerald-400">+{totalReward} {gameTokenSymbol}</span>
              </div>
            </div>

            {/* Controls Helper & Sound Toggle */}
            <div className="flex items-center gap-4 pt-1 text-xs text-white/60 font-mono">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">W</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">A</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">S</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">D</kbd>
                <span className="text-[11px] text-white/40">or Arrows to Move</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">SPACE</kbd>
                <span className="text-[11px] text-white/40">to Harvest</span>
              </span>
              <span>&bull;</span>
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="flex items-center gap-1 text-white/70 hover:text-white transition"
              >
                {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                <span className="text-[10px]">{audioEnabled ? 'Audio ON' : 'Audio OFF'}</span>
              </button>
            </div>
          </div>

          {/* 3D Visual Asset Container */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20 group">
              <img
                src="/images/cyberrealm-harvester.jpg"
                alt="3D CyberRealm Subterranean Mining Grid with Quantum Crystals and Laser Harvester Drone"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-85" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-purple-500/30 text-purple-300">
                  ⚡ Autonomous Laser Drone
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-white/80">
                  Grid Sector 07-X
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Game Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Playable 5x5 Cyber Grid */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-6 border-purple-500/30 space-y-4 bg-slate-950/60">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-purple-400 font-bold tracking-wider">
                  Subterranean Sector Grid
                </span>
                <h3 className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>Coordinates: [X: {playerPos.x}, Y: {playerPos.y}]</span>
                  <span className="text-xs text-white/40 font-normal font-mono">&bull; Depth: -420m</span>
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Drone Battery Indicator */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] font-mono text-xs">
                  <BatteryCharging className={`w-3.5 h-3.5 ${droneBattery < 20 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                  <span className={droneBattery < 20 ? 'text-rose-400 font-bold' : 'text-white'}>{droneBattery}%</span>
                </div>

                {/* Radar Scan Trigger */}
                <button
                  onClick={handleScanRadar}
                  disabled={radarScanning || droneBattery < 15}
                  className="px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Radar className={`w-3.5 h-3.5 ${radarScanning ? 'animate-spin' : ''}`} />
                  <span>Scan Grid</span>
                </button>
              </div>
            </div>

            {/* 5x5 Grid Board with Holographic Glow */}
            <div className="relative p-4 rounded-2xl bg-black/90 border border-purple-500/20 aspect-square max-w-md mx-auto shadow-inner shadow-purple-950/50">
              {/* Laser Beam Visual Line when Harvesting */}
              {isHarvesting && (
                <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_15px_#22d3ee]" />
                  <div className="absolute text-cyan-300 font-mono text-[11px] font-bold tracking-widest uppercase bg-black/80 px-3 py-1 rounded-full border border-cyan-400">
                    ⚡ Mining Sub-Surface Energy...
                  </div>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2.5 h-full">
                {grid.map(tile => {
                  const isPlayerHere = tile.x === playerPos.x && tile.y === playerPos.y;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => {
                        playSound('move');
                        setPlayerPos({ x: tile.x, y: tile.y });
                      }}
                      className={`relative rounded-xl flex flex-col items-center justify-center p-1.5 transition duration-200 cursor-pointer border select-none ${
                        isPlayerHere
                          ? 'bg-gradient-to-b from-purple-600/50 to-indigo-700/50 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] ring-2 ring-purple-400 scale-[1.03] z-10'
                          : tile.type === 'crystal'
                          ? 'bg-cyan-950/30 border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-900/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                          : tile.type === 'plasma'
                          ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400 hover:bg-amber-900/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                          : tile.type === 'ore'
                          ? 'bg-purple-950/30 border-purple-500/30 hover:border-purple-400 hover:bg-purple-900/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      {isPlayerHere ? (
                        <div className="flex flex-col items-center justify-center animate-pulse">
                          <span className="text-2xl drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]">🤖</span>
                          <span className="text-[8px] font-mono text-purple-200 font-black tracking-wider uppercase mt-0.5">DRONE</span>
                        </div>
                      ) : tile.type === 'crystal' ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xl drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]">💎</span>
                          <span className="text-[8px] font-mono text-cyan-300 font-bold mt-0.5">+{tile.yieldAmount * multiplier}</span>
                        </div>
                      ) : tile.type === 'plasma' ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xl drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]">⚡</span>
                          <span className="text-[8px] font-mono text-amber-300 font-bold mt-0.5">+{tile.yieldAmount * multiplier}</span>
                        </div>
                      ) : tile.type === 'ore' ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xl drop-shadow-[0_0_6px_rgba(192,132,252,0.8)]">🌑</span>
                          <span className="text-[8px] font-mono text-purple-300 font-bold mt-0.5">+{tile.yieldAmount * multiplier}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-white/20 font-mono text-[9px]">
                          <span>·</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Directional D-Pad & Harvest Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              {/* Virtual D-Pad */}
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  onClick={() => handleMove(-1, 0)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 hover:bg-white/10 hover:border-purple-400 text-white font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Move West"
                >
                  <ChevronLeft className="w-4 h-4" /> West
                </button>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => handleMove(0, -1)}
                    className="px-3.5 py-1.5 rounded-xl bg-black/60 border border-white/10 hover:bg-white/10 hover:border-purple-400 text-white font-bold transition flex items-center justify-center active:scale-95 cursor-pointer"
                    title="Move North"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(0, 1)}
                    className="px-3.5 py-1.5 rounded-xl bg-black/60 border border-white/10 hover:bg-white/10 hover:border-purple-400 text-white font-bold transition flex items-center justify-center active:scale-95 cursor-pointer"
                    title="Move South"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => handleMove(1, 0)}
                  className="px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 hover:bg-white/10 hover:border-purple-400 text-white font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Move East"
                >
                  East <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Main Harvest Button */}
              <button
                onClick={handleHarvest}
                disabled={isHarvesting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold font-mono text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-40"
              >
                <Zap className={`w-4 h-4 ${isHarvesting ? 'animate-spin text-black' : 'text-black'}`} />
                {isHarvesting ? 'Harvesting Node...' : gatherCooldownBlocks > 0 ? `Cooldown (${gatherCooldownBlocks} blocks)` : `Harvest Tile (+${totalReward} ${gameTokenSymbol})`}
              </button>
            </div>

            <p className="text-[10px] font-mono text-white/40">
              Note: the deployed hub mints via mock tokens owned by the deployer — gatherResources() may revert with OnlyOwner until the hub is granted the minter role. Reverts surface honestly in the toast.
            </p>
          </GlassCard>
        </div>

        {/* Right: Telemetry, Web3 Inventory & Block Logs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tile Telemetry Card */}
          <GlassCard className="p-5 border-cyan-500/30 space-y-4 bg-slate-950/60">
            <div className="border-b border-white/[0.08] pb-3">
              <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Tile Sensor Telemetry
              </span>
              <h3 className="text-base font-bold text-white mt-1">{currentTile?.name}</h3>
              <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                {currentTile?.type !== 'empty'
                  ? `Rich geological vein discovered. Yield per harvest: ${currentTile?.yieldAmount} units x ${multiplier}X multiplier.`
                  : 'Empty basalt corridor. Use the D-pad to locate pulsating quantum crystals or plasma vents.'}
              </p>
            </div>

            {/* Web3 Resource Inventory */}
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-[10px] uppercase">Wallet Inventory</span>
                <span className="text-[10px] text-emerald-400 font-bold">Creditcoin L1 Settled</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🎮</span>
                  <div>
                    <span className="text-white font-bold block">{gameTokenSymbol} Tokens</span>
                    <span className="text-[10px] text-white/40">Ecosystem Utility</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-sm">{gameBalanceLabel} {gameTokenSymbol}</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">💎</span>
                  <div>
                    <span className="text-white font-bold block">Quantum Crystals</span>
                    <span className="text-[10px] text-white/40">Laser Weapon Crafting</span>
                  </div>
                </div>
                <span className="text-cyan-400 font-bold text-sm">{cyberCrystals} units</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⚡</span>
                  <div>
                    <span className="text-white font-bold block">Solar Plasma</span>
                    <span className="text-[10px] text-white/40">Shield Overcharge</span>
                  </div>
                </div>
                <span className="text-amber-400 font-bold text-sm">{solarPlasma} units</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🌑</span>
                  <div>
                    <span className="text-white font-bold block">Dark Aether Ore</span>
                    <span className="text-[10px] text-white/40">Legendary Armor Plate</span>
                  </div>
                </div>
                <span className="text-purple-400 font-bold text-sm">{darkOre} units</span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⏳</span>
                  <div>
                    <span className="text-white font-bold block">Gather Cooldown</span>
                    <span className="text-[10px] text-white/40">GamingEcosystemHub (7200 blocks)</span>
                  </div>
                </div>
                <span className="text-white font-bold text-sm">{gameState ? (gatherCooldownBlocks > 0 ? `${gatherCooldownBlocks} blocks` : 'Ready') : '--'}</span>
              </div>
            </div>
          </GlassCard>

          {/* On-Chain Harvest Receipts Stream */}
          <GlassCard className="p-5 border-white/[0.08] space-y-3 bg-slate-950/60 font-mono text-xs">
            <span className="text-white/40 text-[10px] uppercase block">
              Live Creditcoin L1 Attestation Receipts
            </span>

            <div className="space-y-2">
              {harvestLog.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-black/50 border border-white/[0.04] text-white/40">
                  No on-chain gather receipts yet. Connect a wallet and harvest a tile to generate a real receipt.
                </div>
              ) : (
                harvestLog.map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-black/50 border border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-white font-bold text-[11px] block">{log.name}</span>
                        <span className="text-[9px] text-white/40">{log.blockHash} &bull; {log.time}</span>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-bold text-[11px]">+{log.amount} {gameTokenSymbol}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default CyberRealmHarvester;
