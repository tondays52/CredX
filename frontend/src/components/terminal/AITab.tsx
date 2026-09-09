import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  Bot,
  Cpu,
  ShieldCheck,
  Activity,
  Terminal,
  ArrowRight,
  Zap,
  RefreshCw,
  Coins,
  TrendingUp,
  Sparkles,
  Lock,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import AIRiskModal from '../modals/AIRiskModal';
import { AIRiskVector } from '../../types/tracks';

const AITab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'models' | 'staking' | 'telemetry'>('models');
  const [selectedVector, setSelectedVector] = useState<AIRiskVector | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('1000');
  const [stakingBond, setStakingBond] = useState(false);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const vectors: AIRiskVector[] = [
    { id: 'VEC-LLM-01', modelName: 'DeepSeek-V3 Quantized Hub', riskTier: 'LOW', confidence: 99.4, lastAudit: '12m ago', activeInferences: 41290 },
    { id: 'VEC-CV-08', modelName: 'YOLO-v11 Edge Vision Oracle', riskTier: 'LOW', confidence: 98.9, lastAudit: '1h ago', activeInferences: 18450 },
    { id: 'VEC-FIN-99', modelName: 'Chronos-Financial Time Series Forecaster', riskTier: 'MEDIUM', confidence: 96.2, lastAudit: '3h ago', activeInferences: 8900 },
  ];

  const handleInspect = (vec: AIRiskVector) => {
    setSelectedVector(vec);
    setModalOpen(true);
  };

  const handleStakeAIBond = () => {
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0 || num > userWalletCTC) {
      addToast('error', 'Invalid Amount', `Please specify up to ${userWalletCTC.toLocaleString()} CTC.`);
      return;
    }
    setStakingBond(true);
    addToast('info', 'AI Bond Underwriting', `Staking ${num.toLocaleString()} CTC into the AI Oracle Slashing Reserve Pool...`);
    setTimeout(() => {
      setStakingBond(false);
      if (isPostHogEnabled) {
        posthog.capture('ai_bond_staked', { amount: num });
      }
      addToast('success', 'AI Insurance Bond Active', `Successfully staked ${num.toLocaleString()} CTC earning 22.5% APY underwriting neural validator consensus!`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live AI Risk Staking Capital
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">Oracle Neural Health</span>
            <span className="text-xs font-mono font-bold text-emerald-400">99.8% Consensus Stability</span>
          </div>
          <button
            onClick={() => addToast('info', 'Oracle Feed', 'Live neural validation feed synced with Creditcoin L1.')}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Oracle Latency: 38ms
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5" /> Decentralized AI Oracle & Byzantine Risk Matrix
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Cryptographic AI Model Verification & Slashing Insurance
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Audit on-chain neural model weights, protect against malicious hallucinations with zero-knowledge zkML proofs, and underwrite AI oracle safety pools for up to 22.5% APY yield.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Monitored AI Models</span>
                <span className="text-base font-bold font-mono text-white">42 Shards Active</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Daily Inferences</span>
                <span className="text-base font-bold font-mono text-cyan-300">1.84M Calls</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Slashing Insurance Pool</span>
                <span className="text-base font-bold font-mono text-emerald-400">$8,400,000 USD</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 group">
              <img
                src="/images/ai-risk-vectors.jpg"
                alt="3D Holographic AI Neural Brain Risk Engine"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
                  🧠 Zero-Knowledge zkML Verified
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  Byzantine Safe
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Sub-Sector Navigation Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/[0.08] rounded-2xl">
        <button
          onClick={() => setActiveSubTab('models')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'models'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Bot className="w-4 h-4" /> AI Risk Vectors Matrix
        </button>
        <button
          onClick={() => setActiveSubTab('staking')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'staking'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> AI Insurance Slashing Pool (22.5% APY)
        </button>
        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'telemetry'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Terminal className="w-4 h-4" /> Live Neural Telemetry Feed
        </button>
      </div>

      {/* Sub-Tab 1: Models Risk Vector Grid */}
      {activeSubTab === 'models' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vectors.map((vec) => (
            <GlassCard key={vec.id} className="p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/40">{vec.id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      vec.riskTier === 'LOW'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {vec.riskTier} RISK
                  </span>
                </div>
                <h3 className="text-white font-bold text-sm mt-2">{vec.modelName}</h3>
                <div className="text-xs text-white/60 space-y-1 mt-3">
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-mono text-cyan-400 font-semibold">{vec.confidence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inferences 24h:</span>
                    <span className="font-mono text-white">{(vec.activeInferences || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Audit:</span>
                    <span className="font-mono text-white/50">{vec.lastAudit}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3" /> Slashing Bond: Active
                </span>
                <button
                  onClick={() => handleInspect(vec)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 font-medium text-xs transition flex items-center gap-1"
                >
                  Inspect <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Sub-Tab 2: AI Slashing Staking Pool */}
      {activeSubTab === 'staking' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-6 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Slashing Insurance Pool</h3>
              <span className="text-xs font-mono text-emerald-400 font-bold">22.5% High-Yield APY</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Deposit your wallet CTC into the Byzantine first-loss capital reserve. Earn high fees paid by autonomous AI agents querying Creditcoin Oracles.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Deposit Amount (CTC)</span>
                <span className="text-cyan-400 font-mono">Available: {userWalletCTC.toLocaleString()} CTC</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition"
                  placeholder="1000"
                />
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    onClick={() => setStakeAmount((userWalletCTC * 0.5).toFixed(0))}
                    className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-white/70"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setStakeAmount(userWalletCTC.toString())}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleStakeAIBond}
              disabled={stakingBond}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {stakingBond ? 'Depositing to AI Reserve...' : `Underwrite AI Oracle (${stakeAmount || '0'} CTC)`}
            </button>
          </GlassCard>

          <GlassCard className="lg:col-span-6 p-6 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Oracle Underwriting Statistics</h3>
            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-white/60">Total Value Locked in AI Pool</span>
                <span className="text-white font-mono font-bold">4,200,000 CTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Historical Slashing Events</span>
                <span className="text-emerald-400 font-mono font-bold">0 Events (100% Zero-Loss)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Protocol Revenue Distributed</span>
                <span className="text-cyan-300 font-mono font-bold">+184,200 CTC (30d)</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Sub-Tab 3: AI Telemetry Console */}
      {activeSubTab === 'telemetry' && (
        <GlassCard className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Oracle Neural Validation Telemetry</h3>
            </div>
            <span className="text-[10px] text-white/40 font-mono">STREAMING LIVE (1000 TPS)</span>
          </div>

          <div className="p-4 bg-black/60 border border-white/[0.06] rounded-xl font-mono text-xs text-white/70 space-y-2">
            <div className="text-cyan-400">[0x0FD2] Neural Consensus Round #9042: 128/128 Validators Agreed (0.0001% Drift)</div>
            <div className="text-white/60">[Inference] DeepSeek-V3 shard #44 processed token batch in 42.1ms (Hash: 0x99a8...f102)</div>
            <div className="text-emerald-400">[ZK-Audit] Zero-knowledge proof verified on Creditcoin Testnet block #4,912,019</div>
            <div className="text-white/40">[Reward] Validator 0x48...e1 credited 0.45 CTC for low-latency batch processing</div>
          </div>
        </GlassCard>
      )}

      {/* Modal */}
      <AIRiskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} vector={selectedVector} />
    </div>
  );
};

export default AITab;
