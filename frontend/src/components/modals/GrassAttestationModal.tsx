import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Wifi, ShieldCheck, CheckCircle, Cpu, ArrowRight, Sparkles, Database } from 'lucide-react';
import { useProtocol } from '../../context/ProtocolContext';

interface GrassAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GrassAttestationModal: React.FC<GrassAttestationModalProps> = ({ isOpen, onClose }) => {
  const { grassNetworkQuality, grassEpoch, grassTotalBandwidthGB, grassUptimePoints, grassNetworkPoints, syncGrassAttestation } = useProtocol();
  const [attesting, setAttesting] = useState(false);
  const [step, setStep] = useState<number>(0);

  const handleVerifyOnCreditcoin = async () => {
    setAttesting(true);
    setStep(1);

    setTimeout(() => setStep(2), 600);
    setTimeout(() => setStep(3), 1200);
    setTimeout(async () => {
      setStep(4);
      await syncGrassAttestation();
      setAttesting(false);
      setTimeout(() => {
        onClose();
        setStep(0);
      }, 1000);
    }, 1800);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Grass.io Bandwidth Attestation"
      subtitle="Creditcoin Attestcoin Protocol (USC Precompile 0x0FD2) — local simulation, no wallet tx"
      maxWidth="max-w-xl"
      icon={<div className="w-8 h-8 rounded-xl bg-[#ABF600]/20 border border-[#ABF600]/40 flex items-center justify-center text-[#ABF600] font-bold"><Wifi className="w-4 h-4" /></div>}
    >
      <div className="space-y-5">
        {/* Banner with Grass signature Electric Lime */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#ABF600]/10 via-[#0B0F17] to-emerald-950/20 border border-[#ABF600]/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ABF600] animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#ABF600] font-bold">
                Grass Epoch {grassEpoch} Telemetry Ready
              </span>
            </div>
            <p className="text-xs text-white/70">
              Transform verified residential bandwidth and uptime into on-chain credit reputation on Creditcoin.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Estimated CTS Boost</span>
            <span className="text-lg font-black font-mono text-[#ABF600]">+35 Points</span>
          </div>
        </div>

        {/* Cryptographic Attestation Metadata */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-cyan-400" /> Source Data Layer</span>
            <span className="text-white font-bold">Grass L2 Settlement (Solana / EVM)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-[#ABF600]" /> Creditcoin Precompile</span>
            <span className="text-[#ABF600] font-bold">0x0FD2 (Attestcoin USC)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span>Verified Residential Bandwidth</span>
            <span className="text-cyan-300 font-bold">{grassTotalBandwidthGB} GB</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span>Network Quality Index</span>
            <span className="text-emerald-400 font-bold">{grassNetworkQuality}% (Zero Proxy / Direct Fiber)</span>
          </div>
          <div className="flex items-center justify-between text-white/60">
            <span>Accumulated Grass Points</span>
            <span className="text-white font-bold">{(grassUptimePoints + grassNetworkPoints).toLocaleString()} pts</span>
          </div>
        </div>

        {/* Multi-Step Proof Verification Pipeline */}
        {attesting && (
          <div className="p-4 rounded-2xl bg-[#ABF600]/5 border border-[#ABF600]/20 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-[#ABF600] font-bold">
              <span>Attestation Pipeline Active</span>
              <span>Step {step} of 4</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ABF600] to-emerald-400 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
            <div className="text-[11px] text-white/70 flex items-center gap-2">
              {step === 1 && '📦 1. Encoding RLP packet routing receipts from Grass L2...'}
              {step === 2 && '🔐 2. Computing Merkle Patricia Trie root & state inclusion...'}
              {step === 3 && '⚡ 3. Simulated precompile 0x0FD2 call (local — no on-chain execution)...'}
              {step === 4 && '🎯 4. Simulated verification complete! Updating local Creditcoin Trust Score (CTS)...'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={attesting}
            className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/80 font-mono text-xs transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleVerifyOnCreditcoin}
            disabled={attesting}
            className="flex-2 py-3 px-5 rounded-xl bg-gradient-to-r from-[#ABF600] to-emerald-400 hover:opacity-95 text-black font-extrabold font-mono text-xs shadow-lg shadow-[#ABF600]/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {attesting ? (
              <>
                <ShieldCheck className="w-4 h-4 animate-spin text-black" />
                Verifying via Attestcoin...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                Verify on Creditcoin (+35 CTS)
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GrassAttestationModal;
