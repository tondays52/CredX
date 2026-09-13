import React, { useState, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import useAiComputeLive from '../../hooks/useAiComputeLive';
import { ExtensionModal } from '../modals/ExtensionModal';
import { pingExtension } from '../../utils/extensionBundle';
import { CONTRACTS } from '../../config/contracts';
import {
  Cpu,
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
  Sparkles,
  ExternalLink,
  Terminal,
  Clock,
  Layers,
  Award,
  AlertCircle
} from 'lucide-react';

export const VirtualNodeTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { hardware, virtualNodeActive, virtualNodePoints, toggleVirtualNode, runPingTest } = useProtocol();
  const { addToast } = useToast();
  
  const {
    state: computeState,
    provider,
    providers,
    ledger,
    benchmark,
    loading: computeLoading,
    busy,
    error: computeError,
    lastTx,
    txLog,
    account,
    unpaid,
    register,
    settle,
    claim,
    runBenchmark,
    refresh: refreshCompute,
  } = useAiComputeLive();

  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extDetected, setExtDetected] = useState(false);
  const [extVersion, setExtVersion] = useState<string | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState(15);
  const [qualityGrade, setQualityGrade] = useState(3);
  const [isRegistering, setIsRegistering] = useState(false);
  const [customTag, setCustomTag] = useState('EDGE-AI-NODE-V1');

  // Check for extension detection on mount and periodically
  useEffect(() => {
    let mounted = true;
    const checkExt = async () => {
      try {
        const res = await pingExtension();
        if (mounted && res.installed) {
          setExtDetected(true);
          setExtVersion(res.version || '1.1.0');
        }
      } catch (e) {
        // ignore
      }
    };
    checkExt();
    const interval = setInterval(checkExt, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRunBenchmark = async () => {
    addToast('info', 'Hardware Benchmark', 'Running WebGL tensor math & latency benchmark on this device…');
    const result = await runBenchmark();
    if (result) {
      addToast('success', 'Benchmark Complete', `${result.tokensPerSecond} t/s @ ${result.tensorFLOPS} GFLOPS on ${result.hardwareDevice}`);
    } else {
      addToast('error', 'Benchmark Failed', 'Could not run hardware benchmark.');
    }
  };

  const handleRegisterOnChain = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }
    const ramGb = hardware.deviceMemoryGB || 16;
    const tflops = benchmark ? Math.max(1, Math.round(benchmark.tensorFLOPS / 100)) : 4;
    addToast('info', 'On-Chain Registration', `Registering node operator on AiComputeRegistry (${CONTRACTS.aiComputeRegistry.slice(0, 8)}…)…`);
    const tx = await register(customTag, ramGb, tflops);
    if (tx) {
      addToast('success', 'Node Registered', `Successfully registered node! Tx: ${tx.slice(0, 10)}…`);
      setIsRegistering(false);
    }
  };

  const handleSettleSessionOnChain = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }
    addToast('info', 'Anchoring Session', `Submitting cryptographic telemetry witness to Creditcoin L1…`);
    const tx = await settle(sessionMinutes, qualityGrade);
    if (tx) {
      addToast('success', 'Proof Anchored', `Session settled on-chain! Tx: ${tx.slice(0, 10)}…`);
    }
  };

  const handleClaimOnChainRewards = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }
    if (unpaid <= 0 && virtualNodePoints < 50) {
      addToast('error', 'No Unclaimed Rewards', 'You do not have any pending on-chain reward units.');
      return;
    }
    addToast('info', 'Claiming Rewards', `Claiming on-chain CTC rewards from AiComputeRegistry…`);
    const tx = await claim();
    if (tx) {
      addToast('success', 'Rewards Claimed', `Successfully claimed on-chain CTC rewards! Tx: ${tx.slice(0, 10)}…`);
    }
  };

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;

  return (
    <div className="space-y-6">
      {/* Live Contract Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-xs backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10B981]" />
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Creditcoin Testnet DePIN / Virtual Node</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                AiComputeRegistry: {CONTRACTS.aiComputeRegistry.slice(0, 6)}...{CONTRACTS.aiComputeRegistry.slice(-4)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Real device hardware inspection, live RPC ping &amp; on-chain session proof anchoring.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {extDetected ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Extension v{extVersion} Active</span>
            </div>
          ) : (
            <button
              onClick={() => setExtensionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 font-medium text-xs transition cursor-pointer"
            >
              <Chrome className="w-3.5 h-3.5 text-cyan-400" />
              <span>Install Extension</span>
            </button>
          )}

          <button
            onClick={() => refreshCompute()}
            disabled={computeLoading}
            className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/60 hover:text-white transition cursor-pointer"
            title="Refresh On-Chain State"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computeLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Operator Wallet & Action Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 
              {isConnected ? `Operator: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Watch Mode (Demo Operator)'}
            </div>
            <div className="text-2xl font-black font-mono text-white flex items-center gap-2 mt-0.5">
              {userWalletCTC.toLocaleString()} <span className="text-sm text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-slate-400 font-mono font-normal">
                (${ (userWalletCTC * 2.0).toLocaleString(undefined, { minimumFractionDigits: 2 }) } USD)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleClaimOnChainRewards}
            disabled={busy === 'claim'}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {busy === 'claim'
                ? 'Claiming Tx…'
                : unpaid > 0
                ? `Claim On-Chain CTC (${unpaid} Units)`
                : `Claim Rewards (${(virtualNodePoints * 0.05).toFixed(1)} CTC)`}
            </span>
          </button>

          <button
            onClick={() => setExtensionModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Get Extension (ZIP)</span>
          </button>
        </div>
      </div>

      {/* Main Node Worker Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* State Controller Card */}
        <GlassCard className="lg:col-span-5 p-6 flex flex-col justify-between space-y-6 border-cyan-500/30">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Node Operator Status</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-2 ${
                  virtualNodeActive
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.05] border border-white/[0.08] text-slate-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${virtualNodeActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                {virtualNodeActive ? 'COMPUTING & RELAYING' : 'IDLE / READY'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-xs block">Edge Bandwidth &amp; Compute Points</span>
              <div className="text-3xl font-extrabold font-mono text-cyan-400 mt-1">
                {virtualNodePoints.toLocaleString()} <span className="text-xs text-slate-400 font-normal">PTS</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>+12.5 PTS every 3 seconds active session</span>
              </div>
            </div>

            {/* On-Chain Provider Details */}
            <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Registry Provider ID</span>
                <span className="text-white font-mono font-bold">
                  {provider ? `#${provider.providerId} (${provider.modelTag})` : 'Not Registered'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>On-Chain Sessions Settled</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {provider ? `${provider.sessionSeq} Sessions` : '0'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Unclaimed Reward Units</span>
                <span className="text-cyan-400 font-mono font-bold">{unpaid} Units</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Proof Generation</span>
                <span className="text-emerald-400 font-mono">Keccak256 Merkle Witness</span>
              </div>
            </div>

            {/* Registration Form if not registered */}
            {!provider && (
              <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/20 rounded-xl space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Register Node on Creditcoin L1</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Publish your hardware specs to AiComputeRegistry to accept verified compute tasks and earn CTC.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    placeholder="Node Tag"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleRegisterOnChain}
                    disabled={busy === 'register'}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'register' ? 'Registering…' : 'Register'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleVirtualNode}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
              virtualNodeActive
                ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 shadow-red-500/10'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25'
            }`}
          >
            {virtualNodeActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{virtualNodeActive ? 'Pause Edge Node Mining' : 'Start Virtual Node Session'}</span>
          </button>
        </GlassCard>

        {/* Real-time Hardware Profiling & Proof Settlement HUD */}
        <div className="lg:col-span-7 space-y-6">
          <GlassCard className="p-6 space-y-5 border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Device Hardware Profile</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runPingTest}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-slate-300 text-[10px] font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Radio className="w-3 h-3 text-emerald-400" />
                  <span>Ping RPC</span>
                </button>
                <button
                  onClick={handleRunBenchmark}
                  disabled={busy === 'benchmark'}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span>{busy === 'benchmark' ? 'Running…' : 'Run Benchmark'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">CPU Cores</span>
                <div className="text-base font-bold font-mono text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" /> {hardware.cpuCores} Threads
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">RAM Capacity</span>
                <div className="text-base font-bold font-mono text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" /> {hardware.deviceMemoryGB} GB
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">RPC Latency</span>
                <div className="text-base font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> {hardware.pingMs} ms
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">Inference Speed</span>
                <div className="text-base font-bold font-mono text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> {benchmark ? `${benchmark.tokensPerSecond} t/s` : 'Uncalibrated'}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
              <span className="text-[10px] uppercase text-slate-400 font-mono tracking-wider">Hardware Accelerated GPU Renderer</span>
              <div className="text-xs font-mono text-cyan-300 break-all">{hardware.gpuRenderer}</div>
            </div>

            {/* On-Chain Session Settle Panel */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-cyan-950/40 border border-cyan-500/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>On-Chain Telemetry Session Settlement</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Creditcoin Testnet</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Session Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Quality Tier (1-4)</label>
                  <select
                    value={qualityGrade}
                    onChange={(e) => setQualityGrade(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value={1}>Tier 1: Standard Edge (1.0x)</option>
                    <option value={2}>Tier 2: High Bandwidth (1.5x)</option>
                    <option value={3}>Tier 3: GPU Accelerated (2.0x)</option>
                    <option value={4}>Tier 4: Enterprise ZK Node (3.0x)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSettleSessionOnChain}
                disabled={busy === 'settle'}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{busy === 'settle' ? 'Settling Session on L1…' : 'Settle Session & Commit Merkle Proof'}</span>
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Live On-Chain Session Ledger Feed */}
      <GlassCard className="p-6 space-y-4 border-cyan-500/20">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live On-Chain DePIN Compute Ledger</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {ledger.length} Verified Sessions on Creditcoin L1
          </span>
        </div>

        {ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Session #</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Reward Units</th>
                  <th className="py-2.5 px-3">Witness Merkle Root</th>
                  <th className="py-2.5 px-3">Block Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledger.slice(0, 5).map((entry, idx) => (
                  <tr key={`${entry.operator}-${entry.sessionSeq}-${idx}`} className="hover:bg-white/[0.02] transition">
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">#{entry.sessionSeq}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {entry.operator ? `${entry.operator.slice(0, 6)}...${entry.operator.slice(-4)}` : 'Node Operator'}
                    </td>
                    <td className="py-2.5 px-3 text-white">{entry.sessionMinutes} mins</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">+{entry.rewardUnits} Units</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px] truncate max-w-[140px]" title={entry.merkleRoot}>
                      {entry.merkleRoot ? `${entry.merkleRoot.slice(0, 10)}...${entry.merkleRoot.slice(-6)}` : '0x00...'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                      {entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleTimeString() : 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">
            {computeLoading ? 'Loading verified sessions from Creditcoin L1…' : 'No compute sessions recorded yet. Settle your first session above!'}
          </div>
        )}
      </GlassCard>

      {/* Extension Modal */}
      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />
    </div>
  );
};

export default VirtualNodeTab;
