import React, { useState, useEffect } from 'react';
import OverviewTab from '../components/terminal/OverviewTab';
import DeFiTab from '../components/terminal/DeFiTab';
import DePINTab from '../components/terminal/DePINTab';
import GamingTab from '../components/terminal/GamingTab';
import AITab from '../components/terminal/AITab';
import RWATab from '../components/terminal/RWATab';
import VirtualNodeTab from '../components/terminal/VirtualNodeTab';
import CreditProofsTab from '../components/terminal/CreditProofsTab';
import SimulationBadge from '../components/common/SimulationBadge';
import { useWeb3 } from '../context/Web3Context';
import { useProtocol } from '../context/ProtocolContext';
import {
  LayoutDashboard,
  Zap,
  Server,
  Gamepad2,
  Bot,
  Building2,
  Cpu,
  Landmark,
} from 'lucide-react';

type TerminalTab =
  | 'overview'
  | 'defi'
  | 'depin'
  | 'gaming'
  | 'ai'
  | 'rwa'
  | 'node'
  | 'lending';

const TerminalPage: React.FC = () => {
  const { isConnected } = useWeb3();
  const { dataSource } = useProtocol();

  const getInitialTab = (): TerminalTab => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('depin') || hash.includes('pulse') || hash.includes('nexus') || hash.includes('nodle')) {
      return 'depin';
    }
    if (hash.includes('defi')) return 'defi';
    if (hash.includes('gaming')) return 'gaming';
    if (hash.includes('ai')) return 'ai';
    if (hash.includes('rwa')) return 'rwa';
    if (hash.includes('lending')) return 'lending';
    if (hash.includes('proof')) return 'lending';
    return 'overview'; // Default to Overview - live credit profile, the judge-facing dashboard
  };

  const [activeTab, setActiveTab] = useState<TerminalTab>(getInitialTab);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('depin') || hash.includes('pulse') || hash.includes('nexus') || hash.includes('nodle')) {
        setActiveTab('depin');
      } else if (hash.includes('defi')) setActiveTab('defi');
      else if (hash.includes('gaming')) setActiveTab('gaming');
      else if (hash.includes('ai')) setActiveTab('ai');
      else if (hash.includes('rwa')) setActiveTab('rwa');
      else if (hash.includes('lending')) setActiveTab('lending');
      else if (hash.includes('node')) setActiveTab('node');
      else if (hash.includes('proof') || hash.includes('attest')) setActiveTab('lending');
      else if (hash.includes('overview') || hash.includes('sbt')) setActiveTab('overview');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const tabs: { id: TerminalTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'depin', label: 'DePIN Infra', icon: Server },
    { id: 'defi', label: 'DeFi Hub', icon: Zap },
    { id: 'gaming', label: 'Gaming Guild', icon: Gamepad2 },
    { id: 'ai', label: 'AI Risk Vectors', icon: Bot },
    { id: 'rwa', label: 'RWA Treasuries', icon: Building2 },
    { id: 'node', label: 'Virtual Node', icon: Cpu },
    { id: 'lending', label: 'Credit & Proofs', icon: Landmark },
  ];

  // Source-of-truth status per tab: "live" panels talk to Creditcoin testnet.
  const tabStatus: Record<TerminalTab, { live: boolean; note: string }> = {
    overview: { live: dataSource === 'chain', note: 'Live credit profile + loans when a wallet is connected; demo preview otherwise.' },
    defi: { live: dataSource === 'chain', note: 'AMM swaps/LP and yield-vault staking hit ReputationAMM + ReputationYieldVault when connected; perps, liquid staking and flash-loan receiver panels stay simulated.' },
    depin: { live: dataSource === 'chain', note: 'Delegation, rewards and hardware loans hit DePINInfrastructureHub when connected; Pulse/Nexus/GeoOrbit telemetry is simulated (no on-chain attestation).' },
    gaming: { live: dataSource === 'chain', note: 'WOOD/NFT balances, cooldowns and hub writes are live when connected (gather/lootbox still owner-gated on the current deployment); scholarship vault is simulated.' },
    ai: { live: true, note: 'Live interactions with the deployed AutonomousAIHub on Creditcoin testnet.' },
    rwa: { live: dataSource === 'chain', note: 'Treasury deposits/withdraws and the invoice marketplace hit live contracts when connected; PoR reserve panel stays illustrative.' },
    node: { live: false, note: 'Virtual node telemetry is local to your browser (no CTC is actually shared or earned).' },
    lending: { live: dataSource === 'chain', note: 'Credit Facility borrow/repay hit the undercollateralized lending pool; Proofs & Attest submissions write to CredXHub. RiskGuard and Covenant Ops add a verify-then-execute policy gate plus live oracle telemetry (0x0FD2/0x0FD3) with honest SIMULATED evaluation labels.' },
  };

  const activeStatus = tabStatus[activeTab];

  return (
    <div className="space-y-6 py-4">
      {/* Top Protocol Subheader & Tab Pills */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">CredX Protocol Terminal</h1>
          <p className="text-xs text-white/50 mt-0.5">
            Creditcoin L1 multi-track decentralized risk engine & uncollateralized liquidity protocol
          </p>
        </div>

        {/* Honest data-source status for the active tab */}
        <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
          activeStatus.live
            ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
            : 'border-amber-500/25 bg-amber-500/[0.04]'
        }`}>
          {activeStatus.live ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" /> LIVE ON-CHAIN
            </span>
          ) : (
            <SimulationBadge />
          )}
          <span className="text-white/50 leading-relaxed">{activeStatus.note}</span>
        </div>

        {/* Scrollable Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-white/[0.06]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  window.location.hash = `#/${tab.id}`;
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-white/40'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents Viewport */}
      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'defi' && <DeFiTab />}
        {activeTab === 'depin' && <DePINTab />}
        {activeTab === 'gaming' && <GamingTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'rwa' && <RWATab />}
        {activeTab === 'node' && <VirtualNodeTab />}
        {activeTab === 'lending' && <CreditProofsTab />}
      </div>
    </div>
  );
};

export default TerminalPage;
