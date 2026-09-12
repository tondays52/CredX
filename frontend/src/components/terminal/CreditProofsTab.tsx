import React, { useState } from 'react';
import LendingTab from './LendingTab';
import ProofVerifierTab from './ProofVerifierTab';
import RiskGuardView from './RiskGuardView';
import CovenantOpsFeed from './CovenantOpsFeed';
import PurposeFundView from './PurposeFundView';
import MeterTrackingView from './MeterTrackingView';
import VerifiedEscrowView from './VerifiedEscrowView';
import EvidenceRegistryView from './EvidenceRegistryView';
import SimulationBadge from '../common/SimulationBadge';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { Landmark, FileCheck, ShieldCheck, ShieldHalf, Activity, Anchor, Gauge, Vault, ScrollText } from 'lucide-react';

type CreditProofsSection = 'credit' | 'proofs' | 'risk' | 'ops' | 'purpose' | 'meter' | 'escrow' | 'registry';

const CreditProofsTab: React.FC = () => {
  const { isConnected } = useWeb3();
  const { dataSource } = useProtocol();
  const [section, setSection] = useState<CreditProofsSection>('credit');

  const sections: { id: CreditProofsSection; label: string; icon: React.FC<{ className?: string }>; desc: string }[] = [
    { id: 'credit', label: 'Credit Facility', icon: Landmark, desc: 'Undercollateralized OCCR borrowing — borrow, settle and inspect covenants against the live pool.' },
    { id: 'proofs', label: 'Proofs & Attest', icon: FileCheck, desc: 'Submit cross-chain Merkle/continuity receipts to CredXHub and recompute your on-chain CTS.' },
    { id: 'risk', label: 'RiskGuard Gate', icon: ShieldHalf, desc: 'Verify-then-execute policy engine — the agent proposes, the deterministic contract decides after 0x0FD2 verification.' },
    { id: 'ops', label: 'Covenant Ops', icon: Activity, desc: 'Live oracle telemetry and collateral-liveness/covenant feed — new credit closes the instant an attested breach is proven.' },
    { id: 'purpose', label: 'Purpose-Bound RWA', icon: Anchor, desc: 'Purpose-bound funding vault — money is locked to a declared purpose until attested receipts unlock borrower tranches.' },
    { id: 'meter', label: 'Usage Meters', icon: Gauge, desc: 'Metered accountable usage — attested increments, fail-closed caps, prepaid-first settlement and on-chain debt.' },
    { id: 'escrow', label: 'Verified Escrow', icon: Vault, desc: 'Condition-locked escrow — pays the seller only on a verified proof; replay-guarded, deadline-refundable.' },
    { id: 'registry', label: 'Evidence Registry', icon: ScrollText, desc: 'Recoverable proof ledger — oracle anchors, escrow releases and metered usage, queryable via eth_getLogs.' },
  ];

  return (
    <div className="space-y-6">
      {/* Merged-sector header with sub-toggle */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/70 via-cyan-950/30 to-slate-900/70 border border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Credit & Proofs
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-normal">
                {dataSource === 'chain' ? 'LIVE ON-CHAIN' : 'DEMO'}
              </span>
              {!isConnected && (
                <SimulationBadge label="NOT CONNECTED" note="Connect a wallet to borrow/repay and submit proofs on Creditcoin testnet." />
              )}
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Borrowing, settling and proof submission all read/write the deployed CredXHub + lending pool when a wallet is connected.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const active = section === sec.id;
            return (
              <div key={sec.id} className="flex-1 min-w-[220px]">
                <button
                  onClick={() => setSection(sec.id)}
                  className={`flex flex-col items-start gap-1 w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-white/40'}`} />
                    {sec.label}
                  </span>
                  <span className="text-[10px] font-normal text-white/40 leading-snug">{sec.desc}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active sector */}
      {section === 'credit' && <LendingTab />}
      {section === 'proofs' && <ProofVerifierTab />}
      {section === 'risk' && <RiskGuardView />}
      {section === 'ops' && <CovenantOpsFeed />}
      {section === 'purpose' && <PurposeFundView />}
      {section === 'meter' && <MeterTrackingView />}
      {section === 'escrow' && <VerifiedEscrowView />}
      {section === 'registry' && <EvidenceRegistryView />}
    </div>
  );
};

export default CreditProofsTab;