import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { useProtocol } from '../../context/ProtocolContext';
import { Shield, Sparkles, Award, CheckCircle, ExternalLink } from 'lucide-react';

interface SBTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SBTModal: React.FC<SBTModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const { score, sbtMinted, mintSBT } = useProtocol();
  const [loading, setLoading] = useState(false);

  const handleMint = () => {
    setLoading(true);
    mintSBT();
    const closeTimer = setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1200);
    return () => clearTimeout(closeTimer);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SBT Sovereign Identity Passport" maxWidth="max-w-md">
      <div className="space-y-4 text-xs text-white/80">
        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 overflow-hidden text-center group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/30 mb-3">
            <div className="w-full h-full bg-[#0d121f] rounded-2xl flex items-center justify-center text-cyan-400">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <div className="text-white font-bold text-base">CredX Sovereign Passport</div>
          <div className="text-cyan-400 font-mono text-xs mt-0.5">ERC-5192 Non-Transferable Soulbound</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono">
            <Award className="w-3 h-3" /> CTS Score: {score} &bull; Tier: Sovereign
          </div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
          <div className="text-white font-semibold text-xs">What the SBT Actually Proves</div>
          <div className="space-y-1.5 text-white/70 text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> "My address has CTS ≥ {score >= 780 ? 780 : score >= 650 ? 650 : score >= 500 ? 500 : 300}" — tier threshold only
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Canonical block of attestation (immune to re-orgs)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Privacy commitment hash — exact score never revealed on-chain
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Soulbound: non-transferable (transfers/approvals permanently disabled)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-medium transition"
          >
            Close
          </button>
          {!sbtMinted ? (
            <button
              onClick={handleMint}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? 'Minting SBT...' : 'Mint Soulbound NFT'}
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs text-center">
              Passport Active
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SBTModal;
