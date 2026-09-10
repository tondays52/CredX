import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  ShieldAlert,
  Radio,
  Zap,
  Lock,
  Flame,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sliders,
  AlertTriangle,
  ArrowRight,
  Fingerprint
} from 'lucide-react';

interface DeadswitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonitoredCovenant {
  id: string;
  sourceChain: string;
  asset: string;
  borrower: string;
  pledgedCollateral: string;
  healthFactor: number;
  deadswitchArmed: boolean;
  covenantStatus: 'HEALTHY' | 'WARNING' | 'BREACHED';
  lastAttestedBlock: number;
  rule: string;
}

export const DeadswitchModal: React.FC<DeadswitchModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [simulating, setSimulating] = useState(false);
  const [selectedCovenantId, setSelectedCovenantId] = useState<string>('COV-ETH-9921');

  const [covenants, setCovenants] = useState<MonitoredCovenant[]>([
    {
      id: 'COV-ETH-9921',
      sourceChain: 'Ethereum Mainnet (Chain 1)',
      asset: 'stETH / Aave v3 Collateral',
      borrower: '0x9afB...8f07 (Your Wallet)',
      pledgedCollateral: '$75,000 stETH (Vault 0x8a1c...)',
      healthFactor: 1.84,
      deadswitchArmed: true,
      covenantStatus: 'HEALTHY',
      lastAttestedBlock: 21094320,
      rule: 'Auto-freeze Creditcoin credit line if stETH collateral withdrawal receipt is attested via 0x0FD2',
    },
    {
      id: 'COV-BASE-4018',
      sourceChain: 'Base L2 (Chain 8453)',
      asset: 'Aerodrome LP Positions',
      borrower: '0x43b1...e912',
      pledgedCollateral: '$32,500 USDbC-ETH LP',
      healthFactor: 1.42,
      deadswitchArmed: true,
      covenantStatus: 'HEALTHY',
      lastAttestedBlock: 19842104,
      rule: 'Trigger 2-hour grace period if LP unbonded on Base before Creditcoin cUSD debt repayment',
    },
    {
      id: 'COV-ARB-1102',
      sourceChain: 'Arbitrum One (Chain 42161)',
      asset: 'Camelot V3 Yield Vault',
      borrower: '0x71aa...b420',
      pledgedCollateral: '$110,000 WBTC',
      healthFactor: 2.15,
      deadswitchArmed: true,
      covenantStatus: 'HEALTHY',
      lastAttestedBlock: 25184910,
      rule: 'Enforce maximum cross-chain debt-to-income threshold (DTI <= 45%) across Arbitrum & Creditcoin',
    },
  ]);

  const activeCovenant = covenants.find((c) => c.id === selectedCovenantId) || covenants[0];

  const handleSimulateWithdrawalEvent = () => {
    setSimulating(true);
    addToast('info', 'Simulating Source Chain Event', 'Broadcasting unapproved collateral withdrawal on Ethereum Sepolia...');

    setTimeout(() => {
      // Update state to breached
      setCovenants((prev) =>
        prev.map((c) =>
          c.id === selectedCovenantId
            ? {
                ...c,
                covenantStatus: 'BREACHED',
                healthFactor: 0.82,
                lastAttestedBlock: c.lastAttestedBlock + 1,
              }
            : c
        )
      );
      setSimulating(false);
      addToast(
        'error',
        '🚨 Deadswitch Triggered via 0x0FD2',
        'Cross-chain receipt verified: Collateral moved on Ethereum! Creditcoin credit line frozen and 1-hour grace liquidation started.'
      );
    }, 1800);
  };

  const handleResetCovenant = () => {
    setCovenants((prev) =>
      prev.map((c) =>
        c.id === selectedCovenantId
          ? {
              ...c,
              covenantStatus: 'HEALTHY',
              healthFactor: 1.84,
              lastAttestedBlock: c.lastAttestedBlock + 12,
            }
          : c
      )
    );
    addToast('success', 'Covenant Restored', 'Collateral state re-attested and credit facilities unlocked.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cross-Chain Deadswitch & Autonomous Covenant Guard" maxWidth="max-w-3xl">
      <div className="space-y-5 text-xs text-white/80 font-sans">
        {/* Top Explainer Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/30 via-slate-900/60 to-orange-950/30 border border-red-500/20 backdrop-blur-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>Zero-Bridge Collateral Deadswitch & Covenant Enforcement</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono text-[10px] border border-red-500/30">
                PATENT PENDING USC PRECOMPILE
              </span>
            </div>
            <p className="text-white/60 leading-relaxed text-[11px]">
              Solves the #1 systemic risk in cross-chain lending: <em>"What if the borrower flees or drains their collateral on Ethereum?"</em> CredX monitors external Merkle state via Creditcoin’s <code className="text-cyan-300 font-mono">0x0FD2</code> precompile. If pledged source collateral leaves the verified address or breaches covenant thresholds, the position self-liquidates without requiring centralized oracles or vulnerable multi-sig bridges.
            </p>
          </div>
        </div>

        {/* Covenant Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {covenants.map((cov) => {
            const isSelected = cov.id === selectedCovenantId;
            const isBreached = cov.covenantStatus === 'BREACHED';
            return (
              <div
                key={cov.id}
                onClick={() => setSelectedCovenantId(cov.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? isBreached
                      ? 'bg-red-500/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                      : 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-white/50">{cov.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                      isBreached
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {cov.covenantStatus}
                  </span>
                </div>
                <div className="font-bold text-white text-xs truncate">{cov.asset}</div>
                <div className="text-[10px] text-white/40 truncate">{cov.sourceChain}</div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.06] font-mono">
                  <span className="text-white/40">Health:</span>
                  <span className={cov.healthFactor < 1.0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {cov.healthFactor.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deep Dive Panel on Selected Covenant */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                Active Policy & Safeguard Rule
              </span>
              <h4 className="font-bold text-white text-xs mt-0.5">{activeCovenant.rule}</h4>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-white/40">Armed Status:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-ping" /> ARMED & ACTIVE
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-white/40 text-[10px] uppercase block">Pledged Source Collateral</span>
              <span className="text-white font-semibold">{activeCovenant.pledgedCollateral}</span>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-white/40 text-[10px] uppercase block">Attested Source Block</span>
              <span className="text-cyan-300 font-semibold">#{activeCovenant.lastAttestedBlock.toLocaleString()}</span>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-white/40 text-[10px] uppercase block">Consensus Enforcement</span>
              <span className="text-emerald-400 font-semibold">0x0FD2 Precompile (USC)</span>
            </div>
          </div>

          {/* Action Simulation Box */}
          <div className="pt-2">
            {activeCovenant.covenantStatus === 'BREACHED' ? (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>Covenant Breach Detected on Ethereum! Self-Liquidation Protocol In Effect</span>
                </div>
                <p className="text-[11px] text-white/70">
                  Credit line has been defensively frozen. Borrower has <strong>58 minutes remaining</strong> in grace-period to restore collateral balance before programmatic liquidation executes on Creditcoin.
                </p>
                <div className="pt-1 flex justify-end gap-2">
                  <button
                    onClick={handleResetCovenant}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Re-Attest & Restore Covenant
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-[11px] text-white/60">
                  Test the anti-default mechanism by simulating an unapproved collateral drain on Ethereum Mainnet.
                </div>
                <button
                  onClick={handleSimulateWithdrawalEvent}
                  disabled={simulating}
                  className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-300 font-semibold text-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Flame className="w-3.5 h-3.5" />
                  {simulating ? 'Ingesting 0x0FD2 Proof...' : 'Simulate Ethereum Collateral Drain'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Architecture Flow Diagram */}
        <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.06] text-[11px] font-mono text-white/60 space-y-2">
          <div className="text-white/40 uppercase text-[10px] font-bold">Execution Mechanics:</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-[10px]">
            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.06]">
              1. Pledged Vault on Ethereum
            </div>
            <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              2. 0x0FD2 State Receipt Prover
            </div>
            <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
              3. Dynamic Covenant Engine
            </div>
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-300">
              4. Auto-Freeze / Grace Liquidation
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeadswitchModal;
