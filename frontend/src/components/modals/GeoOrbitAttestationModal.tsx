import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Radio, ShieldCheck, Database, Cpu, Sparkles, MapPin, Layers, Satellite, Zap } from 'lucide-react';
import { useProtocol } from '../../context/ProtocolContext';

interface GeoOrbitAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeoOrbitAttestationModal: React.FC<GeoOrbitAttestationModalProps> = ({ isOpen, onClose }) => {
  const {
    orbitClaimableTokens,
    orbitSatellitesLocked,
    orbitAccuracyCm,
    orbitMountpoint,
    orbitNmeaSentence,
    orbitNmeaData,
    orbitPoSTProofsCount,
    orbitLastAttestationHash,
    syncOrbitAttestation
  } = useProtocol();

  const [attesting, setAttesting] = useState(false);
  const [step, setStep] = useState<number>(0);

  const handleVerifyOnCreditcoin = async () => {
    setAttesting(true);
    setStep(1);

    setTimeout(() => setStep(2), 650);
    setTimeout(() => setStep(3), 1300);
    setTimeout(async () => {
      setStep(4);
      await syncOrbitAttestation();
      setAttesting(false);
      setTimeout(() => {
        onClose();
        setStep(0);
      }, 1200);
    }, 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CredX GeoOrbit Space-Time Attestation"
      subtitle="Decentralized RTK Proof of Space-Time (PoST) — simulated on Creditcoin L1 (0x0FD2), no wallet tx"
      maxWidth="max-w-xl"
      icon={
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
          <Satellite className="w-4 h-4" />
        </div>
      }
    >
      <div className="space-y-5 font-sans">
        {/* Banner with Geodetic Gold / Amber accents */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#0B0F17] to-cyan-950/25 border border-amber-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Centimeter-Precision PoST Batch Ready
              </span>
            </div>
            <p className="text-xs text-white/70">
              Anchoring triple-band carrier phase double-differencing observations to Creditcoin L1 precompile to verify real geographic physical presence and eliminate location spoofing.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-mono text-white/40 block">Reputation Gain</span>
            <span className="text-lg font-black font-mono text-amber-400">+50 CTS</span>
          </div>
        </div>

        {/* Cryptographic Attestation Metadata */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-amber-400" /> Geodetic Network</span>
            <span className="text-white font-bold">CredX GeoOrbit CORS RTK Mesh</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-cyan-400" /> Creditcoin Attest Precompile</span>
            <span className="text-cyan-400 font-bold">0x0FD2 (Attestcoin Universal Smart Contract)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> Carrier Ambiguity State</span>
            <span className="text-emerald-300 font-bold">RTK Fixed ({orbitAccuracyCm.toFixed(1)} cm Precision)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Satellite className="w-3.5 h-3.5 text-blue-400" /> Multi-Constellation Lock</span>
            <span className="text-blue-300 font-bold">{orbitSatellitesLocked} Sats (GPS / GAL / BDS / GLO)</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-purple-400" /> NTRIP Caster Stream</span>
            <span className="text-purple-300 font-bold">mountpoint: {orbitMountpoint}:2101</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] text-white/60">
            <span>Cumulative PoST Proofs</span>
            <span className="text-amber-300 font-bold">{orbitPoSTProofsCount} Proofs Anchored</span>
          </div>
          <div className="flex items-center justify-between text-white/60">
            <span>Claimable Mining Rewards</span>
            <span className="text-white font-bold">{orbitClaimableTokens.toFixed(2)} ORBIT</span>
          </div>
        </div>

        {/* Live NMEA GGA Raw String Telemetry */}
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/40 uppercase">
            <span>Raw NMEA-0183 Carrier String</span>
            <span className="text-emerald-400">GGA Quality = 4 (RTK Fix)</span>
          </div>
          <p className="text-white/80 break-all select-all">{orbitNmeaSentence}</p>
        </div>

        {/* Progress Pipeline */}
        {attesting && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-amber-400 font-bold">
              <span>Attestation Pipeline Status</span>
              <span>Step {step} / 4</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
            <p className="text-white/60 text-[11px]">
              {step === 1 && '1. Computing double-differenced carrier phase residual hash...'}
              {step === 2 && '2. Verifying RTCM 3.2 MSM7 RTK stream over NTRIP TCP port 2101...'}
              {step === 3 && '3. Generating Proof of Space-Time (PoST) signature...'}
              {step === 4 && '4. Simulated call to Creditcoin Precompile 0x0FD2 (local — no on-chain execution)...'}
            </p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleVerifyOnCreditcoin}
          disabled={attesting}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold font-mono text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {attesting ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Anchoring Space-Time Proof to 0x0FD2 (simulated)...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-black" />
              Attest RTK Observation to Creditcoin L1 (+50 CTS)
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
export default GeoOrbitAttestationModal;
