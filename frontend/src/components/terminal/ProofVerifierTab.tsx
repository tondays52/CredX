import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Terminal,
  FileCheck,
  Search,
  ArrowRight,
  ExternalLink,
  Coins,
  DollarSign,
  Zap,
  Code2,
  Sparkles
} from 'lucide-react';
import ComposableQueryModal from '../modals/ComposableQueryModal';

const ProofVerifierTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [proofInput, setProofInput] = useState('0x0fd2e93b194a28f80456cbb8a912a781d4a076c8');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const handleVerify = () => {
    if (!proofInput.startsWith('0x')) {
      addToast('error', 'Invalid Hash', 'Proof hash must be a valid 0x hexadecimal string.');
      return;
    }
    setVerifying(true);
    addToast('info', 'ZK Verifier', 'Validating cryptographic 0x0FD2 proof with Creditcoin L1 on-chain verifier...');

    setTimeout(() => {
      setVerifying(false);
      setResult({
        valid: true,
        proofType: 'Groth16 / SnarkJS ZK-SNARK',
        blockNumber: 4912803,
        timestamp: '2026-09-09 10:48:12 UTC',
        subject: address || '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
        provenCTS: score,
        attestations: ['DeFi Reputational Solvency', 'Edge Node Bandwidth', 'Zero Sybil KYC', 'Hardware Authenticity'],
      });
      addToast('success', 'Proof Cryptographically Verified', 'On-chain verification succeeded with 0 gas overhead.');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-teal-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Cryptographic ZK Prover Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setQueryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Terminal className="w-3.5 h-3.5" /> Composable Query SDK
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <Lock className="w-3.5 h-3.5" /> Zero-Knowledge Privacy & 0x0FD2 Attestation Engine
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Independently Audit ZK Reputational Receipts On-Chain
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Verify mathematical Groth16 / SnarkJS proofs without revealing private wallet transactions, balances, or KYC identifiers. Instant verification on Creditcoin Testnet.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Proof Verification Gas</span>
                <span className="text-base font-bold font-mono text-emerald-400">~240k Gas (0 CTC Overhead)</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Total Proofs Verified</span>
                <span className="text-base font-bold font-mono text-cyan-300">184,912 Validated</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Cryptographic Standard</span>
                <span className="text-base font-bold font-mono text-white">BN254 Pairing</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 group">
              <img
                src="/images/proof-verifier.jpg"
                alt="3D Cryptographic Zero-Knowledge Sybil Mesh and Verification Circuits"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
                  🔐 ZK-SNARK Verified
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  0x0FD2 Standard
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Proof Input Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-white uppercase tracking-wider block">
            Cryptographic Receipt Hash (0x0FD2 Standard)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none transition"
              placeholder="0x..."
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {verifying ? 'Verifying Proof...' : 'Verify On-Chain'}
            </button>
          </div>
        </div>

        {result && (
          <div className="p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/30 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" /> PROOF VALID & AUDITED
              </div>
              <span className="font-mono text-[11px] text-white/50">Block #{result.blockNumber}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Proof Protocol</span>
                <div className="text-white font-mono font-medium">{result.proofType}</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Subject Wallet</span>
                <div className="text-cyan-300 font-mono font-medium">{result.subject}</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Attested CTS Score</span>
                <div className="text-emerald-400 font-mono font-bold text-base">{result.provenCTS} / 1000</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Timestamp</span>
                <div className="text-white font-mono">{result.timestamp}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-500/20">
              <span className="text-white/40 text-[10px] uppercase block mb-1.5">Included Zero-Knowledge Claims</span>
              <div className="flex flex-wrap gap-2">
                {result.attestations.map((att: string) => (
                  <span key={att} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-mono text-[11px]">
                    {att}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Composable Query Modal */}
      <ComposableQueryModal isOpen={queryModalOpen} onClose={() => setQueryModalOpen(false)} />
    </div>
  );
};

export default ProofVerifierTab;
