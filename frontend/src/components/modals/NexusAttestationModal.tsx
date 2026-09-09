import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Radio, ShieldCheck, Database, Cpu, Sparkles, MapPin, Layers } from 'lucide-react';
import { useProtocol } from '../../context/ProtocolContext';

interface NexusAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NexusAttestationModal: React.FC<NexusAttestationModalProps> = ({ isOpen, onClose }) => {
  const { 
    nexusClaimableTokens, 
    nexusTotalBeacons, 
    nexusH3Hex, 
    nexusRealGeo, 
    nexusUncommittedPackets, 
    attestNexusBatch 
  } = useProtocol();

  const [attesting, setAttesting] = useState(false);
  const [step, setStep] = useState<number>(0);

  const handleVerifyOnCreditcoin = async () => {
    setAttesting(true);
    setStep(1);

    setTimeout(() => setStep(2), 600);
    setTimeout(() => setStep(3), 1200);
    setTimeout(async () => {
      setStep(4);
      await attestNexusBatch();
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
      title="CredX Nexus Proximity Attestation"
      subtitle="Creditcoin Attestcoin Protocol (USC Precompile 0x0FD2)"
      maxWidth="max-w-xl"
      icon={
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
          <Radio className="w-4 h-4" />
        </div>
      }
    >
      <div className="space-y-5 font-sans">
        {/* Banner with Mint / Emerald accents matching Nodle design */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#0B0F17] to-cyan-950/20 border border-emerald-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Proof of Proximity™ (PoP) Batch Ready
              </span>
            </div>
            <p className="text-xs text-white/70">
              Anchoring physical BLE witness packets to Creditcoin L1 to prove real-world hardware presence and eliminate sybil farms.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Estimated CTS Boost</span>
            <span className="text-lg font-black font-mono text-emerald-400">+25 Points</span>
          </div>
        </div>

        {/* Cryptographic Attestation Metadata */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-cyan-400" /> Source Data Layer</span>
            <span className="text-white font-bold">CredX Nexus BLE Edge Mesh</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> Creditcoin Precompile</span>
            <span className="text-emerald-400 font-bold">0x0FD2 (Attestcoin USC)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-400" /> Geospatial Anchor</span>
            <span className="text-amber-300 font-bold">{nexusRealGeo?.city || 'Dhaka'}, {nexusRealGeo?.country || 'Bangladesh'} ({nexusRealGeo?.lat?.toFixed(2)}° N, {nexusRealGeo?.lng?.toFixed(2)}° E)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-purple-400" /> Spatial H3 Hex Index</span>
            <span className="text-purple-300 font-bold">{nexusH3Hex} (Res 8)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span>Uncommitted Packets in Batch</span>
            <span className="text-cyan-300 font-bold">{nexusUncommittedPackets} Packets</span>
          </div>
          <div className="flex items-center justify-between text-white/60">
            <span>Claimable NEXUS Reward</span>
            <span className="text-white font-bold">{nexusClaimableTokens.toFixed(4)} NEXUS</span>
          </div>
        </div>

        {/* Multi-Step Proof Verification Pipeline */}
        {attesting && (
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span>Attestation Pipeline Active</span>
              <span>Step {step} of 4</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
            <div className="text-[11px] text-white/60">
              {step === 1 && '1. Computing SHA-256 Merkle leaves for witnessed BLE packets...'}
              {step === 2 && '2. Generating binary Merkle Root & RF path-loss integrity proof...'}
              {step === 3 && '3. Submitting batch root to Creditcoin L1 precompile 0x0FD2...'}
              {step === 4 && '4. Attestation finalized! Creditcoin Trust Score (CTS) updated.'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={attesting}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.04] transition text-xs font-mono disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleVerifyOnCreditcoin}
            disabled={attesting || nexusUncommittedPackets === 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs hover:brightness-110 active:scale-98 transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {attesting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Verifying on Creditcoin...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Attest Batch to Creditcoin (+25 CTS)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
