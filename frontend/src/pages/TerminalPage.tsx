import React, { useState, useEffect } from 'react';
import OverviewTab from '../components/terminal/OverviewTab';
import DeFiTab from '../components/terminal/DeFiTab';
import DePINTab from '../components/terminal/DePINTab';
import GamingTab from '../components/terminal/GamingTab';
import AITab from '../components/terminal/AITab';
import RWATab from '../components/terminal/RWATab';
import VirtualNodeTab from '../components/terminal/VirtualNodeTab';
import SBTPassportTab from '../components/terminal/SBTPassportTab';
import LendingTab from '../components/terminal/LendingTab';
import ProofVerifierTab from '../components/terminal/ProofVerifierTab';
import {
  LayoutDashboard,
  Zap,
  Server,
  Gamepad2,
  Bot,
  Building2,
  Cpu,
  Shield,
  Landmark,
  FileCheck,
} from 'lucide-react';

type TerminalTab =
  | 'overview'
  | 'defi'
  | 'depin'
  | 'gaming'
  | 'ai'
  | 'rwa'
  | 'node'
  | 'sbt'
  | 'lending'
  | 'proof';

const TerminalPage: React.FC = () => {
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
    if (hash.includes('sbt')) return 'sbt';
    if (hash.includes('proof')) return 'proof';
    return 'depin'; // Default directly to DePIN for focused experience
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
      else if (hash.includes('sbt')) setActiveTab('sbt');
      else if (hash.includes('node')) setActiveTab('node');
      else if (hash.includes('proof')) setActiveTab('proof');
      else if (hash.includes('overview')) setActiveTab('overview');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const tabs: { id: TerminalTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'depin', label: 'DePIN Infra', icon: Server },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'defi', label: 'DeFi Hub', icon: Zap },
    { id: 'gaming', label: 'Gaming Guild', icon: Gamepad2 },
    { id: 'ai', label: 'AI Risk Vectors', icon: Bot },
    { id: 'rwa', label: 'RWA Treasuries', icon: Building2 },
    { id: 'node', label: 'Virtual Node', icon: Cpu },
    { id: 'sbt', label: 'SBT Passport', icon: Shield },
    { id: 'lending', label: 'Credit Facility', icon: Landmark },
    { id: 'proof', label: '0x0FD2 Proofs', icon: FileCheck },
  ];

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
        {activeTab === 'sbt' && <SBTPassportTab />}
        {activeTab === 'lending' && <LendingTab />}
        {activeTab === 'proof' && <ProofVerifierTab />}
      </div>
    </div>
  );
};

export default TerminalPage;
