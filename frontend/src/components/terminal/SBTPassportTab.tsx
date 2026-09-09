import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Shield,
  Award,
  Sparkles,
  CheckCircle2,
  Lock,
  ExternalLink,
  QrCode,
  Coins,
  DollarSign,
  UserCheck,
  Fingerprint,
  FileBadge
} from 'lucide-react';
import SBTModal from '../modals/SBTModal';

const SBTPassportTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score, tier, sbtMinted } = useProtocol();
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  return (
    <div className="space-y-6">
      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 border border-indigo-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-indigo-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Soulbound Identity Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-indigo-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">ERC-5192 Status</span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {sbtMinted ? 'Minted #4928-SBT' : 'Eligible for Minting'}
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {sbtMinted ? 'View Passport Details' : 'Mint Soulbound NFT'}
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-indigo-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
              <Fingerprint className="w-3.5 h-3.5" /> Soulbound Identity Credential &bull; ERC-5192
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Cryptographic Sybil-Proof Credit Passport on Creditcoin L1
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Non-transferable on-chain KYC passport bound permanently to your address. Encapsulates cross-chain loan repayment history, edge node uptime, and zero-knowledge uniqueness proofs.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Reputation Score</span>
                <span className="text-base font-bold font-mono text-emerald-400">{score} / 1000 CTS</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Credit Rank</span>
                <span className="text-base font-bold font-mono text-indigo-300">{tier} Tier</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">ZK Attestations</span>
                <span className="text-base font-bold font-mono text-white">4 Verified Badges</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-indigo-500/30 shadow-2xl shadow-indigo-500/20 group">
              <img
                src="/images/sbt-passport.jpg"
                alt="3D Soulbound Identity Passport Shield and Biometric Matrix"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-indigo-500/30 text-indigo-300">
                  🔒 Locked to {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x9afB...8f07'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  Non-Transferable
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Holographic Passport Card & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Holographic Card Render */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-sm aspect-[1.58/1] rounded-2xl p-6 bg-gradient-to-br from-cyan-950/80 via-slate-900 to-indigo-950/90 border border-cyan-500/40 shadow-2xl shadow-cyan-500/20 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -right-12 -bottom-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="font-bold text-white tracking-wider text-xs">CREDX PASSPORT</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                SOVEREIGN
              </span>
            </div>

            <div className="my-2 relative z-10">
              <div className="text-[10px] uppercase font-mono text-white/40 tracking-wider">CTS Credit Score</div>
              <div className="text-3xl font-black font-mono text-white tracking-tight flex items-center gap-2">
                {score} <span className="text-xs text-emerald-400 font-normal">/ 1000 (Top 2.4%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-white/60 relative z-10 pt-2 border-t border-white/[0.08]">
              <div>
                <span className="text-[9px] text-white/40 block">TOKEN ID</span>
                <span className="text-white font-semibold">#4928-SBT</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-white/40 block">CHAIN</span>
                <span className="text-cyan-400">CREDITCOIN L1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Passport Status & Attestations */}
        <GlassCard className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Soulbound Attestations Matrix</h3>
              <p className="text-xs text-white/40 mt-0.5">Cryptographically signed credentials bound to this address</p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {sbtMinted ? 'View Passport Details' : 'Mint Soulbound NFT'}
            </button>
          </div>

          <div className="space-y-2.5 pt-2 text-xs">
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-white font-medium">DeFi Reputational Solvency</div>
                  <div className="text-[10px] text-white/40">38 settled loans across Aave & CredX without liquidation</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">ATTESTED</span>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-white font-medium">Verified Edge Telemetry Worker</div>
                  <div className="text-[10px] text-white/40">Hardware Concurrency & Edge WebSocket Latency (38ms)</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">ATTESTED</span>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-white font-medium">Zero-Knowledge Sybil Defense</div>
                  <div className="text-[10px] text-white/40">ZK-SNARK proof of unique human biometric signature</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">ATTESTED</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Modal */}
      <SBTModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default SBTPassportTab;
