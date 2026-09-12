import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  Cpu,
  Wifi,
  Activity,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Download,
  Chrome,
  Coins,
  DollarSign,
  Radio,
  Server,
  Zap,
  Sparkles
} from 'lucide-react';

const VirtualNodeTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { hardware, virtualNodeActive, virtualNodePoints, toggleVirtualNode, runPingTest, score } = useProtocol();
  const { addToast } = useToast();
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const handleDownloadExt = () => {
    setDownloadingExt(true);
    addToast('info', 'Extension Bundle', 'Building browser manifest V3 payload for background telemetry sharing...');
    setTimeout(() => {
      setDownloadingExt(false);
      addToast('success', 'Extension Ready', 'Download started for CredX-Node-Extension-v2.4.zip. Load unpacked into chrome://extensions.');
    }, 1500);
  };

  const handleClaimMinedRewards = () => {
    if (virtualNodePoints < 100) {
      addToast('error', 'Threshold Not Met', 'Minimum 100 PTS required to claim on-chain CTC rewards.');
      return;
    }
    setClaiming(true);
    addToast('info', 'Claiming Rewards', `Converting ${virtualNodePoints.toLocaleString()} PTS to CTC token rewards on Creditcoin L1...`);
    setTimeout(() => {
      setClaiming(false);
      if (isPostHogEnabled) {
        posthog.capture('node_rewards_claimed', { points: virtualNodePoints });
      }
      addToast('success', 'CTC Rewards Credited', `Successfully claimed ${(virtualNodePoints * 0.05).toFixed(2)} CTC to your connected wallet!`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* SIMULATED banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-[11px] leading-relaxed text-amber-200/80">
        <SimulationBadge
          label="SIMULATED TELEMETRY"
          note="Virtual Node telemetry is simulated locally — the Chrome extension (chrome-extension/) reports real device specs, but no telemetry is attested on-chain."
        />
        <span className="font-mono">
          Device fingerprint is real (this browser), but mined CTC, bandwidth points and telemetry rewards are
          local simulations — nothing is attested on-chain by the extension yet.
        </span>
      </div>

      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Node Operator Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClaimMinedRewards}
            disabled={claiming}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {claiming ? 'Claiming...' : `Claim Mined CTC (${(virtualNodePoints * 0.05).toFixed(1)} CTC)`}
          </button>
          <button
            onClick={handleDownloadExt}
            disabled={downloadingExt}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Chrome className="w-3.5 h-3.5" />
            {downloadingExt ? 'Packaging...' : 'Get Chrome Extension'}
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <Zap className="w-3.5 h-3.5 animate-pulse" /> Edge Telemetry & Decentralized Node Mining
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Turn Your Browser Session into a ZK Validation Node
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Mine bandwidth credits passively, generate zero-knowledge zk-SNARK attestation proofs in your browser, and boost your CTS score while earning real CTC rewards.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Node Uptime Session</span>
                <span className="text-base font-bold font-mono text-emerald-400">{virtualNodeActive ? '99.98% Running' : 'Paused'}</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Telemetry Points Mined</span>
                <span className="text-base font-bold font-mono text-cyan-300">{virtualNodePoints.toLocaleString()} PTS</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Round-Trip Edge Ping</span>
                <span className="text-base font-bold font-mono text-white">{hardware.pingMs} ms</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 group">
              <img
                src="/images/virtual-node.jpg"
                alt="3D High-Tech Virtual Node Server Blade and Telemetry Gauges"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
                  ⚡ Proof Mode: SnarkJS WebAssembly
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  {virtualNodeActive ? 'MINING LIVE' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Node Worker Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* State Controller Card */}
        <GlassCard className="lg:col-span-5 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-white/40">Worker Status</span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 ${
                  virtualNodeActive
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.05] border border-white/[0.08] text-white/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${virtualNodeActive ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`} />
                {virtualNodeActive ? 'MINING & VERIFYING' : 'OFFLINE'}
              </span>
            </div>

            <div>
              <span className="text-white/40 text-xs block">Bandwidth Reward Points</span>
              <div className="text-3xl font-extrabold font-mono text-cyan-400 mt-1">
                {virtualNodePoints.toLocaleString()} <span className="text-xs text-white/40 font-normal">PTS</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-1">+12.5 PTS every 3 seconds while online</div>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Relay Protocol</span>
                <span className="text-white font-mono">WSS/Creditcoin-L1</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Proof Generation</span>
                <span className="text-emerald-400 font-mono">ZK-SNARK SnarkJS</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>CTS Boost Contribution</span>
                <span className="text-cyan-400 font-mono">+18 CTS pts/epoch</span>
              </div>
            </div>
          </div>

          <button
            onClick={toggleVirtualNode}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition ${
              virtualNodeActive
                ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25'
            }`}
          >
            {virtualNodeActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {virtualNodeActive ? 'Pause Edge Node' : 'Start Virtual Node Session'}
          </button>
        </GlassCard>

        {/* Real-time Hardware Profiling HUD */}
        <GlassCard className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Device Hardware Profile</h3>
            <span className="text-[10px] text-white/40 font-mono">AUTO-DETECTED</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
              <span className="text-[10px] uppercase text-white/40 font-mono tracking-wider">CPU Threads</span>
              <div className="text-lg font-bold font-mono text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> {hardware.cpuCores} Logic Threads
              </div>
            </div>
            <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
              <span className="text-[10px] uppercase text-white/40 font-mono tracking-wider">System RAM Matrix</span>
              <div className="text-lg font-bold font-mono text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> {hardware.deviceMemoryGB} GB Physical
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
            <span className="text-[10px] uppercase text-white/40 font-mono tracking-wider">Hardware Accelerated GPU Renderer</span>
            <div className="text-xs font-mono text-cyan-300 break-all">{hardware.gpuRenderer}</div>
          </div>

          <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
            <span className="text-[10px] uppercase text-white/40 font-mono tracking-wider">WebSocket Latency</span>
            <div className="text-sm font-mono text-emerald-400 font-semibold">{hardware.pingMs} ms (Sub-50ms Ultra Low Latency)</div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default VirtualNodeTab;
