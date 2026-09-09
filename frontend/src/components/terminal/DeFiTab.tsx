import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  Zap,
  Landmark,
  ArrowLeftRight,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Coins,
  Percent,
  Layers,
  Activity,
  Flame,
  CheckCircle2,
  DollarSign,
  ArrowDownUp,
  ArrowRight,
  Radio,
  BarChart3,
  Waves,
  Sliders,
  Award
} from 'lucide-react';
import FlashLoanModal from '../modals/FlashLoanModal';
import YieldVaultModal from '../modals/YieldVaultModal';
import AMMSwapModal from '../modals/AMMSwapModal';
import FarmHarvestModal from '../modals/FarmHarvestModal';
import PerpsTerminal from './PerpsTerminal';
import YieldVaultsView from './YieldVaultsView';
import LiquidStakingView from './LiquidStakingView';
import FlashLoanView from './FlashLoanView';
import DexAmmView from './DexAmmView';

export const DeFiTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score, tier, boostScore } = useProtocol();
  const { showToast, playSound } = useToast();

  // Active Sub-Tab
  const [activeDeFiTab, setActiveDeFiTab] = useState<'swap' | 'vaults' | 'liquid-staking' | 'flash-loan' | 'perps'>('swap');

  // Modals state
  const [flashLoanOpen, setFlashLoanOpen] = useState(false);
  const [yieldVaultOpen, setYieldVaultOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [farmOpen, setFarmOpen] = useState(false);

  // Session Points Tracking
  const [accumulatedPoints, setAccumulatedPoints] = useState<number>(140);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const CTC_PRICE = 2.08;
  const userWalletUSD = (userWalletCTC * CTC_PRICE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 animate-fade-in text-slate-200">
      {/* ═══════════════════════════════════════════════════════════════
          1. Live Wallet & OCCR Multiplier Banner with Points Accumulation
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-r from-[#03151c] via-[#04202b] to-[#021016] border border-cyan-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                DEFI REPUTATIONAL HUB &bull; CREDITCOIN L1
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                Chain ID 102031
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Trade, Stake &amp; Yield with Verified Credit Reputation
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100/70 max-w-2xl leading-relaxed">
              Every trade and liquidity action accumulates verified CTS points in real-time. Enjoy discounted 0.05% swap fees, 2.0x vault boosts, and pro perpetuals.
            </p>
          </div>

          {/* Wallet Live Balance & CTS Points Badge */}
          <div className="w-full lg:w-auto p-4 rounded-2xl bg-black/60 border border-cyan-500/30 backdrop-blur-xl shrink-0 flex flex-col sm:flex-row items-center gap-5">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-[10px] uppercase font-mono text-cyan-400/70">Connected Wallet Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-white">
                  {userWalletCTC.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-cyan-300 font-mono">CTC</span>
              </div>
              <div className="text-[11px] text-teal-300/80 font-mono">
                &asymp; ${userWalletUSD} USD
              </div>
            </div>

            <div className="h-10 w-[1px] bg-cyan-500/20 hidden sm:block" />

            <div className="space-y-1 text-center sm:text-right">
              <span className="text-[10px] uppercase font-mono text-cyan-400/70">Reputation &amp; Points</span>
              <div className="flex items-center gap-1.5 justify-center sm:justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="text-sm font-bold text-white">{tier}</span>
                <span className="text-xs font-mono text-cyan-300">({score} CTS)</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center justify-center sm:justify-end gap-1">
                <Award className="w-3 h-3 text-amber-400" />
                +{accumulatedPoints} Session Points Earned
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. Primary Sub-Navigation Tabs
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#020e14] border border-cyan-500/20 max-w-fit">
        {[
          { id: 'swap', label: 'DEX AMM Swap', icon: ArrowLeftRight },
          { id: 'vaults', label: 'Yield Vaults & AI Autopilot (34.8%)', icon: Landmark },
          { id: 'liquid-staking', label: 'Liquid Staking (stCTC)', icon: Coins },
          { id: 'flash-loan', label: '0-Collateral Flash Loans', icon: Zap },
          { id: 'perps', label: 'Perpetual', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeDeFiTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveDeFiTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-md shadow-cyan-500/25 font-black'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. Sub-Tab Content Rendering
         ═══════════════════════════════════════════════════════════════ */}

      {/* Tab 1: DEX AMM Swap */}
      {activeDeFiTab === 'swap' && <DexAmmView />}

      {/* Tab 2: OCCR Boosted Yield Vaults */}
      {activeDeFiTab === 'vaults' && <YieldVaultsView />}

      {/* Tab 3: Liquid Staking (stCTC) */}
      {activeDeFiTab === 'liquid-staking' && <LiquidStakingView />}

      {/* Tab 4: 0-Collateral Flash Loans */}
      {activeDeFiTab === 'flash-loan' && <FlashLoanView />}

      {/* Tab 5: Perpetual */}
      {activeDeFiTab === 'perps' && <PerpsTerminal />}

      {/* Modals */}
      <FlashLoanModal isOpen={flashLoanOpen} onClose={() => setFlashLoanOpen(false)} />
      <YieldVaultModal isOpen={yieldVaultOpen} onClose={() => setYieldVaultOpen(false)} />
      <AMMSwapModal isOpen={swapOpen} onClose={() => setSwapOpen(false)} />
      <FarmHarvestModal isOpen={farmOpen} onClose={() => setFarmOpen(false)} />
    </div>
  );
};

export default DeFiTab;
