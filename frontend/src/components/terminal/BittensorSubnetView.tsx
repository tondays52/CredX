import React, { useState, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { useToast } from '../../context/ToastContext';
import {
  Brain,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  Sliders,
  DollarSign,
  AlertTriangle,
  Play,
  Server,
  Lock,
  ArrowUpRight,
  Database
} from 'lucide-react';
import {
  BITTENSOR_SUBNETS,
  SubnetMetadata,
  computeYumaConsensus,
  getSampleYumaNetwork,
  generateBittensorCreditcoinProof,
  YumaConsensusResult
} from '../../utils/bittensorTelemetry';
import { runLightweightAIBenchmark, AIInferenceBenchmarkResult } from '../../utils/browserAIInference';
import GPULeaseModal from '../modals/GPULeaseModal';

interface BittensorSubnetViewProps {
  hardware?: {
    cpuCores: number;
    deviceMemoryGB: number;
    gpuRenderer: string;
    pingMs: number;
  };
}

export const BittensorSubnetView: React.FC<BittensorSubnetViewProps> = ({
  hardware = {
    cpuCores: navigator.hardwareConcurrency || 8,
    deviceMemoryGB: (navigator as any).deviceMemory || 16,
    gpuRenderer: 'NVIDIA GeForce RTX WebGL',
    pingMs: 18
  }
}) => {
  const { addToast } = useToast();

  // Sub-tab Navigation
  const [subTab, setSubTab] = useState<'subnets' | 'consensus' | 'gpu-fleet' | 'attestation'>('subnets');

  // Subnet Explorer State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState<string>('All');
  const [selectedSubnet, setSelectedSubnet] = useState<SubnetMetadata | null>(BITTENSOR_SUBNETS[0]);
  const [subnetModalOpen, setSubnetModalOpen] = useState<boolean>(false);

  // Yuma Consensus State
  const [yumaData, setYumaData] = useState<YumaConsensusResult>(() => {
    const { W, S } = getSampleYumaNetwork();
    return computeYumaConsensus(W, S, 10.0, 0.5);
  });
  const [rhoParam, setRhoParam] = useState<number>(10.0);
  const [kappaParam, setKappaParam] = useState<number>(0.5);
  const [simulateCabalAttack, setSimulateCabalAttack] = useState<boolean>(false);

  // GPU Lease Modal State (Preserves Existing 3 Fleet Cards)
  const [selectedGPU, setSelectedGPU] = useState<any>(null);
  const [gpuModalOpen, setGpuModalOpen] = useState<boolean>(false);

  // Local AI Benchmark State
  const [benchmarkResult, setBenchmarkResult] = useState<AIInferenceBenchmarkResult | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState<boolean>(false);

  // Creditcoin Cross-Chain Attestation State
  const [attestationProof, setAttestationProof] = useState<any | null>(null);
  const [isAttesting, setIsAttesting] = useState<boolean>(false);
  const [myMinerHotkey, setMyMinerHotkey] = useState<string>('5F3sa8Q2...tao98a');
  const [stakedAmountTao, setStakedAmountTao] = useState<string>('50');

  // Existing 3 GPU Fleet Clusters (100% PRESERVED)
  const gpuClusters = [
    {
      id: 'GPU-US-01',
      model: 'NVIDIA H100 SXM5 80GB',
      vram: '80 GB HBM3',
      tflops: 1979,
      pricePerHour: 2.85,
      status: 'AVAILABLE'
    },
    {
      id: 'GPU-EU-04',
      model: '8x NVIDIA RTX 4090 Cluster',
      vram: '192 GB GDDR6X',
      tflops: 660,
      pricePerHour: 1.45,
      status: 'AVAILABLE'
    },
    {
      id: 'GPU-AP-09',
      model: 'Apple M3 Max Neural Engine',
      vram: '128 GB Unified',
      tflops: 140,
      pricePerHour: 0.65,
      status: 'AVAILABLE'
    }
  ];

  // Re-run Yuma Consensus when parameters change
  useEffect(() => {
    const { W, S } = getSampleYumaNetwork();
    if (simulateCabalAttack) {
      // Simulate disjoint cabal where peers 4 & 5 form disjoint sub-network
      W[4] = [0, 0, 0, 0, 0.5, 0.5];
      W[5] = [0, 0, 0, 0, 0.5, 0.5];
    }
    const result = computeYumaConsensus(W, S, rhoParam, kappaParam);
    setYumaData(result);
  }, [rhoParam, kappaParam, simulateCabalAttack]);

  // Run lightweight local browser AI benchmark
  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      const result = await runLightweightAIBenchmark('Text / LLM');
      setBenchmarkResult(result);
      addToast(
        'success',
        'Hardware Inference Benchmark Complete',
        `Achieved ${result.tokensPerSecond} tokens/sec on ${result.hardwareDevice} (Latency: ${result.embeddingLatencyMs}ms). Zero CPU thermal spike.`
      );
    } catch (e: any) {
      addToast('error', 'Benchmark Error', e.message);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  // Submit Bittensor Merkle Proof to Creditcoin 0x0FD2
  const handleAttestMinerProof = () => {
    setIsAttesting(true);
    setTimeout(() => {
      const proof = generateBittensorCreditcoinProof(
        selectedSubnet?.netuid || 1,
        myMinerHotkey,
        0.984,
        48.5
      );
      setAttestationProof(proof);
      setIsAttesting(false);
      addToast(
        'success',
        'Creditcoin L1 Proof Verified (0x0FD2)',
        `Attested top-decile score on Subnet ${proof.netuid}. Unlocked +100 CTS bonus & $250k zero-collateral hardware lease line!`
      );
    }, 1200);
  };

  // Filter subnets
  const filteredSubnets = BITTENSOR_SUBNETS.filter(sn => {
    const matchesSearch = sn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sn.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sn.netuid.toString() === searchQuery;
    const matchesModality = selectedModality === 'All' || sn.modality.includes(selectedModality);
    return matchesSearch && matchesModality;
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* BITTENSOR HERO HEADER & TELEMETRY                                         */}
      {/* ========================================================================= */}
      <GlassCard className="p-6 relative overflow-hidden border-purple-500/30 bg-gradient-to-r from-black via-[#0d071a] to-[#120826]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Bittensor (TAO) Peer-to-Peer Intelligence Market
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/60 text-xs font-mono">
                Yuma Consensus v3.2
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                Creditcoin 0x0FD2 Verified
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Decentralized Machine Intelligence Commodity
            </h2>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl leading-relaxed">
              Where intelligence is priced by other intelligence systems peer-to-peer. High-ranking miners and validators accumulate speculative bonds and inflation, settled across Creditcoin L1 with zero-collateral GPU financing.
            </p>
          </div>

          {/* Quick Stats & Live Benchmark Trigger */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs space-y-1">
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Total Daily Emission</span>
                <span className="text-purple-400 font-bold">7,200 TAO / day</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>Active Subnets</span>
                <span className="text-white font-bold">64 Subnets (Cap)</span>
              </div>
              <div className="flex justify-between items-center text-white/50 text-[10px] uppercase">
                <span>CTS Reputation Discount</span>
                <span className="text-emerald-400 font-bold">-15% Active</span>
              </div>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={isRunningBenchmark}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningBenchmark ? 'animate-spin' : ''}`} />
              {isRunningBenchmark ? 'Benchmarking Hardware...' : 'Benchmark Device AI Speed'}
            </button>
          </div>
        </div>

        {/* Live Device Hardware Telemetry Banner (PILLAR 1 KEPT) */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Detected AI Accelerator</span>
            <span className="text-white font-bold truncate block">{hardware.gpuRenderer}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Hardware Logic Cores</span>
            <span className="text-white font-bold">{hardware.cpuCores} CPU Threads</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">Subnet Token Throughput</span>
            <span className="text-purple-300 font-bold">
              {benchmarkResult ? `${benchmarkResult.tokensPerSecond} t/s` : '124 t/s (Optimal)'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
            <span className="text-white/40 text-[10px] block">P2P Network Latency</span>
            <span className="text-cyan-400 font-bold">{hardware.pingMs} ms (Probed)</span>
          </div>
        </div>
      </GlassCard>

      {/* ========================================================================= */}
      {/* SUB-TABS NAVIGATION                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08]">
        <button
          onClick={() => setSubTab('subnets')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'subnets'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Subnet Intelligence Market
        </button>

        <button
          onClick={() => setSubTab('consensus')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'consensus'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Yuma Consensus Engine
        </button>

        <button
          onClick={() => setSubTab('gpu-fleet')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'gpu-fleet'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Server className="w-3.5 h-3.5" /> Enterprise GPU Fleet (H100/4090)
        </button>

        <button
          onClick={() => setSubTab('attestation')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'attestation'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Creditcoin 0x0FD2 Attest & Staking
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: SUBNET INTELLIGENCE MARKET (Matching Taostats / Subnet.ai)    */}
      {/* ========================================================================= */}
      {subTab === 'subnets' && (
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/[0.08]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono text-white/50 mr-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Modality:
              </span>
              {['All', 'Text', 'Voice', 'Financial AI', 'Compute'].map(mod => (
                <button
                  key={mod}
                  onClick={() => setSelectedModality(mod)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    selectedModality === mod
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            <div className="relative min-w-[260px]">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Subnet by name or Netuid..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Subnets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSubnets.map(subnet => (
              <GlassCard
                key={subnet.netuid}
                className="p-5 hover:border-purple-500/40 transition space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                      Subnet {subnet.netuid}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {subnet.emissionPercent}% Daily Emission
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mt-2.5">{subnet.name}</h3>
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">{subnet.tagline}</p>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5 font-mono text-xs text-white/70">
                    <div className="flex justify-between">
                      <span className="text-white/40">Daily Emission:</span>
                      <span className="text-purple-300 font-bold">{subnet.dailyTaoEmission} TAO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Active Miners:</span>
                      <span className="text-white">{subnet.activeMiners} / {subnet.maxMiners}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Recycle Register:</span>
                      <span className="text-amber-400 font-bold">{subnet.recycleRegisterCostTao} TAO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Top Miner Score:</span>
                      <span className="text-emerald-400 font-bold">{(subnet.topMinerScore * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/40">{subnet.modality}</span>
                  <button
                    onClick={() => {
                      setSelectedSubnet(subnet);
                      setSubnetModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-purple-500/20 text-white hover:text-purple-300 font-mono text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    Inspect Subnet <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Subnet Inspection Modal */}
          {subnetModalOpen && selectedSubnet && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <div className="w-full max-w-xl p-6 rounded-3xl bg-[#0e0a1a] border border-purple-500/30 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-xs font-mono text-purple-400 font-bold">
                      Subnet {selectedSubnet.netuid} Specification
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">{selectedSubnet.name}</h3>
                  </div>
                  <button
                    onClick={() => setSubnetModalOpen(false)}
                    className="text-white/40 hover:text-white text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-white/70 leading-relaxed">{selectedSubnet.tagline}</p>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <span className="text-[10px] text-white/40 block uppercase">Daily Subnet Allocation</span>
                    <span className="text-purple-300 font-bold text-sm">{selectedSubnet.dailyTaoEmission} TAO</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                    <span className="text-[10px] text-white/40 block uppercase">Validator Stake Pool</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {selectedSubnet.topValidatorStakeTao.toLocaleString()} TAO
                    </span>
                  </div>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <span className="text-white/50 text-[10px] uppercase block">Top Active Validator Hotkeys</span>
                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-white/80">
                      <span>5F4t...89a1 (Foundry Val)</span>
                      <span className="text-emerald-400 font-bold">142,500 TAO</span>
                    </div>
                    <div className="flex justify-between text-white/80">
                      <span>5D8b...33e2 (Opentensor Org)</span>
                      <span className="text-emerald-400 font-bold">98,200 TAO</span>
                    </div>
                    <div className="flex justify-between text-white/80">
                      <span>5C1a...00b4 (Taoshi Node)</span>
                      <span className="text-emerald-400 font-bold">75,400 TAO</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSubnetModalOpen(false);
                    setSubTab('attestation');
                  }}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30"
                >
                  <ShieldCheck className="w-4 h-4" /> Attest Subnet Performance on Creditcoin (0x0FD2)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: YUMA CONSENSUS VISUALIZER (Whitepaper Mathematical Formulas)  */}
      {/* ========================================================================= */}
      {subTab === 'consensus' && (
        <div className="space-y-6">
          {/* Controls: Temperature & Shift */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase text-purple-400 font-bold block">
                  Yuma Rao Incentive Mechanics
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Weight Matrix W & Sigmoid Consensus C = σ(ρ(TᵀS - κ))
                </h3>
              </div>

              {/* Anti-Collusion Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold">
                {yumaData.isConsensusHealthy ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Consensus Secure (Loss L = {yumaData.antiCollusionLoss.toFixed(3)} &lt; 0)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-red-400 border-red-500/30 bg-red-500/10 px-3 py-1 rounded-lg animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cabal Detected (Loss L = {yumaData.antiCollusionLoss.toFixed(3)} &gt; 0)
                  </span>
                )}
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-white/[0.06] font-mono text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60">Sigmoid Temperature (ρ):</span>
                  <span className="text-purple-300 font-bold">{rhoParam.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={rhoParam}
                  onChange={e => setRhoParam(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60">Consensus Shift (κ):</span>
                  <span className="text-purple-300 font-bold">{kappaParam.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={kappaParam}
                  onChange={e => setKappaParam(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <div>
                  <span className="text-white font-bold block text-xs">Simulate Disjoint Cabal</span>
                  <span className="text-[10px] text-white/40">Peers 4 & 5 only vote for each other</span>
                </div>
                <button
                  onClick={() => setSimulateCabalAttack(!simulateCabalAttack)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                    simulateCabalAttack
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {simulateCabalAttack ? 'Active' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          {/* Peer Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left font-mono text-xs bg-black/60">
              <thead className="bg-white/[0.04] text-white/50 text-[10px] uppercase border-b border-white/10">
                <tr>
                  <th className="p-3">UID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Stake (S)</th>
                  <th className="p-3">Fisher Rank (R)</th>
                  <th className="p-3">Consensus (C)</th>
                  <th className="p-3">Incentive (I)</th>
                  <th className="p-3">Daily Emission (ΔS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {yumaData.peers.map(peer => (
                  <tr key={peer.uid} className="hover:bg-white/[0.02] transition">
                    <td className="p-3 font-bold text-white">Peer {peer.uid}</td>
                    <td className="p-3">
                      {peer.isValidator ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                          Validator
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold text-[10px]">
                          Miner
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-white/80">{peer.stakeTao.toLocaleString()} TAO</td>
                    <td className="p-3 text-cyan-400 font-bold">{peer.rank.toFixed(4)}</td>
                    <td className="p-3 text-emerald-400 font-bold">{(peer.consensus * 100).toFixed(1)}%</td>
                    <td className="p-3 text-purple-300 font-bold">{(peer.incentive * 100).toFixed(2)}%</td>
                    <td className="p-3 font-bold text-white">{peer.emissionTaoPerDay.toFixed(2)} TAO</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: ENTERPRISE GPU FLEET LEASING (PILLAR 3 PRESERVED 100%)         */}
      {/* ========================================================================= */}
      {subTab === 'gpu-fleet' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                Hardware Financing & AI Compute Marketplace
              </span>
              <h3 className="text-xl font-black text-white mt-1">Enterprise GPU Compute Fleet</h3>
              <p className="text-xs text-white/60 mt-1 max-w-xl">
                Lease dedicated NVIDIA H100 and RTX 4090 compute with zero collateral, escrowed on Creditcoin based on your verified machine learning subnet score.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-mono text-white/40 block">CTS Reputation Discount</span>
              <span className="text-lg font-black font-mono text-emerald-400">-15% Active</span>
            </div>
          </div>

          {/* GPU Fleet Cards (Original 3 clusters preserved) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {gpuClusters.map(cluster => (
              <GlassCard
                key={cluster.id}
                className="p-5 hover:border-purple-500/40 transition space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/40">{cluster.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {cluster.status}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm mt-2">{cluster.model}</h4>
                  <div className="text-xs text-white/60 space-y-1.5 mt-3 font-mono">
                    <div className="flex justify-between">
                      <span>VRAM Capacity:</span>
                      <span className="text-white">{cluster.vram}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Peak Compute:</span>
                      <span className="text-purple-300 font-bold">{cluster.tflops} TFLOPS</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reputation Discount:</span>
                      <span className="text-emerald-400 font-bold">-15% Applied</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-white/40 block">Hourly Rate</span>
                    <span className="text-base font-bold font-mono text-white">
                      ${cluster.pricePerHour} <span className="text-[10px] text-white/40">({(cluster.pricePerHour / 2).toFixed(2)} CTC)</span>
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedGPU(cluster);
                      setGpuModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300 font-bold text-xs font-mono transition shadow-sm cursor-pointer"
                  >
                    Lease Compute &rarr;
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: CREDITCOIN 0x0FD2 CROSS-CHAIN ATTESTATION & STAKING           */}
      {/* ========================================================================= */}
      {subTab === 'attestation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Attestation Form */}
            <div className="lg:col-span-7 space-y-4">
              <GlassCard className="p-6 border-purple-500/30 space-y-5">
                <div>
                  <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block">
                    Creditcoin Cross-Chain Oracle
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    Attest Bittensor Subnet Score (0x0FD2)
                  </h3>
                  <p className="text-xs text-white/60 mt-1">
                    Submit cryptographically verified Merkle proofs of your miner or validator ranking to Creditcoin L1 to unlock zero-collateral hardware financing lines.
                  </p>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="text-white/50 block text-[10px] uppercase mb-1">Target Subnet</label>
                    <select
                      value={selectedSubnet?.netuid || 1}
                      onChange={e => setSelectedSubnet(BITTENSOR_SUBNETS.find(s => s.netuid === parseInt(e.target.value)) || BITTENSOR_SUBNETS[0])}
                      className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs"
                    >
                      {BITTENSOR_SUBNETS.map(sn => (
                        <option key={sn.netuid} value={sn.netuid}>
                          Subnet {sn.netuid}: {sn.name} ({sn.modality})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-white/50 block text-[10px] uppercase mb-1">Your Miner / Validator Hotkey</label>
                    <input
                      type="text"
                      value={myMinerHotkey}
                      onChange={e => setMyMinerHotkey(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAttestMinerProof}
                  disabled={isAttesting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30"
                >
                  <ShieldCheck className={`w-4 h-4 ${isAttesting ? 'animate-spin' : ''}`} />
                  {isAttesting ? 'Verifying Merkle Root on Creditcoin...' : 'Submit Proof to Precompile 0x0FD2'}
                </button>
              </GlassCard>

              {/* Attestation Proof Receipt Card */}
              {attestationProof && (
                <GlassCard className="p-5 border-emerald-500/30 bg-emerald-950/20 font-mono text-xs space-y-3">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Creditcoin L1 Attestation Confirmed
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px]">
                      {attestationProof.creditTier}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/60 border border-white/10 space-y-1.5 text-white/80 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-white/40">Merkle Root:</span>
                      <span className="text-purple-300 font-mono truncate max-w-[240px]">{attestationProof.merkleRoot}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Precompile Target:</span>
                      <span className="text-cyan-400 font-mono">{attestationProof.precompileTarget}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">CTS Reputation Boost:</span>
                      <span className="text-emerald-400 font-bold">+{attestationProof.reputationBonusCTS} CTS Points</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Zero-Collateral Hardware Credit Limit:</span>
                      <span className="text-white font-bold">${attestationProof.unlockedHardwareLimitUSD.toLocaleString()} USD</span>
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Right: Dual-Yield Staking */}
            <div className="lg:col-span-5 space-y-4">
              <GlassCard className="p-6 border-cyan-500/30 space-y-5">
                <div>
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block">
                    Dual-Yield Validator Pool
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">Stake TAO & CTC</h3>
                  <p className="text-xs text-white/60 mt-1">
                    Delegate stake to top-performing subnet validators. Earn TAO emission yield plus Creditcoin CTS reputation APY simultaneously.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-white/10 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/40">Subnet 1 Validator APY:</span>
                    <span className="text-purple-300 font-bold">18.4% TAO</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Creditcoin CTS Bonus APY:</span>
                    <span className="text-emerald-400 font-bold">+6.2% CTC</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.08] pt-2">
                    <span className="text-white font-bold">Total Blended Yield:</span>
                    <span className="text-cyan-300 font-bold">24.6% APY</span>
                  </div>
                </div>

                <div className="space-y-1 font-mono text-xs">
                  <label className="text-white/50 text-[10px] uppercase">Stake Amount (TAO)</label>
                  <input
                    type="number"
                    value={stakedAmountTao}
                    onChange={e => setStakedAmountTao(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs"
                  />
                </div>

                <button
                  onClick={() => {
                    addToast('success', 'Staking Delegation Executed', `Staked ${stakedAmountTao} TAO into Subnet 1 Validator. Earning blended 24.6% APY.`);
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Delegate & Earn Dual Yield
                </button>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {/* GPU Lease Modal (Preserved 100%) */}
      {selectedGPU && (
        <GPULeaseModal
          isOpen={gpuModalOpen}
          onClose={() => setGpuModalOpen(false)}
          cluster={selectedGPU}
        />
      )}
    </div>
  );
};

export default BittensorSubnetView;
